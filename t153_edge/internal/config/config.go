// Package config loads and validates /etc/edge-agent/edge.yaml (spec 5.11).
// Fields marked [CẦN XÁC MINH] in the spec are configurable, never hard-coded.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"

	"selink.vn/smartmotor/edge/internal/drivers/powermeter"
	"selink.vn/smartmotor/edge/internal/dsp"
	"selink.vn/smartmotor/edge/internal/rules"
	"selink.vn/smartmotor/edge/internal/thermal"
)

// Config is the full edge configuration. It is also accepted as JSON on the
// downlink "config" topic (same field names).
type Config struct {
	Version      int          `yaml:"version" json:"version"`
	Gateway      Gateway      `yaml:"gateway" json:"gateway"`
	MQTT         MQTT         `yaml:"mqtt" json:"mqtt"`
	Storage      Storage      `yaml:"storage" json:"storage"`
	Buses        []Bus        `yaml:"buses" json:"buses"`
	TempModules  []TempModule `yaml:"temp_modules" json:"temp_modules"`
	Machines     []Machine    `yaml:"machines" json:"machines"`
	SensorPolicy SensorPolicy `yaml:"sensor_policy" json:"sensor_policy"`
	Rules        Rules        `yaml:"rules" json:"rules"`
	LocalAlarm   LocalAlarm   `yaml:"local_alarm" json:"local_alarm"`
	Health       Health       `yaml:"health" json:"health"`
	Log          Log          `yaml:"log" json:"log"`
	Intervals    Intervals    `yaml:"intervals" json:"intervals"`
	LocalUI      LocalUI      `yaml:"local_ui" json:"local_ui"`
}

type Gateway struct {
	ID       string `yaml:"id" json:"id"`
	Tenant   string `yaml:"tenant" json:"tenant"`
	Site     string `yaml:"site" json:"site"`
	Timezone string `yaml:"timezone" json:"timezone"`
}

type MQTT struct {
	URL           string `yaml:"url" json:"url"`
	Username      string `yaml:"username" json:"username"`
	Password      string `yaml:"password" json:"password,omitempty"`
	PasswordFile  string `yaml:"password_file" json:"password_file"`
	CAFile        string `yaml:"ca_file" json:"ca_file"`
	CertFile      string `yaml:"cert_file" json:"cert_file"`
	KeyFile       string `yaml:"key_file" json:"key_file"`
	SendWaveforms bool   `yaml:"send_waveforms" json:"send_waveforms"`
	InsecureSkip  bool   `yaml:"insecure_skip_verify" json:"insecure_skip_verify"`
}

type Storage struct {
	Dir           string `yaml:"dir" json:"dir"`
	MaxBytes      int64  `yaml:"max_bytes" json:"max_bytes"`
	RetentionDays int    `yaml:"retention_days" json:"retention_days"`
}

type Bus struct {
	ID           string `yaml:"id" json:"id"`
	Device       string `yaml:"device" json:"device"` // /dev/ttyAS6, COM5, tcp://127.0.0.1:5020
	Baud         int    `yaml:"baud" json:"baud"`
	TimeoutMs    int    `yaml:"timeout_ms" json:"timeout_ms"`
	RawTimeoutMs int    `yaml:"raw_timeout_ms" json:"raw_timeout_ms"`
}

// TempModule describes a PT100→RS485 module (model [CẦN XÁC MINH], spec Q8).
type TempModule struct {
	Bus      string  `yaml:"bus" json:"bus"`
	Addr     int     `yaml:"addr" json:"addr"`
	Channels int     `yaml:"channels" json:"channels"`
	RegBase  int     `yaml:"reg_base" json:"reg_base"`
	Function int     `yaml:"function" json:"function"`
	Scale    float64 `yaml:"scale" json:"scale"`
	Offset   float64 `yaml:"offset" json:"offset"`
}

type Machine struct {
	ID            string            `yaml:"id" json:"id"`
	Name          string            `yaml:"name" json:"name"`
	Type          string            `yaml:"type" json:"type"`
	RatedPowerKW  float64           `yaml:"rated_power_kw" json:"rated_power_kw"`
	RatedSpeedRPM float64           `yaml:"rated_speed_rpm" json:"rated_speed_rpm"`
	Poles         int               `yaml:"poles" json:"poles"`
	LineFreqHz    float64           `yaml:"line_freq_hz" json:"line_freq_hz"`
	ISOGroup      int               `yaml:"iso_group" json:"iso_group"`
	Foundation    string            `yaml:"foundation" json:"foundation"`
	ISOBandHz     []float64         `yaml:"iso_band_hz" json:"iso_band_hz"`
	RunningVrms   float64           `yaml:"running_vrms_mm_s" json:"running_vrms_mm_s"`
	RunDetection  RunDetection      `yaml:"run_detection" json:"run_detection"`
	Thermal       thermal.Params    `yaml:"thermal" json:"thermal"`
	PowerMeter    *PowerMeter       `yaml:"power_meter" json:"power_meter"`
	Temps         []TempRef         `yaml:"temps" json:"temps"`
	Points        []Point           `yaml:"points" json:"points"`
	Isolation     *Isolation        `yaml:"isolation" json:"isolation"`
	BandLimits    []rules.BandLimit `yaml:"band_limits" json:"band_limits"`
	// MaleLobes of a screw compressor driven by this motor (f_mesh = lobes × 1X).
	MaleLobes int `yaml:"male_lobes" json:"male_lobes"`
}

// RunDetection derives the motor RUN signal from selected vibration axes when
// no electrical meter is present. A selected source above its threshold makes
// the machine RUN after OnDelayS; all sources below their thresholds stops it
// after OffDelayS. Empty Sources preserves the legacy "any axis / any point" rule.
type RunDetection struct {
	Sources   []RunSignal `yaml:"sources" json:"sources"`
	OnDelayS  int         `yaml:"on_delay_s" json:"on_delay_s"`
	OffDelayS int         `yaml:"off_delay_s" json:"off_delay_s"`
}

type RunSignal struct {
	PointID      string   `yaml:"point_id" json:"point_id"`
	Axes         []string `yaml:"axes" json:"axes"`
	ThresholdMMs float64  `yaml:"threshold_mm_s" json:"threshold_mm_s"`
}

type PowerMeter struct {
	Driver      string                 `yaml:"driver" json:"driver"` // modbus_tcp | sim
	Host        string                 `yaml:"host" json:"host"`
	Port        int                    `yaml:"port" json:"port"`
	UnitID      int                    `yaml:"unit_id" json:"unit_id"`
	RegisterMap string                 `yaml:"register_map" json:"register_map"`
	CustomMap   powermeter.RegisterMap `yaml:"custom_map" json:"custom_map"`
	VoltageV    float64                `yaml:"voltage_v" json:"voltage_v"`
}

type TempRef struct {
	Role    string `yaml:"role" json:"role"` // frame | ambient | bearing
	Bus     string `yaml:"bus" json:"bus"`
	Addr    int    `yaml:"addr" json:"addr"`
	Channel int    `yaml:"channel" json:"channel"`
}

type Sensor struct {
	Driver        string  `yaml:"driver" json:"driver"`
	Bus           string  `yaml:"bus" json:"bus"`
	Addr          int     `yaml:"addr" json:"addr"`
	VelocityScale float64 `yaml:"velocity_scale" json:"velocity_scale"`
}

type Bearing struct {
	Model      string  `yaml:"model" json:"model"`
	NBalls     int     `yaml:"n_balls" json:"n_balls"`
	BdMm       float64 `yaml:"bd_mm" json:"bd_mm"`
	PdMm       float64 `yaml:"pd_mm" json:"pd_mm"`
	ContactDeg float64 `yaml:"contact_deg" json:"contact_deg"`
	BPFOx      float64 `yaml:"bpfo_x" json:"bpfo_x"`
	BPFIx      float64 `yaml:"bpfi_x" json:"bpfi_x"`
	BSFx       float64 `yaml:"bsf_x" json:"bsf_x"`
	FTFx       float64 `yaml:"ftf_x" json:"ftf_x"`
}

// Geometry converts to the dsp type.
func (b *Bearing) Geometry() *dsp.BearingGeometry {
	if b == nil {
		return nil
	}
	return &dsp.BearingGeometry{NBalls: b.NBalls, BdMm: b.BdMm, PdMm: b.PdMm, ContactDeg: b.ContactDeg,
		BPFOx: b.BPFOx, BPFIx: b.BPFIx, BSFx: b.BSFx, FTFx: b.FTFx}
}

type Profile struct {
	Name       string    `yaml:"name" json:"name"`
	SR         int       `yaml:"sr" json:"sr"`
	Frames     int       `yaml:"frames" json:"frames"`
	EveryS     int       `yaml:"every_s" json:"every_s"`
	BandpassHz []float64 `yaml:"bandpass_hz" json:"bandpass_hz"`
}

type CalPoint struct {
	FreqHz float64 `yaml:"f_hz" json:"f_hz"`
	Factor float64 `yaml:"factor" json:"factor"`
}

// Baseline thresholds pushed from server (spec 6.4 push_thresholds).
type Baseline struct {
	Feature string  `yaml:"feature" json:"feature"` // e.g. iso_vrms_mm_s, x.orders.1, env.bpfo
	Median  float64 `yaml:"median" json:"median"`
	Warn    float64 `yaml:"warn" json:"warn"`
	Alarm   float64 `yaml:"alarm" json:"alarm"`
}

type Point struct {
	ID          string            `yaml:"id" json:"id"`
	Name        string            `yaml:"name" json:"name"`
	Location    string            `yaml:"location" json:"location"`
	Role        string            `yaml:"role" json:"role"` // bearing (default) | base | source
	Sensor      Sensor            `yaml:"sensor" json:"sensor"`
	AxesMap     map[string]string `yaml:"axes_map" json:"axes_map"`
	ISOAxes     []string          `yaml:"iso_axes" json:"iso_axes"`
	Bearing     *Bearing          `yaml:"bearing" json:"bearing"`
	IdleSR      int               `yaml:"idle_sr" json:"idle_sr"`
	Profiles    []Profile         `yaml:"profiles" json:"profiles"`
	Calibration []CalPoint        `yaml:"calibration" json:"calibration"`
	Baselines   []Baseline        `yaml:"baselines" json:"baselines"`
	// Contiguity: "off" (default, spec Q1) or "auto" (phase test, spec 5.6.9).
	Contiguity string `yaml:"contiguity" json:"contiguity"`
}

// CalibrationTable converts to the dsp type.
func (p *Point) CalibrationTable() *dsp.Calibration {
	if len(p.Calibration) == 0 {
		return nil
	}
	c := &dsp.Calibration{}
	for _, cp := range p.Calibration {
		c.FreqHz = append(c.FreqHz, cp.FreqHz)
		c.Factor = append(c.Factor, cp.Factor)
	}
	return c
}

// Isolation configures the Beer HN multi-sensor noise isolation for a machine.
type Isolation struct {
	Enabled         bool                      `yaml:"enabled" json:"enabled"`
	ReferencePoint  string                    `yaml:"reference_point" json:"reference_point"` // base sensor (S2)
	SourcePoint     string                    `yaml:"source_point" json:"source_point"`       // compressor top (S1)
	Targets         []string                  `yaml:"targets" json:"targets"`                 // bearing housings (S3, S4)
	Alpha           map[string]dsp.AlphaTable `yaml:"alpha" json:"alpha"`                     // learned α(f) per target
	LearnSamples    int                       `yaml:"learn_samples" json:"learn_samples"`
	LearnMinLoadPct float64                   `yaml:"learn_min_load_pct" json:"learn_min_load_pct"`
	MeshHarmonics   int                       `yaml:"mesh_harmonics" json:"mesh_harmonics"`
	SourcePeakRatio float64                   `yaml:"source_peak_ratio" json:"source_peak_ratio"`
	Criterion2Mode  string                    `yaml:"criterion2_mode" json:"criterion2_mode"` // spec | beerhn
	// Profile used for the synchronized group capture (default "orders").
	Profile string `yaml:"profile" json:"profile"`
}

type SensorPolicy struct {
	AllowFlashWrite      bool `yaml:"allow_flash_write" json:"allow_flash_write"`
	MaxFlashWritesPerDay int  `yaml:"max_flash_writes_per_day" json:"max_flash_writes_per_day"`
}

type Persistence struct {
	N int `yaml:"n" json:"n"`
	M int `yaml:"m" json:"m"`
}

type Rules struct {
	Persistence          Persistence `yaml:"persistence" json:"persistence"`
	WindingWarningC      float64     `yaml:"winding_warning_c" json:"winding_warning_c"`
	WindingAlarmC        float64     `yaml:"winding_alarm_c" json:"winding_alarm_c"`
	BearingTempWarningC  float64     `yaml:"bearing_temp_warning_c" json:"bearing_temp_warning_c"`
	BearingTempAlarmC    float64     `yaml:"bearing_temp_alarm_c" json:"bearing_temp_alarm_c"`
	KurtosisWatch        float64     `yaml:"kurtosis_watch" json:"kurtosis_watch"`
	RateFactor           float64     `yaml:"rate_factor" json:"rate_factor"`
	RateWindowS          int         `yaml:"rate_window_s" json:"rate_window_s"`
	EventCaptureMinGapS  int         `yaml:"event_capture_min_gap_s" json:"event_capture_min_gap_s"`
	BandLimitsEnforceRSS bool        `yaml:"band_limits_enforce_rss" json:"band_limits_enforce_rss"`
}

type LocalAlarm struct {
	Enabled     bool   `yaml:"enabled" json:"enabled"`
	RelayGPIO   int    `yaml:"relay_gpio" json:"relay_gpio"`
	BuzzerGPIO  int    `yaml:"buzzer_gpio" json:"buzzer_gpio"`
	Buzzer      bool   `yaml:"buzzer" json:"buzzer"`
	MinSeverity string `yaml:"min_severity" json:"min_severity"`
}

type Health struct {
	Watchdog    string `yaml:"watchdog" json:"watchdog"`           // e.g. /dev/watchdog, "" = disabled
	ModemATPort string `yaml:"modem_at_port" json:"modem_at_port"` // e.g. /dev/ttyUSB2 for AT+CSQ
	ThermalZone string `yaml:"thermal_zone" json:"thermal_zone"`
}

// LocalUI is the loopback JSON endpoint read by the gateway's LCD panel.
type LocalUI struct {
	Listen string `yaml:"listen" json:"listen"` // default 127.0.0.1:8091, "off" disables
	// BaseAlpha is the transmission coefficient used on the LCD to show the bearing's own vibration
	// sqrt(DE² − (α·BASE)²). Display only: ISO zones and alarms use the measured DE value. Default 0.8.
	BaseAlpha float64 `yaml:"base_alpha" json:"base_alpha"`
}

type Log struct {
	Level string `yaml:"level" json:"level"`
	File  string `yaml:"file" json:"file"`
}

// Intervals of periodic tasks (spec 5.4.1).
type Intervals struct {
	B1S       int `yaml:"b1_s" json:"b1_s"`
	B1MS      int `yaml:"b1_ms,omitempty" json:"b1_ms,omitempty"`
	B2S       int `yaml:"b2_s" json:"b2_s"`
	FastRMSMS int `yaml:"fast_rms_ms,omitempty" json:"fast_rms_ms,omitempty"`
	// RawDutyPct caps the share of bus time spent on RAWFIFO frames for fast RMS
	// (default 70) so B1 polling and scheduled captures keep running with several sensors.
	RawDutyPct  int `yaml:"raw_duty_pct,omitempty" json:"raw_duty_pct,omitempty"`
	B3S         int `yaml:"b3_s" json:"b3_s"`
	WindowS     int `yaml:"window_s" json:"window_s"`
	VibWindowMS int `yaml:"vib_window_ms,omitempty" json:"vib_window_ms,omitempty"`
	TempS       int `yaml:"temp_s" json:"temp_s"`
	PowerS      int `yaml:"power_s" json:"power_s"`
	HealthS     int `yaml:"health_s" json:"health_s"`
}

// Load reads a YAML file and applies defaults and validation.
func Load(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(b)
}

// Parse parses YAML (or JSON, which is valid YAML).
func Parse(b []byte) (*Config, error) {
	var c Config
	if err := yaml.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	c.applyDefaults()
	if err := c.Validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *Config) applyDefaults() {
	if c.Gateway.Timezone == "" {
		c.Gateway.Timezone = "Asia/Ho_Chi_Minh"
	}
	if c.Storage.Dir == "" {
		c.Storage.Dir = "/data/edge"
	}
	if c.LocalUI.Listen == "" {
		c.LocalUI.Listen = "127.0.0.1:8091"
	}
	if c.LocalUI.BaseAlpha == 0 {
		c.LocalUI.BaseAlpha = 0.8
	}
	if c.Storage.MaxBytes == 0 {
		c.Storage.MaxBytes = 8 << 30
	}
	if c.Storage.RetentionDays == 0 {
		c.Storage.RetentionDays = 7
	}
	for i := range c.Buses {
		b := &c.Buses[i]
		if b.Baud == 0 {
			b.Baud = 9600
		}
		if b.TimeoutMs == 0 {
			b.TimeoutMs = 150
		}
		if b.RawTimeoutMs == 0 {
			b.RawTimeoutMs = 800
		}
	}
	for i := range c.Machines {
		m := &c.Machines[i]
		if m.LineFreqHz == 0 {
			m.LineFreqHz = 50
		}
		if m.ISOGroup == 0 {
			m.ISOGroup = 2
			if m.RatedPowerKW > 300 {
				m.ISOGroup = 1
			}
		}
		if m.Foundation == "" {
			m.Foundation = "rigid"
		}
		if len(m.ISOBandHz) != 2 {
			b := rules.ISOBand(m.RatedSpeedRPM)
			m.ISOBandHz = b[:]
		}
		if m.RunningVrms == 0 {
			m.RunningVrms = 0.3
		}
		if m.RunDetection.OnDelayS == 0 {
			m.RunDetection.OnDelayS = 10
		}
		if m.RunDetection.OffDelayS == 0 {
			m.RunDetection.OffDelayS = 10
		}
		for j := range m.RunDetection.Sources {
			s := &m.RunDetection.Sources[j]
			if s.ThresholdMMs == 0 {
				s.ThresholdMMs = m.RunningVrms
			}
		}
		if m.Isolation != nil {
			iso := m.Isolation
			if iso.LearnSamples == 0 {
				iso.LearnSamples = 30
			}
			if iso.LearnMinLoadPct == 0 {
				iso.LearnMinLoadPct = 90
			}
			if iso.MeshHarmonics == 0 {
				iso.MeshHarmonics = 3
			}
			if iso.SourcePeakRatio == 0 {
				iso.SourcePeakRatio = 0.5
			}
			if iso.Criterion2Mode == "" {
				iso.Criterion2Mode = "beerhn"
			}
			if iso.Profile == "" {
				iso.Profile = "orders"
			}
		}
		for j := range m.Points {
			p := &m.Points[j]
			if p.Name == "" {
				p.Name = p.ID
			}
			if p.Role == "" {
				p.Role = "bearing"
			}
			if p.Sensor.Driver == "" {
				p.Sensor.Driver = "wtvb05"
			}
			if p.Sensor.VelocityScale == 0 {
				p.Sensor.VelocityScale = 0.01
			}
			if len(p.ISOAxes) == 0 {
				p.ISOAxes = []string{"x", "y", "z"}
			}
			if p.Contiguity == "" {
				p.Contiguity = "off"
			}
		}
	}
	if c.SensorPolicy.MaxFlashWritesPerDay == 0 {
		c.SensorPolicy.MaxFlashWritesPerDay = 24
	}
	r := &c.Rules
	if r.Persistence.N == 0 || r.Persistence.M == 0 {
		r.Persistence = Persistence{N: 3, M: 5}
	}
	setF := func(v *float64, d float64) {
		if *v == 0 {
			*v = d
		}
	}
	setF(&r.WindingWarningC, 130)
	setF(&r.WindingAlarmC, 145)
	setF(&r.BearingTempWarningC, 90)
	setF(&r.BearingTempAlarmC, 100)
	setF(&r.KurtosisWatch, 4)
	setF(&r.RateFactor, 2)
	if r.RateWindowS == 0 {
		r.RateWindowS = 600
	}
	if r.EventCaptureMinGapS == 0 {
		r.EventCaptureMinGapS = 600
	}
	if c.LocalAlarm.MinSeverity == "" {
		c.LocalAlarm.MinSeverity = "warning"
	}
	if c.Health.ThermalZone == "" {
		c.Health.ThermalZone = "/sys/class/thermal/thermal_zone0/temp"
	}
	if c.Log.Level == "" {
		c.Log.Level = "info"
	}
	iv := &c.Intervals
	setI := func(v *int, d int) {
		if *v == 0 {
			*v = d
		}
	}
	if iv.B1S == 0 && iv.B1MS == 0 {
		iv.B1S = 2
	}
	setI(&iv.B2S, 10)
	setI(&iv.B3S, 60)
	setI(&iv.WindowS, 10)
	setI(&iv.TempS, 10)
	setI(&iv.PowerS, 1)
	setI(&iv.HealthS, 60)
}

// Validate checks references and ranges.
func (c *Config) Validate() error {
	var errs []string
	if c.Gateway.ID == "" || c.Gateway.Tenant == "" || c.Gateway.Site == "" {
		errs = append(errs, "gateway.id, tenant and site are required")
	}
	if c.Intervals.B1MS != 0 && (c.Intervals.B1MS < 50 || c.Intervals.B1MS >= 1000) {
		errs = append(errs, "intervals.b1_ms must be 50..999 ms when set")
	}
	if c.Intervals.B1MS > 0 && c.Intervals.B1S > 0 {
		errs = append(errs, "use only one of intervals.b1_ms or intervals.b1_s")
	}
	if c.Intervals.VibWindowMS != 0 && (c.Intervals.VibWindowMS < 50 || c.Intervals.VibWindowMS >= 1000) {
		errs = append(errs, "intervals.vib_window_ms must be 50..999 ms when set")
	}
	if c.Intervals.RawDutyPct != 0 && (c.Intervals.RawDutyPct < 20 || c.Intervals.RawDutyPct > 95) {
		errs = append(errs, "intervals.raw_duty_pct must be 20..95 when set")
	}
	if c.Intervals.FastRMSMS != 0 && (c.Intervals.FastRMSMS < 1000 || c.Intervals.FastRMSMS > 60000) {
		errs = append(errs, "intervals.fast_rms_ms must be 1000..60000 ms when set")
	}
	if c.Intervals.B1MS > 0 && c.Intervals.VibWindowMS > 0 && c.Intervals.VibWindowMS < c.Intervals.B1MS {
		errs = append(errs, "intervals.vib_window_ms must be >= intervals.b1_ms")
	}
	buses := map[string]bool{}
	for _, b := range c.Buses {
		if b.ID == "" || b.Device == "" {
			errs = append(errs, "bus id/device required")
		}
		buses[b.ID] = true
	}
	points := map[string]bool{}
	addrs := map[string]string{}
	for _, m := range c.Machines {
		if m.ID == "" {
			errs = append(errs, "machine id required")
		}
		if m.Foundation != "rigid" && m.Foundation != "flexible" {
			errs = append(errs, fmt.Sprintf("machine %s: foundation must be rigid|flexible", m.ID))
		}
		for _, t := range m.Temps {
			if !buses[t.Bus] {
				errs = append(errs, fmt.Sprintf("machine %s: temp bus %q not defined", m.ID, t.Bus))
			}
		}
		for _, p := range m.Points {
			if points[p.ID] {
				errs = append(errs, fmt.Sprintf("duplicate point id %s", p.ID))
			}
			points[p.ID] = true
			if !buses[p.Sensor.Bus] {
				errs = append(errs, fmt.Sprintf("point %s: bus %q not defined", p.ID, p.Sensor.Bus))
			}
			if p.Sensor.Addr < 1 || p.Sensor.Addr > 0x7F {
				errs = append(errs, fmt.Sprintf("point %s: addr must be 0x01..0x7F", p.ID))
			}
			k := fmt.Sprintf("%s/%d", p.Sensor.Bus, p.Sensor.Addr)
			if other, ok := addrs[k]; ok {
				errs = append(errs, fmt.Sprintf("points %s and %s share address %s", other, p.ID, k))
			}
			addrs[k] = p.ID
			for _, pr := range p.Profiles {
				if pr.SR < 0 || pr.SR > 9 {
					errs = append(errs, fmt.Sprintf("point %s profile %s: sr must be 0..9", p.ID, pr.Name))
				}
				if pr.Frames < 1 || pr.Frames > 32 {
					errs = append(errs, fmt.Sprintf("point %s profile %s: frames must be 1..32", p.ID, pr.Name))
				}
			}
		}
		if iso := m.Isolation; iso != nil && iso.Enabled {
			for _, id := range append([]string{iso.ReferencePoint}, iso.Targets...) {
				if !hasPoint(m, id) {
					errs = append(errs, fmt.Sprintf("machine %s isolation: point %q not in machine", m.ID, id))
				}
			}
			if iso.SourcePoint != "" && !hasPoint(m, iso.SourcePoint) {
				errs = append(errs, fmt.Sprintf("machine %s isolation: source point %q not in machine", m.ID, iso.SourcePoint))
			}
		}
	}
	if len(errs) > 0 {
		return errors.New("config invalid: " + strings.Join(errs, "; "))
	}
	return nil
}

func hasPoint(m Machine, id string) bool {
	for _, p := range m.Points {
		if p.ID == id {
			return true
		}
	}
	return false
}

// TopicPrefix returns sm/v1/<tenant>/<site>/<gateway>/.
func (c *Config) TopicPrefix() string {
	return fmt.Sprintf("sm/v1/%s/%s/%s/", c.Gateway.Tenant, c.Gateway.Site, c.Gateway.ID)
}

// MQTTPassword returns the password from file or inline value.
func (c *Config) MQTTPassword() (string, error) {
	if c.MQTT.PasswordFile != "" {
		b, err := os.ReadFile(c.MQTT.PasswordFile)
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(b)), nil
	}
	return c.MQTT.Password, nil
}

// Marshal serializes back to YAML (used when a config arrives over MQTT).
func (c *Config) Marshal() ([]byte, error) { return yaml.Marshal(c) }
