package agent

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/features"
	"selink.vn/smartmotor/edge/internal/rules"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/ulid"
	"selink.vn/smartmotor/edge/internal/wavefile"
)

var errFlashBudget = errors.New("capture skipped: flash write budget exhausted")

// runCaptures executes periodic capture profiles and urgent requests for one point.
func (p *pointRT) runCaptures(ctx context.Context) {
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case req := <-p.reqs:
			if _, err := p.captureAndPublish(ctx, req.profile, req.prio, req.cmdID != ""); err != nil {
				p.log.Warn("requested capture failed", "profile", req.profile, "err", err)
				if req.cmdID != "" {
					p.a.up.Ack(req.cmdID, "error", err.Error())
				}
			} else if req.cmdID != "" {
				p.a.up.Ack(req.cmdID, "ok", "capture done "+req.profile)
			}
		case now := <-t.C:
			if !p.online(now) {
				continue
			}
			for name, tm := range p.timers {
				if !tm.Due(now) {
					continue
				}
				if !p.m.stable(now) {
					continue // retry next tick while the slot is open
				}
				tm.Done(now)
				if _, err := p.captureAndPublish(ctx, name, bus.P2, false); err != nil {
					p.log.Warn("periodic capture failed", "profile", name, "err", err)
				}
			}
		}
	}
}

// setSR applies the sample rate honouring ADR-04 (no flash save unless allowed and in budget).
func (p *pointRT) setSR(ctx context.Context, sr uint8) error {
	err := p.sensor.SetSampleRate(ctx, sr, false)
	if !errors.Is(err, drivers.ErrSrNeedsPersist) {
		return err
	}
	pol := p.a.cfg.SensorPolicy
	key := store.FlashWriteKey(p.cfg.ID, time.Now())
	n, _ := p.a.st.Counter(key)
	if !pol.AllowFlashWrite || n >= int64(pol.MaxFlashWritesPerDay) {
		p.a.emitSystem("system", "capture_skipped_flash_budget", "info",
			fmt.Sprintf("Bỏ capture: đổi SR cần ghi flash (đã ghi %d/%d lần hôm nay, allow=%v)", n, pol.MaxFlashWritesPerDay, pol.AllowFlashWrite),
			"machine", p.m.cfg.ID, "point", p.cfg.ID)
		return errFlashBudget
	}
	if _, err := p.a.st.Incr(key, 1); err != nil {
		return err
	}
	p.log.Warn("writing SR to sensor flash", "sr", sr, "writes_today", n+1)
	return p.sensor.SetSampleRate(ctx, sr, true)
}

// capturedData is the raw result of one capture.
type capturedData struct {
	cap  features.Capture
	prof config.Profile
}

// acquire runs the capture sequence (spec 5.4.2 steps 1–5) and returns raw frames.
func (p *pointRT) acquire(ctx context.Context, profileName string, prio bus.Priority) (*capturedData, error) {
	prof, ok := p.profile(profileName)
	if !ok {
		return nil, fmt.Errorf("unknown profile %q", profileName)
	}
	p.captureMu.Lock()
	defer p.captureMu.Unlock()
	ctx = bus.WithPriority(ctx, prio)
	sr := uint8(prof.SR)
	fs, ok := wtvb05.SampleRates[sr]
	if !ok {
		return nil, fmt.Errorf("invalid sr %d", sr)
	}
	if err := p.setSR(ctx, sr); err != nil {
		p.recordResult(err)
		return nil, err
	}
	defer func() {
		idle := uint8(p.cfg.IdleSR)
		if idle != sr {
			if err := p.setSR(bus.WithPriority(context.WithoutCancel(ctx), prio), idle); err != nil {
				p.log.Warn("restore idle SR failed", "err", err)
			}
		}
	}()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(500 * time.Millisecond):
	}
	// Discard one frame (stale FIFO content from the previous SR).
	if _, err := p.sensor.ReadRawFrame(ctx); err != nil {
		p.recordResult(err)
		return nil, err
	}
	start := time.Now().UTC()
	frames := make([]drivers.RawFrame, 0, prof.Frames)
	for i := 0; i < prof.Frames; i++ {
		f, err := p.sensor.ReadRawFrame(ctx) // each frame is a separate bus job: B1 reads interleave
		p.recordResult(err)
		if err != nil {
			return nil, fmt.Errorf("frame %d: %w", i, err)
		}
		frames = append(frames, f)
	}
	id := fmt.Sprintf("c_%s_%s_%s", start.Format("20060102T150405Z"), p.cfg.ID, prof.Name)
	p.mu.Lock()
	p.lastCapture = start
	p.mu.Unlock()
	return &capturedData{
		cap: features.Capture{CaptureID: id, PointID: p.cfg.ID, Profile: prof.Name, TS: start, FsHz: fs, SrCode: sr,
			Frames: frames, BandpassHz: prof.BandpassHz},
		prof: prof,
	}, nil
}

// featureContext builds the DSP context for this point.
func (p *pointRT) featureContext() features.Context {
	m := p.m
	running, load := m.runLoad()
	hint := math.NaN()
	p.mu.Lock()
	if p.lastInd != nil {
		for _, h := range p.lastInd.FreqHz {
			if !math.IsNaN(h) && math.Abs(h-m.f1xNom) <= 0.03*m.f1xNom {
				hint = h
			}
		}
	}
	p.mu.Unlock()
	if math.IsNaN(hint) {
		hint = 0
	}
	mesh := 0.0
	if m.cfg.MaleLobes > 0 {
		mesh = m.meshHz()
	}
	return features.Context{
		Running: running, LoadPct: load, NominalF1xHz: m.f1xNom, SpeedHintHz: hint,
		ISOBandHz: [2]float64{m.cfg.ISOBandHz[0], m.cfg.ISOBandHz[1]}, Bearing: p.cfg.Bearing.Geometry(),
		Calibration: p.cfg.CalibrationTable(), Contiguity: p.cfg.Contiguity, LineFreqHz: m.cfg.LineFreqHz,
		MeshFreqHz: mesh,
	}
}

// captureAndPublish runs a capture, computes features and publishes everything.
func (p *pointRT) captureAndPublish(ctx context.Context, profile string, prio bus.Priority, manual bool) (*features.Result, error) {
	cd, err := p.acquire(ctx, profile, prio)
	if err != nil {
		return nil, err
	}
	res := features.Compute(cd.cap, p.featureContext())
	res.Features.MachineID = p.m.cfg.ID
	p.persistAndPublish(cd, res)
	p.evaluateCapture(res)
	return res, nil
}

// persistAndPublish stores wave/spectrum files and enqueues features, waveform, spectrum.
func (p *pointRT) persistAndPublish(cd *capturedData, res *features.Result) {
	c := cd.cap
	fs := res.Features
	var counts [3][]int16
	for _, f := range c.Frames {
		for a := 0; a < 3; a++ {
			counts[a] = append(counts[a], f.Counts[a]...)
		}
	}
	waveRel := store.CaptureRel("raw", p.cfg.ID, c.TS, c.CaptureID, ".bin.gz")
	specRel := store.CaptureRel("spec", p.cfg.ID, c.TS, c.CaptureID, ".json.gz")
	fileData, err := wavefile.EncodeFile(wavefile.Header{FsHz: c.FsHz, Frames: len(c.Frames), FramesContiguous: fs.FramesContiguous,
		CaptureID: c.CaptureID, PointID: p.cfg.ID, TS: fs.TS}, counts)
	if err == nil {
		if err := p.a.st.WriteFile(waveRel, fileData); err != nil {
			p.log.Warn("write waveform file", "err", err)
		}
	}
	specJSON, _ := json.Marshal(res.Spectrum)
	specGz := wavefile.Gzip(specJSON)
	if err := p.a.st.WriteFile(specRel, specGz); err != nil {
		p.log.Warn("write spectrum file", "err", err)
	}
	fs.WaveformRef = waveRel
	fs.SpectrumRef = specRel
	fs.MsgID = ulid.New()
	_ = p.a.up.Enqueue("features/"+p.cfg.ID, 1, store.PrioFeatures, fs)
	if p.a.cfg.MQTT.SendWaveforms {
		_ = p.a.up.Enqueue("waveform/"+p.cfg.ID, 1, store.PrioWaveform, blobPayload{
			MsgID: ulid.New(), CaptureID: c.CaptureID, PointID: p.cfg.ID, TS: fs.TS, FsHz: c.FsHz, Frames: len(c.Frames),
			FramesContiguous: fs.FramesContiguous, Encoding: "int16le-xyz-interleaved+gzip+base64",
			GPerLSB: wavefile.GPerLSB, Data: base64.StdEncoding.EncodeToString(wavefile.Gzip(wavefile.Interleave(counts))),
		})
	}
	_ = p.a.up.Enqueue("spectrum/"+p.cfg.ID, 1, store.PrioWaveform, blobPayload{
		MsgID: ulid.New(), CaptureID: c.CaptureID, PointID: p.cfg.ID, TS: fs.TS, FramesContiguous: fs.FramesContiguous,
		Encoding: "json+gzip+base64", Data: base64.StdEncoding.EncodeToString(specGz),
	})
	p.log.Info("capture done", "capture", c.CaptureID, "frames", len(c.Frames), "speed_hz", fs.SpeedHz,
		"iso_vrms", fs.ISOVrmsMax(p.cfg.ISOAxes), "flags", strings.Join(fs.QualityFlags, ","))
}

// evaluateCapture applies ISO, kurtosis and baseline rules on capture features.
func (p *pointRT) evaluateCapture(res *features.Result) {
	fs := res.Features
	if p.cfg.Role != "bearing" || !fs.Running || contains(fs.QualityFlags, "flatline") {
		if contains(fs.QualityFlags, "flatline") {
			p.a.emitSystem("sensor_fault", "flatline", "watch", "Tín hiệu phẳng khi máy chạy – nghi lỗi cảm biến",
				"machine", p.m.cfg.ID, "point", p.cfg.ID)
		}
		return
	}
	now := time.Now()
	var evs []rules.Event
	v := fs.ISOVrmsMax(p.cfg.ISOAxes)
	if fs.Isolation != nil {
		v = fs.Isolation.ISOVrmsMax
	}
	lim := p.a.isoLimits(p.m.cfg)
	// Isolation targets are evaluated in the group capture with isolated values.
	if !math.IsNaN(v) && (fs.Isolation != nil || !p.m.inIsolationTargets(p.cfg.ID)) {
		src := "capture"
		if fs.Isolation != nil {
			src = "isolated"
		}
		evs = append(evs, p.a.engine.Evaluate(rules.ISOObservation(p.m.cfg.ID, p.cfg.ID, v, lim, fs.CaptureID, src), now)...)
	}
	for _, b := range p.cfg.Baselines {
		val, ok := featureValue(fs, b.Feature)
		if !ok {
			continue
		}
		evs = append(evs, p.a.engine.Evaluate(rules.Observation{
			MachineID: p.m.cfg.ID, PointID: p.cfg.ID, Rule: "baseline", Metric: b.Feature, Value: val,
			Limits: rules.Thresholds{Watch: b.Warn, Warning: b.Alarm}, CaptureID: fs.CaptureID,
			Message: "Vượt ngưỡng baseline " + b.Feature,
		}, now)...)
	}
	if fs.Isolation != nil {
		for _, be := range fs.Isolation.Bands {
			evs = append(evs, p.a.engine.Evaluate(rules.Observation{
				MachineID: p.m.cfg.ID, PointID: p.cfg.ID, Rule: "band", Metric: be.Band + "." + be.Axis, Value: be.VelMMs,
				Limits: rules.Thresholds{Watch: be.Warn, Warning: be.Alarm}, CaptureID: fs.CaptureID,
				Message: fmt.Sprintf("Dải %s trục %s: %.2f mm/s (ngưỡng SOP %.2f/%.2f)", strings.ToUpper(be.Band), be.Axis, be.VelMMs, be.Warn, be.Alarm),
			}, now)...)
		}
	}
	p.a.handleEvents(evs)
}

// featureValue resolves names like "iso_vrms_mm_s", "x.orders.1", "env.bpfo", "env.rms", "x.kurtosis".
func featureValue(fs *features.FeatureSet, name string) (float64, bool) {
	switch name {
	case "iso_vrms_mm_s":
		v := fs.ISOVrmsMax(nil)
		return v, !math.IsNaN(v)
	case "env.rms":
		if fs.Envelope != nil {
			return fs.Envelope.EnvRmsG, true
		}
		return 0, false
	case "env.bpfo":
		if fs.Envelope != nil && fs.Envelope.BPFOEnvG != nil {
			return *fs.Envelope.BPFOEnvG, true
		}
		return 0, false
	case "env.bpfi":
		if fs.Envelope != nil && fs.Envelope.BPFIEnvG != nil {
			return *fs.Envelope.BPFIEnvG, true
		}
		return 0, false
	}
	parts := strings.SplitN(name, ".", 3)
	if len(parts) < 2 {
		return 0, false
	}
	ax, ok := fs.Axes[parts[0]]
	if !ok {
		return 0, false
	}
	switch parts[1] {
	case "orders":
		if len(parts) == 3 {
			v, ok := ax.Orders[parts[2]]
			return v, ok
		}
	case "iso_vrms_mm_s":
		return ax.ISOVrmsMMs, true
	case "kurtosis":
		return ax.Kurtosis, true
	case "acc_rms_g":
		return ax.AccRmsG, true
	case "crest":
		return ax.Crest, true
	}
	return 0, false
}

func contains(xs []string, s string) bool {
	for _, x := range xs {
		if x == s {
			return true
		}
	}
	return false
}
