// Package localview keeps the latest values of every measurement point in memory and
// serves them as JSON on a loopback HTTP port for the gateway's local LCD panel.
// It works without the server: the panel keeps showing data when the uplink is down.
package localview

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net"
	"net/http"
	"sort"
	"sync"
	"time"
)

// historyLen is the number of fast-RMS samples kept per point (~10 min at 1 s).
const historyLen = 600

// maxRecentEvents is the number of cleared/raised events kept for the panel.
const maxRecentEvents = 20

// Limits are the ISO 20816-3 zone boundaries of a machine in mm/s RMS.
type Limits struct {
	AB float64 `json:"ab"`
	BC float64 `json:"bc"`
	CD float64 `json:"cd"`
}

// PointInfo is the static description of one measurement point.
type PointInfo struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Role     string            `json:"role"` // bearing | base | source
	Location string            `json:"location"`
	AxesMap  map[string]string `json:"axes_map"`
	ISOAxes  []string          `json:"iso_axes"`
}

// MachineInfo is the static description of one machine.
type MachineInfo struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	RatedSpeedRPM float64     `json:"rated_speed_rpm"`
	ISOGroup      int         `json:"iso_group"`
	Foundation    string      `json:"foundation"`
	Limits        Limits      `json:"limits"`
	BaseAlpha     float64     `json:"base_alpha"` // < 0: own-vibration display off
	Running       bool        `json:"running"`
	Points        []PointInfo `json:"points"`
}

// AxisRMS is one axis of a fast RMS result.
type AxisRMS struct {
	VrmsMMs  *float64 `json:"vrms_mm_s"`
	AccRmsG  *float64 `json:"acc_rms_g"`
	Crest    *float64 `json:"crest"`
	Kurtosis *float64 `json:"kurtosis"`
}

// Fast is the rolling ISO-band RMS computed from raw frames.
type Fast struct {
	TS       time.Time          `json:"ts"`
	WindowMS int                `json:"window_ms"`
	UpdateMS int                `json:"update_ms,omitempty"` // time since the previous result of this point
	Axes     map[string]AxisRMS `json:"axes"`
}

// Indicators are the sensor register values aggregated over one window.
type Indicators struct {
	TS         time.Time          `json:"ts"`
	VelPeakMMs map[string]float64 `json:"vel_peak_mm_s"`
	FreqHz     map[string]float64 `json:"freq_hz"`
	TempC      *float64           `json:"temp_c"`
}

// CaptureAxis is one axis of the last full capture.
type CaptureAxis struct {
	VrmsMMs  *float64           `json:"vrms_mm_s"`
	Kurtosis *float64           `json:"kurtosis"`
	Orders   map[string]float64 `json:"orders"`
	Line2X   *float64           `json:"line_2x_mm_s"`
}

// Capture summarises the last waveform capture (orders 1X..nX, speed).
type Capture struct {
	TS        time.Time              `json:"ts"`
	CaptureID string                 `json:"capture_id"`
	Profile   string                 `json:"profile"`
	Running   bool                   `json:"running"`
	SpeedHz   float64                `json:"speed_hz"`
	DfHz      float64                `json:"df_hz"`
	Axes      map[string]CaptureAxis `json:"axes"`
	Flags     []string               `json:"flags"`
}

// Sample is one point of the fast-RMS history (overall = max over ISO axes).
type Sample struct {
	T       int64              `json:"t"` // unix ms
	Overall *float64           `json:"v"`
	Axes    map[string]float64 `json:"axes"`
}

// Event is an alarm or system event as shown on the panel.
type Event struct {
	EventID   string    `json:"event_id"`
	TS        time.Time `json:"ts"`
	State     string    `json:"state"`
	Type      string    `json:"type"`
	Severity  string    `json:"severity"`
	MachineID string    `json:"machine_id,omitempty"`
	PointID   string    `json:"point_id,omitempty"`
	Rule      string    `json:"rule,omitempty"`
	Value     *float64  `json:"value"`
	Message   string    `json:"message"`
}

// Gateway is the live connection state supplied by the agent on every request.
type Gateway struct {
	ID            string `json:"id"`
	Site          string `json:"site"`
	Version       string `json:"version"`
	MQTTConnected bool   `json:"mqtt_connected"`
	OutboxPending int    `json:"outbox_pending"`
	LocalAlarm    bool   `json:"local_alarm_on"`
}

type pointState struct {
	Online     bool        `json:"online"`
	Fails      int         `json:"fails"`
	LastOK     *time.Time  `json:"last_ok"`
	Fast       *Fast       `json:"fast"`
	Indicators *Indicators `json:"indicators"`
	Capture    *Capture    `json:"capture"`
	History    []Sample    `json:"history,omitempty"`
}

// Hub stores the latest state. All methods are safe for concurrent use.
type Hub struct {
	mu       sync.Mutex
	machines []MachineInfo
	pointISO map[string][]string
	points   map[string]*pointState
	active   map[string]Event
	recent   []Event
	started  time.Time
	gateway  func() Gateway
	alpha    float64
}

// New creates a hub for the given machines. gateway is called for every state request.
func New(machines []MachineInfo, gateway func() Gateway) *Hub {
	h := &Hub{machines: machines, pointISO: map[string][]string{}, points: map[string]*pointState{},
		active: map[string]Event{}, started: time.Now(), gateway: gateway}
	for _, m := range machines {
		for _, p := range m.Points {
			h.pointISO[p.ID] = p.ISOAxes
			h.points[p.ID] = &pointState{Online: true}
		}
	}
	return h
}

func (h *Hub) point(id string) *pointState {
	ps := h.points[id]
	if ps == nil {
		ps = &pointState{Online: true}
		h.points[id] = ps
	}
	return ps
}

// SetBaseAlpha sets the coefficient reported to the panel.
func (h *Hub) SetBaseAlpha(a float64) {
	h.mu.Lock()
	h.alpha = a
	h.mu.Unlock()
}

// SetFast records a fast RMS result and appends it to the history.
func (h *Hub) SetFast(pointID string, f Fast) {
	h.mu.Lock()
	defer h.mu.Unlock()
	ps := h.point(pointID)
	ps.Fast = &f
	s := Sample{T: f.TS.UnixMilli(), Axes: map[string]float64{}}
	best := math.NaN()
	for a, v := range f.Axes {
		if v.VrmsMMs == nil {
			continue
		}
		s.Axes[a] = *v.VrmsMMs
		if contains(h.pointISO[pointID], a) && (math.IsNaN(best) || *v.VrmsMMs > best) {
			best = *v.VrmsMMs
		}
	}
	if !math.IsNaN(best) {
		s.Overall = &best
	}
	ps.History = append(ps.History, s)
	if len(ps.History) > historyLen {
		ps.History = ps.History[len(ps.History)-historyLen:]
	}
}

// SetIndicators records the latest aggregated sensor registers.
func (h *Hub) SetIndicators(pointID string, ind Indicators) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.point(pointID).Indicators = &ind
}

// SetCapture records the summary of the last capture.
func (h *Hub) SetCapture(pointID string, c Capture) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.point(pointID).Capture = &c
}

// SetLink records whether the sensor answers on the bus.
func (h *Hub) SetLink(pointID string, online bool, fails int, lastOK time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()
	ps := h.point(pointID)
	ps.Online, ps.Fails = online, fails
	if !lastOK.IsZero() {
		t := lastOK
		ps.LastOK = &t
	}
}

// SetMachineRunning publishes the current operating state to the local panel.
func (h *Hub) SetMachineRunning(machineID string, running bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for i := range h.machines {
		if h.machines[i].ID == machineID {
			h.machines[i].Running = running
			return
		}
	}
}

// AddEvent tracks raised events until they are cleared and keeps a short recent list.
func (h *Hub) AddEvent(e Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if e.State == "cleared" {
		delete(h.active, e.EventID)
	} else if e.EventID != "" && e.Severity != "info" {
		h.active[e.EventID] = e
	}
	h.recent = append(h.recent, e)
	if len(h.recent) > maxRecentEvents {
		h.recent = h.recent[len(h.recent)-maxRecentEvents:]
	}
}

// State is the JSON document served to the panel.
type State struct {
	Now      time.Time              `json:"now"`
	UptimeS  int64                  `json:"uptime_s"`
	Gateway  Gateway                `json:"gateway"`
	Machines []MachineInfo          `json:"machines"`
	Points   map[string]*pointState `json:"points"`
	Active   []Event                `json:"active_events"`
	Recent   []Event                `json:"recent_events"`
	// BaseAlpha is the display-only BASE→bearing transmission coefficient (see config.LocalUI).
	BaseAlpha float64 `json:"base_alpha"`
}

// Snapshot returns a deep-enough copy of the state; history is included only when asked.
func (h *Hub) Snapshot(withHistory bool) State {
	var gw Gateway
	if h.gateway != nil {
		gw = h.gateway()
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	st := State{Now: time.Now(), UptimeS: int64(time.Since(h.started).Seconds()), Gateway: gw,
		Machines: h.machines, Points: map[string]*pointState{}, Active: []Event{}, Recent: []Event{}, BaseAlpha: h.alpha}
	for id, ps := range h.points {
		cp := *ps
		if withHistory {
			cp.History = append([]Sample(nil), ps.History...)
		} else {
			cp.History = nil
		}
		st.Points[id] = &cp
	}
	for _, e := range h.active {
		st.Active = append(st.Active, e)
	}
	sort.Slice(st.Active, func(i, j int) bool { return st.Active[i].TS.After(st.Active[j].TS) })
	for i := len(h.recent) - 1; i >= 0; i-- {
		st.Recent = append(st.Recent, h.recent[i])
	}
	return st
}

// Handler serves GET /api/local/state (?history=1 adds the RMS history).
func (h *Hub) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/local/state", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(h.Snapshot(r.URL.Query().Get("history") == "1"))
	})
	return mux
}

// Serve listens on addr until ctx is cancelled. An empty addr or "off" disables the server.
func (h *Hub) Serve(ctx context.Context, addr string, log *slog.Logger) {
	if addr == "" || addr == "off" {
		return
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Warn("local view disabled", "addr", addr, "err", err)
		return
	}
	srv := &http.Server{Handler: h.Handler(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(sctx)
	}()
	log.Info("local view listening", "addr", addr)
	if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Warn("local view stopped", "err", err)
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
