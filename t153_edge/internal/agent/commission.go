package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/modbus"
	"selink.vn/smartmotor/edge/internal/uplink"
)

// factoryAddrs are the Modbus addresses new WTVB05 sensors have been seen to ship with.
var factoryAddrs = []int{0x50, 0x01}

// addrConfigured reports whether a configured point already uses this address on the bus.
func (a *Agent) addrConfigured(busID string, addr int) bool {
	for _, p := range a.points {
		if p.cfg.Sensor.Bus == busID && p.cfg.Sensor.Addr == addr {
			return true
		}
	}
	return false
}

// commissionBauds are tried in order after the bus baud when looking for a new sensor.
var commissionBauds = []int{9600, 115200, 230400, 57600, 38400, 19200, 4800}

type commissionParams struct {
	Bus      string `json:"bus"`
	FromAddr int    `json:"from_addr"` // 0 = try the factory addresses
	ToAddr   int    `json:"to_addr"`
}

type commissionResult struct {
	Bus       string `json:"bus"`
	Addr      int    `json:"addr"`
	FoundAddr int    `json:"found_addr"`
	FoundBaud int    `json:"found_baud"`
	Baud      int    `json:"baud"`
	Mode      *int   `json:"mode,omitempty"`
	Firmware  string `json:"fw,omitempty"`
}

// commissionSensor gives a newly connected sensor its own address and the bus baud while
// the other sensors keep running (spec 3.6: one new sensor at a time on the bus).
func (a *Agent) commissionSensor(ctx context.Context, cmd uplink.Command) {
	var prm commissionParams
	if err := json.Unmarshal(cmd.Params, &prm); err != nil {
		a.up.Ack(cmd.CmdID, "error", "bad params: "+err.Error())
		return
	}
	res, err := a.commission(bus.WithPriority(ctx, bus.P0), prm)
	if err != nil {
		a.log.Warn("sensor commissioning failed", "err", err)
		a.up.Ack(cmd.CmdID, "error", err.Error())
		return
	}
	b, _ := json.Marshal(res)
	a.log.Info("sensor commissioned", "bus", res.Bus, "addr", res.Addr, "found_baud", res.FoundBaud)
	a.up.Ack(cmd.CmdID, "ok", string(b))
}

func (a *Agent) commission(ctx context.Context, prm commissionParams) (*commissionResult, error) {
	if prm.Bus == "" && len(a.cfg.Buses) > 0 {
		prm.Bus = a.cfg.Buses[0].ID
	}
	m := a.buses[prm.Bus]
	if m == nil {
		return nil, fmt.Errorf("bus %q không tồn tại", prm.Bus)
	}
	if prm.ToAddr < 1 || prm.ToAddr > 0x7F {
		return nil, errors.New("địa chỉ mới phải trong khoảng 0x01..0x7F")
	}
	for _, p := range a.points {
		if p.cfg.Sensor.Bus == prm.Bus && p.cfg.Sensor.Addr == prm.ToAddr {
			return nil, fmt.Errorf("địa chỉ 0x%02X đã dùng cho điểm đo %s", prm.ToAddr, p.cfg.ID)
		}
	}
	busBaud := m.Baud
	probe := func(baud, addr int) error {
		return m.DoAtBaud(ctx, "commission", baud, func(c *modbus.RTUClient) error {
			_, err := c.ReadHolding(byte(addr), wtvb05.RegSR, 1, probeTimeout(baud))
			return err
		})
	}
	if probe(busBaud, prm.ToAddr) == nil {
		return nil, fmt.Errorf("đã có thiết bị trả lời ở địa chỉ 0x%02X", prm.ToAddr)
	}

	// Find the new sensor: the given address, else the factory addresses seen in the field (0x50, 0x01);
	// bus baud first (already configured), then common rates.
	candidates := []int{prm.FromAddr}
	if prm.FromAddr == 0 {
		candidates = nil
		for _, f := range factoryAddrs {
			if !a.addrConfigured(prm.Bus, f) {
				candidates = append(candidates, f)
			}
		}
	}
	found := 0
scan:
	for _, from := range candidates {
		for i, b := range append([]int{busBaud}, commissionBauds...) {
			if i > 0 && b == busBaud {
				continue
			}
			if probe(b, from) == nil {
				found, prm.FromAddr = b, from
				break scan
			}
		}
	}
	if found == 0 {
		return nil, fmt.Errorf("không tìm thấy cảm biến mới ở địa chỉ gốc %v (đã thử %d bps và %v). "+
			"Kiểm tra nguồn, dây A/B và chỉ cắm một cảm biến mới mỗi lần", candidates, busBaud, commissionBauds)
	}
	res := &commissionResult{Bus: prm.Bus, Addr: prm.ToAddr, FoundAddr: prm.FromAddr, FoundBaud: found, Baud: busBaud}

	// Same MODE as the sensors already running, so RAWFIFO and indicators behave alike.
	var mode *uint16
	for _, p := range a.points {
		p.mu.Lock()
		if p.cfg.Sensor.Bus == prm.Bus && p.info.Firmware != "" {
			v := uint16(p.info.Mode)
			mode = &v
		}
		p.mu.Unlock()
		if mode != nil {
			break
		}
	}
	baudCode, ok := wtvb05.BaudCode(busBaud)
	if !ok {
		return nil, fmt.Errorf("cảm biến không hỗ trợ %d bps", busBaud)
	}
	to := 300 * time.Millisecond
	err := m.DoAtBaud(ctx, "commission", found, func(c *modbus.RTUClient) error {
		if err := c.WriteSingle(byte(prm.FromAddr), wtvb05.RegUnlock, wtvb05.UnlockKey, to); err != nil {
			return fmt.Errorf("unlock: %w", err)
		}
		// The sensor answers this write with its old address, then switches.
		if prm.ToAddr != prm.FromAddr {
			if err := c.WriteSingle(byte(prm.FromAddr), wtvb05.RegAddr, uint16(prm.ToAddr), to); err != nil {
				return fmt.Errorf("ghi địa chỉ: %w", err)
			}
			time.Sleep(50 * time.Millisecond)
		}
		addr := byte(prm.ToAddr)
		if err := c.WriteSingle(addr, wtvb05.RegUnlock, wtvb05.UnlockKey, to); err != nil {
			return fmt.Errorf("unlock địa chỉ mới: %w", err)
		}
		if mode != nil {
			if err := c.WriteSingle(addr, wtvb05.RegMode, *mode, to); err != nil {
				return fmt.Errorf("ghi MODE: %w", err)
			}
		}
		if found != busBaud {
			// Takes effect after the save below; the reply still comes at the old rate.
			if err := c.WriteSingle(addr, wtvb05.RegBaud, baudCode, to); err != nil {
				return fmt.Errorf("ghi baud: %w", err)
			}
		}
		if err := c.WriteSingle(addr, wtvb05.RegSave, wtvb05.SaveValue, to); err != nil {
			return fmt.Errorf("lưu flash: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if mode != nil {
		v := int(*mode)
		res.Mode = &v
	}

	// Verify at the bus baud; some firmwares apply a new baud only after a restart.
	if a.verifyCommissioned(ctx, m, prm.ToAddr, busBaud, probe) {
		res.Firmware = a.readFirmware(ctx, m, prm.ToAddr)
		return res, nil
	}
	if found != busBaud {
		_ = m.DoAtBaud(ctx, "commission", found, func(c *modbus.RTUClient) error {
			_ = c.WriteSingle(byte(prm.ToAddr), wtvb05.RegUnlock, wtvb05.UnlockKey, to)
			return c.WriteSingle(byte(prm.ToAddr), wtvb05.RegSave, wtvb05.RebootValue, to)
		})
		time.Sleep(time.Second)
		if a.verifyCommissioned(ctx, m, prm.ToAddr, busBaud, probe) {
			res.Firmware = a.readFirmware(ctx, m, prm.ToAddr)
			return res, nil
		}
	}
	return nil, fmt.Errorf("đã ghi cấu hình nhưng cảm biến không trả lời ở 0x%02X/%d bps; tắt bật nguồn cảm biến rồi thử lại",
		prm.ToAddr, busBaud)
}

func (a *Agent) verifyCommissioned(ctx context.Context, m *bus.Manager, addr, baud int, probe func(int, int) error) bool {
	for i := 0; i < 5; i++ {
		if probe(baud, addr) == nil {
			return true
		}
		if !sleepCtx(ctx, 300*time.Millisecond) {
			return false
		}
	}
	return false
}

func (a *Agent) readFirmware(ctx context.Context, m *bus.Manager, addr int) string {
	var fw string
	_ = m.Do(ctx, "commission", func(c *modbus.RTUClient) error {
		r, err := c.ReadHolding(byte(addr), wtvb05.RegVersion, 1, 300*time.Millisecond)
		if err == nil && len(r) == 1 && r[0] != 0 {
			fw = fmt.Sprintf("%d.%d", r[0]>>8, r[0]&0xFF)
		}
		return err
	})
	return fw
}

// probeTimeout allows the request/response transfer time plus the sensor turnaround.
func probeTimeout(baud int) time.Duration {
	t := 80 * time.Millisecond
	if baud > 0 && baud < 19200 {
		t = 200 * time.Millisecond
	}
	return t
}
