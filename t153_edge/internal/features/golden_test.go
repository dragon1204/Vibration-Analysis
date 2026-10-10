package features_test

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/dsp"
	"selink.vn/smartmotor/edge/internal/features"
	"selink.vn/smartmotor/edge/internal/sim"
	"selink.vn/smartmotor/edge/internal/wavefile"
)

// Golden cases shared with the server (selink_server/services/tests/test_golden.py, spec 11).
type goldenCase struct {
	Name     string
	Scenario string
	SR       uint8
	Frames   int
	Bandpass []float64
	Bearing  *dsp.BearingGeometry
}

var goldenCases = []goldenCase{
	{Name: "unbalance_orders", Scenario: sim.Unbalance, SR: 4, Frames: 4},
	{Name: "misalignment_orders", Scenario: sim.Misalignment, SR: 4, Frames: 4},
	{Name: "bearing_outer_env", Scenario: sim.BearingOuter, SR: 2, Frames: 8, Bandpass: []float64{1000, 3000},
		Bearing: &dsp.BearingGeometry{NBalls: 9, BdMm: 20.44, PdMm: 100}}, // BPFO = 3.58×1X as in sim
}

func goldenDir() string {
	_, f, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(f), "..", "..", "testdata", "golden")
}

func buildCapture(c goldenCase) features.Capture {
	sig := sim.NewSignal(49.63, c.Scenario, 42)
	fs := wtvb05.SampleRates[c.SR]
	var frames []drivers.RawFrame
	for i := 0; i < c.Frames; i++ {
		x := sig.Sample(fs, 1024, float64(i)*1.5) // non-contiguous frames
		var counts [3][]int16
		for a := 0; a < 3; a++ {
			counts[a] = sim.ToCounts(x[a])
		}
		frames = append(frames, wtvb05.BuildFrame(counts, fs, c.SR, time.Time{}, time.Time{}))
	}
	return features.Capture{CaptureID: "golden_" + c.Name, PointID: "golden", Profile: c.Name,
		TS: time.Date(2026, 10, 8, 14, 0, 0, 0, time.UTC), FsHz: fs, SrCode: c.SR, Frames: frames, BandpassHz: c.Bandpass}
}

func goldenContext(c goldenCase) features.Context {
	return features.Context{Running: true, LoadPct: math.NaN(), NominalF1xHz: 49.63, ISOBandHz: [2]float64{10, 1000},
		LineFreqHz: 50, Bearing: c.Bearing, Contiguity: "off"}
}

// TestWriteGolden regenerates the golden files when GOLDEN_WRITE=1.
func TestWriteGolden(t *testing.T) {
	if os.Getenv("GOLDEN_WRITE") != "1" {
		t.Skip("set GOLDEN_WRITE=1 to regenerate testdata/golden")
	}
	dir := goldenDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, c := range goldenCases {
		cp := buildCapture(c)
		var counts [3][]int16
		for _, f := range cp.Frames {
			for a := 0; a < 3; a++ {
				counts[a] = append(counts[a], f.Counts[a]...)
			}
		}
		file, err := wavefile.EncodeFile(wavefile.Header{FsHz: cp.FsHz, Frames: c.Frames, CaptureID: cp.CaptureID}, counts)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, c.Name+".bin.gz"), file, 0o644); err != nil {
			t.Fatal(err)
		}
		res := features.Compute(cp, goldenContext(c))
		meta := map[string]any{"features": res.Features, "bandpass_hz": c.Bandpass, "bearing": c.Bearing,
			"nominal_f1x_hz": 49.63, "iso_band_hz": []float64{10, 1000}, "line_freq_hz": 50}
		b, _ := json.MarshalIndent(meta, "", " ")
		if err := os.WriteFile(filepath.Join(dir, c.Name+".json"), b, 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

// TestGoldenStable checks Compute still reproduces the committed golden features.
func TestGoldenStable(t *testing.T) {
	for _, c := range goldenCases {
		b, err := os.ReadFile(filepath.Join(goldenDir(), c.Name+".json"))
		if err != nil {
			t.Skip("golden files missing; run with GOLDEN_WRITE=1")
		}
		var meta struct {
			Features features.FeatureSet `json:"features"`
		}
		if err := json.Unmarshal(b, &meta); err != nil {
			t.Fatal(err)
		}
		data, _ := os.ReadFile(filepath.Join(goldenDir(), c.Name+".bin.gz"))
		h, counts, err := wavefile.DecodeFile(data)
		if err != nil {
			t.Fatal(err)
		}
		cp := features.Capture{CaptureID: "g", PointID: "golden", FsHz: h.FsHz, SrCode: c.SR, BandpassHz: c.Bandpass}
		for i := 0; i < h.Frames; i++ {
			var fc [3][]int16
			for a := 0; a < 3; a++ {
				fc[a] = counts[a][i*1024 : (i+1)*1024]
			}
			cp.Frames = append(cp.Frames, wtvb05.BuildFrame(fc, h.FsHz, c.SR, time.Time{}, time.Time{}))
		}
		res := features.Compute(cp, goldenContext(c))
		for _, ax := range []string{"x", "y", "z"} {
			got, want := res.Features.Axes[ax].ISOVrmsMMs, meta.Features.Axes[ax].ISOVrmsMMs
			if math.Abs(got-want) > 1e-3*math.Max(want, 0.01) {
				t.Errorf("%s %s iso_vrms %v != %v", c.Name, ax, got, want)
			}
		}
	}
}
