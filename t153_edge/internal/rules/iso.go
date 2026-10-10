// Package rules implements level-1 alarm logic at the edge (spec 5.8): ISO 20816-3
// zones, narrowband thresholds (Beer HN SOP), temperature limits, rate-of-change,
// and n-of-m persistence with hysteresis.
package rules

import "math"

// ISOLimits are zone boundaries in mm/s RMS.
type ISOLimits struct{ AB, BC, CD float64 }

// ISOThresholds returns ISO 20816-3 limits (spec 13.2). group: 1 (>300 kW) or 2 (15–300 kW).
func ISOThresholds(group int, foundation string) ISOLimits {
	flexible := foundation == "flexible"
	if group == 1 {
		if flexible {
			return ISOLimits{3.5, 7.1, 11.0}
		}
		return ISOLimits{2.3, 4.5, 7.1}
	}
	if flexible {
		return ISOLimits{2.3, 4.5, 7.1}
	}
	return ISOLimits{1.4, 2.8, 4.5}
}

// Zone classifies a velocity RMS value into A/B/C/D.
func (l ISOLimits) Zone(v float64) string {
	switch {
	case math.IsNaN(v):
		return ""
	case v <= l.AB:
		return "A"
	case v <= l.BC:
		return "B"
	case v <= l.CD:
		return "C"
	default:
		return "D"
	}
}

// ISOBand returns the evaluation band by speed (spec 13.2): >600 rpm → 10–1000 Hz, else 2–1000 Hz.
func ISOBand(rpm float64) [2]float64 {
	if rpm > 600 {
		return [2]float64{10, 1000}
	}
	return [2]float64{2, 1000}
}

// Criterion2Threshold returns the change threshold. Mode "spec" (ISO 20816-1, spec 5.8.2):
// 0.25*B/C vs baseline; mode "beerhn": 0.25*(B/C - A/B) vs previous value.
func (l ISOLimits) Criterion2Threshold(mode string) float64 {
	if mode == "beerhn" {
		return 0.25 * (l.BC - l.AB)
	}
	return 0.25 * l.BC
}

// BandLimit is a narrowband warning/alarm pair in mm/s RMS.
type BandLimit struct {
	Band  string  `json:"band" yaml:"band"` // "1x", "2x", "3x4x", "bpfo", "bpfi", ...
	Warn  float64 `json:"warn" yaml:"warn"`
	Alarm float64 `json:"alarm" yaml:"alarm"`
}

// DefaultBandLimits is the illustrative SOP table of the Beer HN project.
var DefaultBandLimits = []BandLimit{
	{Band: "1x", Warn: 1.5, Alarm: 2.3},
	{Band: "2x", Warn: 1.0, Alarm: 1.8},
	{Band: "3x4x", Warn: 0.8, Alarm: 1.5},
	{Band: "bpfo", Warn: 0.5, Alarm: 1.0},
	{Band: "bpfi", Warn: 0.4, Alarm: 0.8},
}

// EnforceRSS scales alarm (and warn proportionally) limits down so that
// sqrt(sum Alarm_i^2) <= zoneBC (Beer HN criterion 4). Returns the scale applied (<=1).
func EnforceRSS(limits []BandLimit, zoneBC float64) ([]BandLimit, float64) {
	sum := 0.0
	for _, l := range limits {
		sum += l.Alarm * l.Alarm
	}
	rss := math.Sqrt(sum)
	out := append([]BandLimit(nil), limits...)
	if rss <= zoneBC || rss == 0 {
		return out, 1
	}
	k := zoneBC / rss
	for i := range out {
		out[i].Alarm *= k
		out[i].Warn *= k
	}
	return out, k
}

// BaselineLimits derives band limits from baseline statistics.
// method "sigma" (Beer HN): warn = mu+2σ, alarm = mu+3σ.
// method "mad" (spec 6.4): warn = med+3·1.4826·MAD, alarm = med+6·1.4826·MAD.
func BaselineLimits(method string, center, spread float64) (warn, alarm float64) {
	if method == "mad" {
		s := 1.4826 * spread
		return center + 3*s, center + 6*s
	}
	return center + 2*spread, center + 3*spread
}
