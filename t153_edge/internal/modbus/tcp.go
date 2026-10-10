package modbus

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"sync"
	"time"
)

// TCPClient is a minimal Modbus TCP client (function 0x03/0x04) used for power meters.
type TCPClient struct {
	Addr    string
	UnitID  byte
	Timeout time.Duration

	mu   sync.Mutex
	conn net.Conn
	tid  uint16
}

// NewTCPClient creates a lazily-connected client.
func NewTCPClient(addr string, unit byte, timeout time.Duration) *TCPClient {
	if timeout <= 0 {
		timeout = time.Second
	}
	return &TCPClient{Addr: addr, UnitID: unit, Timeout: timeout}
}

func (c *TCPClient) ensure() error {
	if c.conn != nil {
		return nil
	}
	conn, err := net.DialTimeout("tcp", c.Addr, c.Timeout)
	if err != nil {
		return err
	}
	c.conn = conn
	return nil
}

// Close closes the connection.
func (c *TCPClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		err := c.conn.Close()
		c.conn = nil
		return err
	}
	return nil
}

// Read reads count registers with function fn (0x03 holding or 0x04 input).
func (c *TCPClient) Read(fn byte, addr, count uint16) ([]uint16, error) {
	if count == 0 || count > maxRegistersPerRd {
		return nil, ErrTooMany
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensure(); err != nil {
		return nil, err
	}
	c.tid++
	req := make([]byte, 12)
	binary.BigEndian.PutUint16(req[0:], c.tid)
	binary.BigEndian.PutUint16(req[2:], 0)
	binary.BigEndian.PutUint16(req[4:], 6)
	req[6] = c.UnitID
	req[7] = fn
	binary.BigEndian.PutUint16(req[8:], addr)
	binary.BigEndian.PutUint16(req[10:], count)
	_ = c.conn.SetDeadline(time.Now().Add(c.Timeout))
	if _, err := c.conn.Write(req); err != nil {
		c.drop()
		return nil, err
	}
	hdr := make([]byte, 7)
	if _, err := io.ReadFull(c.conn, hdr); err != nil {
		c.drop()
		return nil, err
	}
	length := int(binary.BigEndian.Uint16(hdr[4:]))
	if length < 2 || length > 260 {
		c.drop()
		return nil, ErrBadFrame
	}
	body := make([]byte, length-1)
	if _, err := io.ReadFull(c.conn, body); err != nil {
		c.drop()
		return nil, err
	}
	if binary.BigEndian.Uint16(hdr[0:]) != c.tid {
		c.drop()
		return nil, fmt.Errorf("modbus tcp: transaction id mismatch")
	}
	if body[0] == fn|0x80 {
		return nil, &ExceptionError{Func: fn, Code: body[1]}
	}
	if body[0] != fn || int(body[1]) != int(count)*2 || len(body) < 2+int(count)*2 {
		return nil, ErrBadFrame
	}
	return DecodeRegisters(body[2 : 2+int(count)*2]), nil
}

func (c *TCPClient) drop() {
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
}
