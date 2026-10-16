package agent

import (
	"testing"

	"selink.vn/smartmotor/edge/internal/drivers"
)

func TestFastRMSFrameCountCoversOneSecond(t *testing.T) {
	tests := []struct {
		fs   float64
		want int
	}{{4000, 4}, {2000, 2}, {1000, 1}, {512, 1}}
	for _, tc := range tests {
		if got := fastRMSFrameCount(tc.fs); got != tc.want {
			t.Fatalf("fastRMSFrameCount(%v) = %d, want %d", tc.fs, got, tc.want)
		}
	}
}

func TestAppendFastRMSFrameKeepsNewestWindow(t *testing.T) {
	var window []drivers.RawFrame
	for i := 1; i <= 6; i++ {
		window = appendFastRMSFrame(window, drivers.RawFrame{SrCode: uint8(i)}, 4)
	}
	if len(window) != 4 {
		t.Fatalf("window length = %d, want 4", len(window))
	}
	for i, want := range []uint8{3, 4, 5, 6} {
		if window[i].SrCode != want {
			t.Fatalf("window[%d] = %d, want %d", i, window[i].SrCode, want)
		}
	}
}
