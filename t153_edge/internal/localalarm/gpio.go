// Package localalarm drives the on-site relay (horn/beacon) and buzzer through
// sysfs GPIO. GPIO numbers are configurable [CẦN XÁC MINH, spec Q6]; when the
// GPIO is unavailable (e.g. on a dev PC) the alarm degrades to a log line.
package localalarm

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

// Alarm controls the outputs.
type Alarm struct {
	enabled bool
	gpios   []int
	log     *slog.Logger
	mu      sync.Mutex
	state   bool
	ok      map[int]bool
}

// New prepares the GPIOs (export + direction out). Zero/negative numbers are skipped.
func New(enabled bool, relayGPIO, buzzerGPIO int, buzzer bool, log *slog.Logger) *Alarm {
	a := &Alarm{enabled: enabled, log: log.With("mod", "localalarm"), ok: map[int]bool{}}
	if relayGPIO > 0 {
		a.gpios = append(a.gpios, relayGPIO)
	}
	if buzzer && buzzerGPIO > 0 {
		a.gpios = append(a.gpios, buzzerGPIO)
	}
	if !enabled {
		return a
	}
	for _, g := range a.gpios {
		if err := export(g); err != nil {
			a.log.Warn("gpio unavailable, local alarm output disabled", "gpio", g, "err", err)
			continue
		}
		a.ok[g] = true
	}
	return a
}

func gpioPath(g int, f string) string {
	return filepath.Join("/sys/class/gpio", "gpio"+strconv.Itoa(g), f)
}

func export(g int) error {
	if _, err := os.Stat(gpioPath(g, "value")); err != nil {
		if err := os.WriteFile("/sys/class/gpio/export", []byte(strconv.Itoa(g)), 0o200); err != nil {
			return err
		}
		time.Sleep(100 * time.Millisecond)
	}
	return os.WriteFile(gpioPath(g, "direction"), []byte("out"), 0o644)
}

// Set turns outputs on/off (idempotent).
func (a *Alarm) Set(on bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.enabled || on == a.state {
		return
	}
	a.state = on
	a.log.Info("local alarm", "on", on)
	v := "0"
	if on {
		v = "1"
	}
	for _, g := range a.gpios {
		if !a.ok[g] {
			continue
		}
		if err := os.WriteFile(gpioPath(g, "value"), []byte(v), 0o644); err != nil {
			a.log.Warn("gpio write failed", "gpio", g, "err", err)
		}
	}
}

// State returns the current output state.
func (a *Alarm) State() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.state
}

// Describe returns a short status string.
func (a *Alarm) Describe() string { return fmt.Sprintf("enabled=%v gpios=%v", a.enabled, a.gpios) }
