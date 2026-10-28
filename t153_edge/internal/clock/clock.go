// Package clock tells whether the wall clock can be trusted and measures the step applied to it.
//
// The T153 has no RTC battery: after a power loss it boots with a stale time (the last saved one),
// typically minutes or hours behind. Data measured before the clock is verified carries that wrong
// time. The agent starts an "epoch" for such data; once the clock is verified (NTP, or the server's
// HTTP Date header), the step is the difference between how far the wall clock moved and how far
// the monotonic clock moved. Adding it to the epoch's timestamps gives the true measurement time.
package clock

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// MarkerFile is written by edge-provision after it set the clock from the server (tmpfs: per boot).
const MarkerFile = "/run/smartmotor-clock-set"

// Options are the probes; tests replace them.
type Options struct {
	ServerURL  string
	NTPSynced  func() bool
	ServerDate func(ctx context.Context) (time.Time, error)
	SetClock   func(t time.Time) error
	Wall       func() time.Time     // wall clock (no monotonic reading)
	Elapsed    func() time.Duration // monotonic time since the clock was created
	OnResolve  func(epoch string, stepS float64)
}

// Clock tracks verification of the wall clock for this process.
type Clock struct {
	opt      Options
	wall0    time.Time
	epoch    string
	mu       sync.Mutex
	verified bool
	step     float64
	at       time.Time
}

// New checks the clock once; an unverified clock opens an epoch for the data measured from now on.
func New(opt Options) *Clock {
	start := time.Now()
	if opt.Wall == nil {
		opt.Wall = func() time.Time { return time.Now().Round(0) }
	}
	if opt.Elapsed == nil {
		opt.Elapsed = func() time.Duration { return time.Since(start) }
	}
	if opt.NTPSynced == nil {
		opt.NTPSynced = func() bool {
			if _, err := os.Stat(MarkerFile); err == nil {
				return true
			}
			out, _ := exec.Command("timedatectl", "show", "-p", "NTPSynchronized", "--value").Output()
			return strings.TrimSpace(string(out)) == "yes"
		}
	}
	if opt.ServerDate == nil {
		opt.ServerDate = func(ctx context.Context) (time.Time, error) { return httpDate(ctx, opt.ServerURL) }
	}
	if opt.SetClock == nil {
		opt.SetClock = func(t time.Time) error {
			out, err := exec.Command("date", "-u", "-s", "@"+fmt.Sprint(t.Unix())).CombinedOutput()
			if err != nil {
				return fmt.Errorf("%v %s", err, out)
			}
			return nil
		}
	}
	c := &Clock{opt: opt, wall0: opt.Wall()}
	if opt.NTPSynced() {
		c.verified, c.at = true, c.wall0
	} else {
		c.epoch = fmt.Sprintf("boot-%d", c.wall0.UnixNano())
	}
	return c
}

// Verified reports whether timestamps taken now are trustworthy.
func (c *Clock) Verified() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.verified
}

// Epoch is the open epoch for data measured now ("" once the clock is verified).
func (c *Clock) Epoch() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.verified {
		return ""
	}
	return c.epoch
}

// Step returns the correction of the process epoch in seconds (0 when the clock was right).
func (c *Clock) Step() float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.step
}

// Run verifies the clock: NTP every 5 s, the server's Date header every 60 s.
func (c *Clock) Run(ctx context.Context) {
	if c.Verified() {
		return
	}
	tick := time.NewTicker(5 * time.Second)
	defer tick.Stop()
	var lastHTTP time.Time
	for {
		if c.opt.NTPSynced() {
			c.resolve()
			return
		}
		if now := c.opt.Wall(); lastHTTP.IsZero() || now.Sub(lastHTTP) >= time.Minute || now.Before(lastHTTP) {
			lastHTTP = now
			if c.tryServer(ctx) {
				c.resolve()
				return
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (c *Clock) tryServer(ctx context.Context) bool {
	cctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	srv, err := c.opt.ServerDate(cctx)
	if err != nil {
		return false
	}
	if d := srv.Sub(c.opt.Wall()); math.Abs(d.Seconds()) > 2 {
		if err := c.opt.SetClock(srv); err != nil {
			return false
		}
	}
	return true
}

// resolve closes the epoch: step = wall-clock movement − monotonic movement since start.
func (c *Clock) resolve() {
	wall := c.opt.Wall()
	step := wall.Sub(c.wall0).Seconds() - c.opt.Elapsed().Seconds()
	if math.Abs(step) < 1 {
		step = 0
	}
	step = math.Round(step*1000) / 1000
	if c.opt.OnResolve != nil && c.epoch != "" {
		c.opt.OnResolve(c.epoch, step) // stored before Epoch() turns "" and the data is released
	}
	c.mu.Lock()
	c.verified, c.step, c.at = true, step, wall
	c.mu.Unlock()
}

func httpDate(ctx context.Context, base string) (time.Time, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, strings.TrimRight(base, "/")+"/api/v1/health", nil)
	if err != nil {
		return time.Time{}, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return time.Time{}, err
	}
	resp.Body.Close()
	return http.ParseTime(resp.Header.Get("Date"))
}
