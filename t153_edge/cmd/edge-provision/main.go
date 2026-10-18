// edge-provision makes a factory-fresh T153 join the server with no local setup.
//
//	edge-provision [flags]           enrol: announce the eth0 MAC, wait until an admin claims it on
//	                                 the web, write the bundle (token, CA, edge.yaml), start edge-agent
//	edge-provision timesync [flags]  wait for NTP; if it is blocked, set the clock from the server's
//	                                 HTTP Date header so TLS and the capture scheduler still work
//
// Only outbound HTTP to the server is needed, so the board works on any LAN with DHCP.
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"selink.vn/smartmotor/edge/internal/version"
)

type hello struct {
	MAC       string   `json:"mac"`
	Secret    string   `json:"secret"`
	Serial    string   `json:"serial,omitempty"`
	Hostname  string   `json:"hostname,omitempty"`
	HWModel   string   `json:"hw_model,omitempty"`
	FWVersion string   `json:"fw_version,omitempty"`
	LocalIPs  []string `json:"local_ips,omitempty"`
}

type helloResp struct {
	Status string `json:"status"`
	PollS  int    `json:"poll_s"`
	Bundle *struct {
		GatewayID string          `json:"gateway_id"`
		Token     string          `json:"mqtt_token"`
		CAPEM     string          `json:"ca_pem"`
		Config    json.RawMessage `json:"config"`
	} `json:"bundle"`
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "timesync" {
		timesync(os.Args[2:])
		return
	}
	server := flag.String("server", "http://160.191.87.104", "server base URL")
	dir := flag.String("dir", "/etc/edge-agent", "configuration directory")
	iface := flag.String("iface", "eth0", "interface whose MAC identifies the board")
	macFlag := flag.String("mac", "", "override the MAC (testing)")
	noStart := flag.Bool("no-start", false, "write files but do not enable/start edge-agent (testing)")
	force := flag.Bool("force", false, "enrol even if edge.yaml already exists")
	flag.Parse()
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("edge-provision: ")

	cfgPath := filepath.Join(*dir, "edge.yaml")
	if _, err := os.Stat(cfgPath); err == nil && !*force {
		log.Printf("%s exists: already provisioned", cfgPath)
		return
	}
	if err := os.MkdirAll(*dir, 0o755); err != nil {
		log.Fatal(err)
	}
	mac := strings.ToLower(*macFlag)
	if mac == "" {
		b, err := os.ReadFile("/sys/class/net/" + *iface + "/address")
		if err != nil {
			log.Fatalf("read MAC of %s: %v", *iface, err)
		}
		mac = strings.TrimSpace(string(b))
	}
	secret, err := loadSecret(filepath.Join(*dir, "device.secret"))
	if err != nil {
		log.Fatal(err)
	}
	host, _ := os.Hostname()
	req := hello{MAC: mac, Secret: secret, Serial: readTrim("/proc/device-tree/serial-number"), Hostname: host,
		HWModel: "T153-HelperBoard", FWVersion: version.Version}
	log.Printf("MAC %s – waiting to be added on the web (Thiết bị & gateway → Thêm gateway)", mac)

	client := &http.Client{Timeout: 15 * time.Second}
	wait := 15 * time.Second
	for {
		req.LocalIPs = localIPs()
		resp, err := post(client, *server+"/api/v1/provision/hello", req)
		if err != nil {
			log.Printf("hello: %v", err)
			time.Sleep(wait)
			continue
		}
		if resp.PollS > 0 {
			wait = time.Duration(resp.PollS) * time.Second
		}
		if resp.Status == "claimed" && resp.Bundle != nil {
			if err := install(*dir, resp); err != nil {
				log.Printf("install bundle: %v", err) // keep the bundle on the server; retry next round
				time.Sleep(wait)
				continue
			}
			if _, err := post(client, *server+"/api/v1/provision/ack", map[string]string{"mac": mac, "secret": secret}); err != nil {
				log.Printf("ack: %v (bundle already installed)", err)
			}
			log.Printf("provisioned as %s", resp.Bundle.GatewayID)
			if !*noStart {
				for _, args := range [][]string{{"daemon-reload"}, {"enable", "edge-agent"}, {"start", "--no-block", "edge-agent"}} {
					if out, err := exec.Command("systemctl", args...).CombinedOutput(); err != nil {
						log.Printf("systemctl %v: %v %s", args, err, out)
					}
				}
			}
			return
		}
		time.Sleep(wait)
	}
}

// install writes the bundle atomically; edge.yaml is written last because its presence marks
// the board as provisioned.
func install(dir string, r *helloResp) error {
	b := r.Bundle
	if b.Token == "" || b.CAPEM == "" || len(b.Config) == 0 {
		return errors.New("incomplete bundle")
	}
	files := []struct {
		name string
		data []byte
		mode os.FileMode
	}{
		{"ca.pem", []byte(b.CAPEM), 0o644},
		{"mqtt.token", []byte(b.Token), 0o600},
		{"edge.yaml", b.Config, 0o600}, // JSON is valid YAML for edge-agent
	}
	for _, f := range files {
		tmp := filepath.Join(dir, "."+f.name+".tmp")
		if err := os.WriteFile(tmp, f.data, f.mode); err != nil {
			return err
		}
		if err := os.Rename(tmp, filepath.Join(dir, f.name)); err != nil {
			return err
		}
	}
	return nil
}

func post(c *http.Client, url string, body any) (*helloResp, error) {
	buf, _ := json.Marshal(body)
	resp, err := c.Post(url, "application/json", bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	fixClock(resp.Header.Get("Date"))
	if resp.StatusCode/100 != 2 {
		var e struct {
			Detail any `json:"detail"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&e)
		return nil, fmt.Errorf("%s: %v", resp.Status, e.Detail)
	}
	var out helloResp
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

func loadSecret(path string) (string, error) {
	if b, err := os.ReadFile(path); err == nil && len(strings.TrimSpace(string(b))) >= 32 {
		return strings.TrimSpace(string(b)), nil
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	s := hex.EncodeToString(raw)
	return s, os.WriteFile(path, []byte(s), 0o600)
}

func readTrim(path string) string {
	b, _ := os.ReadFile(path)
	return strings.Trim(strings.TrimSpace(string(b)), "\x00")
}

func localIPs() []string {
	var out []string
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil && !ipn.IP.IsLoopback() {
			out = append(out, ipn.IP.String())
		}
	}
	return out
}

// fixClock steps the clock from an HTTP Date header when the local clock is clearly wrong
// (RTC lost on power loss and NTP blocked). The header has 1 s resolution, enough for TLS.
func fixClock(date string) {
	t, err := http.ParseTime(date)
	if err != nil {
		return
	}
	if d := time.Since(t); d > -2*time.Minute && d < 2*time.Minute {
		return
	}
	if out, err := exec.Command("date", "-u", "-s", "@"+fmt.Sprint(t.Unix())).CombinedOutput(); err != nil {
		log.Printf("set clock: %v %s", err, out)
		return
	}
	log.Printf("clock set from server Date header: %s", t.UTC().Format(time.RFC3339))
}

// timesync is the edge-agent ExecStartPre: NTP first, the server's Date header as fallback.
// It never blocks for longer than -wait, so the agent starts on networks that block NTP.
func timesync(args []string) {
	fs := flag.NewFlagSet("timesync", flag.ExitOnError)
	server := fs.String("server", "http://160.191.87.104", "server base URL")
	wait := fs.Duration("wait", 60*time.Second, "how long to wait for NTP")
	_ = fs.Parse(args)
	log.SetPrefix("edge-provision timesync: ")
	deadline := time.Now().Add(*wait)
	for time.Now().Before(deadline) {
		out, _ := exec.Command("timedatectl", "show", "-p", "NTPSynchronized", "--value").Output()
		if strings.TrimSpace(string(out)) == "yes" {
			return
		}
		time.Sleep(3 * time.Second)
	}
	c := &http.Client{Timeout: 10 * time.Second}
	resp, err := c.Head(*server + "/api/v1/health")
	if err != nil {
		log.Printf("NTP not synchronised and server unreachable: %v (starting anyway)", err)
		return
	}
	resp.Body.Close()
	fixClock(resp.Header.Get("Date"))
}
