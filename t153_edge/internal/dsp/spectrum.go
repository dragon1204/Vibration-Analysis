package dsp

import (
	"math"
	"math/cmplx"
	"sort"
)

// Spectrum is a one-sided spectrum of an acceleration signal (m/s^2).
type Spectrum struct {
	Fs  float64
	N   int       // FFT length
	Df  float64   // Fs/N
	Amp []float64 // A_rms[k], m/s^2 RMS per bin (window-corrected amplitude)
	PSD []float64 // one-sided PSD, (m/s^2)^2/Hz (energy-corrected)
}

// Freq returns the frequency of bin k.
func (s *Spectrum) Freq(k int) float64 { return float64(k) * s.Df }

// Bins returns the number of bins (N/2+1).
func (s *Spectrum) Bins() int { return len(s.Amp) }

// ComputeSpectrum removes the mean, applies a Hann window and computes A_rms and PSD
// (spec 5.6.1–5.6.3).
func ComputeSpectrum(x []float64, fs float64) *Spectrum {
	n := len(x)
	a := Detrend(x)
	w := Hann(n)
	sumW, sumW2 := 0.0, 0.0
	for i := range a {
		a[i] *= w[i]
		sumW += w[i]
		sumW2 += w[i] * w[i]
	}
	X := RFFT(a)
	s := &Spectrum{Fs: fs, N: n, Df: fs / float64(n), Amp: make([]float64, len(X)), PSD: make([]float64, len(X))}
	for k, c := range X {
		m := cmplx.Abs(c)
		s.Amp[k] = 2 * m / sumW / math.Sqrt2
		s.PSD[k] = m * m * 2 / (fs * sumW2)
	}
	// DC and Nyquist bins are not doubled in a one-sided spectrum.
	s.Amp[0] /= 2
	s.PSD[0] /= 2
	if n%2 == 0 {
		last := len(X) - 1
		s.Amp[last] /= 2
		s.PSD[last] /= 2
	}
	return s
}

// WelchAverage power-averages spectra of equal length (non-overlapping Welch):
// A_rms_avg[k] = sqrt(mean_i(A_rms_i[k]^2)).
func WelchAverage(specs []*Spectrum) *Spectrum {
	if len(specs) == 0 {
		return nil
	}
	if len(specs) == 1 {
		return specs[0]
	}
	f := specs[0]
	out := &Spectrum{Fs: f.Fs, N: f.N, Df: f.Df, Amp: make([]float64, len(f.Amp)), PSD: make([]float64, len(f.PSD))}
	for _, s := range specs {
		for k := range out.Amp {
			out.Amp[k] += s.Amp[k] * s.Amp[k]
			out.PSD[k] += s.PSD[k]
		}
	}
	inv := 1 / float64(len(specs))
	for k := range out.Amp {
		out.Amp[k] = math.Sqrt(out.Amp[k] * inv)
		out.PSD[k] *= inv
	}
	return out
}

// MaxAnalysisHz is the usable upper frequency (fs/2.56, anti-alias transition band).
func MaxAnalysisHz(fs float64) float64 { return fs / 2.56 }

// BandRMSAcc returns the acceleration RMS (m/s^2) in [f1,f2] using Parseval on the PSD.
func (s *Spectrum) BandRMSAcc(f1, f2 float64) float64 {
	sum := 0.0
	for k := range s.PSD {
		f := s.Freq(k)
		if f >= f1 && f <= f2 {
			sum += s.PSD[k]
		}
	}
	return math.Sqrt(sum * s.Df)
}

// BandRMSVel returns the velocity RMS (mm/s) in [f1,f2] by integrating the PSD
// in the frequency domain. Bins below f1 (and DC) are excluded.
func (s *Spectrum) BandRMSVel(f1, f2 float64) float64 {
	sum := 0.0
	for k := 1; k < len(s.PSD); k++ {
		f := s.Freq(k)
		if f >= f1 && f <= f2 {
			w := 2 * math.Pi * f
			sum += s.PSD[k] / (w * w)
		}
	}
	return math.Sqrt(sum*s.Df) * 1000
}

// VelocityAmp returns V_rms[k] in mm/s for bins with f >= fLo (0 below).
func (s *Spectrum) VelocityAmp(fLo float64) []float64 {
	out := make([]float64, len(s.Amp))
	for k := 1; k < len(out); k++ {
		f := s.Freq(k)
		if f >= fLo {
			out[k] = s.Amp[k] / (2 * math.Pi * f) * 1000
		}
	}
	return out
}

// Calibration is a per-frequency correction table c(f), log-frequency interpolated (spec 9.3).
type Calibration struct {
	FreqHz []float64
	Factor []float64
}

// At returns c(f); 1 when the table is empty; clamps outside the table range.
func (c *Calibration) At(f float64) float64 {
	if c == nil || len(c.FreqHz) == 0 {
		return 1
	}
	n := len(c.FreqHz)
	if f <= c.FreqHz[0] {
		return c.Factor[0]
	}
	if f >= c.FreqHz[n-1] {
		return c.Factor[n-1]
	}
	i := sort.SearchFloat64s(c.FreqHz, f)
	f0, f1 := c.FreqHz[i-1], c.FreqHz[i]
	t := (math.Log(f) - math.Log(f0)) / (math.Log(f1) - math.Log(f0))
	return c.Factor[i-1] + t*(c.Factor[i]-c.Factor[i-1])
}

// Apply scales the spectrum in place: A_cal(f) = A(f) * c(f).
func (c *Calibration) Apply(s *Spectrum) {
	if c == nil || len(c.FreqHz) == 0 {
		return
	}
	for k := range s.Amp {
		g := c.At(s.Freq(k))
		s.Amp[k] *= g
		s.PSD[k] *= g * g
	}
}
