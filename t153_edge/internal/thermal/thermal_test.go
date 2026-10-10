package thermal

import (
	"math"
	"testing"
)

func TestSteadyStateAtRatedCurrent(t *testing.T) {
	m := New(Params{INA: 226, TauRunS: 2700})
	m.Restore(0)
	var out Output
	for i := 0; i < 24*60; i++ { // 24 h at 60 s steps
		out = m.Step(226, 226, 226, true, math.NaN(), 30, 60)
	}
	if math.Abs(out.WindingRiseK-80) > 0.01 || math.Abs(out.WindingTempC-110) > 0.01 {
		t.Fatalf("steady state %+v, want rise 80 K", out)
	}
}

func TestTimeConstantAndUnbalance(t *testing.T) {
	m := New(Params{INA: 100, TauRunS: 2700})
	m.Restore(0)
	var out Output
	for i := 0; i < 45; i++ { // one tau
		out = m.Step(100, 100, 100, true, math.NaN(), 30, 60)
	}
	if want := 80 * (1 - math.Exp(-1)); math.Abs(out.WindingRiseK-want) > 0.01 {
		t.Fatalf("after tau: %.3f want %.3f", out.WindingRiseK, want)
	}
	bal, unb := New(Params{INA: 100}), New(Params{INA: 100})
	bal.Restore(0)
	unb.Restore(0)
	b := bal.Step(100, 100, 100, true, math.NaN(), 30, 3600)
	u := unb.Step(110, 100, 90, true, math.NaN(), 30, 3600)
	if u.WindingRiseK <= b.WindingRiseK {
		t.Fatal("unbalance should increase heating")
	}
}

func TestInitFromFrame(t *testing.T) {
	m := New(Params{INA: 100})
	out := m.Step(0, 0, 0, false, 50, 30, 60)
	// dT0 = (50-30)/0.4 = 50 K then decays with tau_stop = 8100 s.
	if want := 50 * math.Exp(-60.0/8100); math.Abs(out.WindingRiseK-want) > 1e-6 {
		t.Fatalf("init rise %.4f want %.4f", out.WindingRiseK, want)
	}
}
