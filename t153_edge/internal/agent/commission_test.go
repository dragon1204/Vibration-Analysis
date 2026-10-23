package agent

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"testing"
	"time"

	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/sim"
)

func freeAddr(t *testing.T) string {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	return ln.Addr().String()
}

// A factory sensor (0x50) joins a bus that already has a configured sensor (0x02).
func TestCommissionFactorySensor(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	simBus := sim.NewBus(log)
	old := sim.NewWTVB(0x02, 49.6, "healthy", 1)
	fresh := sim.NewWTVB(0x50, 49.6, "healthy", 2)
	simBus.Add(old)
	simBus.Add(fresh)
	addr := freeAddr(t)
	go func() { _ = simBus.ListenTCP(addr) }()
	time.Sleep(100 * time.Millisecond)

	cfg, err := config.Parse([]byte(fmt.Sprintf(`
version: 1
gateway: {id: gw, tenant: t, site: s}
mqtt: {url: "tcp://127.0.0.1:1", username: x, password: x}
storage: {dir: %q}
local_ui: {listen: "off"}
buses: [{id: busA, device: "tcp://%s", baud: 115200, timeout_ms: 150}]
machines:
  - id: m1
    foundation: rigid
    points:
      - {id: p1, sensor: {driver: wtvb05, bus: busA, addr: 2}, profiles: [{name: orders, sr: 3, frames: 1, every_s: 30}]}
`, strings.ReplaceAll(t.TempDir(), `\`, `/`), addr)))
	if err != nil {
		t.Fatal(err)
	}
	a, err := New(cfg, Options{}, log)
	if err != nil {
		t.Fatal(err)
	}
	defer a.st.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	go a.buses["busA"].Run(ctx)

	if _, err := a.commission(ctx, commissionParams{ToAddr: 2}); err == nil || !strings.Contains(err.Error(), "đã dùng") {
		t.Fatalf("address of a configured point must be refused, got %v", err)
	}
	res, err := a.commission(ctx, commissionParams{ToAddr: 3})
	if err != nil {
		t.Fatal(err)
	}
	if res.Addr != 3 || res.FoundAddr != 0x50 || res.FoundBaud != 115200 {
		t.Fatalf("result %+v", res)
	}
	if fresh.Addr() != 3 || fresh.FlashWrites != 1 {
		t.Fatalf("sensor addr 0x%02X flash writes %d", fresh.Addr(), fresh.FlashWrites)
	}
	if old.Addr() != 2 || old.FlashWrites != 0 {
		t.Fatal("the running sensor must not be touched")
	}
	// No factory sensor left on the bus.
	if _, err := a.commission(ctx, commissionParams{ToAddr: 4}); err == nil || !strings.Contains(err.Error(), "không tìm thấy") {
		t.Fatalf("expected not found, got %v", err)
	}
}
