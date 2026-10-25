package config

import (
	"path/filepath"
	"runtime"
	"testing"
)

func deployFile(name string) string {
	_, f, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(f), "..", "..", "deploy", name)
}

func TestSampleConfigs(t *testing.T) {
	for _, n := range []string{"edge.yaml", "edge.beerhn.yaml", "edge.dev.yaml", "edge.truonggiang.yaml"} {
		c, err := Load(deployFile(n))
		if err != nil {
			t.Fatalf("%s: %v", n, err)
		}
		if len(c.Machines) == 0 || len(c.Machines[0].Points) == 0 {
			t.Fatalf("%s: no machines/points", n)
		}
	}
	c, _ := Load(deployFile("edge.yaml"))
	if c.Machines[0].Points[0].Sensor.Addr != 0x11 {
		t.Fatalf("hex address not parsed: %v", c.Machines[0].Points[0].Sensor.Addr)
	}
	if c.TopicPrefix() != "sm/v1/hem/hem-factory/hem-gw-01/" {
		t.Fatal(c.TopicPrefix())
	}
	b, _ := Load(deployFile("edge.beerhn.yaml"))
	if b.Machines[0].ISOGroup != 1 || !b.Machines[0].Isolation.Enabled {
		t.Fatal("beer hn isolation config")
	}
	tg, err := Load(deployFile("edge.truonggiang.yaml"))
	if err != nil || len(tg.Machines[0].RunDetection.Sources) != 1 {
		t.Fatalf("truong giang run config: %v", err)
	}
	s := tg.Machines[0].RunDetection.Sources[0]
	if s.PointID != "pump-tg-01-p1" || len(s.Axes) != 1 || s.Axes[0] != "z" || s.ThresholdMMs != 0.5 {
		t.Fatalf("unexpected default RUN source: %+v", s)
	}
}

func TestSubsecondVibrationIntervals(t *testing.T) {
	c, err := Load(deployFile("edge.truonggiang.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if c.Intervals.B1MS != 100 || c.Intervals.B2S != 3600 || c.Intervals.FastRMSMS != 1000 || c.Intervals.VibWindowMS != 100 || c.Intervals.B1S != 0 {
		t.Fatalf("unexpected subsecond intervals: %+v", c.Intervals)
	}

	bad := `
gateway: {id: g, tenant: t, site: s}
intervals: {b1_ms: 40, vib_window_ms: 20}
buses: [{id: a, device: /dev/x}]
machines: [{id: m, points: [{id: p1, sensor: {bus: a, addr: 0x11}}]}]
`
	if _, err := Parse([]byte(bad)); err == nil {
		t.Fatal("expected unsafe millisecond intervals to be rejected")
	}
}

func TestValidateRejectsDuplicateAddress(t *testing.T) {
	y := `
gateway: {id: g, tenant: t, site: s}
buses: [{id: a, device: /dev/x}]
machines:
  - id: m
    points:
      - {id: p1, sensor: {bus: a, addr: 0x11}}
      - {id: p2, sensor: {bus: a, addr: 0x11}}
`
	if _, err := Parse([]byte(y)); err == nil {
		t.Fatal("expected duplicate address error")
	}
}
