package wtvb05

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/modbus"
	"selink.vn/smartmotor/edge/internal/transport"
)

// Options configure one sensor.
type Options struct {
	ID   string
	Addr byte
	// VelocityScale multiplies raw VX..VZ: 0.01 for firmware > 1.7, 1.0 for <= 1.7.
	VelocityScale float64
	Timeout       time.Duration // normal register access
	RawTimeout    time.Duration // RAWFIFO transaction (>= 1.5x transfer time)
	Baud          int
}

// Sensor is a WTVB05 on an RS485 bus.
type Sensor struct {
	opt Options
	bus *bus.Manager
	log *slog.Logger

	srCode   uint8
	srKnown  bool
	mode     uint8
	firmware string
}

// New creates a driver instance.
func New(b *bus.Manager, opt Options, log *slog.Logger) *Sensor {
	if opt.VelocityScale == 0 {
		opt.VelocityScale = 0.01
	}
	if opt.Timeout == 0 {
		opt.Timeout = 150 * time.Millisecond
	}
	if opt.Baud == 0 {
		opt.Baud = 230400
	}
	minRaw := time.Duration(1.5 * float64(rawRespLen*10) / float64(opt.Baud) * float64(time.Second))
	if opt.RawTimeout < minRaw {
		opt.RawTimeout = minRaw + 50*time.Millisecond
	}
	return &Sensor{opt: opt, bus: b, log: log.With("sensor", opt.ID, "addr", fmt.Sprintf("0x%02X", opt.Addr))}
}

// ID returns the point/sensor identifier.
func (s *Sensor) ID() string { return s.opt.ID }

func (s *Sensor) readRegs(ctx context.Context, addr, count uint16) ([]uint16, error) {
	var regs []uint16
	err := s.bus.Do(ctx, s.opt.ID, func(c *modbus.RTUClient) error {
		var e error
		regs, e = c.ReadHolding(s.opt.Addr, addr, count, s.opt.Timeout)
		return e
	})
	return regs, err
}

func i16(v uint16) float64 { return float64(int16(v)) }

func nan3() [3]float64 { return [3]float64{math.NaN(), math.NaN(), math.NaN()} }

func emptyIndicators(ts time.Time) drivers.VibrationIndicators {
	n := nan3()
	return drivers.VibrationIndicators{
		TS: ts, AccG: n, AccAmp: n, VelMMs: n, DispUm: n, FreqHz: n, TempC: math.NaN(),
		CrestFactor: n, Kurtosis: n, AccAbsMeanG: n, AccVarG: n, AccRmsG: n, WaveIndex: n,
		PeakIndex: n, PulseCoef: n, Skewness: n, VelRmsMMs: n, VelKurt: n, DispRmsMm: n,
	}
}

// DecodeB1 converts block B1 registers to indicators.
func DecodeB1(r []uint16, velScale float64, ts time.Time) drivers.VibrationIndicators {
	v := emptyIndicators(ts)
	for a := 0; a < 3; a++ {
		v.AccG[a] = i16(r[b1Acc+a]) * AccLSB
		v.AccAmp[a] = i16(r[b1AccF+a]) * AccLSB // [CẦN XÁC MINH hệ số]
		v.VelMMs[a] = i16(r[b1Vel+a]) * velScale
		v.DispUm[a] = i16(r[b1Disp+a])
		v.FreqHz[a] = i16(r[b1Hz+a]) / 10
	}
	v.TempC = i16(r[b1Temp]) / 100
	return v
}

// DecodeB2 converts block B2 registers to statistics.
func DecodeB2(r []uint16, ts time.Time) drivers.VibrationIndicators {
	v := emptyIndicators(ts)
	for a := 0; a < 3; a++ {
		base := a * statPerAxis
		f := func(off int) float64 { return i16(r[base+off]) / 1000 }
		v.CrestFactor[a] = f(statCF)
		v.Kurtosis[a] = f(statK)
		v.AccAbsMeanG[a] = f(statAAVG)
		v.AccVarG[a] = f(statVAR)
		v.AccRmsG[a] = f(statRRA)
		v.WaveIndex[a] = f(statWI)
		v.PeakIndex[a] = f(statPI)
		v.PulseCoef[a] = f(statPC)
		v.Skewness[a] = f(statSK)
		v.VelRmsMMs[a] = f(statVRMS)
		v.VelKurt[a] = f(statVK)
		v.DispRmsMm[a] = f(statDRMS)
		v.ErrCode[a] = r[3*statPerAxis+a]
	}
	return v
}

// DecodeB3 converts block B3 registers (raw units, no published scale).
func DecodeB3(r []uint16, ts time.Time) drivers.SpectrumEnergy {
	e := drivers.SpectrumEnergy{TS: ts}
	for a := 0; a < 3; a++ {
		base := a * 15
		for i := 0; i < 8; i++ {
			e.Points[a][i] = float64(r[base+i])
		}
		for i := 0; i < 6; i++ {
			e.Areas[a][i] = float64(r[base+8+i])
		}
		e.Total[a] = float64(r[base+14])
	}
	return e
}

// ReadIndicators reads block B1.
func (s *Sensor) ReadIndicators(ctx context.Context) (drivers.VibrationIndicators, error) {
	r, err := s.readRegs(ctx, B1Start, B1Count)
	if err != nil {
		return drivers.VibrationIndicators{}, err
	}
	v := DecodeB1(r, s.opt.VelocityScale, time.Now().UTC())
	v.SrCode, v.Mode = s.srCode, s.mode
	return v, nil
}

// ReadStatistics reads block B2.
func (s *Sensor) ReadStatistics(ctx context.Context) (drivers.VibrationIndicators, error) {
	r, err := s.readRegs(ctx, B2Start, B2Count)
	if err != nil {
		return drivers.VibrationIndicators{}, err
	}
	v := DecodeB2(r, time.Now().UTC())
	v.SrCode, v.Mode = s.srCode, s.mode
	return v, nil
}

// ReadSpectrumEnergy reads block B3.
func (s *Sensor) ReadSpectrumEnergy(ctx context.Context) (drivers.SpectrumEnergy, error) {
	r, err := s.readRegs(ctx, B3Start, B3Count)
	if err != nil {
		return drivers.SpectrumEnergy{}, err
	}
	return DecodeB3(r, time.Now().UTC()), nil
}

// SampleRate reads the SR register (cached afterwards).
func (s *Sensor) SampleRate(ctx context.Context) (uint8, error) {
	r, err := s.readRegs(ctx, RegSR, 1)
	if err != nil {
		return 0, err
	}
	s.srCode, s.srKnown = uint8(r[0]), true
	return s.srCode, nil
}

// WriteConfig performs unlock → write → (optional save) in one bus job (spec 3.1.2).
func (s *Sensor) WriteConfig(ctx context.Context, reg, value uint16, persist bool) error {
	return s.bus.Do(ctx, s.opt.ID, func(c *modbus.RTUClient) error {
		if err := c.WriteSingle(s.opt.Addr, RegUnlock, UnlockKey, s.opt.Timeout); err != nil {
			return fmt.Errorf("unlock: %w", err)
		}
		if err := c.WriteSingle(s.opt.Addr, reg, value, s.opt.Timeout); err != nil {
			return fmt.Errorf("write 0x%02X: %w", reg, err)
		}
		if persist {
			if err := c.WriteSingle(s.opt.Addr, RegSave, SaveValue, s.opt.Timeout); err != nil {
				return fmt.Errorf("save: %w", err)
			}
		}
		return nil
	})
}

// SetSampleRate changes SR. Per ADR-04 persist should be false by default.
// Returns drivers.ErrSrNeedsPersist if the read-back shows no effect without save.
func (s *Sensor) SetSampleRate(ctx context.Context, srCode uint8, persist bool) error {
	if _, ok := SampleRates[srCode]; !ok {
		return fmt.Errorf("invalid SR code %d", srCode)
	}
	cur, err := s.SampleRate(ctx)
	if err != nil {
		return err
	}
	if cur == srCode {
		return nil
	}
	if err := s.WriteConfig(ctx, RegSR, uint16(srCode), persist); err != nil {
		return err
	}
	got, err := s.SampleRate(ctx)
	if err != nil {
		return err
	}
	if got != srCode {
		if !persist {
			return drivers.ErrSrNeedsPersist
		}
		return fmt.Errorf("SR write not applied: want %d got %d", srCode, got)
	}
	s.log.Debug("sample rate set", "sr_code", srCode, "persist", persist)
	return nil
}

// ParseRawFIFO parses a RAWFIFO response. ready=false means CNT samples are buffered.
func ParseRawFIFO(frame []byte, addr byte) (ready bool, cnt int, counts [3][]int16, err error) {
	if len(frame) < 7 || frame[0] != addr || frame[1] != modbus.FuncReadHolding {
		return false, 0, counts, modbus.ErrBadFrame
	}
	switch frame[2] {
	case 0x01:
		if len(frame) != 7 {
			return false, 0, counts, modbus.ErrBadFrame
		}
		if !modbus.CheckCRC(frame) {
			return false, 0, counts, modbus.ErrCRC
		}
		return false, int(frame[3])<<8 | int(frame[4]), counts, nil
	case 0x00:
		if len(frame) != rawRespLen {
			return false, 0, counts, modbus.ErrBadFrame
		}
		if !modbus.CheckCRC(frame) {
			return false, 0, counts, modbus.ErrCRC
		}
		for a := 0; a < 3; a++ {
			counts[a] = make([]int16, samplesPerRaw)
		}
		d := frame[3 : 3+samplesPerRaw*6]
		for i := 0; i < samplesPerRaw; i++ {
			for a := 0; a < 3; a++ {
				o := i*6 + a*2
				counts[a][i] = int16(uint16(d[o])<<8 | uint16(d[o+1]))
			}
		}
		return true, samplesPerRaw, counts, nil
	default:
		return false, 0, counts, modbus.ErrBadFrame
	}
}

func (s *Sensor) rawOnce(ctx context.Context) (ready bool, cnt int, counts [3][]int16, start, end time.Time, err error) {
	req := modbus.BuildRead(s.opt.Addr, modbus.FuncReadHolding, RegRawFIFO, 1)
	err = s.bus.Do(ctx, s.opt.ID, func(c *modbus.RTUClient) error {
		start = time.Now().UTC()
		frame, e := c.Transact(req, s.opt.RawTimeout, func(r *transport.Reader) ([]byte, error) {
			hdr, e := r.ReadN(3)
			if e != nil {
				return nil, modbus.ErrTimeout
			}
			n := 4 // not ready: CNT_H CNT_L CRC CRC
			if hdr[2] == 0x00 {
				n = rawRespLen - 3
			} else if hdr[1] == modbus.FuncReadHolding|0x80 {
				n = 2
			}
			rest, e := r.ReadN(n)
			if e != nil {
				return nil, modbus.ErrTimeout
			}
			return append(hdr, rest...), nil
		})
		end = time.Now().UTC()
		if e != nil {
			return e
		}
		ready, cnt, counts, e = ParseRawFIFO(frame, s.opt.Addr)
		if e != nil {
			return e
		}
		return nil
	})
	return
}

// ReadRawFrame reads one 1024-sample frame. Waits for the FIFO if not full and
// retries CRC errors up to 2 times (spec 3.1.6).
func (s *Sensor) ReadRawFrame(ctx context.Context) (drivers.RawFrame, error) {
	if !s.srKnown {
		if _, err := s.SampleRate(ctx); err != nil {
			return drivers.RawFrame{}, err
		}
	}
	fs := SampleRates[s.srCode]
	crcRetries := 0
	deadline := time.Now().Add(time.Duration(2*float64(samplesPerRaw)/fs*float64(time.Second)) + 3*time.Second)
	for {
		ready, cnt, counts, start, end, err := s.rawOnce(ctx)
		if err != nil {
			if errors.Is(err, modbus.ErrCRC) && crcRetries < 2 {
				crcRetries++
				continue
			}
			return drivers.RawFrame{}, err
		}
		if ready {
			return BuildFrame(counts, fs, s.srCode, start, end), nil
		}
		if time.Now().After(deadline) {
			return drivers.RawFrame{}, drivers.ErrNotReady
		}
		wait := time.Duration(float64(samplesPerRaw-cnt)/fs*float64(time.Second)) + 20*time.Millisecond
		select {
		case <-ctx.Done():
			return drivers.RawFrame{}, ctx.Err()
		case <-time.After(wait):
		}
	}
}

// BuildFrame converts raw counts to a RawFrame in m/s^2 and flags saturation (|a| >= 15.5 g).
func BuildFrame(counts [3][]int16, fs float64, sr uint8, start, end time.Time) drivers.RawFrame {
	f := drivers.RawFrame{FsHz: fs, Counts: counts, StartTS: start, EndTS: end, SrCode: sr}
	satLSB := 15.5 / AccLSB
	for a := 0; a < 3; a++ {
		f.Samples[a] = make([]float32, len(counts[a]))
		for i, c := range counts[a] {
			f.Samples[a][i] = float32(float64(c) * AccLSB * G)
			if math.Abs(float64(c)) >= satLSB {
				f.Saturated = true
			}
		}
	}
	return f
}

// Info reads SR, MODE and (best-effort) firmware version.
func (s *Sensor) Info(ctx context.Context) (drivers.DeviceInfo, error) {
	info := drivers.DeviceInfo{Model: "WTVB05", Addr: int(s.opt.Addr)}
	sr, err := s.SampleRate(ctx)
	if err != nil {
		return info, err
	}
	info.SrCode = sr
	if r, err := s.readRegs(ctx, RegMode, 1); err == nil {
		s.mode = uint8(r[0])
		info.Mode = s.mode
	}
	if r, err := s.readRegs(ctx, RegVersion, 1); err == nil && r[0] != 0 {
		s.firmware = fmt.Sprintf("%d.%d", r[0]>>8, r[0]&0xFF)
	}
	info.Firmware = s.firmware
	return info, nil
}

// Addr returns the Modbus address.
func (s *Sensor) Addr() byte { return s.opt.Addr }
