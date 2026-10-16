package agent

import (
	"context"
	"log/slog"
	"math"
	"sort"
	"sync"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/rules"
	"selink.vn/smartmotor/edge/internal/scheduler"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/ulid"
)

type captureRequest struct {
	profile string
	prio    bus.Priority
	cmdID   string
}

// pointRT is the runtime of one measurement point (one WTVB05).
type pointRT struct {
	a      *Agent
	m      *machineRT
	cfg    config.Point
	sensor *wtvb05.Sensor
	log    *slog.Logger

	mu          sync.Mutex
	win         []drivers.VibrationIndicators
	lastStats   *drivers.VibrationIndicators
	lastInd     *drivers.VibrationIndicators
	info        drivers.DeviceInfo
	fails       int
	offline     bool
	offlineEvID string
	nextTry     time.Time
	backoff     time.Duration
	lastOK      time.Time
	velHist     []float64 // 10 s window means, last hour, for spike detection
	quickVrms   float64

	timers       map[string]*scheduler.ProfileTimer
	captureMu    sync.Mutex
	lastEventCap time.Time
	reqs         chan captureRequest
	lastCapture  time.Time
}

func newPointRT(a *Agent, m *machineRT, pc config.Point, s *wtvb05.Sensor) *pointRT {
	p := &pointRT{a: a, m: m, cfg: pc, sensor: s, log: a.log.With("point", pc.ID),
		timers: map[string]*scheduler.ProfileTimer{}, reqs: make(chan captureRequest, 8), backoff: 5 * time.Second,
		quickVrms: math.NaN()}
	for _, pr := range pc.Profiles {
		if m.isolationEnabled() && pr.Name == m.cfg.Isolation.Profile && m.inIsolation(pc.ID) {
			continue // scheduled by the machine-level group capture
		}
		p.timers[pr.Name] = scheduler.NewProfileTimer(time.Duration(pr.EveryS)*time.Second, pc.ID+"/"+pr.Name)
	}
	return p
}

func (p *pointRT) profile(name string) (config.Profile, bool) {
	for _, pr := range p.cfg.Profiles {
		if pr.Name == name {
			return pr, true
		}
	}
	return config.Profile{}, false
}

func (p *pointRT) status() map[string]any {
	p.mu.Lock()
	defer p.mu.Unlock()
	st := map[string]any{"offline": p.offline, "fails": p.fails, "addr": p.cfg.Sensor.Addr, "sr_code": p.info.SrCode}
	if !p.lastOK.IsZero() {
		st["last_ok"] = tsString(p.lastOK)
	}
	if !p.lastCapture.IsZero() {
		st["last_capture"] = tsString(p.lastCapture)
	}
	if p.info.Firmware != "" {
		st["fw"] = p.info.Firmware
	}
	return st
}

// online returns false while the device is in offline backoff.
func (p *pointRT) online(now time.Time) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return !p.offline || !now.Before(p.nextTry)
}

func (p *pointRT) recordResult(err error) {
	p.mu.Lock()
	now := time.Now()
	if err == nil {
		wasOffline := p.offline
		p.fails, p.offline, p.backoff, p.lastOK = 0, false, 5*time.Second, now
		evID := p.offlineEvID
		p.mu.Unlock()
		if wasOffline {
			p.log.Info("sensor back online")
			p.a.emitSystem("sensor_fault", "device_offline", "warning", "Cảm biến kết nối lại", "machine", p.m.cfg.ID,
				"point", p.cfg.ID, "state", "cleared", "event_id", evID)
		}
		return
	}
	p.fails++
	goingOffline := !p.offline && p.fails >= 3
	if p.fails >= 3 {
		p.offline = true
		p.nextTry = now.Add(p.backoff)
		p.backoff = min(p.backoff*2, 60*time.Second)
	}
	if goingOffline {
		p.offlineEvID = "ev_" + ulid.New()
	}
	evID := p.offlineEvID
	p.mu.Unlock()
	if goingOffline {
		p.log.Warn("sensor offline", "err", err)
		p.a.emitSystem("sensor_fault", "device_offline", "warning", "Mất kết nối cảm biến: "+err.Error(),
			"machine", p.m.cfg.ID, "point", p.cfg.ID, "event_id", evID)
	}
}

// runIndicators reads B1/B2/B3 periodically and publishes aggregated windows.
func (p *pointRT) runIndicators(ctx context.Context) {
	iv := p.a.cfg.Intervals
	ctx = bus.WithPriority(ctx, bus.P1)
	if info, err := p.sensor.Info(ctx); err == nil {
		p.mu.Lock()
		p.info = info
		p.mu.Unlock()
		p.log.Info("sensor detected", "fw", info.Firmware, "sr", info.SrCode, "mode", info.Mode)
	} else {
		p.log.Warn("sensor info failed", "err", err)
	}
	b1Interval := time.Duration(iv.B1S) * time.Second
	if iv.B1MS > 0 {
		b1Interval = time.Duration(iv.B1MS) * time.Millisecond
	}
	window := time.Duration(iv.WindowS) * time.Second
	if iv.VibWindowMS > 0 {
		window = time.Duration(iv.VibWindowMS) * time.Millisecond
	}
	// Check often enough for sub-second B1 polling without spinning. Sensor reads
	// remain serialized by the priority bus, so waveform capture stays safe.
	tickInterval := 50 * time.Millisecond
	if quarter := b1Interval / 4; quarter > 0 && quarter < tickInterval {
		tickInterval = quarter
	}
	tick := time.NewTicker(tickInterval)
	defer tick.Stop()
	var lastB1, lastB2, lastB3 time.Time
	lastWindow := time.Now().Truncate(window)
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-tick.C:
			p.a.wd.Beat()
			if !p.online(now) {
				continue
			}
			if now.Sub(lastB1) >= b1Interval {
				lastB1 = now
				ind, err := p.sensor.ReadIndicators(ctx)
				p.recordResult(err)
				if err == nil {
					p.mu.Lock()
					p.win = append(p.win, ind)
					p.lastInd = &ind
					p.mu.Unlock()
					p.m.observeVibration(p, ind)
				}
			}
			if now.Sub(lastB2) >= time.Duration(iv.B2S)*time.Second {
				lastB2 = now
				st, err := p.sensor.ReadStatistics(ctx)
				p.recordResult(err)
				if err == nil {
					p.mu.Lock()
					p.lastStats = &st
					p.mu.Unlock()
					p.evaluateStats(st)
				}
			}
			if now.Sub(lastB3) >= time.Duration(iv.B3S)*time.Second {
				lastB3 = now
				e, err := p.sensor.ReadSpectrumEnergy(ctx)
				p.recordResult(err)
				if err == nil {
					p.publishEnergy(e)
				}
			}
			if w := now.Truncate(window); w.After(lastWindow) {
				lastWindow = w
				p.flushWindow(w)
			}
		}
	}
}

func agg(vals []float64) (mean, maxV float64) {
	n := 0
	mean, maxV = 0, math.NaN()
	for _, v := range vals {
		if math.IsNaN(v) {
			continue
		}
		mean += v
		n++
		if math.IsNaN(maxV) || v > maxV {
			maxV = v
		}
	}
	if n == 0 {
		return math.NaN(), math.NaN()
	}
	return mean / float64(n), maxV
}

func (p *pointRT) flushWindow(end time.Time) {
	p.mu.Lock()
	win := p.win
	p.win = nil
	stats := p.lastStats
	p.lastStats = nil
	info := p.info
	p.mu.Unlock()
	ts := tsString(end)
	unsynced := end.UTC().Year() < 2026
	if len(win) > 0 {
		var flags []string
		windowMS := int((time.Duration(p.a.cfg.Intervals.WindowS) * time.Second) / time.Millisecond)
		if p.a.cfg.Intervals.VibWindowMS > 0 {
			windowMS = p.a.cfg.Intervals.VibWindowMS
		}
		windowS := 0
		if windowMS%1000 == 0 {
			windowS = windowMS / 1000
		}
		msg := vibMetrics{MsgID: ulid.New(), TS: ts, WindowS: windowS, WindowMS: windowMS, PointID: p.cfg.ID,
			Sensor:  sensorInfo{Model: "WTVB05", Addr: p.cfg.Sensor.Addr, SrCode: info.SrCode, Mode: info.Mode, FW: info.Firmware},
			Samples: len(win), TimeUnsync: unsynced}
		col := func(f func(drivers.VibrationIndicators) float64) []float64 {
			out := make([]float64, len(win))
			for i, w := range win {
				out[i] = f(w)
			}
			return out
		}
		var velMeans [3]float64
		setXYZ := func(dst, dstMax *xyz, f func(drivers.VibrationIndicators, int) float64) {
			for a := 0; a < 3; a++ {
				a := a
				mean, mx := agg(col(func(w drivers.VibrationIndicators) float64 { return f(w, a) }))
				if dst != nil {
					*axisPtr(dst, a) = fptr(mean)
				}
				if dstMax != nil {
					*axisPtr(dstMax, a) = fptr(mx)
				}
			}
		}
		setXYZ(&msg.VelMMs, &msg.VelMMsMax, func(w drivers.VibrationIndicators, a int) float64 { return w.VelMMs[a] })
		setXYZ(&msg.DispUm, nil, func(w drivers.VibrationIndicators, a int) float64 { return w.DispUm[a] })
		setXYZ(&msg.FreqHz, nil, func(w drivers.VibrationIndicators, a int) float64 { return w.FreqHz[a] })
		setXYZ(&msg.AccG, nil, func(w drivers.VibrationIndicators, a int) float64 { return w.AccG[a] })
		for a := 0; a < 3; a++ {
			if v := *axisPtr(&msg.VelMMs, a); v != nil {
				velMeans[a] = *v
			}
		}
		tMean, _ := agg(col(func(w drivers.VibrationIndicators) float64 { return w.TempC }))
		msg.TempC = fptr(tMean)
		if tMean < -20 || tMean > 85 {
			flags = append(flags, "out_of_range")
		}
		vmax := math.Max(velMeans[0], math.Max(velMeans[1], velMeans[2]))
		if p.spike(vmax) {
			flags = append(flags, "spike")
		}
		if unsynced {
			flags = append(flags, "time_unsynced")
		}
		if flags == nil {
			flags = []string{}
		}
		msg.Flags = flags
		_ = p.a.up.Enqueue("metrics/vib/"+p.cfg.ID, 1, store.PrioMetrics, msg)
		// Bearing housing temperature from the sensor itself.
		if p.cfg.Role == "bearing" && !math.IsNaN(tMean) {
			p.a.handleEvents(p.a.engine.Evaluate(rules.Observation{
				MachineID: p.m.cfg.ID, PointID: p.cfg.ID, Rule: "bearing_temp", Metric: "temp_c", Value: tMean,
				Limits:  rules.Thresholds{Warning: p.a.cfg.Rules.BearingTempWarningC, Danger: p.a.cfg.Rules.BearingTempAlarmC},
				Message: "Nhiệt độ ổ đỡ vượt ngưỡng",
			}, end))
			p.m.setBearingTemp(p.cfg.ID, tMean)
		}
	}
	if stats != nil {
		msg := vibStat{MsgID: ulid.New(), TS: ts, PointID: p.cfg.ID, SrCode: info.SrCode, Mode: info.Mode,
			Source: "sensor_b2", Axes: map[string]vibStatAxis{}, Flags: []string{}}
		for a := 0; a < 3; a++ {
			msg.Axes[drivers.AxisNames[a]] = vibStatAxis{
				Crest: fptr(stats.CrestFactor[a]), Kurtosis: fptr(stats.Kurtosis[a]), AccAbsMeanG: fptr(stats.AccAbsMeanG[a]),
				AccVarG: fptr(stats.AccVarG[a]), AccRmsG: fptr(stats.AccRmsG[a]), WaveIndex: fptr(stats.WaveIndex[a]),
				PeakIndex: fptr(stats.PeakIndex[a]), PulseCoef: fptr(stats.PulseCoef[a]), Skew: fptr(stats.Skewness[a]),
				VelRmsMMs: fptr(stats.VelRmsMMs[a]), VelKurt: fptr(stats.VelKurt[a]), DispRmsMm: fptr(stats.DispRmsMm[a]),
				ErrCode: int(stats.ErrCode[a]),
			}
		}
		_ = p.a.up.Enqueue("metrics/vibstat/"+p.cfg.ID, 1, store.PrioMetrics, msg)
	}
}

func axisPtr(v *xyz, a int) **float64 {
	switch a {
	case 0:
		return &v.X
	case 1:
		return &v.Y
	}
	return &v.Z
}

// spike flags a value deviating more than 10× from the 1-hour median (spec 5.5).
func (p *pointRT) spike(v float64) bool {
	if math.IsNaN(v) {
		return false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	h := append([]float64(nil), p.velHist...)
	p.velHist = append(p.velHist, v)
	if len(p.velHist) > 360 {
		p.velHist = p.velHist[len(p.velHist)-360:]
	}
	if len(h) < 30 {
		return false
	}
	sort.Float64s(h)
	med := h[len(h)/2]
	return med > 0.05 && math.Abs(v-med) > 10*med
}

func (p *pointRT) publishEnergy(e drivers.SpectrumEnergy) {
	msg := vibEnergy{MsgID: ulid.New(), TS: tsString(e.TS), PointID: p.cfg.ID, Axes: map[string]energyAxis{}}
	for a := 0; a < 3; a++ {
		msg.Axes[drivers.AxisNames[a]] = energyAxis{Points: e.Points[a][:], Areas: e.Areas[a][:], Total: e.Total[a]}
	}
	_ = p.a.up.Enqueue("metrics/vibenergy/"+p.cfg.ID, 0, store.PrioMetrics, msg)
}

func (p *pointRT) isoAxesIdx() []int {
	var out []int
	for _, n := range p.cfg.ISOAxes {
		for a, an := range drivers.AxisNames {
			if an == n {
				out = append(out, a)
			}
		}
	}
	return out
}

// evaluateStats applies quick rules between captures using sensor-computed VRMS
// (registers 0x50/0x5C/0x68) and kurtosis.
func (p *pointRT) evaluateStats(st drivers.VibrationIndicators) {
	now := time.Now()
	v := math.NaN()
	k := math.NaN()
	for _, a := range p.isoAxesIdx() {
		if !math.IsNaN(st.VelRmsMMs[a]) && (math.IsNaN(v) || st.VelRmsMMs[a] > v) {
			v = st.VelRmsMMs[a]
		}
		if !math.IsNaN(st.Kurtosis[a]) && (math.IsNaN(k) || st.Kurtosis[a] > k) {
			k = st.Kurtosis[a]
		}
	}
	p.mu.Lock()
	p.quickVrms = v
	p.mu.Unlock()
	if p.cfg.Role != "bearing" || math.IsNaN(v) || !p.m.runState.Running() {
		return
	}
	var evs []rules.Event
	lim := p.a.isoLimits(p.m.cfg)
	// For isolation machines the raw sensor VRMS still contains compressor noise:
	// ISO zone alarms come from isolated captures only.
	if !p.m.isolationEnabled() {
		evs = append(evs, p.a.engine.Evaluate(rules.ISOObservation(p.m.cfg.ID, p.cfg.ID, v, lim, "", "sensor_vrms"), now)...)
	}
	if !math.IsNaN(k) {
		evs = append(evs, p.a.engine.Evaluate(rules.Observation{
			MachineID: p.m.cfg.ID, PointID: p.cfg.ID, Rule: "kurtosis", Metric: "kurtosis", Value: k,
			Limits: rules.Thresholds{Watch: p.a.cfg.Rules.KurtosisWatch}, Message: "Kurtosis cao – nghi va đập/vòng bi",
		}, now)...)
	}
	if r := p.a.rate.Ratio(p.cfg.ID, now, v); r > 0 && v > lim.AB {
		evs = append(evs, p.a.engine.Evaluate(rules.Observation{
			MachineID: p.m.cfg.ID, PointID: p.cfg.ID, Rule: "rate", Metric: "vel_rms_ratio_10min", Value: r,
			Limits: rules.Thresholds{Danger: p.a.cfg.Rules.RateFactor}, Immediate: true,
			Message: "Rung tăng đột biến > 2× trong 10 phút",
		}, now)...)
	}
	for _, b := range p.cfg.Baselines {
		if b.Feature == "vel_rms_mm_s" {
			evs = append(evs, p.a.engine.Evaluate(rules.Observation{
				MachineID: p.m.cfg.ID, PointID: p.cfg.ID, Rule: "baseline", Metric: b.Feature, Value: v,
				Limits: rules.Thresholds{Watch: b.Warn, Warning: b.Alarm}, Message: "Vượt ngưỡng baseline " + b.Feature,
			}, now)...)
		}
	}
	p.a.handleEvents(evs)
}

// requestEventCapture schedules an urgent capture (orders + bearing), max once per gap.
func (p *pointRT) requestEventCapture() {
	gap := time.Duration(p.a.cfg.Rules.EventCaptureMinGapS) * time.Second
	p.mu.Lock()
	if time.Since(p.lastEventCap) < gap {
		p.mu.Unlock()
		return
	}
	p.lastEventCap = time.Now()
	p.mu.Unlock()
	group := p.m.inIsolation(p.cfg.ID)
	if group {
		// Isolation points need a synchronized group capture (S2/S1/S3/S4) to compute A_iso.
		go p.m.eventGroupCapture()
	}
	for _, pr := range p.cfg.Profiles {
		if group && pr.Name == p.m.cfg.Isolation.Profile {
			continue
		}
		select {
		case p.reqs <- captureRequest{profile: pr.Name, prio: bus.P0}:
		default:
		}
	}
}
