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
	msgs, err := s.Pending(10)
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
