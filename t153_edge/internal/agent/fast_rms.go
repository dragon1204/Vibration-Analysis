package agent

import (
	"context"
	"fmt"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/features"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/ulid"
)

// runFastRMS publishes a lightweight ISO-band RMS result from one RAWFIFO
// frame. Unlike a full capture it stores no waveform/spectrum and therefore
// can follow a handheld meter without growing edge/server storage every second.
func (p *pointRT) runFastRMS(ctx context.Context) {
	interval := time.Duration(p.a.cfg.Intervals.FastRMSMS) * time.Millisecond
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			started := time.Now()
			if err := p.publishFastRMS(ctx); err != nil {
				p.log.Warn("fast RMS failed", "err", err)
			}
			wait := interval - time.Since(started)
			if wait < 0 {
				wait = 0
			}
			timer.Reset(wait)
		}
	}
}

func (p *pointRT) publishFastRMS(ctx context.Context) error {
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

	res := features.Compute(features.Capture{
		CaptureID: "r_" + ulid.New(), PointID: p.cfg.ID, Profile: "fast-rms",
		TS: frame.StartTS, FsHz: fs, SrCode: sr, Frames: []drivers.RawFrame{frame},
	}, p.featureContext())
	msg := vibStat{
		MsgID: ulid.New(), TS: res.Features.TS, PointID: p.cfg.ID, SrCode: sr,
		Mode: p.info.Mode, Source: "edge_raw_iso", Axes: map[string]vibStatAxis{},
		Flags: append([]string{"edge_raw_iso"}, res.Features.QualityFlags...),
	}
	for _, axis := range drivers.AxisNames {
		a := res.Features.Axes[axis]
		msg.Axes[axis] = vibStatAxis{
			AccRmsG: fptr(a.AccRmsG), VelRmsMMs: fptr(a.ISOVrmsMMs), Crest: fptr(a.Crest),
			Kurtosis: fptr(a.Kurtosis), Skew: fptr(a.Skew),
		}
	}
	return p.a.up.Enqueue("metrics/vibstat/"+p.cfg.ID, 1, store.PrioMetrics, msg)
}
