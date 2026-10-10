package dsp

import (
	"math"
	"math/cmplx"
)

// Analytic returns the analytic signal via FFT (Hilbert transform).
func Analytic(x []float64) []complex128 {
	n := len(x)
	cx := make([]complex128, n)
	for i, v := range x {
		cx[i] = complex(v, 0)
	}
	X := CFFT(cx)
	h := make([]float64, n)
	if n%2 == 0 {
		h[0], h[n/2] = 1, 1
		for i := 1; i < n/2; i++ {
			h[i] = 2
		}
	} else {
		h[0] = 1
		for i := 1; i < (n+1)/2; i++ {
			h[i] = 2
		}
	}
	for i := range X {
		X[i] *= complex(h[i], 0)
	}
	return ICFFT(X)
}

// EnvelopeResult holds an envelope spectrum (peak amplitude in g) and its RMS.
type EnvelopeResult struct {
	Df     float64
	AmpG   []float64 // peak amplitude per bin, g, bins up to MaxHz
	RmsG   float64   // RMS of the de-meaned envelope, g
	BandHz [2]float64
}

// Envelope computes the envelope spectrum (spec 5.6.7). x is acceleration in m/s^2.
func Envelope(x []float64, fs, lo, hi, maxHz float64) *EnvelopeResult {
	if hi >= fs/2 {
		hi = 0.45 * fs
	}
	g := make([]float64, len(x))
	for i, v := range x {
		g[i] = v / 9.80665
	}
	g = Detrend(g)
	filtered := FiltFilt(ButterBandpass(4, lo, hi, fs), g)
	an := Analytic(filtered)
	env := make([]float64, len(an))
	for i, c := range an {
		env[i] = cmplx.Abs(c)
	}
	env = Detrend(env)
	rms := 0.0
	for _, v := range env {
		rms += v * v
	}
	rms = math.Sqrt(rms / float64(len(env)))

	n := len(env)
	w := Hann(n)
	sumW := 0.0
	for i := range env {
		env[i] *= w[i]
		sumW += w[i]
	}
	X := RFFT(env)
	df := fs / float64(n)
	kmax := min(len(X)-1, int(maxHz/df))
	amp := make([]float64, kmax+1)
	for k := 0; k <= kmax; k++ {
		amp[k] = 2 * cmplx.Abs(X[k]) / sumW
	}
	amp[0] /= 2
	return &EnvelopeResult{Df: df, AmpG: amp, RmsG: rms, BandHz: [2]float64{lo, hi}}
}

// FaultPeak describes the envelope amplitude at a fault frequency and its harmonics.
type FaultPeak struct {
	FreqHz     float64   `json:"freq_hz"`
	Harmonics  []float64 `json:"harmonics_g"` // amplitude at 1x,2x,3x fault frequency
	PeakFloor  []float64 `json:"peak_floor"`  // ratio of each harmonic peak to local median
	NHarmonics int       `json:"n_harmonics"` // harmonics with peak/floor >= 3
	AmpG       float64   `json:"amp_g"`       // amplitude at 1x
}

// FaultAmplitude searches ±2 bins around h*f (h=1..3) for the max envelope amplitude.
func (e *EnvelopeResult) FaultAmplitude(f float64) FaultPeak {
	fp := FaultPeak{FreqHz: f}
	for h := 1; h <= 3; h++ {
		fh := float64(h) * f
		k := int(math.Round(fh / e.Df))
		if k < 1 || k >= len(e.AmpG) {
			break
		}
		best := 0.0
		for j := k - 2; j <= k+2; j++ {
			if j >= 1 && j < len(e.AmpG) && e.AmpG[j] > best {
				best = e.AmpG[j]
			}
		}
		var floor []float64
		for j := k - 12; j <= k+12; j++ {
			if j >= 1 && j < len(e.AmpG) && (j < k-3 || j > k+3) {
				floor = append(floor, e.AmpG[j])
			}
		}
		ratio := 0.0
		if m := median(floor); m > 0 {
			ratio = best / m
		}
		fp.Harmonics = append(fp.Harmonics, best)
		fp.PeakFloor = append(fp.PeakFloor, ratio)
		if ratio >= 3 {
			fp.NHarmonics++
		}
	}
	if len(fp.Harmonics) > 0 {
		fp.AmpG = fp.Harmonics[0]
	}
	return fp
}
