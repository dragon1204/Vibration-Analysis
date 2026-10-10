// Package wavefile encodes raw captures (spec 5.9): a one-line JSON header followed by
// int16 little-endian samples interleaved X,Y,Z, all gzip-compressed.
package wavefile

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

// GPerLSB is the WTVB05 acceleration scale (16 g / 32768).
const GPerLSB = 0.00048828125

// Header is the first line of a .bin.gz file.
type Header struct {
	FsHz             float64  `json:"fs_hz"`
	Axes             []string `json:"axes"`
	Scale            string   `json:"scale"`
	Frames           int      `json:"frames"`
	FramesContiguous bool     `json:"frames_contiguous"`
	CaptureID        string   `json:"capture_id,omitempty"`
	PointID          string   `json:"point_id,omitempty"`
	TS               string   `json:"ts,omitempty"`
}

// Interleave packs per-axis frames into int16 LE X,Y,Z interleaved bytes.
func Interleave(axes [3][]int16) []byte {
	n := len(axes[0])
	buf := make([]byte, n*6)
	for i := 0; i < n; i++ {
		for a := 0; a < 3; a++ {
			binary.LittleEndian.PutUint16(buf[i*6+a*2:], uint16(axes[a][i]))
		}
	}
	return buf
}

// Gzip compresses data.
func Gzip(data []byte) []byte {
	var b bytes.Buffer
	w, _ := gzip.NewWriterLevel(&b, gzip.BestCompression)
	_, _ = w.Write(data)
	_ = w.Close()
	return b.Bytes()
}

// EncodeFile builds the gzip'd file content: header line + interleaved samples.
func EncodeFile(h Header, axes [3][]int16) ([]byte, error) {
	if h.Scale == "" {
		h.Scale = fmt.Sprintf("g_per_lsb=%v", GPerLSB)
	}
	if len(h.Axes) == 0 {
		h.Axes = []string{"x", "y", "z"}
	}
	hb, err := json.Marshal(h)
	if err != nil {
		return nil, err
	}
	raw := append(append(hb, '\n'), Interleave(axes)...)
	return Gzip(raw), nil
}

// DecodeFile parses a .bin.gz file.
func DecodeFile(data []byte) (Header, [3][]int16, error) {
	var h Header
	var axes [3][]int16
	zr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return h, axes, err
	}
	br := bufio.NewReader(zr)
	line, err := br.ReadBytes('\n')
	if err != nil {
		return h, axes, err
	}
	if err := json.Unmarshal(line, &h); err != nil {
		return h, axes, err
	}
	body, err := io.ReadAll(br)
	if err != nil {
		return h, axes, err
	}
	n := len(body) / 6
	for a := 0; a < 3; a++ {
		axes[a] = make([]int16, n)
	}
	for i := 0; i < n; i++ {
		for a := 0; a < 3; a++ {
			axes[a][i] = int16(binary.LittleEndian.Uint16(body[i*6+a*2:]))
		}
	}
	return h, axes, nil
}
