package clock

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

// fake: the board booted 25 min behind; 10 min later the server's Date header is reachable.
func TestStepFromServerDate(t *testing.T) {
	boot := time.Date(2026, 10, 19, 8, 0, 0, 0, time.UTC)
	wall := boot
	elapsed := time.Duration(0)
	truth := boot.Add(25 * time.Minute)
	serverUp := false
	var resolved []float64
	c := New(Options{
		NTPSynced: func() bool { return false },
		ServerDate: func(context.Context) (time.Time, error) {
			if !serverUp {
				return time.Time{}, errors.New("offline")
			}
			return truth.Add(elapsed), nil
		},
		SetClock:  func(t time.Time) error { wall = t; return nil },
		Wall:      func() time.Time { return wall },
		Elapsed:   func() time.Duration { return elapsed },
		OnResolve: func(_ string, s float64) { resolved = append(resolved, s) },
	})
	if c.Verified() || c.Epoch() == "" {
		t.Fatal("stale clock at boot must open an epoch")
	}
	if c.tryServer(context.Background()) {
		t.Fatal("offline server must not verify the clock")
	}
	elapsed, wall = 10*time.Minute, boot.Add(10*time.Minute)
	serverUp = true
	if !c.tryServer(context.Background()) {
		t.Fatal("server date must verify the clock")
	}
	c.resolve()
	if !c.Verified() || c.Epoch() != "" || c.Step() != 1500 || len(resolved) != 1 || resolved[0] != 1500 {
		t.Fatalf("step = %v resolved %v, want 1500 s", c.Step(), resolved)
	}
}

func TestVerifiedAtStartHasNoEpoch(t *testing.T) {
	c := New(Options{NTPSynced: func() bool { return true }})
	if !c.Verified() || c.Epoch() != "" || c.Step() != 0 {
		t.Fatal("NTP-synced clock needs no correction")
	}
}

func TestSmallDriftIsNotAStep(t *testing.T) {
	wall := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	elapsed := time.Duration(0)
	c := New(Options{NTPSynced: func() bool { return false }, Wall: func() time.Time { return wall }, Elapsed: func() time.Duration { return elapsed }})
	elapsed, wall = time.Minute, wall.Add(time.Minute+300*time.Millisecond)
	c.resolve()
	if c.Step() != 0 {
		t.Fatalf("sub-second drift must not shift data, got %v", c.Step())
	}
}

func TestCorrectPayload(t *testing.T) {
	in := []byte(`{"msg_id":"a","ts":"2026-10-19T08:05:00.250Z","point_id":"p1","vel_mm_s":{"x":1},"flags":["spike","time_unsynced"]}`)
	var m map[string]any
	_ = json.Unmarshal(Correct(in, 1500, true), &m)
	if m["ts"] != "2026-10-19T08:30:00.250Z" || m["time_corrected_s"] != 1500.0 || m["point_id"] != "p1" {
		t.Fatalf("corrected payload %v", m)
	}
	if f := m["flags"].([]any); len(f) != 1 || f[0] != "spike" {
		t.Fatalf("corrected payload keeps time_unsynced flag: %v", f)
	}
	m = nil
	_ = json.Unmarshal(Correct(in, 0, false), &m)
	if m["time_unsynced"] != true || m["ts"] != "2026-10-19T08:05:00.250Z" {
		t.Fatalf("unknown step must flag, got %v", m)
	}
	if string(Correct([]byte("raw"), 5, true)) != "raw" {
		t.Fatal("non-JSON payload must pass through")
	}
}
