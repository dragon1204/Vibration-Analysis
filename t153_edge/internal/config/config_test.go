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
	for _, n := range []string{"edge.yaml", "edge.beerhn.yaml", "edge.dev.yaml"} {
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
