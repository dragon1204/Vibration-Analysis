package dsp

import "math"

// Biquad is one second-order section with a0 normalized to 1 (scipy "sos" row: b0 b1 b2 1 a1 a2).
type Biquad struct{ B0, B1, B2, A1, A2 float64 }

// butterQ returns the section Q factors of an even-order Butterworth filter.
func butterQ(order int) []float64 {
	qs := make([]float64, order/2)
	for k := range qs {
		theta := math.Pi * float64(2*k+1) / float64(2*order)
		qs[k] = 1 / (2 * math.Cos(theta))
	}
	return qs
}

func lowpassSection(fc, fs, q float64) Biquad {
	w0 := 2 * math.Pi * fc / fs
	cw, alpha := math.Cos(w0), math.Sin(w0)/(2*q)
	a0 := 1 + alpha
	return Biquad{B0: (1 - cw) / 2 / a0, B1: (1 - cw) / a0, B2: (1 - cw) / 2 / a0, A1: -2 * cw / a0, A2: (1 - alpha) / a0}
}

func highpassSection(fc, fs, q float64) Biquad {
	w0 := 2 * math.Pi * fc / fs
	cw, alpha := math.Cos(w0), math.Sin(w0)/(2*q)
	a0 := 1 + alpha
	return Biquad{B0: (1 + cw) / 2 / a0, B1: -(1 + cw) / a0, B2: (1 + cw) / 2 / a0, A1: -2 * cw / a0, A2: (1 - alpha) / a0}
}

// ButterBandpass designs a band-pass as a cascade of an order-N Butterworth high-pass at lo
// and an order-N Butterworth low-pass at hi (bilinear with pre-warping). Equivalent to
// scipy: vstack(butter(N, lo, 'highpass', fs=fs, output='sos'), butter(N, hi, 'lowpass', ...)).
func ButterBandpass(order int, lo, hi, fs float64) []Biquad {
	var sos []Biquad
	for _, q := range butterQ(order) {
		sos = append(sos, highpassSection(lo, fs, q))
	}
	for _, q := range butterQ(order) {
		sos = append(sos, lowpassSection(hi, fs, q))
	}
	return sos
}

// sosZi returns steady-state initial conditions for a unit step input (scipy sosfilt_zi).
func sosZi(sos []Biquad) [][2]float64 {
	zi := make([][2]float64, len(sos))
	scale := 1.0
	for i, s := range sos {
		g := (s.B0 + s.B1 + s.B2) / (1 + s.A1 + s.A2)
		u := scale
		y := g * u
		z2 := s.B2*u - s.A2*y
		z1 := s.B1*u - s.A1*y + z2
		zi[i] = [2]float64{z1, z2}
		scale = y
	}
	return zi
}

// sosFilter runs the cascade (direct form II transposed) with initial state zi*x0.
func sosFilter(sos []Biquad, x []float64, zi [][2]float64, x0 float64) []float64 {
	y := append([]float64(nil), x...)
	for i, s := range sos {
		z1, z2 := zi[i][0]*x0, zi[i][1]*x0
		for n, v := range y {
			out := s.B0*v + z1
			z1 = s.B1*v - s.A1*out + z2
			z2 = s.B2*v - s.A2*out
			y[n] = out
		}
	}
	return y
}

// FiltFilt applies zero-phase filtering with odd extension, like scipy.signal.sosfiltfilt.
func FiltFilt(sos []Biquad, x []float64) []float64 {
	n := len(x)
	padlen := 3 * (2*len(sos) + 1)
	if padlen >= n {
		padlen = n - 1
	}
	if padlen < 0 {
		padlen = 0
	}
	ext := make([]float64, 0, n+2*padlen)
	for i := padlen; i >= 1; i-- {
		ext = append(ext, 2*x[0]-x[i])
	}
	ext = append(ext, x...)
	for i := n - 2; i >= n-1-padlen; i-- {
		ext = append(ext, 2*x[n-1]-x[i])
	}
	zi := sosZi(sos)
	y := sosFilter(sos, ext, zi, ext[0])
	reverse(y)
	y = sosFilter(sos, y, zi, y[0])
	reverse(y)
	return y[padlen : padlen+n]
}

func reverse(x []float64) {
	for i, j := 0, len(x)-1; i < j; i, j = i+1, j-1 {
		x[i], x[j] = x[j], x[i]
	}
}
