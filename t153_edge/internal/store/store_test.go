package store

import (
	"testing"
)

func TestOutboxOrder(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	_ = s.Enqueue("a/waveform", 1, PrioWaveform, []byte("w"))
	_ = s.Enqueue("a/metrics", 1, PrioMetrics, []byte("m"))
	_ = s.Enqueue("a/events", 1, PrioEvent, []byte("e"))
	msgs, err := s.Pending(10, "")
	if err != nil || len(msgs) != 3 {
		t.Fatal(err, len(msgs))
	}
	if msgs[0].Topic != "a/events" || msgs[2].Topic != "a/waveform" {
		t.Fatalf("wrong order: %v %v %v", msgs[0].Topic, msgs[1].Topic, msgs[2].Topic)
	}
	_ = s.Ack(msgs[0].ID)
	if n, _ := s.PendingCount(); n != 2 {
		t.Fatalf("pending = %d", n)
	}
	if v, _ := s.Incr("k", 2); v != 2 {
		t.Fatal("counter")
	}
	_ = s.SetState("x", "1")
	if v, ok, _ := s.GetState("x"); !ok || v != "1" {
		t.Fatal("state")
	}
}

func TestClockEpochHold(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	epoch := "boot-1"
	s.SetClockEpoch(func() string { return epoch })
	_ = s.Enqueue("a/vib", 1, PrioMetrics, []byte(`{"ts":"2026-10-19T08:00:00.000Z"}`))
	epoch = ""
	_ = s.Enqueue("a/health", 1, PrioMetrics, []byte(`{}`))
	held, _ := s.Pending(10, "boot-1")
	if len(held) != 1 || held[0].Topic != "a/health" {
		t.Fatalf("held epoch must be skipped: %+v", held)
	}
	all, _ := s.Pending(10, "")
	if len(all) != 2 || all[0].ClockEpoch != "boot-1" || all[1].ClockEpoch != "" {
		t.Fatalf("epoch not stored: %+v", all)
	}
	s.Close()
	// reopening an existing database keeps the migrated column
	s, err = Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if again, _ := s.Pending(10, ""); len(again) != 2 {
		t.Fatal("reopen lost messages")
	}
}
