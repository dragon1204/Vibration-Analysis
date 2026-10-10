// Package thermal estimates winding temperature from current, frame and ambient
// temperature (spec 5.7, ADR-10). The output is an ESTIMATE and must be labelled so.
package thermal

import "math"

// Params are per-motor model parameters.
type Params struct {
	INA      float64 `yaml:"i_n_a" json:"i_n_a"`
	DTNK     float64 `yaml:"dt_n_k" json:"dt_n_k"`
	A        float64 `yaml:"a" json:"a"`
	TauRunS  float64 `yaml:"tau_run_s" json:"tau_run_s"`
	TauStopS float64 `yaml:"tau_stop_s" json:"tau_stop_s"`
	KNeg     float64 `yaml:"k_neg" json:"k_neg"`
	KFrame   float64 `yaml:"k_frame" json:"k_frame"`
	CFrame   float64 `yaml:"c_frame" json:"c_frame"`
}

// WithDefaults fills unset parameters with spec defaults.
func (p Params) WithDefaults() Params {
	if p.DTNK == 0 {
		p.DTNK = 80
	}
	if p.A == 0 {
		p.A = 0.25
	}
	if p.TauRunS == 0 {
		p.TauRunS = 2700
	}
	if p.TauStopS == 0 {
		p.TauStopS = 3 * p.TauRunS
	}
	if p.KNeg == 0 {
		p.KNeg = 3
	}
	if p.CFrame == 0 {
		p.CFrame = 0.4
	}
	return p
}

// Version identifies the model in payloads.
const Version = "v1"

// Model is a first-order thermal model.
type Model struct {
	P      Params
	dT     float64
	inited bool
}

// Output of one step.
type Output struct {
	WindingTempC float64
	WindingRiseK float64
	FrameModelC  float64
}

// New creates a model.
func New(p Params) *Model { return &Model{P: p.WithDefaults()} }

// State returns the current winding rise (for persistence across restarts).
func (m *Model) State() (float64, bool) { return m.dT, m.inited }

// Restore sets the internal state.
func (m *Model) Restore(dT float64) { m.dT, m.inited = dT, true }

// Step advances the model by dt seconds. frameC/ambC may be NaN when unavailable.
func (m *Model) Step(ia, ib, ic float64, running bool, frameC, ambC, dt float64) Output {
	p := m.P
	if math.IsNaN(ambC) {
		ambC = 30 // fallback ambient [assumption]
	}
	if !m.inited {
		if !math.IsNaN(frameC) && p.CFrame > 0 {
			m.dT = math.Max(0, (frameC-ambC)/p.CFrame)
		}
		m.inited = true
	}
	i1 := (ia + ib + ic) / 3
	i2 := (math.Max(ia, math.Max(ib, ic)) - math.Min(ia, math.Min(ib, ic))) / 2
	ieq := math.Sqrt(i1*i1 + p.KNeg*i2*i2)
	var dTss, tau float64
	if running && p.INA > 0 {
		r := ieq / p.INA
		dTss = p.DTNK * (p.A + (1-p.A)*r*r)
		tau = p.TauRunS
	} else {
		dTss = 0
		tau = p.TauStopS
	}
	m.dT = dTss + (m.dT-dTss)*math.Exp(-dt/tau)
	frameModel := ambC + p.CFrame*m.dT
	tw := ambC + m.dT
	if !math.IsNaN(frameC) {
		tw += p.KFrame * (frameC - frameModel)
	}
	return Output{WindingTempC: tw, WindingRiseK: m.dT, FrameModelC: frameModel}
}
