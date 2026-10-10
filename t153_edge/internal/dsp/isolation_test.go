package dsp

import (
	"math"
	"math/rand"
	"testing"
)

// Synthetic Beer HN scenario: compressor mesh at 4*49.17 Hz is transmitted from the
// base (S2) to the bearing housing (S3) with transmissibility 0.4; the motor itself
// has a 1X component that S2 does not see.
func beerSignals(seed int64, motor1X float64) (s1, s2, s3 []float64) {
	fs, n := 2000.0, 1024
	f1, fm := 49.17, 4*49.17
	rnd := rand.New(rand.NewSource(seed))
	ph := rnd.Float64() * 6
	comp := sine(n, fs, fm, accPeakForVelRMS(3.0, fm), ph)     // at S2 (base)
	compS1 := sine(n, fs, fm, accPeakForVelRMS(9.0, fm), ph)   // at compressor top
	comp2 := sine(n, fs, 2*fm, accPeakForVelRMS(2.0, 2*fm), 0) // S1 harmonic
	mot := sine(n, fs, f1, accPeakForVelRMS(motor1X, f1), 0.4)
	s1, s2, s3 = make([]float64, n), make([]float64, n), make([]float64, n)
	for i := 0; i < n; i++ {
		noise := func() float64 { return 0.002 * rnd.NormFloat64() }
		s1[i] = compS1[i] + comp2[i] + noise()
		s2[i] = comp[i] + noise()
		s3[i] = 0.4*comp[i] + mot[i] + noise()
	}
	return
}

func TestLearnAlphaAndIsolate(t *testing.T) {
	fs, fm := 2000.0, 4*49.17
	var t3, r2 []*Spectrum
	for i := 0; i < 10; i++ {
		_, s2, s3 := beerSignals(int64(i), 0) // learning phase: motor quiet at f_comp
		t3 = append(t3, ComputeSpectrum(s3, fs))
		r2 = append(r2, ComputeSpectrum(s2, fs))
	}
	alpha, n := LearnAlpha(t3, r2, fm)
	if n != 10 || math.Abs(alpha-0.4) > 0.01 {
		t.Fatalf("alpha = %.4f (n=%d), want 0.4", alpha, n)
	}
	if _, n3 := LearnAlpha(t3, r2, 3*fm); n3 != 0 {
		t.Fatalf("no reference peak at 3×f_mesh: alpha must not be learned (n=%d)", n3)
	}
	_, s2, s3 := beerSignals(99, 2.0)
	iso := Isolate(ComputeSpectrum(s3, fs), ComputeSpectrum(s2, fs), AlphaTable{{FreqHz: fm, Alpha: alpha}})
	if v := OrderAmpAcc(iso, fm) / (2 * math.Pi * fm) * 1000; v > 0.1 {
		t.Errorf("mesh not removed: %.3f mm/s", v)
	}
	if v := OrderAmpAcc(iso, 49.17) / (2 * math.Pi * 49.17) * 1000; math.Abs(v-2.0) > 0.05 {
		t.Errorf("motor 1X altered: %.3f mm/s", v)
	}
}

func TestDetectMeshAndCrossCheck(t *testing.T) {
	fs := 2000.0
	s1, _, s3 := beerSignals(5, 2.0)
	sp1 := ComputeSpectrum(s1, fs)
	md := DetectMesh(sp1, 49.17, 4)
	if !md.MatchExpected || md.Harmonics < 1 {
		t.Fatalf("mesh detection %+v", md)
	}
	sp3 := ComputeSpectrum(s3, fs)
	v3 := sp3.VelocityAmp(1)
	k := int(math.Round(4 * 49.17 / sp3.Df))
	if !TransmittedFromSource(sp1, 4*49.17, v3[k], 0.5) {
		t.Error("mesh peak at S3 should be classified as transmitted")
	}
	k1 := int(math.Round(49.17 / sp3.Df))
	if TransmittedFromSource(sp1, 49.17, v3[k1], 0.5) {
		t.Error("motor 1X should NOT be classified as transmitted")
	}
}
