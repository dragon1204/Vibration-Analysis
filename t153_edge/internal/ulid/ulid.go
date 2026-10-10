// Package ulid generates ULIDs (26-char Crockford base32, time-sortable) used as msg_id.
package ulid

import (
	"crypto/rand"
	"sync"
	"time"
)

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

var (
	mu       sync.Mutex
	lastMs   uint64
	lastRand [10]byte
)

// New returns a monotonic ULID string.
func New() string { return At(time.Now()) }

// At returns a ULID for time t (monotonic within the same millisecond).
func At(t time.Time) string {
	mu.Lock()
	ms := uint64(t.UnixMilli())
	var r [10]byte
	if ms == lastMs {
		r = lastRand
		for i := 9; i >= 0; i-- {
			r[i]++
			if r[i] != 0 {
				break
			}
		}
	} else {
		_, _ = rand.Read(r[:])
	}
	lastMs, lastRand = ms, r
	mu.Unlock()

	var b [16]byte
	for i := 0; i < 6; i++ {
		b[i] = byte(ms >> (40 - 8*i))
	}
	copy(b[6:], r[:])
	return encode(b)
}

func encode(b [16]byte) string {
	// 128 bits → 26 base32 chars (first char holds 3 bits).
	out := make([]byte, 26)
	var acc uint64
	bits := 0
	idx := 25
	for i := 15; i >= 0; i-- {
		acc |= uint64(b[i]) << bits
		bits += 8
		for bits >= 5 && idx >= 0 {
			out[idx] = alphabet[acc&31]
			acc >>= 5
			bits -= 5
			idx--
		}
	}
	if idx >= 0 {
		out[idx] = alphabet[acc&31]
	}
	return string(out)
}
