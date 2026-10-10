package dsp

import "math"

// TimeStats are time-domain indicators (spec 5.6.8).
type TimeStats struct {
	RMS, Peak, Crest, Kurtosis, Skew, Std float64
}

// ComputeTimeStats computes statistics of x after mean removal.
func ComputeTimeStats(x []float64) TimeStats {
	n := float64(len(x))
	if n == 0 {
		return TimeStats{}
	}
	mu := Mean(x)
	var s2, s3, s4, peak float64
	for _, v := range x {
		d := v - mu
		d2 := d * d
		s2 += d2
		s3 += d2 * d
		s4 += d2 * d2
		if a := math.Abs(d); a > peak {
			peak = a
		}
	}
	variance := s2 / n
	std := math.Sqrt(variance)
	st := TimeStats{RMS: std, Peak: peak, Std: std}
	if std > 0 {
		st.Crest = peak / std
		st.Kurtosis = (s4 / n) / (variance * variance)
		st.Skew = (s3 / n) / (variance * std)
	}
	return st
}

// PhaseAt fits A*cos(2*pi*f*t + phi) by least squares and returns phi (radians).
func PhaseAt(x []float64, fs, f float64) (phi, amp float64) {
	var c, s float64
	w := 2 * math.Pi * f / fs
	for i, v := range x {
		c += v * math.Cos(w*float64(i))
		s += v * math.Sin(w*float64(i))
	}
	n := float64(len(x))
	a, b := 2*c/n, 2*s/n
	return math.Atan2(-b, a), math.Hypot(a, b)
}

// FramesContiguous tests phase continuity of the 1X component across consecutive
// frames (spec 5.6.9). Returns true only if every junction deviates < tolDeg.
func FramesContiguous(frames [][]float64, fs, f1x, tolDeg float64) bool {
	if len(frames) < 2 || f1x <= 0 {
		return false
	}
	for i := 0; i+1 < len(frames); i++ {
		p0, a0 := PhaseAt(frames[i], fs, f1x)
		p1, a1 := PhaseAt(frames[i+1], fs, f1x)
		if a0 == 0 || a1 == 0 {
			return false
		}
		pred := p0 + 2*math.Pi*f1x*float64(len(frames[i]))/fs
		d := math.Remainder(p1-pred, 2*math.Pi)
		if math.Abs(d)*180/math.Pi >= tolDeg {
			return false
		}
	}
	return true
}
