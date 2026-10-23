package localview

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"
)

func f(v float64) *float64 { return &v }

func TestHubStateAndHistory(t *testing.T) {
	h := New([]MachineInfo{{ID: "m1", Limits: Limits{3.5, 7.1, 11}, Points: []PointInfo{{ID: "p1", ISOAxes: []string{"y", "z"}}}}},
		func() Gateway { return Gateway{ID: "gw", MQTTConnected: true} })
	now := time.Now()
	// x is axial: excluded from the overall value even though it is the largest.
	h.SetFast("p1", Fast{TS: now, Axes: map[string]AxisRMS{"x": {VrmsMMs: f(9)}, "y": {VrmsMMs: f(5)}, "z": {VrmsMMs: f(3)}}})
	h.AddEvent(Event{EventID: "e1", TS: now, State: "raised", Severity: "warning", Message: "rung"})
	h.AddEvent(Event{EventID: "e2", TS: now, State: "raised", Severity: "watch"})
	h.AddEvent(Event{EventID: "e2", TS: now, State: "cleared", Severity: "watch"})

	rec := httptest.NewRecorder()
	h.Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/api/local/state?history=1", nil))
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	var st State
	if err := json.Unmarshal(rec.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	if !st.Gateway.MQTTConnected || st.Gateway.ID != "gw" {
		t.Fatalf("gateway %+v", st.Gateway)
	}
	p := st.Points["p1"]
	if p == nil || len(p.History) != 1 || p.History[0].Overall == nil || *p.History[0].Overall != 5 {
		t.Fatalf("history %+v", p)
	}
	if len(st.Active) != 1 || st.Active[0].EventID != "e1" {
		t.Fatalf("active %+v", st.Active)
	}
	if len(st.Recent) != 3 || st.Recent[0].State != "cleared" {
		t.Fatalf("recent %+v", st.Recent)
	}

	rec = httptest.NewRecorder()
	h.Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/api/local/state", nil))
	_ = json.Unmarshal(rec.Body.Bytes(), &st)
	if len(st.Points["p1"].History) != 0 {
		t.Fatal("history must be omitted without ?history=1")
	}
}
