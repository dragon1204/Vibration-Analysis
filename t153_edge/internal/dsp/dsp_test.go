package dsp

import (
	"math"
	"math/rand"
	"testing"
)

func sine(n int, fs, f, ampPk, phase float64) []float64 {
	x := make([]float64, n)
	for i := range x {
		x[i] = ampPk * math.Sin(2*math.Pi*f*float64(i)/fs+phase)
	}
	return x
}

// accPeakForVelRMS converts a velocity RMS (mm/s) at f to acceleration peak (m/s^2).
func accPeakForVelRMS(vrms, f float64) float64 {
	return vrms / 1000 * math.Sqrt2 * 2 * math.Pi * f
}

func relErr(got, want float64) float64 { return math.Abs(got-want) / want }

func TestBandRMSAndISOVelocity(t *testing.T) {
	fs, f := 2000.0, 49.63
	vrms := 2.31
	x := sine(1024, fs, f, accPeakForVelRMS(vrms, f), 0.3)
	s := ComputeSpectrum(x, fs)
	got := s.BandRMSVel(10, MaxAnalysisHz(fs))
	if e := relErr(got, vrms); e > 0.01 {
		t.Fatalf("iso vrms = %.4f want %.4f (err %.2f%%)", got, vrms, e*100)
	}
	aRMS := accPeakForVelRMS(vrms, f) / math.Sqrt2
	if e := relErr(s.BandRMSAcc(1, 1000), aRMS); e > 0.01 {
		t.Fatalf("acc rms err %.2f%%", e*100)
	}
}

func TestWelchAndOrders(t *testing.T) {
	fs, f1 := 2000.0, 49.63
	var specs []*Spectrum
	for fr := 0; fr < 4; fr++ {
		x := sine(1024, fs, f1, accPeakForVelRMS(1.92, f1), float64(fr))
		x2 := sine(1024, fs, 2*f1, accPeakForVelRMS(0.71, 2*f1), 0.7*float64(fr))
		for i := range x {
			x[i] += x2[i]
		}
		specs = append(specs, ComputeSpectrum(x, fs))
	}
	s := WelchAverage(specs)
	sp := EstimateSpeed(s, 49.63, 0)
	if sp.Confidence != "high" || math.Abs(sp.Hz-f1) > 0.2 {
		t.Fatalf("speed = %+v", sp)
	}
	o := Orders(s, f1, []float64{0.5, 1, 2, 3})
	if e := relErr(o[1], 1.92); e > 0.01 {
		t.Errorf("1X = %.4f (err %.2f%%)", o[1], e*100)
	}
	if e := relErr(o[2], 0.71); e > 0.01 {
		t.Errorf("2X = %.4f (err %.2f%%)", o[2], e*100)
	}
	if o[3] > 0.02 {
		t.Errorf("3X should be ~0, got %.4f", o[3])
	}
}

func TestTimeStats(t *testing.T) {
	x := sine(4096, 4096, 64, 1, 0)
	st := ComputeTimeStats(x)
	if relErr(st.RMS, 1/math.Sqrt2) > 0.001 || relErr(st.Crest, math.Sqrt2) > 0.001 || relErr(st.Kurtosis, 1.5) > 0.01 {
		t.Fatalf("stats = %+v", st)
	}
}

func TestFilterGain(t *testing.T) {
	fs := 8000.0
	sos := ButterBandpass(4, 1000, 3000, fs)
	pass := FiltFilt(sos, sine(8192, fs, 2000, 1, 0))
	stop := FiltFilt(sos, sine(8192, fs, 100, 1, 0))
	pr := ComputeTimeStats(pass[1000:7000]).RMS / (1 / math.Sqrt2)
	sr := ComputeTimeStats(stop[1000:7000]).RMS / (1 / math.Sqrt2)
	if pr < 0.9 || pr > 1.01 {
		t.Errorf("passband gain %.3f", pr)
	}
	if sr > 0.001 {
		t.Errorf("stopband gain %.5f", sr)
	}
}

func TestEnvelopeBearingOuter(t *testing.T) {
	fs, n := 8000.0, 8192
	bpfo := 87.3
	rnd := rand.New(rand.NewSource(1))
	x := make([]float64, n)
	period := fs / bpfo
	for i := range x {
		x[i] = 0.05 * rnd.NormFloat64() * 9.80665
	}
	for k := 0.0; k*period < float64(n); k++ {
		start := int(k * period)
		for j := 0; j < 200 && start+j < n; j++ {
			tt := float64(j) / fs
			x[start+j] += 2 * 9.80665 * math.Exp(-tt*800) * math.Sin(2*math.Pi*2500*tt)
		}
	}
	env := Envelope(x, fs, 1000, 3000, 500)
	fp := env.FaultAmplitude(bpfo)
	if fp.NHarmonics < 2 {
		t.Fatalf("expected >=2 BPFO harmonics, got %+v", fp)
	}
	other := env.FaultAmplitude(61.1)
	if other.AmpG >= fp.AmpG/3 {
		t.Fatalf("non-fault frequency too strong: %+v vs %+v", other, fp)
	}
}

func TestContiguity(t *testing.T) {
	fs, f := 2000.0, 49.63
	full := sine(4096, fs, f, 1, 0.2)
	frames := [][]float64{full[0:1024], full[1024:2048], full[2048:3072]}
	if !FramesContiguous(frames, fs, f, 10) {
		t.Fatal("contiguous frames not detected")
	}
	gap := [][]float64{full[0:1024], full[1100:2124]}
	if FramesContiguous(gap, fs, f, 10) {
		t.Fatal("gap not detected")
	}
}

func TestBearingFrequencies(t *testing.T) {
	// 6322: approximate geometry for test only (n=8, Bd=41.3, Pd=170).
	g := BearingGeometry{NBalls: 8, BdMm: 41.3, PdMm: 170}
	ff := g.Frequencies(9.833)
	if ff.BPFO <= 0 || ff.BPFI <= ff.BPFO || ff.FTF >= 9.833/2 {
		t.Fatalf("bad freqs %+v", ff)
	}
	if relErr(ff.BPFO+ff.BPFI, 8*9.833) > 1e-9 {
		t.Fatalf("BPFO+BPFI should equal N*fr")
	}
}

func TestCalibration(t *testing.T) {
	c := &Calibration{FreqHz: []float64{10, 100, 1000}, Factor: []float64{1.0, 1.1, 1.2}}
	if relErr(c.At(math.Sqrt(10*100)), 1.05) > 1e-9 {
		t.Fatalf("log interpolation wrong: %v", c.At(31.62))
	}
	if c.At(5) != 1.0 || c.At(5000) != 1.2 {
		t.Fatal("clamping wrong")
	}
}
