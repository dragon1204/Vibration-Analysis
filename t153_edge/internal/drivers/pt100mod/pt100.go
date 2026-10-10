// Package pt100mod reads generic PT100→RS485 Modbus RTU modules (spec 3.3).
// The exact module model is not fixed yet [CẦN XÁC MINH], so the register base,
// function code, scale and offset are all configurable.
package pt100mod

import (
	"context"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/modbus"
)

// Options describes one module.
type Options struct {
	ID       string
	Addr     byte
	Channels int     // number of channels to read
	RegBase  uint16  // register of channel 1
	Function byte    // 0x03 or 0x04
	Scale    float64 // temp = raw*Scale + Offset
	Offset   float64
	// InvalidRaw marks open/short-circuit sensor values (e.g. 0x7FFF).
	InvalidRaw []int16
	Timeout    time.Duration
}

// Module is a multi-channel PT100 converter.
type Module struct {
	opt Options
	bus *bus.Manager
}

// New creates a module driver.
func New(b *bus.Manager, opt Options) *Module {
	if opt.Channels <= 0 {
		opt.Channels = 4
	}
	if opt.Function == 0 {
		opt.Function = modbus.FuncReadHolding
	}
	if opt.Scale == 0 {
		opt.Scale = 0.1
	}
	if opt.Timeout == 0 {
		opt.Timeout = 300 * time.Millisecond
	}
	if opt.InvalidRaw == nil {
		opt.InvalidRaw = []int16{0x7FFF, -32768}
	}
	return &Module{opt: opt, bus: b}
}

// Read returns all channels; channel numbers start at 1.
func (m *Module) Read(ctx context.Context) ([]drivers.ChannelValue, error) {
	var regs []uint16
	err := m.bus.Do(ctx, m.opt.ID, func(c *modbus.RTUClient) error {
		var e error
		if m.opt.Function == modbus.FuncReadInput {
			regs, e = c.ReadInput(m.opt.Addr, m.opt.RegBase, uint16(m.opt.Channels), m.opt.Timeout)
		} else {
			regs, e = c.ReadHolding(m.opt.Addr, m.opt.RegBase, uint16(m.opt.Channels), m.opt.Timeout)
		}
		return e
	})
	if err != nil {
		return nil, err
	}
	out := make([]drivers.ChannelValue, len(regs))
	for i, r := range regs {
		raw := int16(r)
		ok := true
		for _, bad := range m.opt.InvalidRaw {
			if raw == bad {
				ok = false
			}
		}
		t := float64(raw)*m.opt.Scale + m.opt.Offset
		if t < -50 || t > 250 {
			ok = false
		}
		out[i] = drivers.ChannelValue{Channel: i + 1, TempC: t, OK: ok}
	}
	return out, nil
}
