// Package powermeter reads 3-phase power meters over Modbus TCP using a
// configurable register map (spec 3.4, Q7). A "sim" driver generates synthetic
// readings for development without hardware.
package powermeter

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/modbus"
)

// DataType of a register value.
type DataType string

const (
	Float32   DataType = "float32"    // 2 registers, big-endian word order (ABCD)
	Float32SW DataType = "float32_sw" // 2 registers, swapped words (CDAB)
	Int16     DataType = "int16"
	Uint16    DataType = "uint16"
	Int32     DataType = "int32"
	Uint32    DataType = "uint32"
)

// Field describes one quantity in the register map.
type Field struct {
	Addr     uint16   `yaml:"addr" json:"addr"`
	Type     DataType `yaml:"type" json:"type"`
	Scale    float64  `yaml:"scale" json:"scale"`
	Function byte     `yaml:"function" json:"function"`
}

// RegisterMap maps quantity name → field. Names: u1,u2,u3,i1,i2,i3,p,q,s,pf,f,kwh,thd_u,thd_i.
type RegisterMap map[string]Field

// Maps contains built-in register maps referenced by name in edge.yaml.
var Maps = map[string]RegisterMap{
	// generic_3ph_v1: common float32 layout (Schneider PM2xxx-like, 0-based addresses).
	// [CẦN XÁC MINH] replace with the chosen meter model's map.
	"generic_3ph_v1": {
		"i1": {Addr: 2999, Type: Float32}, "i2": {Addr: 3001, Type: Float32}, "i3": {Addr: 3003, Type: Float32},
		"u1": {Addr: 3027, Type: Float32}, "u2": {Addr: 3029, Type: Float32}, "u3": {Addr: 3031, Type: Float32},
		"p": {Addr: 3059, Type: Float32}, "q": {Addr: 3067, Type: Float32}, "s": {Addr: 3075, Type: Float32},
		"pf": {Addr: 3083, Type: Float32}, "f": {Addr: 3109, Type: Float32},
		"kwh": {Addr: 2699, Type: Float32}, "thd_u": {Addr: 21329, Type: Float32}, "thd_i": {Addr: 21299, Type: Float32},
	},
}

// TCPMeter is a Modbus TCP meter.
type TCPMeter struct {
	c   *modbus.TCPClient
	m   RegisterMap
	dev string
}

// NewTCP creates a TCP meter driver.
func NewTCP(host string, port int, unit byte, regmap RegisterMap) *TCPMeter {
	addr := fmt.Sprintf("%s:%d", host, port)
	return &TCPMeter{c: modbus.NewTCPClient(addr, unit, time.Second), m: regmap, dev: addr}
}

func decode(t DataType, r []uint16) float64 {
	switch t {
	case Float32:
		return float64(math.Float32frombits(uint32(r[0])<<16 | uint32(r[1])))
	case Float32SW:
		return float64(math.Float32frombits(uint32(r[1])<<16 | uint32(r[0])))
	case Int16:
		return float64(int16(r[0]))
	case Uint16:
		return float64(r[0])
	case Int32:
		return float64(int32(uint32(r[0])<<16 | uint32(r[1])))
	case Uint32:
		return float64(uint32(r[0])<<16 | uint32(r[1]))
	}
	return math.NaN()
}

func words(t DataType) uint16 {
	if t == Int16 || t == Uint16 {
		return 1
	}
	return 2
}

// Read reads all mapped fields; missing fields are NaN.
func (m *TCPMeter) Read(ctx context.Context) (drivers.PowerReading, error) {
	vals := map[string]float64{}
	for name, f := range m.m {
		fn := f.Function
		if fn == 0 {
			fn = modbus.FuncReadHolding
		}
		r, err := m.c.Read(fn, f.Addr, words(f.Type))
		if err != nil {
			return drivers.PowerReading{}, fmt.Errorf("power meter %s field %s: %w", m.dev, name, err)
		}
		v := decode(f.Type, r)
		if f.Scale != 0 {
			v *= f.Scale
		}
		vals[name] = v
	}
	get := func(k string) float64 {
		if v, ok := vals[k]; ok {
			return v
		}
		return math.NaN()
	}
	return drivers.PowerReading{
		TS: time.Now().UTC(),
		UV: [3]float64{get("u1"), get("u2"), get("u3")}, IA: [3]float64{get("i1"), get("i2"), get("i3")},
		PkW: get("p"), QkVar: get("q"), SkVA: get("s"), PF: get("pf"), FHz: get("f"), KWh: get("kwh"),
		THDUPct: get("thd_u"), THDIPct: get("thd_i"),
	}, nil
}

// Close closes the connection.
func (m *TCPMeter) Close() error { return m.c.Close() }

// SimMeter generates plausible readings around a nominal current.
type SimMeter struct {
	mu       sync.Mutex
	nominalA float64
	voltage  float64
	kwh      float64
	last     time.Time
	rnd      *rand.Rand
}

// NewSim creates a simulated meter running at ~80% of iN.
func NewSim(iN, voltage float64) *SimMeter {
	if voltage == 0 {
		voltage = 400
	}
	return &SimMeter{nominalA: iN * 0.8, voltage: voltage, rnd: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

// Read returns a synthetic reading.
func (s *SimMeter) Read(ctx context.Context) (drivers.PowerReading, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	n := func(sd float64) float64 { return s.rnd.NormFloat64() * sd }
	i := s.nominalA * (1 + 0.01*math.Sin(float64(now.Unix())/300)) // slow load variation
	r := drivers.PowerReading{TS: now}
	for k := 0; k < 3; k++ {
		r.UV[k] = s.voltage + n(0.8)
		r.IA[k] = i*(1+0.004*float64(k-1)) + n(0.2)
	}
	r.PF = 0.9 + n(0.003)
	r.SkVA = math.Sqrt(3) * s.voltage * i / 1000
	r.PkW = r.SkVA * r.PF
	r.QkVar = math.Sqrt(math.Max(0, r.SkVA*r.SkVA-r.PkW*r.PkW))
	r.FHz = 50 + n(0.01)
	if !s.last.IsZero() {
		s.kwh += r.PkW * now.Sub(s.last).Hours()
	}
	s.last = now
	r.KWh = s.kwh
	r.THDUPct = 2 + n(0.05)
	r.THDIPct = 6 + n(0.2)
	return r, nil
}

// Close is a no-op.
func (s *SimMeter) Close() error { return nil }

// Float32Regs encodes a float32 as two big-endian registers (helper for tests/sim).
func Float32Regs(v float32) [2]uint16 {
	var b [4]byte
	binary.BigEndian.PutUint32(b[:], math.Float32bits(v))
	return [2]uint16{binary.BigEndian.Uint16(b[:2]), binary.BigEndian.Uint16(b[2:])}
}
