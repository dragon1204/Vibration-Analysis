package agent

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/uplink"
)

func (a *Agent) runCommands(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case cmd := <-a.up.Commands():
			a.handleCommand(ctx, cmd)
		case raw := <-a.up.Configs():
			a.handleConfig(raw)
		}
	}
}

func (a *Agent) handleCommand(ctx context.Context, cmd uplink.Command) {
	a.log.Info("command received", "cmd_id", cmd.CmdID, "type", cmd.Type, "point", cmd.PointID)
	switch cmd.Type {
	case "ping":
		a.up.Ack(cmd.CmdID, "ok", "pong")
	case "capture_now":
		p := a.points[cmd.PointID]
		if p == nil {
			a.up.Ack(cmd.CmdID, "error", "unknown point "+cmd.PointID)
			return
		}
		prof := cmd.Profile
		if prof == "" && len(p.cfg.Profiles) > 0 {
			prof = p.cfg.Profiles[0].Name
		}
		if _, ok := p.profile(prof); !ok {
			a.up.Ack(cmd.CmdID, "error", "unknown profile "+prof)
			return
		}
		select {
		case p.reqs <- captureRequest{profile: prof, prio: bus.P0, cmdID: cmd.CmdID}:
			a.up.Ack(cmd.CmdID, "accepted", "capture "+prof+" queued")
		default:
			a.up.Ack(cmd.CmdID, "error", "capture queue full")
		}
	case "group_capture":
		var prm struct {
			MachineID string `json:"machine_id"`
		}
		_ = json.Unmarshal(cmd.Params, &prm)
		for _, m := range a.machines {
			if m.cfg.ID == prm.MachineID && m.isolationEnabled() {
				go func(m *machineRT) {
					if err := m.groupCapture(ctx, bus.P0); err != nil {
						a.up.Ack(cmd.CmdID, "error", err.Error())
						return
					}
					a.up.Ack(cmd.CmdID, "ok", "group capture done")
				}(m)
				return
			}
		}
		a.up.Ack(cmd.CmdID, "error", "machine not found or isolation disabled")
	case "learn_alpha":
		var prm struct {
			MachineID string `json:"machine_id"`
		}
		_ = json.Unmarshal(cmd.Params, &prm)
		for _, m := range a.machines {
			if m.cfg.ID == prm.MachineID && m.isolationEnabled() {
				m.resetAlpha()
				a.up.Ack(cmd.CmdID, "ok", "alpha learning restarted")
				return
			}
		}
		a.up.Ack(cmd.CmdID, "error", "machine not found or isolation disabled")
	case "set_sensor_param":
		var prm struct {
			Reg     uint16 `json:"reg"`
			Value   uint16 `json:"value"`
			Persist bool   `json:"persist"`
		}
		if err := json.Unmarshal(cmd.Params, &prm); err != nil {
			a.up.Ack(cmd.CmdID, "error", "bad params: "+err.Error())
			return
		}
		p := a.points[cmd.PointID]
		if p == nil {
			a.up.Ack(cmd.CmdID, "error", "unknown point")
			return
		}
		go func() {
			err := p.sensor.WriteConfig(bus.WithPriority(ctx, bus.P3), prm.Reg, prm.Value, prm.Persist)
			if err != nil {
				a.up.Ack(cmd.CmdID, "error", err.Error())
				return
			}
			a.up.Ack(cmd.CmdID, "ok", fmt.Sprintf("reg 0x%02X=%d persist=%v", prm.Reg, prm.Value, prm.Persist))
		}()
	case "reload_config":
		a.up.Ack(cmd.CmdID, "ok", "reloading")
		a.requestReload()
	case "reboot":
		a.up.Ack(cmd.CmdID, "ok", "rebooting in 5 s")
		go func() {
			time.Sleep(5 * time.Second)
			a.saveState()
			if runtime.GOOS == "linux" {
				_ = exec.Command("reboot").Run()
			}
		}()
	case "ota_update":
		go a.ota(cmd)
	case "upload_logs":
		go a.uploadLogs(cmd)
	default:
		a.up.Ack(cmd.CmdID, "error", "unknown command type "+cmd.Type)
	}
}

func (a *Agent) requestReload() {
	if a.opt.OnReload != nil {
		go a.opt.OnReload()
	}
}

// handleConfig applies a full configuration pushed on the retained "config" topic.
func (a *Agent) handleConfig(raw []byte) {
	newCfg, err := config.Parse(raw)
	if err != nil {
		a.log.Error("downlink config rejected", "err", err)
		a.emitSystem("system", "config_rejected", "watch", "Cấu hình từ server không hợp lệ: "+err.Error())
		return
	}
	if newCfg.Version <= a.cfg.Version {
		a.log.Debug("config version not newer, ignoring", "have", a.cfg.Version, "got", newCfg.Version)
		return
	}
	// Keep local secrets/paths the server does not manage.
	newCfg.MQTT = a.cfg.MQTT
	newCfg.Storage = a.cfg.Storage
	y, err := newCfg.Marshal()
	if err != nil {
		a.log.Error("marshal config", "err", err)
		return
	}
	if a.opt.ConfigPath != "" {
		_ = os.Rename(a.opt.ConfigPath, a.opt.ConfigPath+".bak")
		if err := os.WriteFile(a.opt.ConfigPath, y, 0o600); err != nil {
			a.log.Error("write config", "err", err)
			return
		}
	}
	a.log.Info("new config applied", "version", newCfg.Version)
	a.emitSystem("system", "config_applied", "info", fmt.Sprintf("Áp dụng cấu hình phiên bản %d", newCfg.Version))
	a.requestReload()
}

// ota downloads a new binary, verifies SHA-256, self-tests it and swaps it in (spec 5.13).
func (a *Agent) ota(cmd uplink.Command) {
	fail := func(err error) {
		a.log.Error("ota failed", "err", err)
		a.up.Ack(cmd.CmdID, "error", err.Error())
	}
	bin := a.opt.BinaryPath
	if bin == "" || cmd.URL == "" || cmd.SHA256 == "" {
		fail(fmt.Errorf("ota requires url, sha256 and a known binary path"))
		return
	}
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(cmd.URL)
	if err != nil {
		fail(err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fail(fmt.Errorf("download status %s", resp.Status))
		return
	}
	tmp := bin + ".new"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		fail(err)
		return
	}
	h := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, h), resp.Body)
	f.Close()
	if err != nil {
		fail(err)
		return
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != cmd.SHA256 {
		os.Remove(tmp)
		fail(fmt.Errorf("sha256 mismatch: %s", got))
		return
	}
	args := []string{"--self-test"}
	if a.opt.ConfigPath != "" {
		args = append(args, "--config", a.opt.ConfigPath)
	}
	if out, err := exec.Command(tmp, args...).CombinedOutput(); err != nil {
		os.Remove(tmp)
		fail(fmt.Errorf("self-test failed: %v: %s", err, out))
		return
	}
	_ = os.Remove(bin + ".prev")
	if err := os.Rename(bin, bin+".prev"); err != nil {
		fail(err)
		return
	}
	if err := os.Rename(tmp, bin); err != nil {
		_ = os.Rename(bin+".prev", bin)
		fail(err)
		return
	}
	// Marker read by the init script: roll back if MQTT does not connect within 5 min.
	_ = os.WriteFile(bin+".pending", []byte(time.Now().UTC().Format(time.RFC3339)), 0o644)
	a.up.Ack(cmd.CmdID, "ok", "binary replaced, restarting")
	time.Sleep(3 * time.Second)
	a.saveState()
	os.Exit(0) // supervisor (S99edge-agent) restarts the new binary
}

// uploadLogs PUTs the current log file to a pre-signed URL.
func (a *Agent) uploadLogs(cmd uplink.Command) {
	path := a.cfg.Log.File
	if path == "" || cmd.URL == "" {
		a.up.Ack(cmd.CmdID, "error", "log file or url not configured")
		return
	}
	f, err := os.Open(path)
	if err != nil {
		a.up.Ack(cmd.CmdID, "error", err.Error())
		return
	}
	defer f.Close()
	req, _ := http.NewRequest(http.MethodPut, cmd.URL, f)
	resp, err := (&http.Client{Timeout: 5 * time.Minute}).Do(req)
	if err != nil {
		a.up.Ack(cmd.CmdID, "error", err.Error())
		return
	}
	resp.Body.Close()
	a.up.Ack(cmd.CmdID, "ok", "uploaded: "+resp.Status)
}
