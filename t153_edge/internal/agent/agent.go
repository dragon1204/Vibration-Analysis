// Package agent wires drivers, scheduling, DSP, rules, storage and uplink into the
// single edge-agent process (spec 5.2).
package agent

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"os"
	"sync"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/drivers/powermeter"
	"selink.vn/smartmotor/edge/internal/drivers/pt100mod"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/health"
	"selink.vn/smartmotor/edge/internal/localalarm"
	"selink.vn/smartmotor/edge/internal/rules"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/ulid"
	"selink.vn/smartmotor/edge/internal/uplink"
	"selink.vn/smartmotor/edge/internal/version"
)

// Options for the agent process.
type Options struct {
	ConfigPath string
	BinaryPath string
	// OnReload is called when a reload is requested (config downlink or command).
	OnReload func()
}

// Agent is one running instance bound to a configuration.
type Agent struct {
	cfg   *config.Config
	opt   Options
	log   *slog.Logger
	st    *store.Store
	up    *uplink.Client
	buses map[string]*bus.Manager
	temps map[string]*pt100mod.Module // key bus/addr

	machines []*machineRT
	points   map[string]*pointRT

	engine *rules.Engine
	rate   *rules.RateTracker
	alarm  *localalarm.Alarm
	health *health.Collector
	wd     *health.Watchdog

	wg  sync.WaitGroup
	ctx context.Context // root context of Run (for event-triggered background work)
}

// New builds an agent from configuration.
func New(cfg *config.Config, opt Options, log *slog.Logger) (*Agent, error) {
	st, err := store.Open(cfg.Storage.Dir)
	if err != nil {
		return nil, fmt.Errorf("store: %w", err)
	}
	up, err := uplink.New(cfg, st, log)
	if err != nil {
		st.Close()
		return nil, err
	}
	a := &Agent{
		cfg: cfg, opt: opt, log: log, st: st, up: up,
		buses: map[string]*bus.Manager{}, temps: map[string]*pt100mod.Module{}, points: map[string]*pointRT{},
		engine: rules.NewEngine(cfg.Rules.Persistence.N, cfg.Rules.Persistence.M),
		rate:   rules.NewRateTracker(time.Duration(cfg.Rules.RateWindowS) * time.Second),
		alarm:  localalarm.New(cfg.LocalAlarm.Enabled, cfg.LocalAlarm.RelayGPIO, cfg.LocalAlarm.BuzzerGPIO, cfg.LocalAlarm.Buzzer, log),
		health: health.NewCollector(cfg.Health.ThermalZone, cfg.Health.ModemATPort),
		wd:     health.NewWatchdog(cfg.Health.Watchdog, log),
	}
	if opt.BinaryPath != "" {
		up.OnConnect = func() { _ = os.Remove(opt.BinaryPath + ".pending") } // OTA confirmed
	}
	busCfg := map[string]config.Bus{}
	for _, b := range cfg.Buses {
		busCfg[b.ID] = b
		a.buses[b.ID] = bus.New(b.ID, b.Device, b.Baud, log)
	}
	modCfg := map[string]config.TempModule{}
	for _, tm := range cfg.TempModules {
		modCfg[fmt.Sprintf("%s/%d", tm.Bus, tm.Addr)] = tm
	}
	for i := range cfg.Machines {
		mc := cfg.Machines[i]
		m := newMachineRT(a, mc)
		for _, t := range mc.Temps {
			key := fmt.Sprintf("%s/%d", t.Bus, t.Addr)
			if _, ok := a.temps[key]; ok {
				continue
			}
			tm := modCfg[key]
			a.temps[key] = pt100mod.New(a.buses[t.Bus], pt100mod.Options{
				ID: "pt100@" + key, Addr: byte(t.Addr), Channels: tm.Channels, RegBase: uint16(tm.RegBase),
				Function: byte(tm.Function), Scale: tm.Scale, Offset: tm.Offset,
				Timeout: time.Duration(busCfg[t.Bus].TimeoutMs) * time.Millisecond,
			})
		}
		if pm := mc.PowerMeter; pm != nil {
			switch pm.Driver {
			case "sim":
				m.meter = powermeter.NewSim(mc.Thermal.INA, pm.VoltageV)
			case "modbus_tcp", "":
				rm := pm.CustomMap
				if len(rm) == 0 {
					rm = powermeter.Maps[pm.RegisterMap]
				}
				if len(rm) == 0 {
					log.Warn("unknown power meter register map, meter disabled", "machine", mc.ID, "map", pm.RegisterMap)
				} else {
					port := pm.Port
					if port == 0 {
						port = 502
					}
					m.meter = powermeter.NewTCP(pm.Host, port, byte(pm.UnitID), rm)
				}
			}
		}
		for _, pc := range mc.Points {
			b := busCfg[pc.Sensor.Bus]
			s := wtvb05.New(a.buses[pc.Sensor.Bus], wtvb05.Options{
				ID: pc.ID, Addr: byte(pc.Sensor.Addr), VelocityScale: pc.Sensor.VelocityScale,
				Timeout: time.Duration(b.TimeoutMs) * time.Millisecond, RawTimeout: time.Duration(b.RawTimeoutMs) * time.Millisecond,
				Baud: b.Baud,
			}, log)
			p := newPointRT(a, m, pc, s)
			m.points = append(m.points, p)
			a.points[pc.ID] = p
		}
		m.restoreState()
		a.machines = append(a.machines, m)
	}
	return a, nil
}

// Run starts all loops and blocks until ctx is cancelled.
func (a *Agent) Run(ctx context.Context) error {
	a.log.Info("edge-agent starting", "version", version.Version, "gateway", a.cfg.Gateway.ID,
		"machines", len(a.machines), "points", len(a.points))
	defer a.st.Close()
	a.ctx = ctx
	stopWD := make(chan struct{})
	go a.wd.Run(stopWD)
	defer close(stopWD)

	busCtx, busCancel := context.WithCancel(context.Background())
	for _, b := range a.buses {
		a.wg.Add(1)
		go func(b *bus.Manager) { defer a.wg.Done(); b.Run(busCtx) }(b)
	}
	a.goLoop(ctx, a.up.Run)
	for _, m := range a.machines {
		m := m
		a.goLoop(ctx, m.run)
		for _, p := range m.points {
			p := p
			a.goLoop(ctx, p.runIndicators)
			a.goLoop(ctx, p.runCaptures)
		}
		if m.isolationEnabled() {
			a.goLoop(ctx, m.runIsolation)
		}
	}
	a.goLoop(ctx, a.runHealth)
	a.goLoop(ctx, a.runCommands)
	a.goLoop(ctx, a.runHousekeeping)
	a.emitSystem("system", "agent_started", "info", fmt.Sprintf("edge-agent %s khởi động", version.Version))

	<-ctx.Done()
	a.log.Info("edge-agent stopping")
	busCancel()
	a.wg.Wait()
	a.saveState()
	for _, m := range a.machines {
		if m.meter != nil {
			_ = m.meter.Close()
		}
	}
	return nil
}

func (a *Agent) goLoop(ctx context.Context, fn func(context.Context)) {
	a.wg.Add(1)
	go func() {
		defer a.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				a.log.Error("loop panic", "panic", r)
			}
		}()
		fn(ctx)
	}()
}

func tsString(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func fptr(v float64) *float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return nil
	}
	r := math.Round(v*10000) / 10000
	return &r
}

// handleEvents publishes rule events, drives the local alarm and triggers event captures.
func (a *Agent) handleEvents(evs []rules.Event) {
	for _, e := range evs {
		p := eventPayload{
			MsgID: ulid.New(), TS: tsString(e.TS), EventID: e.EventID, Type: "alarm", State: e.State,
			Severity: e.Severity, MachineID: e.MachineID, PointID: e.PointID, Rule: e.Rule, Metric: e.Metric,
			Value: fptr(e.Value), Threshold: fptr(e.Threshold), Message: e.Message, CaptureID: e.CaptureID, Source: "edge",
		}
		if err := a.up.Enqueue("events", 1, store.PrioEvent, p); err != nil {
			a.log.Error("enqueue event", "err", err)
		}
		a.log.Info("alarm event", "state", e.State, "severity", e.Severity, "point", e.PointID, "rule", e.Rule, "value", e.Value)
		if e.State == "raised" && (e.Severity == "warning" || e.Severity == "danger") && e.PointID != "" {
			if pt := a.points[e.PointID]; pt != nil {
				pt.requestEventCapture()
			}
		}
	}
	minLvl := rules.LevelWarning
	for l, n := range rules.SeverityName {
		if n == a.cfg.LocalAlarm.MinSeverity {
			minLvl = l
		}
	}
	a.alarm.Set(a.engine.ActiveMax("") >= minLvl)
}

// emitSystem publishes a non-rule event (sensor_fault, system, gateway).
func (a *Agent) emitSystem(typ, rule, severity, msg string, kv ...string) {
	p := eventPayload{MsgID: ulid.New(), TS: tsString(time.Now()), EventID: "ev_" + ulid.New(), Type: typ,
		State: "raised", Severity: severity, Rule: rule, Message: msg, Source: "edge"}
	for i := 0; i+1 < len(kv); i += 2 {
		switch kv[i] {
		case "machine":
			p.MachineID = kv[i+1]
		case "point":
			p.PointID = kv[i+1]
		case "state":
			p.State = kv[i+1]
		case "event_id":
			p.EventID = kv[i+1]
		}
	}
	_ = a.up.Enqueue("events", 1, store.PrioEvent, p)
}

func (a *Agent) runHealth(ctx context.Context) {
	t := time.NewTicker(time.Duration(a.cfg.Intervals.HealthS) * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		a.wd.Beat()
		r := health.Report{MsgID: ulid.New(), TS: tsString(time.Now()), Version: version.Version,
			MQTTConnected: a.up.Connected(), BusStats: map[string]any{}, Devices: map[string]any{}, LocalAlarm: a.alarm.State()}
		a.health.Fill(&r, a.st.Dir())
		r.OutboxPending, _ = a.st.PendingCount()
		r.DataUsedMB = math.Round(float64(a.st.DiskUsage())/(1<<20)*10) / 10
		for id, b := range a.buses {
			r.BusStats[id] = map[string]any{"queue": b.QueueLen(), "devices": b.Stats()}
		}
		for id, p := range a.points {
			r.Devices[id] = p.status()
		}
		_ = a.up.Enqueue("health", 0, store.PrioMetrics, r)
	}
}

func (a *Agent) runHousekeeping(ctx context.Context) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	save := time.NewTicker(5 * time.Minute)
	defer save.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-save.C:
			a.saveState()
		case <-t.C:
			n, err := a.st.Prune(a.cfg.Storage.RetentionDays, a.cfg.Storage.MaxBytes)
			if err != nil {
				a.log.Warn("prune failed", "err", err)
			} else if n > 0 {
				a.log.Info("pruned files", "count", n)
			}
		}
	}
}

func (a *Agent) saveState() {
	for _, m := range a.machines {
		m.saveState()
	}
}

// --- helpers shared by point/machine runtimes ---

func (a *Agent) isoLimits(m config.Machine) rules.ISOLimits {
	return rules.ISOThresholds(m.ISOGroup, m.Foundation)
}
