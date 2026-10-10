// Package transport abstracts the physical link of an RS485 bus. A device path
// such as "/dev/ttyAS6" or "COM5" opens a serial port; "tcp://host:port" opens a
// raw TCP socket carrying RTU frames (used with sensor-sim or RS485-to-Ethernet
// converters), so the whole stack runs without hardware.
package transport

import (
	"errors"
	"io"
	"net"
	"strings"
	"time"

	"go.bug.st/serial"
)

// ErrDeadline is returned when a read did not complete before its deadline.
var ErrDeadline = errors.New("transport: read deadline exceeded")

// Port is a byte stream with per-read timeouts.
type Port interface {
	io.Writer
	// ReadTimeout reads into p, waiting at most d. Returns 0, nil on timeout.
	ReadTimeout(p []byte, d time.Duration) (int, error)
	// ResetInput discards unread input bytes.
	ResetInput() error
	Close() error
}

// Open opens a serial device or tcp:// endpoint.
func Open(device string, baud int) (Port, error) {
	if strings.HasPrefix(device, "tcp://") {
		conn, err := net.DialTimeout("tcp", strings.TrimPrefix(device, "tcp://"), 5*time.Second)
		if err != nil {
			return nil, err
		}
		return &tcpPort{c: conn}, nil
	}
	sp, err := serial.Open(device, &serial.Mode{BaudRate: baud, DataBits: 8, Parity: serial.NoParity, StopBits: serial.OneStopBit})
	if err != nil {
		return nil, err
	}
	return &serialPort{p: sp}, nil
}

type serialPort struct{ p serial.Port }

func (s *serialPort) Write(b []byte) (int, error) { return s.p.Write(b) }
func (s *serialPort) ReadTimeout(b []byte, d time.Duration) (int, error) {
	if d <= 0 {
		d = time.Millisecond
	}
	if err := s.p.SetReadTimeout(d); err != nil {
		return 0, err
	}
	return s.p.Read(b)
}
func (s *serialPort) ResetInput() error { return s.p.ResetInputBuffer() }
func (s *serialPort) Close() error      { return s.p.Close() }

type tcpPort struct{ c net.Conn }

func (t *tcpPort) Write(b []byte) (int, error) { return t.c.Write(b) }
func (t *tcpPort) ReadTimeout(b []byte, d time.Duration) (int, error) {
	_ = t.c.SetReadDeadline(time.Now().Add(d))
	n, err := t.c.Read(b)
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return n, nil
	}
	return n, err
}
func (t *tcpPort) ResetInput() error {
	buf := make([]byte, 4096)
	for {
		_ = t.c.SetReadDeadline(time.Now().Add(time.Millisecond))
		n, err := t.c.Read(buf)
		if n == 0 || err != nil {
			var ne net.Error
			if err != nil && !(errors.As(err, &ne) && ne.Timeout()) {
				return err
			}
			return nil
		}
	}
}
func (t *tcpPort) Close() error { return t.c.Close() }

// Reader reads exact byte counts from a Port before an absolute deadline.
type Reader struct {
	p        Port
	deadline time.Time
}

// NewReader creates a deadline-bound reader.
func NewReader(p Port, deadline time.Time) *Reader { return &Reader{p: p, deadline: deadline} }

// ReadN reads exactly n bytes or fails with ErrDeadline.
func (r *Reader) ReadN(n int) ([]byte, error) {
	buf := make([]byte, n)
	got := 0
	for got < n {
		remain := time.Until(r.deadline)
		if remain <= 0 {
			return buf[:got], ErrDeadline
		}
		k, err := r.p.ReadTimeout(buf[got:], min(remain, 100*time.Millisecond))
		if err != nil {
			return buf[:got], err
		}
		got += k
	}
	return buf, nil
}
