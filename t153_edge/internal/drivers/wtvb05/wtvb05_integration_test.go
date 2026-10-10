package wtvb05_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"math"
	"net"
	"testing"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/features"
	"selink.vn/smartmotor/edge/internal/sim"
)

func startSim(t *testing.T, devs ...sim.Slave) string {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	b := sim.NewBus(log)
	for _, d := range devs {
		b.Add(d)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func() { defer c.Close(); _ = b.Serve(c) }()
		}
	}()
	return "tcp://" + ln.Addr().String()
}

func newSensor(t *testing.T, url string, addr byte) (*wtvb05.Sensor, context.Context) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := bus.New("busA", url, 230400, log)
	go m.Run(ctx)
	return wtvb05.New(m, wtvb05.Options{ID: "p", Addr: addr, Timeout: 500 * time.Millisecond}, log), ctx
}

func TestIndicatorsAndRawCapture(t *testing.T) {
	dev := sim.NewWTVB(0x11, 49.63, sim.Unbalance, 1)
	s, ctx := newSensor(t, startSim(t, dev), 0x11)

	info, err := s.Info(ctx)
	if err != nil || info.Firmware != "1.8" {
		t.Fatalf("info %+v err %v", info, err)
	}
	ind, err := s.ReadIndicators(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if ind.VelMMs[0] < 3 || math.Abs(ind.AccG[2]-1) > 0.3 {
		t.Fatalf("unexpected indicators %+v", ind)
	}
	st, err := s.ReadStatistics(ctx)
	if err != nil || st.VelRmsMMs[0] < 3 {
		t.Fatalf("stats %+v err %v", st.VelRmsMMs, err)
	}
	if _, err := s.ReadSpectrumEnergy(ctx); err != nil {
		t.Fatal(err)
	}
	if err := s.SetSampleRate(ctx, 0x04, false); err != nil {
		t.Fatal(err)
	}
	var frames []drivers.RawFrame
	for i := 0; i < 2; i++ {
		f, err := s.ReadRawFrame(ctx)
		if err != nil {
			t.Fatal(err)
		}
		frames = append(frames, f)
	}
	res := features.Compute(features.Capture{CaptureID: "c1", PointID: "p", Profile: "orders", TS: time.Now(),
		FsHz: 2000, SrCode: 4, Frames: frames},
		features.Context{Running: true, LoadPct: math.NaN(), NominalF1xHz: 49.63, ISOBandHz: [2]float64{10, 1000}, LineFreqHz: 50})
	x := res.Features.Axes["x"]
	// Simulator unbalance: 1X x-axis 4.2 mm/s RMS.
	if math.Abs(x.Orders["1"]-4.2)/4.2 > 0.05 {
		t.Fatalf("1X = %.3f want ~4.2 (features %+v)", x.Orders["1"], x)
	}
	if res.Features.SpeedConfidence != "high" {
		t.Fatalf("speed %+v", res.Features.SpeedHz)
	}
}

func TestSRNeedsPersist(t *testing.T) {
	dev := sim.NewWTVB(0x12, 49.63, sim.Healthy, 2)
	dev.SRNeedsSave = true
	s, ctx := newSensor(t, startSim(t, dev), 0x12)
	err := s.SetSampleRate(ctx, 0x02, false)
	if !errors.Is(err, drivers.ErrSrNeedsPersist) {
		t.Fatalf("expected ErrSrNeedsPersist, got %v", err)
	}
	if err := s.SetSampleRate(ctx, 0x02, true); err != nil {
		t.Fatal(err)
	}
	if dev.FlashWrites != 1 {
		t.Fatalf("flash writes = %d", dev.FlashWrites)
	}
}
