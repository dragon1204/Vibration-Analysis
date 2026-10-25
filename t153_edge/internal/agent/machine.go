package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"sync"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/dsp"
	"selink.vn/smartmotor/edge/internal/features"
	"selink.vn/smartmotor/edge/internal/rules"
	"selink.vn/smartmotor/edge/internal/scheduler"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/thermal"
	"selink.vn/smartmotor/edge/internal/ulid"
)

// machineRT is the runtime of one motor.
type machineRT struct {
	a      *Agent
	cfg    config.Machine
	points []*pointRT
	meter  drivers.PowerMeter
	f1xNom float64

	runState          scheduler.RunState
	runCandidate      bool
	runCandidateSince time.Time

	mu           sync.Mutex
	powerWin     []drivers.PowerReading
	lastPower    *drivers.PowerReading
	meterFails   int
	frameC       float64
	ambC         float64
	ptBearingC   float64
	bearingTemps map[string]float64
	model        *thermal.Model
	lastThermal  *thermal.Output
	lastThermalT time.Time

	// isolation state
	alpha       map[string]dsp.AlphaTable
	learn       map[string]*alphaLearn
	prevIsoRMS  map[string]float64
	detectedMHz float64
	groupTimer  *scheduler.ProfileTimer
	started     time.Time
	// lastGroupEvent limits event-triggered group captures.
	lastGroupEvent time.Time
}

type alphaLearn struct {
	targets, refs [3][]*dsp.Spectrum
	n             int
}

func newMachineRT(a *Agent, mc config.Machine) *machineRT {
	m := &machineRT{a: a, cfg: mc, f1xNom: mc.RatedSpeedRPM / 60, frameC: math.NaN(), ambC: math.NaN(), ptBearingC: math.NaN(),
		bearingTemps: map[string]float64{}, model: thermal.New(mc.Thermal), alpha: map[string]dsp.AlphaTable{},
		learn: map[string]*alphaLearn{}, prevIsoRMS: map[string]float64{}, started: time.Now()}
	if iso := mc.Isolation; iso != nil {
		for k, v := range iso.Alpha {
			m.alpha[k] = v.Sorted()
		}
		every := 900 * time.Second
		for _, p := range mc.Points {
			if p.ID == iso.ReferencePoint {
				for _, pr := range p.Profiles {
					if pr.Name == iso.Profile && pr.EveryS > 0 {
						every = time.Duration(pr.EveryS) * time.Second
					}
				}
			}
		}
		m.groupTimer = scheduler.NewProfileTimer(every, mc.ID+"/isolation")
	}
	return m
}

func (m *machineRT) hasTempRole(role string) bool {
	for _, t := range m.cfg.Temps {
		if t.Role == role {
			return true
		}
	}
	return false
}

func (m *machineRT) isolationEnabled() bool { return m.cfg.Isolation != nil && m.cfg.Isolation.Enabled }

func (m *machineRT) hasBasePoint() bool {
	for _, p := range m.points {
		if p.cfg.Role == "base" {
			return true
		}
	}
	return false
}

// correctedStats removes the matched BASE contribution from each bearing axis.
// The bearing and base axes are paired by their physical axes_map role, not by x/y/z index.
func (m *machineRT) correctedStats(p *pointRT, in drivers.VibrationIndicators) drivers.VibrationIndicators {
	if p.cfg.Role != "bearing" {
		return in
	}
	var base *pointRT
	for _, candidate := range m.points {
		if candidate.cfg.Role == "base" {
			base = candidate
			break
		}
	}
	if base == nil {
		return in
	}
	base.mu.Lock()
	baseStats := base.lastStats
	base.mu.Unlock()
	if baseStats == nil {
		return in
	}
	alpha := m.a.cfg.LocalUI.BaseAlpha
	if alpha <= 0 {
		alpha = 0.8
	}
	out := in
	defaults := [3]string{"radial_h", "axial", "radial_v"}
	for i, axis := range drivers.AxisNames {
		role := p.cfg.AxesMap[axis]
		if role == "" {
			role = defaults[i]
		}
		baseIdx := -1
		for j, baseAxis := range drivers.AxisNames {
			baseRole := base.cfg.AxesMap[baseAxis]
			if baseRole == "" {
				baseRole = defaults[j]
			}
			if baseRole == role {
				baseIdx = j
				break
			}
		}
		if baseIdx >= 0 && !math.IsNaN(in.VelRmsMMs[i]) && !math.IsNaN(baseStats.VelRmsMMs[baseIdx]) {
			out.VelRmsMMs[i] = math.Sqrt(math.Max(0, in.VelRmsMMs[i]*in.VelRmsMMs[i]-(alpha*baseStats.VelRmsMMs[baseIdx])*(alpha*baseStats.VelRmsMMs[baseIdx])))
		}
	}
	return out
}

func (m *machineRT) inIsolation(id string) bool {
	if !m.isolationEnabled() {
		return false
	}
	iso := m.cfg.Isolation
	return id == iso.ReferencePoint || id == iso.SourcePoint || m.inIsolationTargets(id)
}

func (m *machineRT) inIsolationTargets(id string) bool {
	if !m.isolationEnabled() {
		return false
	}
	for _, t := range m.cfg.Isolation.Targets {
		if t == id {
			return true
		}
	}
	return false
}

func (m *machineRT) meshHz() float64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.detectedMHz > 0 {
		return m.detectedMHz
	}
	return float64(m.cfg.MaleLobes) * m.f1xNom
}

// runLoad returns running flag and load % (NaN without meter).
func (m *machineRT) runLoad() (bool, float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	load := math.NaN()
	if m.lastPower != nil && m.cfg.Thermal.INA > 0 {
		load = meanI(m.lastPower.IA) / m.cfg.Thermal.INA * 100
	}
	return m.runState.Running(), load
}

func meanI(i [3]float64) float64 { return (i[0] + i[1] + i[2]) / 3 }

// stable gates periodic captures: running ≥ 120 s and current variation < 5 %.
func (m *machineRT) stable(now time.Time) bool { return m.runState.Stable(now, 120*time.Second, 5) }

// observeVibration updates the running flag when no power meter is available.
func (m *machineRT) observeVibration(p *pointRT, ind drivers.VibrationIndicators) {
	if m.meter != nil {
		return
	}
	_ = p
	_ = ind
	now := time.Now()
	m.mu.Lock()
	detection, legacyThreshold := m.cfg.RunDetection, m.cfg.RunningVrms
	m.mu.Unlock()

	matched := false
	if len(detection.Sources) == 0 { // legacy: any axis of every point
		for _, op := range m.points {
			op.mu.Lock()
			last := op.lastInd
			op.mu.Unlock()
			if last == nil {
				continue
			}
			for _, v := range last.VelMMs {
				if !math.IsNaN(v) && v > legacyThreshold {
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}
	} else {
		for _, source := range detection.Sources {
			op := m.pointByID(source.PointID)
			if op == nil {
				continue
			}
			op.mu.Lock()
			last := op.lastInd
			op.mu.Unlock()
			if last == nil {
				continue
			}
			for axis, name := range drivers.AxisNames {
				selected := len(source.Axes) == 0
				for _, a := range source.Axes {
					if a == name {
						selected = true
						break
					}
				}
				if selected && !math.IsNaN(last.VelMMs[axis]) && last.VelMMs[axis] > source.ThresholdMMs {
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}
	}

	current := m.runState.Running()
	if matched == current {
		m.runCandidateSince = time.Time{}
		m.runState.Update(now, current, math.NaN())
		return
	}
	if m.runCandidateSince.IsZero() || m.runCandidate != matched {
		m.runCandidate, m.runCandidateSince = matched, now
	}
	delay := time.Duration(detection.OnDelayS) * time.Second
	if !matched {
		delay = time.Duration(detection.OffDelayS) * time.Second
	}
	if now.Sub(m.runCandidateSince) >= delay {
		m.runState.Update(now, matched, math.NaN())
		m.runCandidateSince = time.Time{}
	} else {
		m.runState.Update(now, current, math.NaN())
	}
}

func (m *machineRT) setBearingTemp(point string, t float64) {
	m.mu.Lock()
	m.bearingTemps[point] = t
	m.mu.Unlock()
}

// run reads the power meter and temperatures and runs the thermal model.
func (m *machineRT) run(ctx context.Context) {
	iv := m.a.cfg.Intervals
	powerT := time.NewTicker(time.Duration(iv.PowerS) * time.Second)
	defer powerT.Stop()
	tempT := time.NewTicker(time.Duration(iv.TempS) * time.Second)
	defer tempT.Stop()
	window := time.Duration(iv.WindowS) * time.Second
	lastWindow := time.Now().Truncate(window)
	winT := time.NewTicker(time.Second)
	defer winT.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-powerT.C:
			m.readPower(ctx)
		case <-tempT.C:
			m.readTemps(ctx)
		case now := <-winT.C:
			if w := now.Truncate(window); w.After(lastWindow) {
				lastWindow = w
				m.flushWindow(w)
			}
		}
	}
}

func (m *machineRT) readPower(ctx context.Context) {
	if m.meter == nil {
		return
	}
	r, err := m.meter.Read(ctx)
	m.mu.Lock()
	if err != nil {
		m.meterFails++
		fails := m.meterFails
		m.mu.Unlock()
		if fails == 3 {
			m.a.log.Warn("power meter offline", "machine", m.cfg.ID, "err", err)
			m.a.emitSystem("sensor_fault", "power_meter_offline", "watch", "Mất kết nối đồng hồ điện: "+err.Error(), "machine", m.cfg.ID)
		}
		return
	}
	m.meterFails = 0
	m.powerWin = append(m.powerWin, r)
	m.lastPower = &r
	iN := m.cfg.Thermal.INA
	m.mu.Unlock()
	running := iN > 0 && meanI(r.IA) > 0.1*iN
	m.runState.Update(r.TS, running, meanI(r.IA))
}

func (m *machineRT) readTemps(ctx context.Context) {
	ctx = bus.WithPriority(ctx, bus.P1)
	cache := map[string][]drivers.ChannelValue{}
	for _, t := range m.cfg.Temps {
		key := fmt.Sprintf("%s/%d", t.Bus, t.Addr)
		vals, ok := cache[key]
		if !ok {
			mod := m.a.temps[key]
			if mod == nil {
				continue
			}
			var err error
			vals, err = mod.Read(ctx)
			if err != nil {
				m.a.log.Debug("pt100 read failed", "module", key, "err", err)
				continue
			}
			cache[key] = vals
		}
		if t.Channel < 1 || t.Channel > len(vals) || !vals[t.Channel-1].OK {
			continue
		}
		v := vals[t.Channel-1].TempC
		m.mu.Lock()
		switch t.Role {
		case "frame":
			m.frameC = v
		case "ambient":
			m.ambC = v
		case "bearing":
			m.ptBearingC = v
		}
		m.mu.Unlock()
	}
}

func unbalancePct(v [3]float64) float64 {
	mean := meanI(v)
	if mean <= 0 {
		return math.NaN()
	}
	dev := 0.0
	for _, x := range v {
		dev = math.Max(dev, math.Abs(x-mean))
	}
	return dev / mean * 100
}

func (m *machineRT) flushWindow(end time.Time) {
	m.mu.Lock()
	win := m.powerWin
	m.powerWin = nil
	frameC, ambC := m.frameC, m.ambC
	bearing := m.ptBearingC
	sensorTemp := math.NaN()
	for _, t := range m.bearingTemps {
		if math.IsNaN(sensorTemp) || t > sensorTemp {
			sensorTemp = t
		}
	}
	m.mu.Unlock()
	running, load := m.runLoad()
	source := "vibration"
	if m.meter != nil {
		source = "power"
	}
	// Persist the operating state independently of capture and power-meter
	// availability. This is the source of truth for Runtime and Run Rate.
	_ = m.a.up.Enqueue("metrics/run/"+m.cfg.ID, 1, store.PrioMetrics, runStateMetrics{
		MsgID: ulid.New(), TS: tsString(end), MachineID: m.cfg.ID, Running: running, Source: source,
	})
	m.a.view.SetMachineRunning(m.cfg.ID, running)
	var avgI [3]float64
	if len(win) > 0 {
		var p drivers.PowerReading
		for _, r := range win {
			for k := 0; k < 3; k++ {
				p.UV[k] += r.UV[k] / float64(len(win))
				p.IA[k] += r.IA[k] / float64(len(win))
			}
			p.PkW += r.PkW / float64(len(win))
			p.QkVar += r.QkVar / float64(len(win))
			p.PF += r.PF / float64(len(win))
			p.FHz += r.FHz / float64(len(win))
			p.THDUPct += r.THDUPct / float64(len(win))
			p.THDIPct += r.THDIPct / float64(len(win))
		}
		p.KWh = win[len(win)-1].KWh
		avgI = p.IA
		r1 := func(x [3]float64) [3]float64 {
			return [3]float64{math.Round(x[0]*10) / 10, math.Round(x[1]*10) / 10, math.Round(x[2]*10) / 10}
		}
		_ = m.a.up.Enqueue("metrics/power/"+m.cfg.ID, 1, store.PrioMetrics, powerMetrics{
			MsgID: ulid.New(), TS: tsString(end), WindowS: m.a.cfg.Intervals.WindowS, MachineID: m.cfg.ID,
			UV: r1(p.UV), IA: r1(p.IA), PkW: fptr(p.PkW), QkVar: fptr(p.QkVar), PF: fptr(p.PF), FHz: fptr(p.FHz),
			THDUPct: fptr(p.THDUPct), THDIPct: fptr(p.THDIPct), KWh: fptr(p.KWh),
			IUnbalancePct: fptr(unbalancePct(p.IA)), UUnbalancePct: fptr(unbalancePct(p.UV)), LoadPct: fptr(load), Running: running,
		})
	}
	// Thermal model every 60 s (only with a power meter).
	m.mu.Lock()
	doThermal := m.meter != nil && len(win) > 0 && end.Sub(m.lastThermalT) >= 60*time.Second
	// Spec 5.7: initialise ΔT from the frame temperature, so wait (≤ 5 min) for the first PT100 reading.
	if _, inited := m.model.State(); doThermal && !inited && math.IsNaN(frameC) && m.hasTempRole("frame") &&
		time.Since(m.started) < 5*time.Minute {
		doThermal = false
	}
	var out *thermal.Output
	if doThermal {
		dt := 60.0
		if !m.lastThermalT.IsZero() {
			dt = end.Sub(m.lastThermalT).Seconds()
		}
		o := m.model.Step(avgI[0], avgI[1], avgI[2], running, frameC, ambC, dt)
		m.lastThermal, m.lastThermalT = &o, end
	}
	out = m.lastThermal
	m.mu.Unlock()
	if math.IsNaN(frameC) && math.IsNaN(ambC) && math.IsNaN(bearing) && out == nil {
		return
	}
	msg := tempMetrics{MsgID: ulid.New(), TS: tsString(end), MachineID: m.cfg.ID, FrameTempC: fptr(frameC),
		AmbientTempC: fptr(ambC), BearingTempC: fptr(bearing), SensorTempC: fptr(sensorTemp), ThermalModel: thermal.Version}
	if out != nil {
		msg.WindingTempEstC = fptr(out.WindingTempC)
		msg.WindingRiseEstK = fptr(out.WindingRiseK)
	}
	_ = m.a.up.Enqueue("metrics/temp/"+m.cfg.ID, 1, store.PrioMetrics, msg)
	if doThermal && out != nil {
		r := m.a.cfg.Rules
		m.a.handleEvents(m.a.engine.Evaluate(rules.Observation{
			MachineID: m.cfg.ID, Rule: "winding_temp", Metric: "winding_temp_est_c", Value: out.WindingTempC,
			Limits:  rules.Thresholds{Warning: r.WindingWarningC, Danger: r.WindingAlarmC},
			Message: fmt.Sprintf("Nhiệt cuộn dây (ước lượng) %.1f °C vượt ngưỡng", out.WindingTempC),
		}, end))
	}
}

// --- Beer HN multi-sensor isolation ---

func (m *machineRT) pointByID(id string) *pointRT {
	for _, p := range m.points {
		if p.cfg.ID == id {
			return p
		}
	}
	return nil
}

// runIsolation performs synchronized group captures (reference, source, targets).
func (m *machineRT) runIsolation(ctx context.Context) {
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			if !m.groupTimer.Due(now) || !m.stable(now) {
				continue
			}
			m.groupTimer.Done(now)
			if err := m.groupCapture(ctx, bus.P2); err != nil {
				m.a.log.Warn("isolation group capture failed", "machine", m.cfg.ID, "err", err)
			}
		}
	}
}

func (m *machineRT) groupCapture(ctx context.Context, prio bus.Priority) error {
	iso := m.cfg.Isolation
	ref := m.pointByID(iso.ReferencePoint)
	if ref == nil {
		return fmt.Errorf("reference point missing")
	}
	results := map[string]*features.Result{}
	data := map[string]*capturedData{}
	order := []string{iso.ReferencePoint}
	if iso.SourcePoint != "" {
		order = append(order, iso.SourcePoint)
	}
	order = append(order, iso.Targets...)
	for _, id := range order {
		p := m.pointByID(id)
		if p == nil || !p.online(time.Now()) {
			continue
		}
		cd, err := p.acquire(ctx, iso.Profile, prio)
		if err != nil {
			m.a.log.Warn("group capture point failed", "point", id, "err", err)
			continue
		}
		res := features.Compute(cd.cap, p.featureContext())
		res.Features.MachineID = m.cfg.ID
		results[id], data[id] = res, cd
	}
	refRes := results[iso.ReferencePoint]
	if refRes == nil {
		return fmt.Errorf("reference capture failed")
	}
	srcRes := results[iso.SourcePoint]
	f1 := refRes.Features.SpeedHz
	for _, id := range iso.Targets {
		if r := results[id]; r != nil && r.Features.SpeedConfidence == "high" {
			f1 = r.Features.SpeedHz
			break
		}
	}
	lim := m.a.isoLimits(m.cfg)
	bandLimits := m.cfg.BandLimits
	if len(bandLimits) == 0 {
		bandLimits = rules.DefaultBandLimits
	}
	if m.a.cfg.Rules.BandLimitsEnforceRSS {
		bandLimits, _ = rules.EnforceRSS(bandLimits, lim.BC)
	}
	running, load := m.runLoad()
	// Mesh detection on S1 refines f_mesh.
	if srcRes != nil {
		var best dsp.MeshDetection
		for a := 0; a < 3; a++ {
			md := dsp.DetectMesh(srcRes.Spectra[a], f1, m.cfg.MaleLobes)
			if md.VelMMs > best.VelMMs {
				best = md
			}
		}
		if best.FreqHz > 0 && (best.MatchExpected || m.cfg.MaleLobes == 0) {
			m.mu.Lock()
			m.detectedMHz = best.FreqHz
			m.mu.Unlock()
		}
	}
	for _, id := range iso.Targets {
		tr := results[id]
		p := m.pointByID(id)
		if tr == nil || p == nil {
			continue
		}
		m.learnAlpha(id, tr, refRes, running, load)
		m.mu.Lock()
		alpha := m.alpha[id]
		m.mu.Unlock()
		in := features.IsolationInput{
			Target: tr.Spectra, Reference: refRes.Spectra, ReferenceCaptureID: refRes.Features.CaptureID,
			ReferencePoint: iso.ReferencePoint, SourcePoint: iso.SourcePoint, Alpha: alpha, F1xHz: f1,
			MaleLobes: m.cfg.MaleLobes, ISOBandHz: [2]float64{m.cfg.ISOBandHz[0], m.cfg.ISOBandHz[1]}, ISOLimits: lim,
			ISOAxes: p.cfg.ISOAxes, Bearing: p.cfg.Bearing.Geometry(), BandLimits: bandLimits,
			SourcePeakRatio: iso.SourcePeakRatio,
		}
		if srcRes != nil {
			in.Source, in.HasSource = srcRes.Spectra, true
		}
		tr.Features.Isolation = features.ComputeIsolation(in)
		// Criterion II on the isolated RMS.
		v := tr.Features.Isolation.ISOVrmsMax
		m.mu.Lock()
		prev, hasPrev := m.prevIsoRMS[id]
		m.prevIsoRMS[id] = v
		m.mu.Unlock()
		if hasPrev && !math.IsNaN(v) && running {
			thr := lim.Criterion2Threshold(iso.Criterion2Mode)
			m.a.handleEvents(m.a.engine.Evaluate(rules.Observation{
				MachineID: m.cfg.ID, PointID: id, Rule: "criterion2", Metric: "delta_iso_vrms_mm_s", Value: math.Abs(v - prev),
				Limits: rules.Thresholds{Watch: thr}, CaptureID: tr.Features.CaptureID,
				Message: fmt.Sprintf("Criterion II: ΔRMS %.2f mm/s > %.2f", math.Abs(v-prev), thr),
			}, time.Now()))
		}
	}
	for _, id := range order {
		if r := results[id]; r != nil {
			p := m.pointByID(id)
			p.persistAndPublish(data[id], r)
			p.evaluateCapture(r)
		}
	}
	return nil
}

// eventGroupCapture runs an urgent group capture, at most once per event-capture gap.
func (m *machineRT) eventGroupCapture() {
	gap := time.Duration(m.a.cfg.Rules.EventCaptureMinGapS) * time.Second
	m.mu.Lock()
	if time.Since(m.lastGroupEvent) < gap || m.a.ctx == nil {
		m.mu.Unlock()
		return
	}
	m.lastGroupEvent = time.Now()
	m.mu.Unlock()
	if err := m.groupCapture(m.a.ctx, bus.P0); err != nil {
		m.a.log.Warn("event group capture failed", "machine", m.cfg.ID, "err", err)
	}
}

// learnAlpha accumulates spectra at full load and fixes α(f_mesh·h) per target.
func (m *machineRT) learnAlpha(target string, tr, ref *features.Result, running bool, load float64) {
	iso := m.cfg.Isolation
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.alpha[target]) > 0 || !running {
		return
	}
	if !math.IsNaN(load) && load < iso.LearnMinLoadPct {
		return
	}
	l := m.learn[target]
	if l == nil {
		l = &alphaLearn{}
		m.learn[target] = l
	}
	for a := 0; a < 3; a++ {
		l.targets[a] = append(l.targets[a], tr.Spectra[a])
		l.refs[a] = append(l.refs[a], ref.Spectra[a])
	}
	l.n++
	if l.n < iso.LearnSamples {
		return
	}
	fm := m.detectedMHz
	if fm <= 0 {
		fm = float64(m.cfg.MaleLobes) * m.f1xNom
	}
	var table dsp.AlphaTable
	for h := 1; h <= iso.MeshHarmonics && fm > 0; h++ {
		f := float64(h) * fm
		if f > dsp.MaxAnalysisHz(tr.Spectra[0].Fs) {
			break
		}
		sum, cnt := 0.0, 0
		for a := 0; a < 3; a++ {
			al, n := dsp.LearnAlpha(l.targets[a], l.refs[a], f)
			if n > 0 {
				sum += al
				cnt++
			}
		}
		if cnt > 0 {
			table = append(table, dsp.AlphaPoint{FreqHz: math.Round(f*100) / 100, Alpha: math.Round(sum/float64(cnt)*1e4) / 1e4})
		}
	}
	delete(m.learn, target)
	if len(table) == 0 {
		return
	}
	m.alpha[target] = table
	b, _ := json.Marshal(table)
	_ = m.a.st.SetState("alpha/"+m.cfg.ID+"/"+target, string(b))
	go m.a.emitSystem("system", "alpha_learned", "info",
		fmt.Sprintf("Đã học hệ số truyền α cho %s: %s", target, string(b)), "machine", m.cfg.ID, "point", target)
}

// resetAlpha clears learned α so learning restarts (command learn_alpha).
func (m *machineRT) resetAlpha() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k := range m.alpha {
		delete(m.alpha, k)
		_ = m.a.st.SetState("alpha/"+m.cfg.ID+"/"+k, "[]")
	}
	m.learn = map[string]*alphaLearn{}
}

func (m *machineRT) restoreState() {
	if v, ok, _ := m.a.st.GetState("thermal/" + m.cfg.ID); ok {
		if dT, err := strconv.ParseFloat(v, 64); err == nil {
			m.model.Restore(dT)
		}
	}
	if m.cfg.Isolation != nil {
		for _, t := range m.cfg.Isolation.Targets {
			if len(m.alpha[t]) > 0 {
				continue // configured (pushed by server) wins
			}
			if v, ok, _ := m.a.st.GetState("alpha/" + m.cfg.ID + "/" + t); ok {
				var tab dsp.AlphaTable
				if json.Unmarshal([]byte(v), &tab) == nil && len(tab) > 0 {
					m.alpha[t] = tab
				}
			}
		}
	}
}

func (m *machineRT) saveState() {
	m.mu.Lock()
	dT, ok := m.model.State()
	m.mu.Unlock()
	if ok {
		_ = m.a.st.SetState("thermal/"+m.cfg.ID, strconv.FormatFloat(dT, 'f', 3, 64))
	}
}
