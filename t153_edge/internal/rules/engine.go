package rules

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// Severity levels.
const (
	LevelNormal = iota
	LevelWatch
	LevelWarning
	LevelDanger
)

// SeverityName maps level to the MQTT/DB severity string.
var SeverityName = map[int]string{LevelNormal: "normal", LevelWatch: "watch", LevelWarning: "warning", LevelDanger: "danger"}

// Thresholds of one rule: value > T[level] means at least that level. Zero disables a level.
type Thresholds struct {
	Watch, Warning, Danger float64
}

func (t Thresholds) level(v float64, hysteresis float64) int {
	if math.IsNaN(v) {
		return LevelNormal
	}
	f := 1 - hysteresis
	switch {
	case t.Danger > 0 && v > t.Danger*f:
		return LevelDanger
	case t.Warning > 0 && v > t.Warning*f:
		return LevelWarning
	case t.Watch > 0 && v > t.Watch*f:
		return LevelWatch
	}
	return LevelNormal
}

func (t Thresholds) of(level int) float64 {
	switch level {
	case LevelWatch:
		return t.Watch
	case LevelWarning:
		return t.Warning
	case LevelDanger:
		return t.Danger
	}
	return 0
}

// Observation is one evaluated measurement.
type Observation struct {
	MachineID string
	PointID   string
	Rule      string // iso_zone | baseline | band | kurtosis | winding_temp | bearing_temp | rate | criterion2
	Metric    string
	Value     float64
	Limits    Thresholds
	Message   string // message template; %s replaced by severity label
	CaptureID string
	// Immediate skips persistence (e.g. rate rule already integrates over time).
	Immediate bool
}

// Event is emitted when a rule raises, escalates or clears.
type Event struct {
	TS        time.Time
	EventID   string
	State     string // raised | cleared
	Severity  string
	MachineID string
	PointID   string
	Rule      string
	Metric    string
	Value     float64
	Threshold float64
	Message   string
	CaptureID string
}

type ruleState struct {
	hist      []int
	active    int
	eventID   string
	belowRun  int
	lastValue float64
}

// Engine keeps per-(point,rule,metric) persistence state.
type Engine struct {
	N, M       int     // raise when level holds in >= N of last M evaluations
	ClearAfter int     // consecutive evaluations below active level to clear
	Hysteresis float64 // fraction (0.1 = 10%)

	mu    sync.Mutex
	state map[string]*ruleState
	seq   uint64
}

// NewEngine creates an engine with spec defaults (3/5, clear after 5, 10% hysteresis).
func NewEngine(n, m int) *Engine {
	if n <= 0 || m <= 0 || n > m {
		n, m = 3, 5
	}
	return &Engine{N: n, M: m, ClearAfter: 5, Hysteresis: 0.10, state: map[string]*ruleState{}}
}

// Evaluate updates state with an observation and returns resulting events.
func (e *Engine) Evaluate(o Observation, now time.Time) []Event {
	e.mu.Lock()
	defer e.mu.Unlock()
	key := o.MachineID + "|" + o.PointID + "|" + o.Rule + "|" + o.Metric
	st := e.state[key]
	if st == nil {
		st = &ruleState{}
		e.state[key] = st
	}
	st.lastValue = o.Value
	// Raw level (no hysteresis) for raising; hysteresis applies to keeping the active level.
	raw := o.Limits.level(o.Value, 0)
	keep := o.Limits.level(o.Value, e.Hysteresis) >= st.active && st.active > 0
	st.hist = append(st.hist, raw)
	if len(st.hist) > e.M {
		st.hist = st.hist[len(st.hist)-e.M:]
	}
	candidate := raw
	if !o.Immediate {
		candidate = LevelNormal
		for lvl := LevelDanger; lvl > LevelNormal; lvl-- {
			cnt := 0
			for _, h := range st.hist {
				if h >= lvl {
					cnt++
				}
			}
			if cnt >= e.N {
				candidate = lvl
				break
			}
		}
	}
	var out []Event
	switch {
	case candidate > st.active:
		if st.active > LevelNormal {
			out = append(out, e.event(o, st, "cleared", st.active, now))
		}
		st.active = candidate
		st.belowRun = 0
		e.seq++
		st.eventID = fmt.Sprintf("ev_%s_%d", now.UTC().Format("20060102T150405Z"), e.seq)
		out = append(out, e.event(o, st, "raised", candidate, now))
	case st.active > LevelNormal && !keep:
		st.belowRun++
		if st.belowRun >= e.ClearAfter {
			out = append(out, e.event(o, st, "cleared", st.active, now))
			st.active = LevelNormal
			st.belowRun = 0
			st.hist = nil
		}
	default:
		st.belowRun = 0
	}
	return out
}

func (e *Engine) event(o Observation, st *ruleState, state string, level int, now time.Time) Event {
	msg := o.Message
	if msg == "" {
		msg = fmt.Sprintf("%s vượt ngưỡng", o.Metric)
	}
	return Event{
		TS: now.UTC(), EventID: st.eventID, State: state, Severity: SeverityName[level],
		MachineID: o.MachineID, PointID: o.PointID, Rule: o.Rule, Metric: o.Metric,
		Value: o.Value, Threshold: o.Limits.of(level), Message: msg, CaptureID: o.CaptureID,
	}
}

// ActiveMax returns the highest active level, optionally limited to one machine ("" = all).
func (e *Engine) ActiveMax(machineID string) int {
	e.mu.Lock()
	defer e.mu.Unlock()
	maxL := LevelNormal
	for k, st := range e.state {
		if machineID != "" && !hasPrefix(k, machineID+"|") {
			continue
		}
		if st.active > maxL {
			maxL = st.active
		}
	}
	return maxL
}

func hasPrefix(s, p string) bool { return len(s) >= len(p) && s[:len(p)] == p }

// ISOObservation builds thresholds per spec 5.8.2: watch > 0.8*B/C, warning zone C, danger zone D.
func ISOObservation(machine, point string, v float64, l ISOLimits, captureID, source string) Observation {
	return Observation{
		MachineID: machine, PointID: point, Rule: "iso_zone", Metric: "iso_vrms_mm_s", Value: v,
		Limits:    Thresholds{Watch: 0.8 * l.BC, Warning: l.BC, Danger: l.CD},
		Message:   fmt.Sprintf("Rung %.2f mm/s – vùng %s (ISO 20816-3, nguồn %s)", v, l.Zone(v), source),
		CaptureID: captureID,
	}
}

// RateTracker detects a > factor× increase within a window (spec: danger if > 2× in 10 min).
type RateTracker struct {
	Window time.Duration
	mu     sync.Mutex
	hist   map[string][]rateSample
}

type rateSample struct {
	t time.Time
	v float64
}

// NewRateTracker creates a tracker.
func NewRateTracker(window time.Duration) *RateTracker {
	return &RateTracker{Window: window, hist: map[string][]rateSample{}}
}

// Ratio adds a sample and returns current / min-in-window (0 if not enough data).
func (r *RateTracker) Ratio(key string, now time.Time, v float64) float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	h := append(r.hist[key], rateSample{now, v})
	cut := 0
	for cut < len(h) && now.Sub(h[cut].t) > r.Window {
		cut++
	}
	h = h[cut:]
	r.hist[key] = h
	if len(h) < 3 || now.Sub(h[0].t) < r.Window/2 {
		return 0
	}
	minV := math.Inf(1)
	for _, s := range h[:len(h)-1] {
		minV = math.Min(minV, s.v)
	}
	if minV <= 0 {
		return 0
	}
	return v / minV
}
