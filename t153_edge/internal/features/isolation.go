package features

import (
	"math"
	"sort"

	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/dsp"
	"selink.vn/smartmotor/edge/internal/rules"
)

// IsolationResult is attached to the FeatureSet of each target point (S3/S4) after a
// synchronized group capture (Beer HN method, docs/ALGORITHMS.md §2).
type IsolationResult struct {
	ReferencePoint string                  `json:"reference_point"`
	SourcePoint    string                  `json:"source_point,omitempty"`
	ReferenceCapID string                  `json:"reference_capture_id"`
	AlphaLearned   bool                    `json:"alpha_learned"`
	Mesh           *dsp.MeshDetection      `json:"mesh,omitempty"`
	Axes           map[string]IsolatedAxis `json:"axes"`
	ISOVrmsMax     float64                 `json:"iso_vrms_max_mm_s"`
	Zone           string                  `json:"zone"`
	Bands          []BandEval              `json:"bands"`
	Transmitted    []dsp.PeakInfo          `json:"transmitted_peaks"` // peaks explained by the compressor (ignored)
	Local          []dsp.PeakInfo          `json:"local_peaks"`       // abnormal peaks NOT present at S1
}

// IsolatedAxis are features computed on A_iso.
type IsolatedAxis struct {
	ISOVrmsMMs float64            `json:"iso_vrms_mm_s"`
	Orders     map[string]float64 `json:"orders"`
	BPFOMMs    *float64           `json:"bpfo_mm_s,omitempty"`
	BPFIMMs    *float64           `json:"bpfi_mm_s,omitempty"`
}

// BandEval is a narrowband value compared to its SOP limit.
type BandEval struct {
	Band   string  `json:"band"`
	Axis   string  `json:"axis"`
	VelMMs float64 `json:"vel_mm_s"`
	Warn   float64 `json:"warn"`
	Alarm  float64 `json:"alarm"`
	Level  string  `json:"level"` // healthy | warning | alarm
}

// IsolationInput bundles the spectra of one group capture.
type IsolationInput struct {
	Target, Reference, Source [3]*dsp.Spectrum
	HasSource                 bool
	ReferenceCaptureID        string
	ReferencePoint            string
	SourcePoint               string
	Alpha                     dsp.AlphaTable
	F1xHz                     float64
	MaleLobes                 int
	ISOBandHz                 [2]float64
	ISOLimits                 rules.ISOLimits
	ISOAxes                   []string
	Bearing                   *dsp.BearingGeometry
	BandLimits                []rules.BandLimit
	SourcePeakRatio           float64
}

// ComputeIsolation applies A_iso per axis and evaluates narrowband limits.
func ComputeIsolation(in IsolationInput) *IsolationResult {
	res := &IsolationResult{
		ReferencePoint: in.ReferencePoint, SourcePoint: in.SourcePoint, ReferenceCapID: in.ReferenceCaptureID,
		AlphaLearned: len(in.Alpha) > 0, Axes: map[string]IsolatedAxis{},
	}
	f1 := in.F1xHz
	var mesh dsp.MeshDetection
	if in.HasSource {
		// Use the source axis with the strongest dominant peak.
		for a := 0; a < 3; a++ {
			m := dsp.DetectMesh(in.Source[a], f1, in.MaleLobes)
			if m.VelMMs > mesh.VelMMs {
				mesh = m
			}
		}
		res.Mesh = &mesh
	}
	var ff *dsp.FaultFreqs
	if in.Bearing.Valid() {
		x := in.Bearing.Frequencies(f1)
		ff = &x
	}
	limits := map[string]rules.BandLimit{}
	for _, l := range in.BandLimits {
		limits[l.Band] = l
	}
	res.ISOVrmsMax = math.NaN()
	iso := make([]*dsp.Spectrum, 3)
	for a := 0; a < 3; a++ {
		name := drivers.AxisNames[a]
		iso[a] = dsp.Isolate(in.Target[a], in.Reference[a], in.Alpha)
		f2 := math.Min(in.ISOBandHz[1], dsp.MaxAnalysisHz(iso[a].Fs))
		ia := IsolatedAxis{ISOVrmsMMs: round(iso[a].BandRMSVel(in.ISOBandHz[0], f2), 4), Orders: map[string]float64{}}
		for k, v := range dsp.Orders(iso[a], f1, []float64{1, 2, 3, 4}) {
			ia.Orders[OrderKey(k)] = round(v, 4)
		}
		velAt := func(f float64) float64 {
			if f <= 0 || f > dsp.MaxAnalysisHz(iso[a].Fs) {
				return math.NaN()
			}
			return dsp.OrderAmpAcc(iso[a], f) / (2 * math.Pi * f) * 1000
		}
		if ff != nil {
			if v := velAt(ff.BPFO); !math.IsNaN(v) {
				ia.BPFOMMs = ptr(round(v, 4))
			}
			if v := velAt(ff.BPFI); !math.IsNaN(v) {
				ia.BPFIMMs = ptr(round(v, 4))
			}
		}
		res.Axes[name] = ia
		if contains(in.ISOAxes, name) && (math.IsNaN(res.ISOVrmsMax) || ia.ISOVrmsMMs > res.ISOVrmsMax) {
			res.ISOVrmsMax = ia.ISOVrmsMMs
		}
		// Narrowband SOP bands.
		bands := map[string]float64{
			"1x":   ia.Orders["1"],
			"2x":   ia.Orders["2"],
			"3x4x": math.Sqrt(sq(ia.Orders["3"]) + sq(ia.Orders["4"])),
		}
		if ia.BPFOMMs != nil {
			bands["bpfo"] = *ia.BPFOMMs
		}
		if ia.BPFIMMs != nil {
			bands["bpfi"] = *ia.BPFIMMs
		}
		for _, b := range []string{"1x", "2x", "3x4x", "bpfo", "bpfi"} {
			v, ok := bands[b]
			l, hasL := limits[b]
			if !ok || !hasL {
				continue
			}
			lvl := "healthy"
			if v > l.Alarm {
				lvl = "alarm"
			} else if v > l.Warn {
				lvl = "warning"
			}
			res.Bands = append(res.Bands, BandEval{Band: b, Axis: name, VelMMs: round(v, 4), Warn: l.Warn, Alarm: l.Alarm, Level: lvl})
		}
		// Cross-coherence with S1 on the top isolated peaks.
		if in.HasSource {
			for _, p := range topPeaks(iso[a], in.ISOBandHz[0], f2, 5) {
				if dsp.TransmittedFromSource(in.Source[a], p.FreqHz, p.VelMMs, in.SourcePeakRatio) {
					res.Transmitted = append(res.Transmitted, p)
				} else {
					res.Local = append(res.Local, p)
				}
			}
		}
	}
	res.Zone = in.ISOLimits.Zone(res.ISOVrmsMax)
	return res
}

func topPeaks(s *dsp.Spectrum, f1, f2 float64, n int) []dsp.PeakInfo {
	v := s.VelocityAmp(f1)
	var peaks []dsp.PeakInfo
	for k := 2; k < len(v)-1; k++ {
		f := s.Freq(k)
		if f < f1 || f > f2 {
			continue
		}
		if v[k] > v[k-1] && v[k] >= v[k+1] && v[k] > 0 {
			peaks = append(peaks, dsp.PeakInfo{FreqHz: round(f, 2), VelMMs: round(v[k], 4)})
		}
	}
	sort.Slice(peaks, func(i, j int) bool { return peaks[i].VelMMs > peaks[j].VelMMs })
	if len(peaks) > n {
		peaks = peaks[:n]
	}
	return peaks
}

func sq(x float64) float64 { return x * x }

func contains(xs []string, s string) bool {
	for _, x := range xs {
		if x == s {
			return true
		}
	}
	return false
}
