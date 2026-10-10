package dsp

import (
	"math"
	"sort"
)

// Multi-sensor noise isolation (Beer HN method, docs/ALGORITHMS.md §2):
//
//	A_iso(f) = sqrt( A_target(f)^2 - (alpha(f) * A_ref(f))^2 ),  0 if negative
//
// A_ref is the base/skid sensor (S2) and A_target a bearing housing (S3/S4).
// alpha(f) is the transmissibility learned at the compressor mesh frequency
// (and harmonics), where the motor itself produces no vibration.

// AlphaPoint is one learned transmissibility value.
type AlphaPoint struct {
	FreqHz float64 `json:"f_hz" yaml:"f_hz"`
	Alpha  float64 `json:"alpha" yaml:"alpha"`
}

// AlphaTable is alpha(f): log-frequency interpolation between learned points,
// clamped to the end values outside the learned range.
type AlphaTable []AlphaPoint

// At returns alpha(f); 0 when empty (no subtraction).
func (t AlphaTable) At(f float64) float64 {
	if len(t) == 0 || f <= 0 {
		return 0
	}
	c := Calibration{}
	for _, p := range t {
		c.FreqHz = append(c.FreqHz, p.FreqHz)
		c.Factor = append(c.Factor, p.Alpha)
	}
	return c.At(f)
}

// Sorted returns a copy ordered by frequency.
func (t AlphaTable) Sorted() AlphaTable {
	c := append(AlphaTable(nil), t...)
	sort.Slice(c, func(i, j int) bool { return c[i].FreqHz < c[j].FreqHz })
	return c
}

// Isolate returns a new spectrum of the target with the reference contribution removed
// per bin. Both spectra must have the same fs and N. Amp and PSD are scaled consistently.
func Isolate(target, ref *Spectrum, alpha AlphaTable) *Spectrum {
	out := &Spectrum{Fs: target.Fs, N: target.N, Df: target.Df,
		Amp: make([]float64, len(target.Amp)), PSD: make([]float64, len(target.PSD))}
	for k := range target.Amp {
		a := alpha.At(target.Freq(k))
		r := 0.0
		if k < len(ref.Amp) {
			r = a * ref.Amp[k]
		}
		t2 := target.Amp[k] * target.Amp[k]
		d := t2 - r*r
		if d <= 0 || t2 == 0 {
			continue // A_iso = 0 (avoid sqrt of a negative number)
		}
		ratio := d / t2
		out.Amp[k] = math.Sqrt(d)
		out.PSD[k] = target.PSD[k] * ratio
	}
	return out
}

// LearnAlpha computes alpha at frequency f as the mean over samples of
// A_target(f)/A_ref(f), each amplitude taken as the band energy around f
// (±max(2 bins, 2%)). Pairs where the reference has no clear peak at f
// (< 3× its local noise floor) are skipped: the ratio would be noise/noise.
func LearnAlpha(targets, refs []*Spectrum, f float64) (alpha float64, n int) {
	sum := 0.0
	for i := range targets {
		if i >= len(refs) {
			break
		}
		at, ar := OrderAmpAcc(targets[i], f), OrderAmpAcc(refs[i], f)
		if ar <= 1e-9 || !prominent(refs[i], f, 3) {
			continue
		}
		sum += at / ar
		n++
	}
	if n == 0 {
		return 0, 0
	}
	return sum / float64(n), n
}

// prominent reports whether the spectrum has a peak at f (±2 bins) >= ratio × the local median.
func prominent(s *Spectrum, f, ratio float64) bool {
	k := int(math.Round(f / s.Df))
	if k < 1 || k >= len(s.Amp) {
		return false
	}
	peak := 0.0
	for j := k - 2; j <= k+2; j++ {
		if j >= 1 && j < len(s.Amp) && s.Amp[j] > peak {
			peak = s.Amp[j]
		}
	}
	var floor []float64
	for j := k - 15; j <= k+15; j++ {
		if j >= 1 && j < len(s.Amp) && (j < k-3 || j > k+3) {
			floor = append(floor, s.Amp[j])
		}
	}
	m := median(floor)
	return m > 0 && peak >= ratio*m
}

// PeakInfo is a detected spectral peak.
type PeakInfo struct {
	FreqHz float64 `json:"freq_hz"`
	VelMMs float64 `json:"vel_mm_s"`
}

// DominantPeak finds the strongest velocity peak in [f1,f2], excluding ±exclTol
// (fractional) around each frequency in exclude (e.g. 1X). Uses the velocity spectrum.
func DominantPeak(s *Spectrum, f1, f2 float64, exclude []float64, exclTol float64) PeakInfo {
	v := s.VelocityAmp(f1)
	best := PeakInfo{}
	for k := 1; k < len(v); k++ {
		f := s.Freq(k)
		if f < f1 || f > f2 {
			continue
		}
		skip := false
		for _, e := range exclude {
			if math.Abs(f-e) <= math.Max(exclTol*e, 2*s.Df) {
				skip = true
			}
		}
		if !skip && v[k] > best.VelMMs {
			best = PeakInfo{FreqHz: f, VelMMs: v[k]}
		}
	}
	return best
}

// MeshDetection is the result of compressor mesh frequency detection on S1.
type MeshDetection struct {
	FreqHz        float64 `json:"freq_hz"`
	VelMMs        float64 `json:"vel_mm_s"`
	ExpectedHz    float64 `json:"expected_hz"`
	MatchExpected bool    `json:"match_expected"`
	Harmonics     int     `json:"harmonics"` // number of 2x/3x harmonics present
}

// DetectMesh implements the appendix procedure: scan S1 velocity spectrum 10–1000 Hz,
// exclude 1X, take the dominant peak, check it against lobes*f1x and look for 2x/3x.
func DetectMesh(s *Spectrum, f1x float64, maleLobes int) MeshDetection {
	fmax := math.Min(1000, MaxAnalysisHz(s.Fs))
	p := DominantPeak(s, 10, fmax, []float64{f1x}, 0.03)
	md := MeshDetection{FreqHz: p.FreqHz, VelMMs: p.VelMMs}
	if maleLobes > 0 && f1x > 0 {
		md.ExpectedHz = float64(maleLobes) * f1x
		md.MatchExpected = math.Abs(p.FreqHz-md.ExpectedHz) <= math.Max(2*s.Df, 0.03*md.ExpectedHz)
	}
	if p.FreqHz > 0 {
		floor := medianVel(s, 10, fmax)
		for h := 2; h <= 3; h++ {
			fh := float64(h) * p.FreqHz
			if fh > fmax {
				break
			}
			a := OrderAmpAcc(s, fh) / (2 * math.Pi * fh) * 1000
			if floor > 0 && a >= 3*floor {
				md.Harmonics++
			}
		}
	}
	return md
}

func medianVel(s *Spectrum, f1, f2 float64) float64 {
	v := s.VelocityAmp(f1)
	var xs []float64
	for k := range v {
		if f := s.Freq(k); f >= f1 && f <= f2 {
			xs = append(xs, v[k])
		}
	}
	return median(xs)
}

// TransmittedFromSource implements the cross-check with S1: a peak at f in the target is
// considered transmitted noise when the source spectrum has a peak at f (±2 bins) that is
// itself prominent (>= 3x its local floor) and at least ratio x the target amplitude.
func TransmittedFromSource(source *Spectrum, f, targetVelMMs, ratio float64) bool {
	if source == nil || f <= 0 {
		return false
	}
	v := source.VelocityAmp(1)
	k := int(math.Round(f / source.Df))
	if k < 1 || k >= len(v) {
		return false
	}
	peak := 0.0
	for j := k - 2; j <= k+2; j++ {
		if j >= 1 && j < len(v) && v[j] > peak {
			peak = v[j]
		}
	}
	var floor []float64
	for j := k - 15; j <= k+15; j++ {
		if j >= 1 && j < len(v) && (j < k-3 || j > k+3) {
			floor = append(floor, v[j])
		}
	}
	m := median(floor)
	return m > 0 && peak >= 3*m && peak >= ratio*targetVelMMs
}
