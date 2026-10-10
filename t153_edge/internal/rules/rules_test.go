package rules

import (
	"math"
	"testing"
	"time"
)

func TestISOZones(t *testing.T) {
	l := ISOThresholds(2, "rigid")
	cases := map[float64]string{1.0: "A", 2.0: "B", 3.1: "C", 5: "D"}
	for v, z := range cases {
		if got := l.Zone(v); got != z {
			t.Errorf("zone(%v)=%s want %s", v, got, z)
		}
	}
	if g1 := ISOThresholds(1, "rigid"); g1.BC != 4.5 {
		t.Errorf("group 1 rigid B/C = %v", g1.BC)
	}
	if c2 := l.Criterion2Threshold("beerhn"); math.Abs(c2-0.35) > 1e-9 {
		t.Errorf("criterion2 beerhn = %v", c2)
	}
}

func TestEnforceRSS(t *testing.T) {
	// SOP table: sqrt(2.3²+1.8²+1.5²+1²+0.8²) ≈ 3.55 > 2.8 (group 2 rigid) → scaled down.
	out, k := EnforceRSS(DefaultBandLimits, 2.8)
	if k >= 1 {
		t.Fatalf("expected scaling, k=%v", k)
	}
	sum := 0.0
	for _, l := range out {
		sum += l.Alarm * l.Alarm
	}
	if math.Sqrt(sum) > 2.8+1e-9 {
		t.Fatalf("RSS %.3f > 2.8", math.Sqrt(sum))
	}
	// Group 1 rigid B/C = 4.5: SOP table already satisfies the constraint.
	if _, k := EnforceRSS(DefaultBandLimits, 4.5); k != 1 {
		t.Fatalf("should not scale for 4.5, k=%v", k)
	}
}

func TestPersistence(t *testing.T) {
	e := NewEngine(3, 5)
	now := time.Now()
	th := Thresholds{Watch: 2, Warning: 2.8, Danger: 4.5}
	obs := func(v float64) []Event {
		now = now.Add(10 * time.Second)
		return e.Evaluate(Observation{MachineID: "m", PointID: "p", Rule: "iso_zone", Metric: "v", Value: v, Limits: th}, now)
	}
	if ev := obs(3); len(ev) != 0 {
		t.Fatal("raised too early")
	}
	obs(1)
	obs(3)
	ev := obs(3)
	if len(ev) != 1 || ev[0].State != "raised" || ev[0].Severity != "warning" {
		t.Fatalf("expected warning raised, got %+v", ev)
	}
	// Within hysteresis (2.6 > 2.8*0.9) keeps the alarm.
	for i := 0; i < 6; i++ {
		if ev := obs(2.6); len(ev) != 0 {
			t.Fatalf("should hold within hysteresis: %+v", ev)
		}
	}
	var cleared bool
	for i := 0; i < 5; i++ {
		for _, x := range obs(1) {
			cleared = cleared || x.State == "cleared"
		}
	}
	if !cleared {
		t.Fatal("expected cleared after 5 low evaluations")
	}
}

func TestRate(t *testing.T) {
	r := NewRateTracker(10 * time.Minute)
	t0 := time.Now()
	var ratio float64
	for i := 0; i <= 60; i++ {
		v := 1.0
		if i == 60 {
			v = 2.5
		}
		ratio = r.Ratio("p", t0.Add(time.Duration(i)*10*time.Second), v)
	}
	if ratio < 2 {
		t.Fatalf("ratio %.2f", ratio)
	}
}
