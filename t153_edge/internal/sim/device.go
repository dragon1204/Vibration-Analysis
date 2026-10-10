package sim

import (
	"math"
	"sync"
	"time"

	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/dsp"
)

// Slave is anything answering Modbus requests at an address.
type Slave interface {
	Addr() byte
	// Handle processes a validated request frame (without CRC) and returns the
	// response frame (without CRC), or nil for no answer.
	Handle(req []byte) []byte
}

// WTVB is a simulated WTVB05.
type WTVB struct {
	mu        sync.Mutex
	addr      byte
	regs      map[uint16]uint16
	sig       *Signal
	start     time.Time
	unlocked  time.Time
	lastRaw   time.Time
	rawT      float64 // signal time of next raw frame (contiguous mode)
	Contig    bool    // emulate gap-free FIFO
	cache     time.Time
	cacheRegs map[uint16]uint16
	tempBase  float64
	// SRNeedsSave emulates firmware that only applies SR after save (ADR-04 test).
	SRNeedsSave bool
	pendingSR   *uint16
	FlashWrites int
}

// NewWTVB creates a simulated sensor.
func NewWTVB(addr byte, f1x float64, scenario string, seed int64) *WTVB {
	d := &WTVB{addr: addr, sig: NewSignal(f1x, scenario, seed), start: time.Now(), tempBase: 38 + float64(addr%7)}
	d.regs = map[uint16]uint16{
		wtvb05.RegBaud: 0x07, wtvb05.RegMode: 0, wtvb05.RegAddr: uint16(addr), wtvb05.RegSR: 0x04,
		wtvb05.RegDRM: 1, wtvb05.RegVersion: 0x0108, wtvb05.RegStatic: 100,
	}
	return d
}

// Addr implements Slave.
func (d *WTVB) Addr() byte { return d.addr }

// Signal returns the generator (to tune scenario/mesh).
func (d *WTVB) Signal() *Signal { return d.sig }

// SetScenario changes the scenario at runtime.
func (d *WTVB) SetScenario(name string) {
	d.mu.Lock()
	d.sig.Scenario = name
	d.cache = time.Time{}
	d.mu.Unlock()
}

// Scenario returns the current scenario.
func (d *WTVB) Scenario() string {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.sig.Scenario
}

func (d *WTVB) fs() float64 { return wtvb05.SampleRates[uint8(d.regs[wtvb05.RegSR])] }

func i16(v float64) uint16 {
	v = math.Round(v)
	v = math.Max(-32768, math.Min(32767, v))
	return uint16(int16(v))
}

// computed returns indicator registers 0x34..0x9A computed from 1 s of signal.
func (d *WTVB) computed(now time.Time) map[uint16]uint16 {
	if now.Sub(d.cache) < time.Second && d.cacheRegs != nil {
		return d.cacheRegs
	}
	const fs, n = 4096.0, 4096
	t := now.Sub(d.start).Seconds()
	x := d.sig.Sample(fs, n, t)
	r := map[uint16]uint16{}
	for a := 0; a < 3; a++ {
		ax := uint16(a)
		g := make([]float64, n)
		for i, v := range x[a] {
			g[i] = v / g0
		}
		st := dsp.ComputeTimeStats(g)
		mean := dsp.Mean(g)
		sp := dsp.ComputeSpectrum(x[a], fs)
		vrms := sp.BandRMSVel(10, 1000)
		// Displacement RMS (mm) from PSD.
		dsum := 0.0
		for k := 1; k < len(sp.PSD); k++ {
			f := sp.Freq(k)
			if f >= 10 && f <= 1000 {
				w := 2 * math.Pi * f
				dsum += sp.PSD[k] / (w * w * w * w)
			}
		}
		drms := math.Sqrt(dsum*sp.Df) * 1000
		dom := dsp.DominantPeak(sp, 5, 1000, nil, 0)
		absMean := 0.0
		for _, v := range g {
			absMean += math.Abs(v - mean)
		}
		absMean /= float64(n)
		r[0x34+ax] = i16(g[n-1] / wtvb05.AccLSB)
		r[0x37+ax] = i16(st.Peak / wtvb05.AccLSB)
		r[0x3A+ax] = i16(vrms * 100)
		r[0x41+ax] = i16(drms * 1000 * 2 * math.Sqrt2) // peak-to-peak µm
		r[0x44+ax] = i16(dom.FreqHz * 10)
		base := uint16(0x47) + ax*12
		vals := []float64{st.Crest, st.Kurtosis, absMean, st.Std * st.Std, st.RMS,
			safeDiv(st.RMS, absMean), safeDiv(st.Peak, st.RMS), safeDiv(st.Peak, absMean), st.Skew,
			vrms, 3.0, drms}
		for i, v := range vals {
			r[base+uint16(i)] = i16(v * 1000)
		}
		r[0x6B+ax] = 0
		eb := uint16(0x6E) + ax*15
		for i, k := range []float64{0.25, 0.5, 1, 2, 3, 4, 5, 6} {
			fk := k * d.sig.F1x
			r[eb+uint16(i)] = uint16(math.Min(65535, dsp.OrderAmpAcc(sp, fk)*1000))
		}
		edges := []float64{0, 0.5, 1, 2, 3, 4, 5}
		for i := 0; i < 6; i++ {
			r[eb+8+uint16(i)] = uint16(math.Min(65535, sp.BandRMSAcc(edges[i]*d.sig.F1x, edges[i+1]*d.sig.F1x)*1000))
		}
		r[eb+14] = uint16(math.Min(65535, sp.BandRMSAcc(1, 2000)*1000))
	}
	temp := d.tempBase + 0.2*math.Sin(t/60)
	if d.sig.Scenario == BearingOuter {
		temp += 15
	}
	r[0x40] = i16(temp * 100)
	d.cache, d.cacheRegs = now, r
	return r
}

func safeDiv(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

// Handle implements Slave.
func (d *WTVB) Handle(req []byte) []byte {
	d.mu.Lock()
	defer d.mu.Unlock()
	now := time.Now()
	fn := req[1]
	addr := uint16(req[2])<<8 | uint16(req[3])
	val := uint16(req[4])<<8 | uint16(req[5])
	switch fn {
	case 0x03:
		if addr == wtvb05.RegRawFIFO {
			return d.rawFIFO(now)
		}
		if val == 0 || val > 125 {
			return []byte{d.addr, 0x83, 0x03}
		}
		comp := d.computed(now)
		out := []byte{d.addr, 0x03, byte(val * 2)}
		for i := uint16(0); i < val; i++ {
			a := addr + i
			v, ok := comp[a]
			if !ok {
				v = d.regs[a]
			}
			out = append(out, byte(v>>8), byte(v))
		}
		return out
	case 0x06:
		echo := append([]byte(nil), req...)
		switch {
		case addr == wtvb05.RegUnlock && val == wtvb05.UnlockKey:
			d.unlocked = now
		case now.Sub(d.unlocked) > 10*time.Second:
			// Locked: the real sensor still echoes but ignores the write.
		case addr == wtvb05.RegSave:
			switch val {
			case wtvb05.SaveValue:
				d.FlashWrites++
				if d.pendingSR != nil {
					d.regs[wtvb05.RegSR] = *d.pendingSR
					d.pendingSR = nil
				}
			case wtvb05.RebootValue, wtvb05.FactoryValue:
			}
		case addr == wtvb05.RegSR && d.SRNeedsSave:
			v := val
			d.pendingSR = &v
		case addr == wtvb05.RegAddr:
			d.regs[addr] = val
			d.addr = byte(val)
		default:
			d.regs[addr] = val
			if addr == wtvb05.RegSR {
				d.lastRaw = now // FIFO restarts
			}
		}
		return echo
	}
	return []byte{d.addr, fn | 0x80, 0x01}
}

func (d *WTVB) rawFIFO(now time.Time) []byte {
	fs := d.fs()
	if d.lastRaw.IsZero() {
		d.lastRaw = now.Add(-time.Duration(1024 / fs * float64(time.Second)))
	}
	have := now.Sub(d.lastRaw).Seconds() * fs
	if have < 1024 {
		c := int(have)
		return []byte{d.addr, 0x03, 0x01, byte(c >> 8), byte(c)}
	}
	t := now.Sub(d.start).Seconds() - 1024/fs
	if d.Contig && d.rawT > 0 && t-d.rawT < 2*1024/fs {
		t = d.rawT
	}
	d.rawT = t + 1024/fs
	x := d.sig.Sample(fs, 1024, t)
	var counts [3][]int16
	for a := 0; a < 3; a++ {
		counts[a] = ToCounts(x[a])
	}
	out := make([]byte, 3, 3+6144)
	out[0], out[1], out[2] = d.addr, 0x03, 0x00
	for i := 0; i < 1024; i++ {
		for a := 0; a < 3; a++ {
			v := uint16(counts[a][i])
			out = append(out, byte(v>>8), byte(v))
		}
	}
	d.lastRaw = now
	return out
}

// PT100 is a simulated multi-channel PT100 module (holding regs 0.., temp*10).
type PT100 struct {
	addr  byte
	Temps []float64
	start time.Time
}

// NewPT100 creates a module with default channel temperatures.
func NewPT100(addr byte, temps []float64) *PT100 {
	return &PT100{addr: addr, Temps: temps, start: time.Now()}
}

// Addr implements Slave.
func (p *PT100) Addr() byte { return p.addr }

// Handle implements Slave.
func (p *PT100) Handle(req []byte) []byte {
	fn := req[1]
	addr := int(uint16(req[2])<<8 | uint16(req[3]))
	cnt := int(uint16(req[4])<<8 | uint16(req[5]))
	if fn != 0x03 && fn != 0x04 {
		return []byte{p.addr, fn | 0x80, 0x01}
	}
	t := time.Since(p.start).Seconds()
	out := []byte{p.addr, fn, byte(cnt * 2)}
	for i := 0; i < cnt; i++ {
		ch := addr + i
		v := 0.0
		if ch < len(p.Temps) {
			v = p.Temps[ch] + 0.3*math.Sin(t/120+float64(ch))
		}
		r := i16(v * 10)
		out = append(out, byte(r>>8), byte(r))
	}
	return out
}
