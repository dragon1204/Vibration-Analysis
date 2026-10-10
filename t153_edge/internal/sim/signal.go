// Package sim simulates WTVB05 sensors and a PT100 module on a Modbus RTU bus
// (spec 5.14), so the edge stack can be developed and tested without hardware.
package sim

import (
	"math"
	"math/rand"
	"strings"
)

// Scenario names (spec 5.14).
const (
	Healthy      = "healthy"
	Unbalance    = "unbalance"
	Misalignment = "misalignment"
	Looseness    = "looseness"
	BearingOuter = "bearing_outer"
	Flatline     = "sensor_flatline"
	Saturation   = "saturation"
)

// Scenarios lists valid scenario names.
var Scenarios = []string{Healthy, Unbalance, Misalignment, Looseness, BearingOuter, Flatline, Saturation}

const g0 = 9.80665

// tone is a sinusoid defined by its velocity RMS (mm/s).
type tone struct {
	order  float64 // multiple of f1x (or absolute Hz if abs=true)
	abs    bool
	velRMS [3]float64
	phase  [3]float64
}

// Signal generates a continuous 3-axis acceleration signal a(t) in m/s^2.
type Signal struct {
	F1x        float64
	LineHz     float64
	Scenario   string
	MeshLobes  int     // compressor male lobes (0 = none)
	MeshVelRMS float64 // mesh velocity at this sensor (mm/s RMS)
	BPFOx      float64 // BPFO as multiple of 1X (default 3.58)
	NoiseG     float64
	Gravity    bool // add 1 g on Z (sensor mounted vertically)
	rnd        *rand.Rand
}

// NewSignal creates a generator.
func NewSignal(f1x float64, scenario string, seed int64) *Signal {
	return &Signal{F1x: f1x, LineHz: 50, Scenario: strings.ToLower(scenario), BPFOx: 3.58, NoiseG: 0.004,
		Gravity: true, rnd: rand.New(rand.NewSource(seed))}
}

func (s *Signal) tones() []tone {
	ph := [3]float64{0.1, 1.3, 2.1}
	t := []tone{
		{order: 1, velRMS: [3]float64{0.8, 0.3, 0.7}, phase: ph},
		{order: 2, velRMS: [3]float64{0.25, 0.15, 0.2}, phase: ph},
		{order: 3, velRMS: [3]float64{0.08, 0.05, 0.07}, phase: ph},
		{order: 2 * s.LineHz, abs: true, velRMS: [3]float64{0.08, 0.05, 0.08}, phase: ph},
	}
	switch s.Scenario {
	case Unbalance:
		t[0].velRMS = [3]float64{4.2, 0.6, 3.8}
	case Misalignment:
		t[0].velRMS = [3]float64{1.4, 2.6, 1.2}
		t[1].velRMS = [3]float64{2.4, 2.8, 2.0}
		t[2].velRMS = [3]float64{0.6, 0.7, 0.5}
	case Looseness:
		t[0].velRMS = [3]float64{1.6, 0.6, 1.8}
		t[1].velRMS = [3]float64{1.2, 0.4, 1.3}
		t[2].velRMS = [3]float64{1.0, 0.3, 1.1}
		for k := 4.0; k <= 6; k++ {
			t = append(t, tone{order: k, velRMS: [3]float64{0.7, 0.2, 0.8}, phase: ph})
		}
		t = append(t, tone{order: 0.5, velRMS: [3]float64{0.6, 0.2, 0.7}, phase: ph},
			tone{order: 1.5, velRMS: [3]float64{0.5, 0.2, 0.5}, phase: ph})
	case Saturation:
		t[0].velRMS = [3]float64{200, 50, 200}
	}
	if s.MeshLobes > 0 && s.MeshVelRMS > 0 {
		m := s.MeshVelRMS
		t = append(t,
			tone{order: float64(s.MeshLobes), velRMS: [3]float64{m, 0.4 * m, m}, phase: [3]float64{0.5, 0.9, 1.7}},
			tone{order: float64(2 * s.MeshLobes), velRMS: [3]float64{0.3 * m, 0.1 * m, 0.3 * m}, phase: [3]float64{0.2, 0.4, 0.6}})
	}
	return t
}

// Sample fills n samples at fs starting at time t0 (seconds). Values are m/s^2.
func (s *Signal) Sample(fs float64, n int, t0 float64) [3][]float64 {
	var out [3][]float64
	for a := 0; a < 3; a++ {
		out[a] = make([]float64, n)
	}
	if s.Scenario == Flatline {
		for i := 0; i < n; i++ {
			if s.Gravity {
				out[2][i] = g0
			}
		}
		return out
	}
	nyq := fs / 2
	for _, tn := range s.tones() {
		f := tn.order * s.F1x
		if tn.abs {
			f = tn.order
		}
		if f <= 0 || f >= nyq*0.9 {
			continue
		}
		w := 2 * math.Pi * f
		for a := 0; a < 3; a++ {
			amp := tn.velRMS[a] / 1000 * math.Sqrt2 * w // acceleration peak m/s^2
			if amp == 0 {
				continue
			}
			for i := 0; i < n; i++ {
				t := t0 + float64(i)/fs
				out[a][i] += amp * math.Sin(w*t+tn.phase[a])
			}
		}
	}
	if s.Scenario == BearingOuter {
		bpfo := s.BPFOx * s.F1x
		res := math.Min(2500, 0.4*fs)
		for i := 0; i < n; i++ {
			t := t0 + float64(i)/fs
			k := math.Floor(t * bpfo)
			for j := 0.0; j < 3; j++ {
				dt := t - (k-j)/bpfo
				if dt < 0 || dt > 0.03 {
					continue
				}
				v := 1.5 * g0 * math.Exp(-dt*700) * math.Sin(2*math.Pi*res*dt)
				out[0][i] += v
				out[2][i] += 0.8 * v
				out[1][i] += 0.3 * v
			}
		}
	}
	for a := 0; a < 3; a++ {
		for i := 0; i < n; i++ {
			out[a][i] += s.NoiseG * g0 * s.rnd.NormFloat64()
			if a == 2 && s.Gravity {
				out[a][i] += g0
			}
			// Sensor range ±16 g.
			out[a][i] = math.Max(-16*g0, math.Min(16*g0, out[a][i]))
		}
	}
	return out
}

// ToCounts converts m/s^2 to int16 LSB (16 g full scale).
func ToCounts(x []float64) []int16 {
	o := make([]int16, len(x))
	for i, v := range x {
		c := math.Round(v / g0 / 16 * 32768)
		o[i] = int16(math.Max(-32768, math.Min(32767, c)))
	}
	return o
}
