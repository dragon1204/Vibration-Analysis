package agent

import (
	"testing"

	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/drivers"
)

func TestRunSourcesMatch(t *testing.T) {
	ind := map[string]*drivers.VibrationIndicators{
		"de":   {VelMMs: [3]float64{0, 0, 2.0}},
		"base": {VelMMs: [3]float64{0, 0, 0.05}},
	}
	last := func(id string) *drivers.VibrationIndicators { return ind[id] }
	sources := []config.RunSignal{
		{PointID: "de", Axes: []string{"z"}, ThresholdMMs: 1},
		{PointID: "base", Axes: []string{"z"}, ThresholdMMs: 0.1},
	}
	if !runSourcesMatch(config.RunDetection{Sources: sources}, last) {
		t.Fatal("any: DE above its threshold must RUN")
	}
	if runSourcesMatch(config.RunDetection{Mode: "all", Sources: sources}, last) {
		t.Fatal("all: BASE below its threshold must STOP")
	}
	ind["base"].VelMMs[2] = 0.2
	if !runSourcesMatch(config.RunDetection{Mode: "all", Sources: sources}, last) {
		t.Fatal("all: every source above must RUN")
	}
	delete(ind, "base") // no data yet from BASE: judge on the sources that report
	if !runSourcesMatch(config.RunDetection{Mode: "all", Sources: sources}, last) {
		t.Fatal("all: a source without data must not force STOP")
	}
	if runSourcesMatch(config.RunDetection{Mode: "all", Sources: sources}, func(string) *drivers.VibrationIndicators { return nil }) {
		t.Fatal("no data at all must STOP")
	}
}
