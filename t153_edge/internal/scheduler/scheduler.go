// Package scheduler provides timing helpers: capture profile timers with phase
// offsets (so points do not hit the bus at the same time) and the machine
// running/stability detector that gates captures (spec 5.4.2).
package scheduler

import (
	"hash/fnv"
	"math"
	"sync"
	"time"
)

// ProfileTimer fires every Every, shifted by a deterministic per-key offset.
type ProfileTimer struct {
	Every  time.Duration
	Offset time.Duration
	last   time.Time
}

// NewProfileTimer creates a timer; key (e.g. point/profile) determines the phase offset.
func NewProfileTimer(every time.Duration, key string) *ProfileTimer {
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	off := time.Duration(0)
	if every > 0 {
		off = time.Duration(h.Sum32()) % every
	}
	return &ProfileTimer{Every: every, Offset: off}
}

// Due reports whether the current slot has not run yet.
func (p *ProfileTimer) Due(now time.Time) bool {
	if p.Every <= 0 {
		return false
	}
	slot := now.Add(-p.Offset).Truncate(p.Every).Add(p.Offset)
	return p.last.Before(slot)
}

// Done marks the current slot as executed.
func (p *ProfileTimer) Done(now time.Time) { p.last = now }

// RunState tracks whether a machine is running and stable.
type RunState struct {
	mu       sync.Mutex
	running  bool
	since    time.Time
	currents []sample
}

type sample struct {
	t time.Time
	v float64
}

// Update records the latest running flag and current (NaN if no meter).
func (r *RunState) Update(now time.Time, running bool, current float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if running != r.running {
		r.running, r.since = running, now
		r.currents = nil
	}
	if !math.IsNaN(current) {
		r.currents = append(r.currents, sample{now, current})
		cut := 0
		for cut < len(r.currents) && now.Sub(r.currents[cut].t) > 60*time.Second {
			cut++
		}
		r.currents = r.currents[cut:]
	}
}

// Running returns the current flag.
func (r *RunState) Running() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.running
}

// Stable: running for >= minRun and current variation over the last 60 s < maxVarPct.
func (r *RunState) Stable(now time.Time, minRun time.Duration, maxVarPct float64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.running || now.Sub(r.since) < minRun {
		return false
	}
	if len(r.currents) < 2 {
		return true // no meter: running time is the only criterion
	}
	lo, hi, sum := math.Inf(1), math.Inf(-1), 0.0
	for _, s := range r.currents {
		lo, hi = math.Min(lo, s.v), math.Max(hi, s.v)
		sum += s.v
	}
	mean := sum / float64(len(r.currents))
	return mean > 0 && (hi-lo)/mean*100 < maxVarPct
}
