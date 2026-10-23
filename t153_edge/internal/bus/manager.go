// Package bus serializes all traffic on one RS485 bus. Exactly one goroutine
// owns the port; callers submit jobs through a priority queue
// (P0 urgent capture > P1 periodic indicators > P2 periodic capture > P3 config).
package bus

import (
	"container/heap"
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"selink.vn/smartmotor/edge/internal/modbus"
	"selink.vn/smartmotor/edge/internal/transport"
)

// Priority of a bus job. Lower value runs first.
type Priority int

const (
	P0 Priority = iota // urgent (event capture)
	P1                 // periodic indicators
	P2                 // periodic capture
	P3                 // configuration
)

type prioKey struct{}

// WithPriority attaches a bus priority to ctx; drivers read it when submitting jobs.
func WithPriority(ctx context.Context, p Priority) context.Context {
	return context.WithValue(ctx, prioKey{}, p)
}

// PriorityFrom returns the priority stored in ctx (default P1).
func PriorityFrom(ctx context.Context) Priority {
	if p, ok := ctx.Value(prioKey{}).(Priority); ok {
		return p
	}
	return P1
}

// ErrClosed is returned for jobs submitted after the manager stopped.
var ErrClosed = errors.New("bus: manager closed")

// Stats are per-device transaction counters exposed in health messages.
type Stats struct {
	Requests uint64 `json:"requests"`
	Timeouts uint64 `json:"timeouts"`
	CRC      uint64 `json:"crc"`
	Errors   uint64 `json:"errors"`
}

type job struct {
	prio Priority
	seq  uint64
	ctx  context.Context
	dev  string
	baud int // 0 = bus baud; otherwise the port is reopened at this rate for the job
	fn   func(c *modbus.RTUClient) error
	done chan error
}

type jobHeap []*job

func (h jobHeap) Len() int { return len(h) }
func (h jobHeap) Less(i, j int) bool {
	if h[i].prio != h[j].prio {
		return h[i].prio < h[j].prio
	}
	return h[i].seq < h[j].seq
}
func (h jobHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *jobHeap) Push(x any)   { *h = append(*h, x.(*job)) }
func (h *jobHeap) Pop() any     { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }

// Manager owns one bus.
type Manager struct {
	ID     string
	Device string
	Baud   int
	log    *slog.Logger

	mu     sync.Mutex
	cond   *sync.Cond
	queue  jobHeap
	seq    uint64
	closed bool
	client *modbus.RTUClient
	cur    int // baud the open client uses
	stats  map[string]*Stats
}

// New creates a manager; call Run to start it.
func New(id, device string, baud int, log *slog.Logger) *Manager {
	m := &Manager{ID: id, Device: device, Baud: baud, log: log.With("bus", id), stats: map[string]*Stats{}}
	m.cond = sync.NewCond(&m.mu)
	return m
}

// Do runs fn with exclusive access to the bus. dev identifies the device for stats.
func (m *Manager) Do(ctx context.Context, dev string, fn func(c *modbus.RTUClient) error) error {
	return m.DoAtBaud(ctx, dev, 0, fn)
}

// DoAtBaud runs fn with the port temporarily set to baud (0 = bus baud), e.g. to reach a
// factory-new sensor at 9600 bps on a 115200 bps bus. The next ordinary job restores the rate.
func (m *Manager) DoAtBaud(ctx context.Context, dev string, baud int, fn func(c *modbus.RTUClient) error) error {
	j := &job{prio: PriorityFrom(ctx), ctx: ctx, dev: dev, baud: baud, fn: fn, done: make(chan error, 1)}
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return ErrClosed
	}
	m.seq++
	j.seq = m.seq
	heap.Push(&m.queue, j)
	m.cond.Signal()
	m.mu.Unlock()
	select {
	case err := <-j.done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Stats returns a snapshot of per-device counters.
func (m *Manager) Stats() map[string]Stats {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make(map[string]Stats, len(m.stats))
	for k, v := range m.stats {
		out[k] = *v
	}
	return out
}

// QueueLen returns the number of pending jobs.
func (m *Manager) QueueLen() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.queue)
}

// Run opens the port (reopening on failure) and executes jobs until ctx ends.
func (m *Manager) Run(ctx context.Context) {
	go func() {
		<-ctx.Done()
		m.mu.Lock()
		m.closed = true
		m.cond.Broadcast()
		m.mu.Unlock()
	}()
	backoff := time.Second
	for {
		j := m.next()
		if j == nil {
			if m.client != nil {
				_ = m.client.Port.Close()
			}
			return
		}
		if j.ctx.Err() != nil {
			j.done <- j.ctx.Err()
			continue
		}
		want := m.Baud
		if j.baud > 0 {
			want = j.baud
		}
		if m.client != nil && m.cur != want {
			_ = m.client.Port.Close()
			m.client = nil
		}
		if m.client == nil {
			p, err := transport.Open(m.Device, want)
			if err != nil {
				m.log.Warn("open bus failed", "device", m.Device, "err", err)
				j.done <- err
				select {
				case <-ctx.Done():
				case <-time.After(backoff):
				}
				backoff = min(backoff*2, 30*time.Second)
				continue
			}
			backoff = time.Second
			m.client, m.cur = modbus.NewRTUClient(p, want), want
			if want == m.Baud {
				m.log.Info("bus opened", "device", m.Device, "baud", want)
			} else {
				m.log.Info("bus opened at temporary baud", "device", m.Device, "baud", want)
			}
		}
		err := j.fn(m.client)
		m.account(j.dev, err)
		if err != nil && !isProtocolErr(err) {
			// I/O error on the port itself: reopen on next job.
			m.log.Warn("bus i/o error, reopening", "err", err)
			_ = m.client.Port.Close()
			m.client = nil
		}
		j.done <- err
	}
}

func (m *Manager) next() *job {
	m.mu.Lock()
	defer m.mu.Unlock()
	for len(m.queue) == 0 && !m.closed {
		m.cond.Wait()
	}
	if m.closed {
		for _, j := range m.queue {
			j.done <- ErrClosed
		}
		m.queue = nil
		return nil
	}
	return heap.Pop(&m.queue).(*job)
}

func (m *Manager) account(dev string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.stats[dev]
	if s == nil {
		s = &Stats{}
		m.stats[dev] = s
	}
	s.Requests++
	switch {
	case err == nil:
	case errors.Is(err, modbus.ErrTimeout):
		s.Timeouts++
	case errors.Is(err, modbus.ErrCRC):
		s.CRC++
	default:
		s.Errors++
	}
}

func isProtocolErr(err error) bool {
	var ex *modbus.ExceptionError
	return errors.Is(err, modbus.ErrTimeout) || errors.Is(err, modbus.ErrCRC) ||
		errors.Is(err, modbus.ErrBadFrame) || errors.Is(err, modbus.ErrBadEcho) ||
		errors.Is(err, modbus.ErrWrongAddr) || errors.As(err, &ex) ||
		errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) ||
		isDriverErr(err)
}

// DriverError marks errors raised by driver logic (not port I/O) so the bus is not reopened.
type DriverError struct{ Err error }

func (e *DriverError) Error() string { return e.Err.Error() }
func (e *DriverError) Unwrap() error { return e.Err }

func isDriverErr(err error) bool {
	var de *DriverError
	return errors.As(err, &de)
}
