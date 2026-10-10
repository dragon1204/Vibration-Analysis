// Package features turns a capture (N raw frames) into a FeatureSet (spec 5.6.10)
// and a compact spectrum document for upload.
package features

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"selink.vn/smartmotor/edge/internal/drivers"
	"selink.vn/smartmotor/edge/internal/dsp"
)

// Capture is the input of feature extraction.
type Capture struct {
	CaptureID  string
	PointID    string
	Profile    string
	TS         time.Time
	FsHz       float64
	SrCode     uint8
	Frames     []drivers.RawFrame
	BandpassHz []float64
}

// Context holds machine/point information needed to compute features.
type Context struct {
	Running       bool
	LoadPct       float64
	NominalF1xHz  float64
	SpeedHintHz   float64
	ISOBandHz     [2]float64
	Orders        []float64
	Bearing       *dsp.BearingGeometry
	Calibration   *dsp.Calibration
	Contiguity    string // off | auto
	LineFreqHz    float64
	MeshFreqHz    float64 // compressor mesh (lobes × 1X), 0 if none
	EnvelopeMaxHz float64
}

// DefaultOrders per spec 5.6.5.
var DefaultOrders = []float64{0.5, 1, 1.5, 2, 3, 4, 5, 6}

// AxisFeatures per axis.
type AxisFeatures struct {
	AccRmsG    float64            `json:"acc_rms_g"`
	AccPeakG   float64            `json:"acc_peak_g"`
	Crest      float64            `json:"crest"`
	Kurtosis   float64            `json:"kurtosis"`
	Skew       float64            `json:"skew"`
	ISOVrmsMMs float64            `json:"iso_vrms_mm_s"`
	ISOBandHz  [2]float64         `json:"iso_band_hz"`
	Orders     map[string]float64 `json:"orders"`
	OrdersUnit string             `json:"orders_unit"`
	LineX2MMs  float64            `json:"line_2x_mm_s"`        // 2×f_line (100 Hz) component
	MeshMMs    *float64           `json:"mesh_mm_s,omitempty"` // compressor mesh component
}

// EnvelopeAxis are envelope features per axis.
type EnvelopeAxis struct {
	EnvRmsG  float64                  `json:"env_rms_g"`
	BPFOEnvG *float64                 `json:"bpfo_env_g,omitempty"`
	BPFIEnvG *float64                 `json:"bpfi_env_g,omitempty"`
	BSFEnvG  *float64                 `json:"bsf_env_g,omitempty"`
	FTFEnvG  *float64                 `json:"ftf_env_g,omitempty"`
	Faults   map[string]dsp.FaultPeak `json:"faults,omitempty"`
}

// Envelope is the envelope block of a FeatureSet.
type Envelope struct {
	BandHz       [2]float64              `json:"band_hz"`
	DfHz         float64                 `json:"df_hz"`
	FaultFreqsHz map[string]float64      `json:"fault_freqs_hz,omitempty"`
	Axes         map[string]EnvelopeAxis `json:"axes"`
	// Convenience maxima across axes (feature names used by server: env.rms, env.bpfo...).
	EnvRmsG  float64  `json:"env_rms_g"`
	BPFOEnvG *float64 `json:"bpfo_env_g,omitempty"`
	BPFIEnvG *float64 `json:"bpfi_env_g,omitempty"`
}

// FeatureSet is published on features/<point> (spec 5.6.10).
type FeatureSet struct {
	MsgID            string                  `json:"msg_id,omitempty"`
	CaptureID        string                  `json:"capture_id"`
	PointID          string                  `json:"point_id"`
	MachineID        string                  `json:"machine_id,omitempty"`
	Profile          string                  `json:"profile"`
	TS               string                  `json:"ts"`
	FsHz             float64                 `json:"fs_hz"`
	SrCode           int                     `json:"sr_code"`
	Frames           int                     `json:"frames"`
	FramesContiguous bool                    `json:"frames_contiguous"`
	NFFT             int                     `json:"n_fft"`
	DfHz             float64                 `json:"df_hz"`
	Running          bool                    `json:"running"`
	LoadPct          *float64                `json:"load_pct"`
	SpeedHz          float64                 `json:"speed_hz"`
	SpeedConfidence  string                  `json:"speed_confidence"`
	Axes             map[string]AxisFeatures `json:"axes"`
	Envelope         *Envelope               `json:"envelope"`
	Isolation        *IsolationResult        `json:"isolation,omitempty"`
	QualityFlags     []string                `json:"quality_flags"`
	WaveformRef      string                  `json:"waveform_ref"`
	SpectrumRef      string                  `json:"spectrum_ref"`
}

// ISOVrmsMax returns the max ISO velocity over the given axes (all if empty).
func (f *FeatureSet) ISOVrmsMax(axes []string) float64 {
	best := math.NaN()
	consider := func(a string) {
		if af, ok := f.Axes[a]; ok && (math.IsNaN(best) || af.ISOVrmsMMs > best) {
			best = af.ISOVrmsMMs
		}
	}
	if len(axes) == 0 {
		axes = drivers.AxisNames[:]
	}
	for _, a := range axes {
		consider(a)
	}
	return best
}

// SpectrumDoc is the compact spectrum uploaded on spectrum/<point> and stored as spec/*.json.gz.
type SpectrumDoc struct {
	CaptureID string               `json:"capture_id"`
	PointID   string               `json:"point_id"`
	TS        string               `json:"ts"`
	FsHz      float64              `json:"fs_hz"`
	NFFT      int                  `json:"n_fft"`
	DfHz      float64              `json:"df_hz"`
	SpeedHz   float64              `json:"speed_hz"`
	Unit      string               `json:"acc_unit"`
	Acc       map[string][]float32 `json:"acc"` // A_rms per bin (m/s^2)
	Env       *EnvSpectrumDoc      `json:"env,omitempty"`
	Markers   map[string]float64   `json:"markers"`
}

// EnvSpectrumDoc is the envelope spectrum (peak g).
type EnvSpectrumDoc struct {
	DfHz float64              `json:"df_hz"`
	Amp  map[string][]float32 `json:"amp_g"`
}

// Result bundles outputs of Compute.
type Result struct {
	Features *FeatureSet
	Spectra  [3]*dsp.Spectrum
	Spectrum *SpectrumDoc
	// AxisSamples are per-axis concatenated samples (m/s^2).
	AxisSamples [3][]float64
}

func round(v float64, digits int) float64 {
	p := math.Pow(10, float64(digits))
	return math.Round(v*p) / p
}

func ptr(v float64) *float64 { return &v }

// OrderKey formats an order number as in the spec ("0.5", "1", "2").
func OrderKey(k float64) string { return strconv.FormatFloat(k, 'f', -1, 64) }

// Compute extracts features from a capture.
func Compute(c Capture, ctx Context) *Result {
	fs := c.FsHz
	flags := []string{}
	usable := make([]drivers.RawFrame, 0, len(c.Frames))
	for _, f := range c.Frames {
		if f.Saturated {
			continue
		}
		usable = append(usable, f)
	}
	if len(usable) < len(c.Frames) {
		flags = append(flags, "saturated")
	}
	if len(usable) == 0 {
		usable = c.Frames // still compute, flagged
	}
	toF64 := func(x []float32) []float64 {
		o := make([]float64, len(x))
		for i, v := range x {
			o[i] = float64(v)
		}
		return o
	}
	var perAxisFrames [3][][]float64
	var all [3][]float64
	for _, f := range usable {
		for a := 0; a < 3; a++ {
			s := toF64(f.Samples[a])
			perAxisFrames[a] = append(perAxisFrames[a], s)
			all[a] = append(all[a], s...)
		}
	}
	nominal := ctx.NominalF1xHz
	contiguous := false
	if ctx.Contiguity == "auto" && len(usable) > 1 {
		// Use the strongest axis at 1X for the phase test.
		best, bestAmp := 0, 0.0
		for a := 0; a < 3; a++ {
			if _, amp := dsp.PhaseAt(perAxisFrames[a][0], fs, nominal); amp > bestAmp {
				best, bestAmp = a, amp
			}
		}
		contiguous = dsp.FramesContiguous(perAxisFrames[best], fs, nominal, 10)
	}
	var specs [3]*dsp.Spectrum
	for a := 0; a < 3; a++ {
		if contiguous {
			specs[a] = dsp.ComputeSpectrum(all[a], fs)
		} else {
			var ss []*dsp.Spectrum
			for _, fr := range perAxisFrames[a] {
				ss = append(ss, dsp.ComputeSpectrum(fr, fs))
			}
			specs[a] = dsp.WelchAverage(ss)
		}
		ctx.Calibration.Apply(specs[a])
	}
	// Speed from the axis with the strongest 1X.
	speed := dsp.SpeedEstimate{Hz: nominal, Confidence: "low"}
	bestAmp := -1.0
	for a := 0; a < 3; a++ {
		est := dsp.EstimateSpeed(specs[a], nominal, ctx.SpeedHintHz)
		if est.Confidence == "high" {
			if amp := dsp.OrderAmpAcc(specs[a], est.Hz); amp > bestAmp {
				speed, bestAmp = est, amp
			}
		}
	}
	f1x := speed.Hz
	orders := ctx.Orders
	if len(orders) == 0 {
		orders = DefaultOrders
	}
	f2 := math.Min(ctx.ISOBandHz[1], dsp.MaxAnalysisHz(fs))
	if f2 < ctx.ISOBandHz[1] {
		flags = append(flags, "iso_band_truncated")
	}
	fset := &FeatureSet{
		CaptureID: c.CaptureID, PointID: c.PointID, Profile: c.Profile,
		TS: c.TS.UTC().Format("2006-01-02T15:04:05.000Z"), FsHz: fs, SrCode: int(c.SrCode),
		Frames: len(c.Frames), FramesContiguous: contiguous, NFFT: specs[0].N, DfHz: round(specs[0].Df, 4),
		Running: ctx.Running, SpeedHz: round(f1x, 3), SpeedConfidence: speed.Confidence,
		Axes: map[string]AxisFeatures{},
	}
	if !math.IsNaN(ctx.LoadPct) {
		fset.LoadPct = ptr(round(ctx.LoadPct, 1))
	}
	flat := false
	for a := 0; a < 3; a++ {
		g := make([]float64, len(all[a]))
		for i, v := range all[a] {
			g[i] = v / 9.80665
		}
		st := dsp.ComputeTimeStats(g)
		if ctx.Running && st.Std < 0.0005 {
			flat = true
		}
		ords := map[string]float64{}
		for k, v := range dsp.Orders(specs[a], f1x, orders) {
			ords[OrderKey(k)] = round(v, 4)
		}
		af := AxisFeatures{
			AccRmsG: round(st.RMS, 5), AccPeakG: round(st.Peak, 4), Crest: round(st.Crest, 3),
			Kurtosis: round(st.Kurtosis, 3), Skew: round(st.Skew, 3),
			ISOVrmsMMs: round(specs[a].BandRMSVel(ctx.ISOBandHz[0], f2), 4),
			ISOBandHz:  [2]float64{ctx.ISOBandHz[0], round(f2, 1)},
			Orders:     ords, OrdersUnit: "mm_s_rms",
		}
		if lf := 2 * ctx.LineFreqHz; lf > 0 && lf < dsp.MaxAnalysisHz(fs) {
			af.LineX2MMs = round(dsp.OrderAmpAcc(specs[a], lf)/(2*math.Pi*lf)*1000, 4)
		}
		if ctx.MeshFreqHz > 0 && ctx.MeshFreqHz < dsp.MaxAnalysisHz(fs) {
			af.MeshMMs = ptr(round(dsp.OrderAmpAcc(specs[a], ctx.MeshFreqHz)/(2*math.Pi*ctx.MeshFreqHz)*1000, 4))
		}
		fset.Axes[drivers.AxisNames[a]] = af
	}
	if flat {
		flags = append(flags, "flatline")
	}
	if speed.Confidence == "low" {
		flags = append(flags, "speed_low_confidence")
	}
	// Envelope for bearing profiles.
	var envDoc *EnvSpectrumDoc
	if len(c.BandpassHz) == 2 && c.BandpassHz[1] > c.BandpassHz[0] {
		maxHz := ctx.EnvelopeMaxHz
		if maxHz == 0 {
			maxHz = 500
		}
		env := &Envelope{Axes: map[string]EnvelopeAxis{}}
		var ff *dsp.FaultFreqs
		if ctx.Bearing.Valid() {
			x := ctx.Bearing.Frequencies(f1x)
			ff = &x
			env.FaultFreqsHz = map[string]float64{"bpfo": round(x.BPFO, 3), "bpfi": round(x.BPFI, 3), "bsf": round(x.BSF, 3), "ftf": round(x.FTF, 3)}
		}
		envDoc = &EnvSpectrumDoc{Amp: map[string][]float32{}}
		for a := 0; a < 3; a++ {
			var res *dsp.EnvelopeResult
			if contiguous {
				res = dsp.Envelope(all[a], fs, c.BandpassHz[0], c.BandpassHz[1], maxHz)
			} else {
				res = averageEnvelope(perAxisFrames[a], fs, c.BandpassHz[0], c.BandpassHz[1], maxHz)
			}
			env.BandHz = res.BandHz
			env.DfHz = round(res.Df, 4)
			ea := EnvelopeAxis{EnvRmsG: round(res.RmsG, 5)}
			if ff != nil {
				ea.Faults = map[string]dsp.FaultPeak{
					"bpfo": res.FaultAmplitude(ff.BPFO), "bpfi": res.FaultAmplitude(ff.BPFI),
					"bsf2": res.FaultAmplitude(2 * ff.BSF), "ftf": res.FaultAmplitude(ff.FTF),
				}
				ea.BPFOEnvG = ptr(round(ea.Faults["bpfo"].AmpG, 5))
				ea.BPFIEnvG = ptr(round(ea.Faults["bpfi"].AmpG, 5))
				ea.BSFEnvG = ptr(round(ea.Faults["bsf2"].AmpG, 5))
				ea.FTFEnvG = ptr(round(ea.Faults["ftf"].AmpG, 5))
				if env.BPFOEnvG == nil || *ea.BPFOEnvG > *env.BPFOEnvG {
					env.BPFOEnvG = ea.BPFOEnvG
				}
				if env.BPFIEnvG == nil || *ea.BPFIEnvG > *env.BPFIEnvG {
					env.BPFIEnvG = ea.BPFIEnvG
				}
			}
			env.EnvRmsG = math.Max(env.EnvRmsG, ea.EnvRmsG)
			env.Axes[drivers.AxisNames[a]] = ea
			envDoc.DfHz = res.Df
			envDoc.Amp[drivers.AxisNames[a]] = f32(res.AmpG)
		}
		fset.Envelope = env
	}
	fset.QualityFlags = flags

	doc := &SpectrumDoc{
		CaptureID: c.CaptureID, PointID: c.PointID, TS: fset.TS, FsHz: fs, NFFT: specs[0].N, DfHz: specs[0].Df,
		SpeedHz: fset.SpeedHz, Unit: "m_s2_rms", Acc: map[string][]float32{}, Env: envDoc,
		Markers: map[string]float64{},
	}
	for a := 0; a < 3; a++ {
		doc.Acc[drivers.AxisNames[a]] = f32(specs[a].Amp)
	}
	for _, k := range []float64{1, 2, 3, 4, 5, 6} {
		doc.Markers[fmt.Sprintf("%gX", k)] = round(k*f1x, 3)
	}
	if ctx.LineFreqHz > 0 {
		doc.Markers["2xLF"] = 2 * ctx.LineFreqHz
	}
	if ctx.MeshFreqHz > 0 {
		doc.Markers["MESH"] = round(ctx.MeshFreqHz, 3)
	}
	if fset.Envelope != nil {
		for k, v := range fset.Envelope.FaultFreqsHz {
			doc.Markers[k] = v
		}
	}
	return &Result{Features: fset, Spectra: specs, Spectrum: doc, AxisSamples: all}
}

func averageEnvelope(frames [][]float64, fs, lo, hi, maxHz float64) *dsp.EnvelopeResult {
	var out *dsp.EnvelopeResult
	rms2 := 0.0
	for i, fr := range frames {
		r := dsp.Envelope(fr, fs, lo, hi, maxHz)
		rms2 += r.RmsG * r.RmsG
		if i == 0 {
			out = &dsp.EnvelopeResult{Df: r.Df, AmpG: make([]float64, len(r.AmpG)), BandHz: r.BandHz}
		}
		for k := range out.AmpG {
			out.AmpG[k] += r.AmpG[k] * r.AmpG[k]
		}
	}
	for k := range out.AmpG {
		out.AmpG[k] = math.Sqrt(out.AmpG[k] / float64(len(frames)))
	}
	out.RmsG = math.Sqrt(rms2 / float64(len(frames)))
	return out
}

func f32(x []float64) []float32 {
	o := make([]float32, len(x))
	for i, v := range x {
		o[i] = float32(round(v, 6))
	}
	return o
}
