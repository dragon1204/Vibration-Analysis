package dsp

import (
	"math"
	"sort"
)

// SpeedEstimate is the result of 1X detection (spec 5.6.4).
type SpeedEstimate struct {
	Hz         float64
	Confidence string // "high" | "low"
}

// EstimateSpeed searches the strongest peak near the nominal 1X frequency, refines it
// with log-parabolic interpolation and checks it against the surrounding noise floor.
// hint (e.g. the sensor's dominant frequency) is used when close to nominal.
func EstimateSpeed(s *Spectrum, nominalHz, hint float64) SpeedEstimate {
	if nominalHz <= 0 || s == nil {
		return SpeedEstimate{Hz: nominalHz, Confidence: "low"}
	}
	lo := int(math.Floor((0.97*nominalHz - s.Df) / s.Df))
	hi := int(math.Ceil((1.03*nominalHz + s.Df) / s.Df))
	lo = max(lo, 1)
	hi = min(hi, len(s.Amp)-2)
	if lo > hi {
		return SpeedEstimate{Hz: nominalHz, Confidence: "low"}
	}
	peak := lo
	for k := lo; k <= hi; k++ {
		if s.Amp[k] > s.Amp[peak] {
			peak = k
		}
	}
	f := s.Freq(peak)
	a, b, c := s.Amp[peak-1], s.Amp[peak], s.Amp[peak+1]
	if a > 0 && b > 0 && c > 0 {
		la, lb, lc := math.Log(a), math.Log(b), math.Log(c)
		den := la - 2*lb + lc
		if den != 0 {
			delta := 0.5 * (la - lc) / den
			if math.Abs(delta) <= 0.5 {
				f = (float64(peak) + delta) * s.Df
			}
		}
	}
	// Noise floor: median of bins within ±25% of nominal, excluding the peak ±2 bins.
	var floor []float64
	for k := int(0.75 * nominalHz / s.Df); k <= int(1.25*nominalHz/s.Df) && k < len(s.Amp); k++ {
		if k < 1 || (k >= peak-2 && k <= peak+2) {
			continue
		}
		floor = append(floor, s.Amp[k])
	}
	med := median(floor)
	if med > 0 && b < 3*med {
		if hint > 0 && math.Abs(hint-nominalHz) <= 0.03*nominalHz {
			return SpeedEstimate{Hz: hint, Confidence: "low"}
		}
		return SpeedEstimate{Hz: nominalHz, Confidence: "low"}
	}
	return SpeedEstimate{Hz: f, Confidence: "high"}
}

// OrderAmpAcc returns the acceleration RMS (m/s^2) around order frequency fk:
// energy in |f - fk| <= max(2*df, 0.02*fk), computed from the PSD so that the
// Hann main-lobe energy is counted exactly once (see docs/CHANGELOG.md).
func OrderAmpAcc(s *Spectrum, fk float64) float64 {
	half := math.Max(2*s.Df, 0.02*fk)
	sum := 0.0
	k0 := max(0, int(math.Floor((fk-half)/s.Df)))
	k1 := min(len(s.PSD)-1, int(math.Ceil((fk+half)/s.Df)))
	for k := k0; k <= k1; k++ {
		if math.Abs(s.Freq(k)-fk) <= half {
			sum += s.PSD[k]
		}
	}
	return math.Sqrt(sum * s.Df)
}

// Orders computes velocity RMS (mm/s) at each order k*f1x. Orders above the usable
// band (fs/2.56) are omitted.
func Orders(s *Spectrum, f1x float64, orders []float64) map[float64]float64 {
	out := make(map[float64]float64, len(orders))
	fmax := MaxAnalysisHz(s.Fs)
	for _, k := range orders {
		fk := k * f1x
		if fk <= 0 || fk > fmax {
			continue
		}
		out[k] = OrderAmpAcc(s, fk) / (2 * math.Pi * fk) * 1000
	}
	return out
}

func median(x []float64) float64 {
	if len(x) == 0 {
		return 0
	}
	c := append([]float64(nil), x...)
	sort.Float64s(c)
	n := len(c)
	if n%2 == 1 {
		return c[n/2]
	}
	return 0.5 * (c[n/2-1] + c[n/2])
}

// Median is exported for other packages.
func Median(x []float64) float64 { return median(x) }

// BearingGeometry describes a rolling element bearing.
type BearingGeometry struct {
	NBalls     int
	BdMm       float64
	PdMm       float64
	ContactDeg float64
	// Optional manufacturer-provided order coefficients (multiples of fr); used if > 0.
	BPFOx, BPFIx, BSFx, FTFx float64
}

// FaultFreqs are bearing characteristic frequencies in Hz.
type FaultFreqs struct {
	BPFO, BPFI, BSF, FTF float64
}

// Valid reports whether geometry is complete.
func (g *BearingGeometry) Valid() bool {
	if g == nil {
		return false
	}
	if g.BPFOx > 0 && g.BPFIx > 0 && g.BSFx > 0 && g.FTFx > 0 {
		return true
	}
	return g.NBalls > 0 && g.BdMm > 0 && g.PdMm > 0
}

// Frequencies computes BPFO/BPFI/BSF/FTF for shaft frequency fr (spec 5.6.6).
func (g *BearingGeometry) Frequencies(fr float64) FaultFreqs {
	if g.BPFOx > 0 && g.BPFIx > 0 && g.BSFx > 0 && g.FTFx > 0 {
		return FaultFreqs{BPFO: g.BPFOx * fr, BPFI: g.BPFIx * fr, BSF: g.BSFx * fr, FTF: g.FTFx * fr}
	}
	r := g.BdMm / g.PdMm * math.Cos(g.ContactDeg*math.Pi/180)
	n := float64(g.NBalls)
	return FaultFreqs{
		BPFO: n / 2 * fr * (1 - r),
		BPFI: n / 2 * fr * (1 + r),
		BSF:  g.PdMm / (2 * g.BdMm) * fr * (1 - r*r),
		FTF:  fr / 2 * (1 - r),
	}
}
