package modbus

import (
	"errors"
	"fmt"
	"time"

	"selink.vn/smartmotor/edge/internal/transport"
)

// Function codes used in this project.
const (
	FuncReadHolding   = 0x03
	FuncReadInput     = 0x04
	FuncWriteSingle   = 0x06
	maxRegistersPerRd = 125
)

var (
	ErrCRC       = errors.New("modbus: crc mismatch")
	ErrTimeout   = errors.New("modbus: timeout")
	ErrBadFrame  = errors.New("modbus: malformed response")
	ErrBadEcho   = errors.New("modbus: write echo mismatch")
	ErrTooMany   = errors.New("modbus: too many registers in one request")
	ErrWrongAddr = errors.New("modbus: response from unexpected slave")
)

// ExceptionError is returned when the slave answers with an exception code.
type ExceptionError struct {
	Func byte
	Code byte
}

func (e *ExceptionError) Error() string {
	return fmt.Sprintf("modbus: exception func=0x%02X code=0x%02X", e.Func, e.Code)
}

// BuildRead builds a read request (function 0x03 or 0x04).
func BuildRead(id byte, fn byte, addr, count uint16) []byte {
	f := []byte{id, fn, byte(addr >> 8), byte(addr), byte(count >> 8), byte(count)}
	return AppendCRC(f)
}

// BuildWriteSingle builds a function 0x06 request.
func BuildWriteSingle(id byte, addr, value uint16) []byte {
	f := []byte{id, FuncWriteSingle, byte(addr >> 8), byte(addr), byte(value >> 8), byte(value)}
	return AppendCRC(f)
}

// DecodeRegisters converts big-endian register bytes to uint16 values.
func DecodeRegisters(b []byte) []uint16 {
	out := make([]uint16, len(b)/2)
	for i := range out {
		out[i] = uint16(b[2*i])<<8 | uint16(b[2*i+1])
	}
	return out
}

// RTUClient performs request/response transactions on a half-duplex port.
// It is NOT safe for concurrent use; the bus manager owns it.
type RTUClient struct {
	Port transport.Port
	// Gap is the silent interval enforced between transactions (>= 3.5 chars).
	Gap      time.Duration
	lastDone time.Time
}

// NewRTUClient creates a client and derives the inter-frame gap from the baud rate.
func NewRTUClient(p transport.Port, baud int) *RTUClient {
	gap := time.Duration(float64(time.Second) * 3.5 * 11 / float64(max(baud, 1200)))
	if gap < 2*time.Millisecond {
		gap = 2 * time.Millisecond
	}
	return &RTUClient{Port: p, Gap: gap}
}

func (c *RTUClient) beforeTx() {
	if wait := c.Gap - time.Since(c.lastDone); wait > 0 {
		time.Sleep(wait)
	}
	_ = c.Port.ResetInput()
}

func (c *RTUClient) afterTx() { c.lastDone = time.Now() }

// Transact sends req and reads a response using readResp. Used for custom frames.
func (c *RTUClient) Transact(req []byte, timeout time.Duration, readResp func(r *transport.Reader) ([]byte, error)) ([]byte, error) {
	c.beforeTx()
	defer c.afterTx()
	if _, err := c.Port.Write(req); err != nil {
		return nil, fmt.Errorf("modbus: write: %w", err)
	}
	r := transport.NewReader(c.Port, time.Now().Add(timeout))
	return readResp(r)
}

// readStandard reads a standard RTU response for function fn.
func readStandard(r *transport.Reader, id, fn byte) ([]byte, error) {
	hdr, err := r.ReadN(3)
	if err != nil {
		return nil, mapTimeout(err)
	}
	if hdr[0] != id {
		return nil, ErrWrongAddr
	}
	var rest []byte
	switch {
	case hdr[1] == fn|0x80:
		rest, err = r.ReadN(2)
		if err != nil {
			return nil, mapTimeout(err)
		}
		frame := append(hdr, rest...)
		if !CheckCRC(frame) {
			return nil, ErrCRC
		}
		return nil, &ExceptionError{Func: fn, Code: hdr[2]}
	case hdr[1] != fn:
		return nil, ErrBadFrame
	case fn == FuncReadHolding || fn == FuncReadInput:
		rest, err = r.ReadN(int(hdr[2]) + 2)
	case fn == FuncWriteSingle:
		rest, err = r.ReadN(5)
	default:
		return nil, ErrBadFrame
	}
	if err != nil {
		return nil, mapTimeout(err)
	}
	frame := append(hdr, rest...)
	if !CheckCRC(frame) {
		return nil, ErrCRC
	}
	return frame, nil
}

func mapTimeout(err error) error {
	if errors.Is(err, transport.ErrDeadline) {
		return ErrTimeout
	}
	return err
}

// ReadHolding reads count holding registers starting at addr.
func (c *RTUClient) ReadHolding(id byte, addr, count uint16, timeout time.Duration) ([]uint16, error) {
	if count == 0 || count > maxRegistersPerRd {
		return nil, ErrTooMany
	}
	req := BuildRead(id, FuncReadHolding, addr, count)
	frame, err := c.Transact(req, timeout, func(r *transport.Reader) ([]byte, error) {
		return readStandard(r, id, FuncReadHolding)
	})
	if err != nil {
		return nil, err
	}
	if int(frame[2]) != int(count)*2 {
		return nil, ErrBadFrame
	}
	return DecodeRegisters(frame[3 : 3+int(count)*2]), nil
}

// ReadInput reads count input registers (function 0x04).
func (c *RTUClient) ReadInput(id byte, addr, count uint16, timeout time.Duration) ([]uint16, error) {
	if count == 0 || count > maxRegistersPerRd {
		return nil, ErrTooMany
	}
	req := BuildRead(id, FuncReadInput, addr, count)
	frame, err := c.Transact(req, timeout, func(r *transport.Reader) ([]byte, error) {
		return readStandard(r, id, FuncReadInput)
	})
	if err != nil {
		return nil, err
	}
	if int(frame[2]) != int(count)*2 {
		return nil, ErrBadFrame
	}
	return DecodeRegisters(frame[3 : 3+int(count)*2]), nil
}

// WriteSingle writes one register (function 0x06) and checks the echo.
func (c *RTUClient) WriteSingle(id byte, addr, value uint16, timeout time.Duration) error {
	req := BuildWriteSingle(id, addr, value)
	frame, err := c.Transact(req, timeout, func(r *transport.Reader) ([]byte, error) {
		return readStandard(r, id, FuncWriteSingle)
	})
	if err != nil {
		return err
	}
	for i := range req {
		if frame[i] != req[i] {
			return ErrBadEcho
		}
	}
	return nil
}
