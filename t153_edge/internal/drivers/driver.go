// Package drivers defines the plugin interfaces for sensors (ADR-09). New sensor
// models (ifm VVB306, Banner QM30VT3...) implement these without touching the core.
package drivers

import (
	"context"
	"errors"
	"time"
)

// Axis index: 0=X, 1=Y, 2=Z.
type Axis int

const (
	X Axis = iota
	Y
	Z
)

// AxisNames maps axis index to JSON key.
var AxisNames = [3]string{"x", "y", "z"}

var (
	// ErrSrNeedsPersist means the sample-rate write did not take effect without a flash save.
	ErrSrNeedsPersist = errors.New("sensor: sample rate change requires persist (flash save)")
	// ErrNotReady is returned when a raw frame was not available within the allowed time.
	ErrNotReady = errors.New("sensor: raw frame not ready")
)

// VibrationIndicators holds values computed inside the sensor (blocks B1 and B2).
// Fields not read in a given call are NaN.
type VibrationIndicators struct {
	TS     time.Time
	AccG   [3]float64 // AX..AZ
	AccAmp [3]float64 // AXF..AZF (amplitude, scale [CẦN XÁC MINH])
	VelMMs [3]float64 // VX..VZ
	DispUm [3]float64 // DX..DZ
	FreqHz [3]float64 // HZX..HZZ
	TempC  float64
	// statistics (block B2)
	CrestFactor [3]float64
	Kurtosis    [3]float64
	AccAbsMeanG [3]float64
	AccVarG     [3]float64
	AccRmsG     [3]float64
	WaveIndex   [3]float64
	PeakIndex   [3]float64
	PulseCoef   [3]float64
	Skewness    [3]float64
	VelRmsMMs   [3]float64
	VelKurt     [3]float64
	DispRmsMm   [3]float64
	ErrCode     [3]uint16
	SrCode      uint8
	Mode        uint8
}

// SpectrumEnergy is block B3.
type SpectrumEnergy struct {
	TS     time.Time
	Points [3][8]float64 // 0.25X,0.5X,1X..6X
	Areas  [3][6]float64
	Total  [3]float64
}

// RawFrame is one RAWFIFO read: 1024 samples x 3 axes.
type RawFrame struct {
	FsHz      float64
	Samples   [3][]float32 // m/s^2 after scaling
	Counts    [3][]int16   // raw LSB values (for waveform files)
	StartTS   time.Time    // request sent
	EndTS     time.Time    // response fully received
	SrCode    uint8
	Saturated bool
}

// DeviceInfo describes the physical sensor.
type DeviceInfo struct {
	Model    string `json:"model"`
	Addr     int    `json:"addr"`
	Firmware string `json:"fw,omitempty"`
	SrCode   uint8  `json:"sr_code"`
	Mode     uint8  `json:"mode"`
}

// VibrationSensor is the common interface of vibration sensor drivers.
type VibrationSensor interface {
	ID() string
	// ReadIndicators reads the instantaneous block (B1). Statistics fields are NaN.
	ReadIndicators(ctx context.Context) (VibrationIndicators, error)
	// ReadStatistics reads the statistics block (B2). Instantaneous fields are NaN.
	ReadStatistics(ctx context.Context) (VibrationIndicators, error)
	ReadSpectrumEnergy(ctx context.Context) (SpectrumEnergy, error)
	SetSampleRate(ctx context.Context, srCode uint8, persist bool) error
	SampleRate(ctx context.Context) (uint8, error)
	ReadRawFrame(ctx context.Context) (RawFrame, error)
	Info(ctx context.Context) (DeviceInfo, error)
}

// ChannelValue is one temperature channel.
type ChannelValue struct {
	Channel int
	TempC   float64
	OK      bool
}

// TempSensor reads multi-channel temperature modules.
type TempSensor interface {
	Read(ctx context.Context) ([]ChannelValue, error)
}

// PowerReading is one reading of a 3-phase power meter.
type PowerReading struct {
	TS      time.Time
	UV      [3]float64
	IA      [3]float64
	PkW     float64
	QkVar   float64
	SkVA    float64
	PF      float64
	FHz     float64
	KWh     float64
	THDUPct float64
	THDIPct float64
}

// PowerMeter reads electrical quantities.
type PowerMeter interface {
	Read(ctx context.Context) (PowerReading, error)
	Close() error
}
