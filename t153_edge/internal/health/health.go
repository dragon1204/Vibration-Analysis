// Package health collects gateway health (spec 5.12) and kicks the hardware watchdog.
package health

import (
	"bufio"
	"bytes"
	"log/slog"
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"go.bug.st/serial"
)

// Report is the payload of the health topic.
type Report struct {
	MsgID         string         `json:"msg_id"`
	TS            string         `json:"ts"`
	Version       string         `json:"version"`
	CPUPct        float64        `json:"cpu_pct"`
	MemRSSMB      float64        `json:"mem_rss_mb"`
	DiskFreeMB    float64        `json:"disk_free_mb"`
	DataUsedMB    float64        `json:"data_used_mb"`
	SoCTempC      *float64       `json:"soc_temp_c"`
	UptimeS       int64          `json:"uptime_s"`
	OutboxPending int            `json:"outbox_pending"`
	BusStats      map[string]any `json:"bus_stats"`
	Devices       map[string]any `json:"devices"`
	MQTTConnected bool           `json:"mqtt_connected"`
	NetIface      string         `json:"net_iface"`
	RSSIdBm       *float64       `json:"rssi_dbm"`
	TimeUnsynced  bool           `json:"time_unsynced"`
	LocalAlarm    bool           `json:"local_alarm_on"`
}

// Collector computes CPU usage between calls.
type Collector struct {
	start               time.Time
	lastIdle, lastTotal uint64
	ThermalZone         string
	ModemATPort         string
}

// NewCollector creates a collector.
func NewCollector(thermalZone, modemAT string) *Collector {
	return &Collector{start: time.Now(), ThermalZone: thermalZone, ModemATPort: modemAT}
}

// Fill populates system fields of r.
func (c *Collector) Fill(r *Report, dataDir string) {
	r.UptimeS = int64(time.Since(c.start).Seconds())
	r.CPUPct = c.cpu()
	r.MemRSSMB = rssMB()
	r.DiskFreeMB = diskFreeMB(dataDir)
	r.SoCTempC = readMilliC(c.ThermalZone)
	r.NetIface = netIface()
	r.TimeUnsynced = time.Now().UTC().Year() < 2026
	if c.ModemATPort != "" && r.NetIface == "ppp0" {
		r.RSSIdBm = rssi(c.ModemATPort)
	}
}

// cpu returns the process-wide CPU usage from /proc/stat (0 when unavailable).
func (c *Collector) cpu() float64 {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	f := strings.Fields(line)
	if len(f) < 5 {
		return 0
	}
	var total, idle uint64
	for i, s := range f[1:] {
		v, _ := strconv.ParseUint(s, 10, 64)
		total += v
		if i == 3 || i == 4 {
			idle += v
		}
	}
	defer func() { c.lastIdle, c.lastTotal = idle, total }()
	if c.lastTotal == 0 || total <= c.lastTotal {
		return 0
	}
	dt, di := float64(total-c.lastTotal), float64(idle-c.lastIdle)
	return round1(100 * (dt - di) / dt)
}

func rssMB() float64 {
	b, err := os.ReadFile("/proc/self/status")
	if err == nil {
		sc := bufio.NewScanner(bytes.NewReader(b))
		for sc.Scan() {
			if strings.HasPrefix(sc.Text(), "VmRSS:") {
				f := strings.Fields(sc.Text())
				if len(f) >= 2 {
					kb, _ := strconv.ParseFloat(f[1], 64)
					return round1(kb / 1024)
				}
			}
		}
	}
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return round1(float64(ms.Sys) / (1 << 20))
}

func readMilliC(path string) *float64 {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(string(b)), 64)
	if err != nil {
		return nil
	}
	t := round1(v / 1000)
	return &t
}

func netIface() string {
	for _, i := range []string{"ppp0", "eth0", "wlan0"} {
		b, err := os.ReadFile("/sys/class/net/" + i + "/operstate")
		if err == nil && (strings.TrimSpace(string(b)) == "up" || (i == "ppp0" && strings.TrimSpace(string(b)) == "unknown")) {
			return i
		}
	}
	return ""
}

var csqRe = regexp.MustCompile(`\+CSQ:\s*(\d+),`)

// rssi queries AT+CSQ on the modem's AT port (EC20/EC25).
func rssi(dev string) *float64 {
	p, err := serial.Open(dev, &serial.Mode{BaudRate: 115200})
	if err != nil {
		return nil
	}
	defer p.Close()
	_ = p.SetReadTimeout(500 * time.Millisecond)
	if _, err := p.Write([]byte("AT+CSQ\r")); err != nil {
		return nil
	}
	buf := make([]byte, 256)
	n, _ := p.Read(buf)
	m := csqRe.FindSubmatch(buf[:n])
	if m == nil {
		return nil
	}
	v, _ := strconv.Atoi(string(m[1]))
	if v == 99 {
		return nil
	}
	dbm := float64(-113 + 2*v)
	return &dbm
}

func round1(v float64) float64 { return float64(int64(v*10+0.5)) / 10 }

// Watchdog kicks /dev/watchdog every 10 s while the main loop heartbeat is fresh.
type Watchdog struct {
	path string
	beat atomic.Int64
	log  *slog.Logger
}

// NewWatchdog creates a watchdog ("" path = disabled).
func NewWatchdog(path string, log *slog.Logger) *Watchdog {
	w := &Watchdog{path: path, log: log}
	w.Beat()
	return w
}

// Beat records main-loop liveness.
func (w *Watchdog) Beat() { w.beat.Store(time.Now().Unix()) }

// Run kicks the device until stop is closed. If the heartbeat is older than 60 s the
// kicks stop and the board resets.
func (w *Watchdog) Run(stop <-chan struct{}) {
	if w.path == "" {
		return
	}
	f, err := os.OpenFile(w.path, os.O_WRONLY, 0)
	if err != nil {
		w.log.Warn("watchdog unavailable", "path", w.path, "err", err)
		return
	}
	defer func() {
		_, _ = f.Write([]byte("V")) // magic close: disarm on clean shutdown
		f.Close()
	}()
	t := time.NewTicker(10 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			if time.Since(time.Unix(w.beat.Load(), 0)) < 60*time.Second {
				_, _ = f.Write([]byte("k"))
			} else {
				w.log.Error("main loop stalled, not kicking watchdog")
			}
		}
	}
}
