// Package logx provides a size-based rotating log writer (10 × 10 MB, spec 5.9).
package logx

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Rotator writes to path and rotates to path.1..path.N when MaxBytes is exceeded.
type Rotator struct {
	Path     string
	MaxBytes int64
	Keep     int

	mu   sync.Mutex
	f    *os.File
	size int64
}

// NewRotator opens (appends to) path.
func NewRotator(path string, maxBytes int64, keep int) (*Rotator, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	r := &Rotator{Path: path, MaxBytes: maxBytes, Keep: keep}
	return r, r.open()
}

func (r *Rotator) open() error {
	f, err := os.OpenFile(r.Path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	st, _ := f.Stat()
	r.f, r.size = f, st.Size()
	return nil
}

// Write implements io.Writer.
func (r *Rotator) Write(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.size+int64(len(p)) > r.MaxBytes {
		r.rotate()
	}
	n, err := r.f.Write(p)
	r.size += int64(n)
	return n, err
}

func (r *Rotator) rotate() {
	r.f.Close()
	for i := r.Keep - 1; i >= 1; i-- {
		_ = os.Rename(fmt.Sprintf("%s.%d", r.Path, i), fmt.Sprintf("%s.%d", r.Path, i+1))
	}
	_ = os.Rename(r.Path, r.Path+".1")
	if err := r.open(); err != nil {
		r.f, _ = os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	}
}

// Close closes the file.
func (r *Rotator) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.f.Close()
}
