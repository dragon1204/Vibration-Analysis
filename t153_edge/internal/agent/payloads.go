package agent

// MQTT payloads (spec 5.10). Field names are part of the data contract.

type xyz struct {
	X *float64 `json:"x"`
	Y *float64 `json:"y"`
	Z *float64 `json:"z"`
}

type sensorInfo struct {
	Model  string `json:"model"`
	Addr   int    `json:"addr"`
	SrCode uint8  `json:"sr_code"`
	Mode   uint8  `json:"mode"`
	FW     string `json:"fw,omitempty"`
}

type vibMetrics struct {
	MsgID      string     `json:"msg_id"`
	TS         string     `json:"ts"`
	WindowS    int        `json:"window_s"`
	WindowMS   int        `json:"window_ms,omitempty"`
	PointID    string     `json:"point_id"`
	Sensor     sensorInfo `json:"sensor"`
	VelMMs     xyz        `json:"vel_mm_s"`
	VelMMsMax  xyz        `json:"vel_mm_s_max"`
	DispUm     xyz        `json:"disp_um"`
	FreqHz     xyz        `json:"freq_hz"`
	AccG       xyz        `json:"acc_g"`
	TempC      *float64   `json:"temp_c"`
	Samples    int        `json:"samples"`
	Flags      []string   `json:"flags"`
	TimeUnsync bool       `json:"time_unsynced,omitempty"`
}

type vibStatAxis struct {
	Crest       *float64 `json:"crest"`
	Kurtosis    *float64 `json:"kurtosis"`
	AccAbsMeanG *float64 `json:"acc_abs_mean_g"`
	AccVarG     *float64 `json:"acc_var"`
	AccRmsG     *float64 `json:"acc_rms_g"`
	WaveIndex   *float64 `json:"wave_index"`
	PeakIndex   *float64 `json:"peak_index"`
	PulseCoef   *float64 `json:"pulse_coef"`
	Skew        *float64 `json:"skew"`
	VelRmsMMs   *float64 `json:"vel_rms_mm_s"`
	VelKurt     *float64 `json:"vel_kurt"`
	DispRmsMm   *float64 `json:"disp_rms_mm"`
	ErrCode     int      `json:"err_code"`
}

type vibStat struct {
	MsgID    string                 `json:"msg_id"`
	TS       string                 `json:"ts"`
	PointID  string                 `json:"point_id"`
	SrCode   uint8                  `json:"sr_code"`
	Mode     uint8                  `json:"mode"`
	Source   string                 `json:"source,omitempty"`
	WindowMS int                    `json:"window_ms,omitempty"`
	Frames   int                    `json:"frames,omitempty"`
	Axes     map[string]vibStatAxis `json:"axes"`
	Flags    []string               `json:"flags"`
}

type energyAxis struct {
	Points []float64 `json:"points"`
	Areas  []float64 `json:"areas"`
	Total  float64   `json:"total"`
}

type vibEnergy struct {
	MsgID   string                `json:"msg_id"`
	TS      string                `json:"ts"`
	PointID string                `json:"point_id"`
	Axes    map[string]energyAxis `json:"axes"`
}

type powerMetrics struct {
	MsgID         string     `json:"msg_id"`
	TS            string     `json:"ts"`
	WindowS       int        `json:"window_s"`
	MachineID     string     `json:"machine_id"`
	UV            [3]float64 `json:"u_v"`
	IA            [3]float64 `json:"i_a"`
	PkW           *float64   `json:"p_kw"`
	QkVar         *float64   `json:"q_kvar"`
	PF            *float64   `json:"pf"`
	FHz           *float64   `json:"f_hz"`
	THDUPct       *float64   `json:"thd_u_pct"`
	THDIPct       *float64   `json:"thd_i_pct"`
	KWh           *float64   `json:"kwh"`
	IUnbalancePct *float64   `json:"i_unbalance_pct"`
	UUnbalancePct *float64   `json:"u_unbalance_pct"`
	LoadPct       *float64   `json:"load_pct"`
	Running       bool       `json:"running"`
}

type tempMetrics struct {
	MsgID           string   `json:"msg_id"`
	TS              string   `json:"ts"`
	MachineID       string   `json:"machine_id"`
	FrameTempC      *float64 `json:"frame_temp_c"`
	AmbientTempC    *float64 `json:"ambient_temp_c"`
	BearingTempC    *float64 `json:"bearing_temp_c"`
	WindingTempEstC *float64 `json:"winding_temp_est_c"`
	WindingRiseEstK *float64 `json:"winding_rise_est_k"`
	ThermalModel    string   `json:"thermal_model"`
}

type eventPayload struct {
	MsgID     string   `json:"msg_id"`
	TS        string   `json:"ts"`
	EventID   string   `json:"event_id"`
	Type      string   `json:"type"`  // alarm | sensor_fault | gateway | system
	State     string   `json:"state"` // raised | cleared
	Severity  string   `json:"severity"`
	MachineID string   `json:"machine_id,omitempty"`
	PointID   string   `json:"point_id,omitempty"`
	Rule      string   `json:"rule,omitempty"`
	Metric    string   `json:"metric,omitempty"`
	Value     *float64 `json:"value"`
	Threshold *float64 `json:"threshold"`
	Message   string   `json:"message"`
	CaptureID string   `json:"capture_id,omitempty"`
	Source    string   `json:"source"`
}

type blobPayload struct {
	MsgID            string  `json:"msg_id"`
	CaptureID        string  `json:"capture_id"`
	PointID          string  `json:"point_id"`
	TS               string  `json:"ts"`
	FsHz             float64 `json:"fs_hz,omitempty"`
	Frames           int     `json:"frames,omitempty"`
	FramesContiguous bool    `json:"frames_contiguous"`
	Encoding         string  `json:"encoding"`
	GPerLSB          float64 `json:"g_per_lsb,omitempty"`
	Data             string  `json:"data"`
}
