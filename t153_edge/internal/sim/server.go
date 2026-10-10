package sim

import (
	"io"
	"log/slog"
	"math/rand"
	"net"
	"sync"
	"time"

	"go.bug.st/serial"

	"selink.vn/smartmotor/edge/internal/modbus"
)

// Faults configures error injection (spec 5.14).
type Faults struct {
	CRCErrorRate float64 // probability of corrupting a response
	TimeoutRate  float64 // probability of not answering
	DelayMs      int     // extra turnaround delay
	EmulateBaud  int     // >0: delay responses by their transfer time at this baud
}

// Bus dispatches requests to slaves by address.
type Bus struct {
	mu     sync.Mutex
	slaves map[byte]Slave
	Faults Faults
	log    *slog.Logger
	rnd    *rand.Rand
}

// NewBus creates an empty simulated bus.
func NewBus(log *slog.Logger) *Bus {
	return &Bus{slaves: map[byte]Slave{}, log: log, rnd: rand.New(rand.NewSource(time.Now().UnixNano()))}
}

// Add registers a slave.
func (b *Bus) Add(s Slave) {
	b.mu.Lock()
	b.slaves[s.Addr()] = s
	b.mu.Unlock()
}

// Slaves returns registered slaves.
func (b *Bus) Slaves() []Slave {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]Slave, 0, len(b.slaves))
	for _, s := range b.slaves {
		out = append(out, s)
	}
	return out
}

// Serve handles one byte stream (TCP connection or serial port) until EOF.
func (b *Bus) Serve(rw io.ReadWriter) error {
	buf := make([]byte, 0, 256)
	tmp := make([]byte, 256)
	for {
		n, err := rw.Read(tmp)
		if err != nil {
			return err
		}
		buf = append(buf, tmp[:n]...)
		// All requests used by the edge are 8-byte frames (0x03/0x04/0x06).
		for len(buf) >= 8 {
			frame := buf[:8]
			if !modbus.CheckCRC(frame) {
				buf = buf[1:] // resync
				continue
			}
			req := append([]byte(nil), frame[:6]...)
			buf = buf[8:]
			b.mu.Lock()
			// Address changes (wtvb-config set-addr) re-key the slave map.
			for k, s := range b.slaves {
				if s.Addr() != k {
					delete(b.slaves, k)
					b.slaves[s.Addr()] = s
				}
			}
			s := b.slaves[req[0]]
			f := b.Faults
			drop := b.rnd.Float64() < f.TimeoutRate
			corrupt := b.rnd.Float64() < f.CRCErrorRate
			b.mu.Unlock()
			if s == nil || drop {
				continue
			}
			resp := s.Handle(req)
			if resp == nil {
				continue
			}
			out := modbus.AppendCRC(resp)
			if corrupt {
				out[len(out)/2] ^= 0x5A
			}
			delay := time.Duration(f.DelayMs) * time.Millisecond
			if f.EmulateBaud > 0 {
				delay += time.Duration(float64(len(out)*10) / float64(f.EmulateBaud) * float64(time.Second))
			}
			if delay > 0 {
				time.Sleep(delay)
			}
			if _, err := rw.Write(out); err != nil {
				return err
			}
		}
	}
}

// ListenTCP serves connections on addr (e.g. ":5020").
func (b *Bus) ListenTCP(addr string) error {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	b.log.Info("sim bus listening", "tcp", addr)
	for {
		c, err := ln.Accept()
		if err != nil {
			return err
		}
		go func() {
			defer c.Close()
			b.log.Info("client connected", "remote", c.RemoteAddr())
			_ = b.Serve(c)
			b.log.Info("client disconnected", "remote", c.RemoteAddr())
		}()
	}
}

// ListenSerial serves a serial port (e.g. one end of a socat PTY pair or a COM port).
func (b *Bus) ListenSerial(dev string, baud int) error {
	p, err := serial.Open(dev, &serial.Mode{BaudRate: baud})
	if err != nil {
		return err
	}
	defer p.Close()
	b.log.Info("sim bus on serial", "device", dev, "baud", baud)
	return b.Serve(p)
}
