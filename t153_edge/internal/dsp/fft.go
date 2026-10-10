// Package dsp implements the signal processing of spec 5.6: windowing, FFT,
// amplitude/PSD spectra, band RMS (ISO), orders, bearing fault frequencies,
// envelope analysis and time-domain statistics. All inputs are SI (m/s^2, Hz).
package dsp

import (
	"math"
	"sync"

	"gonum.org/v1/gonum/dsp/fourier"
)

var (
	rfftPools sync.Map // n -> *sync.Pool of *fourier.FFT
	cfftPools sync.Map // n -> *sync.Pool of *fourier.CmplxFFT
)

func rfftPool(n int) *sync.Pool {
	if p, ok := rfftPools.Load(n); ok {
		return p.(*sync.Pool)
	}
	p, _ := rfftPools.LoadOrStore(n, &sync.Pool{New: func() any { return fourier.NewFFT(n) }})
	return p.(*sync.Pool)
}

func cfftPool(n int) *sync.Pool {
	if p, ok := cfftPools.Load(n); ok {
		return p.(*sync.Pool)
	}
	p, _ := cfftPools.LoadOrStore(n, &sync.Pool{New: func() any { return fourier.NewCmplxFFT(n) }})
	return p.(*sync.Pool)
}

// RFFT returns the n/2+1 non-negative frequency coefficients of a real sequence.
func RFFT(x []float64) []complex128 {
	pool := rfftPool(len(x))
	f := pool.Get().(*fourier.FFT)
	defer pool.Put(f)
	return f.Coefficients(nil, x)
}

// CFFT returns the forward complex FFT.
func CFFT(x []complex128) []complex128 {
	pool := cfftPool(len(x))
	f := pool.Get().(*fourier.CmplxFFT)
	defer pool.Put(f)
	return f.Coefficients(nil, x)
}

// ICFFT returns the normalized inverse complex FFT.
func ICFFT(c []complex128) []complex128 {
	n := len(c)
	pool := cfftPool(n)
	f := pool.Get().(*fourier.CmplxFFT)
	defer pool.Put(f)
	out := f.Sequence(nil, c)
	inv := 1 / float64(n)
	for i := range out {
		out[i] *= complex(inv, 0)
	}
	return out
}

// Hann returns the symmetric Hann window 0.5-0.5*cos(2*pi*n/(N-1)).
func Hann(n int) []float64 {
	w := make([]float64, n)
	if n == 1 {
		w[0] = 1
		return w
	}
	for i := range w {
		w[i] = 0.5 - 0.5*math.Cos(2*math.Pi*float64(i)/float64(n-1))
	}
	return w
}

// Mean returns the arithmetic mean.
func Mean(x []float64) float64 {
	if len(x) == 0 {
		return 0
	}
	s := 0.0
	for _, v := range x {
		s += v
	}
	return s / float64(len(x))
}

// Detrend returns a copy of x with the mean removed.
func Detrend(x []float64) []float64 {
	m := Mean(x)
	out := make([]float64, len(x))
	for i, v := range x {
		out[i] = v - m
	}
	return out
}
