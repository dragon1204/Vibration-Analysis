package agent

import (
	"context"
	"fmt"
	"math"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/features"
	"selink.vn/smartmotor/edge/internal/localview"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/ulid"
)

// defaultRawDuty is the share of bus time fast RMS may use when raw_duty_pct is unset.
const defaultRawDuty = 0.70

// runFastRMSBus publishes lightweight ISO-band RMS results from RAWFIFO frames for
// every point of one bus. Unlike a full capture it stores no waveform/spectrum and
// can follow a handheld meter without growing edge/server storage every second.
//
// One RAWFIFO frame occupies the bus for ~0.55 s at 115200 bps, so several sensors
// cannot each be read every second. Points are served round-robin, one frame per turn,
// and after each frame the loop idles long enough to keep raw reads at the duty cap:
// B1 polling and scheduled captures (lower priority) use the idle time and never starve.
// With n sensors each one refreshes about every n × frame / duty (≈ 0.8 s per sensor).
func (a *Agent) runFastRMSBus(ctx context.Context, pts []*pointRT) {
	minPeriod := time.Duration(a.cfg.Intervals.FastRMSMS) * time.Millisecond
	duty := defaultRawDuty
	if a.cfg.Intervals.RawDutyPct > 0 {
		duty = float64(a.cfg.Intervals.RawDutyPct) / 100
	}
	windows := make([][]drivers.RawFrame, len(pts))
	last := make([]time.Time, len(pts))
	next := 0
	for {
		if ctx.Err() != nil {
			return
		}
		now := time.Now()
		// Next point in turn that is online and whose minimum period has elapsed.
		pick, wait := -1, 200*time.Millisecond
		for k := 0; k < len(pts); k++ {
			i := (next + k) % len(pts)
			if !pts[i].online(now) {
				continue
			}
			if d := last[i].Add(minPeriod).Sub(now); d > 0 {
				wait = min(wait, d)
				continue
			}
			pick = i
			break
		}
		if pick < 0 {
			if !sleepCtx(ctx, wait) {
				return
			}
			continue
		}
		next = (pick + 1) % len(pts)
		p := pts[pick]
		started := time.Now()
		prev := last[pick]
		last[pick] = started
		if err := p.publishFastRMS(ctx, &windows[pick], prev); err != nil && ctx.Err() == nil {
			p.log.Warn("fast RMS failed", "err", err)
		}
		busy := time.Since(started)
		if !sleepCtx(ctx, time.Duration(float64(busy)*(1/duty-1))) {
			return
		}
	}
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

// fastRMSGroups groups points by bus so each bus gets one fast-RMS scheduler.
func fastRMSGroups(machines []*machineRT) [][]*pointRT {
	idx := map[string]int{}
	var out [][]*pointRT
	for _, m := range machines {
		for _, p := range m.points {
			b := p.cfg.Sensor.Bus
			i, ok := idx[b]
			if !ok {
				i = len(out)
				idx[b] = i
				out = append(out, nil)
			}
			out[i] = append(out[i], p)
		}
	}
	return out
}

// fastRMSFrameCount returns enough 1024-sample frames for at least one second
// of analysed signal. Frames are retained as a rolling Welch window, so the
// live result can still be refreshed once per second without changing the
// sensor sample rate or writing its flash configuration.
func fastRMSFrameCount(fs float64) int {
	n := int(math.Ceil(fs / 1024.0))
	if n < 1 {
		return 1
	}
	return n
}

func appendFastRMSFrame(window []drivers.RawFrame, frame drivers.RawFrame, maxFrames int) []drivers.RawFrame {
	window = append(window, frame)
	if len(window) > maxFrames {
		window = window[len(window)-maxFrames:]
	}
	return window
}

func (p *pointRT) publishFastRMS(ctx context.Context, window *[]drivers.RawFrame, prev time.Time) error {
	if len(p.cfg.Profiles) == 0 {
		return fmt.Errorf("fast RMS requires a capture profile")
	}
	prof := p.cfg.Profiles[0]
	sr := uint8(prof.SR)
	fs, ok := wtvb05.SampleRates[sr]
	if !ok {
		return fmt.Errorf("invalid fast RMS SR %d", sr)
	}

	// RAWFIFO and scheduled captures share the same sensor FIFO. Serialize them,
	// while retaining P1 priority over background captures so the live number
	// remains responsive.
	p.captureMu.Lock()
	readCtx := bus.WithPriority(ctx, bus.P1)
	if _, err := p.prepareSR(readCtx, sr); err != nil {
		p.captureMu.Unlock()
		p.recordResult(err)
		return err
	}
	frame, err := p.sensor.ReadRawFrame(readCtx)
	p.captureMu.Unlock()
	p.recordResult(err)
	if err != nil {
		return err
	}
	*window = appendFastRMSFrame(*window, frame, fastRMSFrameCount(fs))
	frames := append([]drivers.RawFrame(nil), (*window)...)
	windowMS := int(math.Round(float64(len(frames)*1024) / fs * 1000))

	res := features.Compute(features.Capture{
		CaptureID: "r_" + ulid.New(), PointID: p.cfg.ID, Profile: "fast-rms",
		TS: frame.StartTS, FsHz: fs, SrCode: sr, Frames: frames,
	}, p.featureContext())
	msg := vibStat{
		MsgID: ulid.New(), TS: res.Features.TS, PointID: p.cfg.ID, SrCode: sr,
		Mode: p.info.Mode, Source: "edge_raw_iso", WindowMS: windowMS, Frames: len(frames),
		Axes:  map[string]vibStatAxis{},
		Flags: append([]string{"edge_raw_iso", fmt.Sprintf("rolling_%dms", windowMS)}, res.Features.QualityFlags...),
	}
	view := localview.Fast{TS: frame.StartTS, WindowMS: windowMS, Axes: map[string]localview.AxisRMS{}}
	if !prev.IsZero() {
		view.UpdateMS = int(time.Since(prev) / time.Millisecond)
	}
	for _, axis := range drivers.AxisNames {
		a := res.Features.Axes[axis]
		msg.Axes[axis] = vibStatAxis{
			AccRmsG: fptr(a.AccRmsG), VelRmsMMs: fptr(a.ISOVrmsMMs), Crest: fptr(a.Crest),
			Kurtosis: fptr(a.Kurtosis), Skew: fptr(a.Skew),
		}
		view.Axes[axis] = localview.AxisRMS{VrmsMMs: fptr(a.ISOVrmsMMs), AccRmsG: fptr(a.AccRmsG), Crest: fptr(a.Crest), Kurtosis: fptr(a.Kurtosis)}
	}
	p.a.view.SetFast(p.cfg.ID, view)
	return p.a.up.Enqueue("metrics/vibstat/"+p.cfg.ID, 1, store.PrioMetrics, msg)
}
