-- Smart Motor schema (spec 6.2) + additions documented in docs/CHANGELOG.md
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ===== Danh mục / tài sản =====
CREATE TABLE tenants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE sites (
  id TEXT PRIMARY KEY, tenant_id TEXT REFERENCES tenants(id),
  name TEXT NOT NULL, address TEXT, timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  network TEXT CHECK (network IN ('lan','4g','other')));

CREATE TABLE gateways (
  id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id),
  hw_model TEXT DEFAULT 'T153-HelperBoard', fw_version TEXT,
  mqtt_username TEXT UNIQUE, mqtt_password_hash TEXT,
  last_seen TIMESTAMPTZ, online BOOLEAN DEFAULT false, config_version INT DEFAULT 0,
  health JSONB);                                   -- [add] last health report

CREATE TABLE bearings (
  id SERIAL PRIMARY KEY, model TEXT NOT NULL, maker TEXT,
  n_balls INT, bd_mm NUMERIC, pd_mm NUMERIC, contact_deg NUMERIC DEFAULT 0,
  bpfo_x NUMERIC, bpfi_x NUMERIC, bsf_x NUMERIC, ftf_x NUMERIC);

CREATE TABLE machines (
  id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id), name TEXT NOT NULL,
  type TEXT,
  maker TEXT, model TEXT, serial TEXT,
  rated_power_kw NUMERIC, rated_speed_rpm NUMERIC, poles INT, line_freq_hz NUMERIC DEFAULT 50,
  rated_voltage_v NUMERIC, rated_current_a NUMERIC, insulation_class TEXT,
  mounting TEXT,
  iso_group INT DEFAULT 2, foundation TEXT CHECK (foundation IN ('rigid','flexible')),
  iso_band_lo_hz NUMERIC, iso_band_hi_hz NUMERIC DEFAULT 1000,
  thermal_params JSONB,
  meta JSONB, photo_url TEXT, created_at TIMESTAMPTZ DEFAULT now(),
  male_lobes INT,                                  -- [add] screw compressor lobes (f_mesh)
  isolation JSONB,                                 -- [add] Beer HN isolation config incl. learned alpha
  band_limits JSONB);                              -- [add] narrowband SOP limits

CREATE TABLE measurement_points (
  id TEXT PRIMARY KEY, machine_id TEXT REFERENCES machines(id),
  name TEXT, location TEXT,
  gateway_id TEXT REFERENCES gateways(id),
  sensor_model TEXT DEFAULT 'WTVB05', sensor_serial TEXT, sensor_addr INT,
  axes_map JSONB,
  iso_axes TEXT[] DEFAULT '{x,z}',
  bearing_id INT REFERENCES bearings(id),
  calibration JSONB,
  installed_at TIMESTAMPTZ, photo_url TEXT, active BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'bearing');                    -- [add] bearing | base | source

-- ===== Chuỗi thời gian =====
CREATE TABLE vib_metrics (
  ts TIMESTAMPTZ NOT NULL, point_id TEXT NOT NULL, axis CHAR(1) NOT NULL,
  vel_mm_s REAL, vel_mm_s_max REAL, disp_um REAL, freq_hz REAL, acc_g REAL,
  acc_rms_g REAL, vel_rms_mm_s REAL, disp_rms_mm REAL, crest REAL, kurtosis REAL,
  skew REAL, wave_index REAL, peak_index REAL, pulse_coef REAL, acc_var REAL,
  vel_kurt REAL, err_code INT, temp_c REAL, sr_code SMALLINT, mode SMALLINT,
  flags TEXT[], msg_id TEXT);
SELECT create_hypertable('vib_metrics', 'ts', chunk_time_interval => INTERVAL '7 days');
CREATE INDEX ON vib_metrics (point_id, axis, ts DESC);
CREATE UNIQUE INDEX ON vib_metrics (point_id, axis, ts);

CREATE TABLE vib_energy (
  ts TIMESTAMPTZ NOT NULL, point_id TEXT NOT NULL, axis CHAR(1) NOT NULL,
  points REAL[8], areas REAL[6], total REAL);
SELECT create_hypertable('vib_energy', 'ts');
CREATE UNIQUE INDEX ON vib_energy (point_id, axis, ts);

CREATE TABLE power_metrics (
  ts TIMESTAMPTZ NOT NULL, machine_id TEXT NOT NULL,
  u_v REAL[3], i_a REAL[3], p_kw REAL, q_kvar REAL, pf REAL, f_hz REAL,
  thd_u_pct REAL, thd_i_pct REAL, kwh DOUBLE PRECISION,
  i_unbalance_pct REAL, u_unbalance_pct REAL, load_pct REAL, running BOOLEAN);
SELECT create_hypertable('power_metrics', 'ts');
CREATE UNIQUE INDEX ON power_metrics (machine_id, ts);

CREATE TABLE temp_metrics (
  ts TIMESTAMPTZ NOT NULL, machine_id TEXT NOT NULL,
  frame_temp_c REAL, ambient_temp_c REAL, bearing_temp_c REAL,
  winding_temp_est_c REAL, winding_rise_est_k REAL, thermal_model TEXT);
SELECT create_hypertable('temp_metrics', 'ts');
CREATE UNIQUE INDEX ON temp_metrics (machine_id, ts);

CREATE TABLE captures (
  capture_id TEXT PRIMARY KEY, ts TIMESTAMPTZ NOT NULL, point_id TEXT NOT NULL,
  profile TEXT, fs_hz REAL, sr_code SMALLINT, frames INT, frames_contiguous BOOLEAN,
  n_fft INT, df_hz REAL, running BOOLEAN, load_pct REAL, speed_hz REAL, speed_confidence TEXT,
  features JSONB,
  iso_vrms_max_mm_s REAL, iso_zone CHAR(1),
  waveform_key TEXT, spectrum_key TEXT, quality_flags TEXT[],
  processed_by TEXT DEFAULT 'edge', reprocessed_at TIMESTAMPTZ,
  anomaly_score REAL);                             -- [add]
CREATE INDEX ON captures (point_id, ts DESC);

-- ===== Baseline, ngưỡng, sự kiện =====
CREATE TABLE baselines (
  id SERIAL PRIMARY KEY, point_id TEXT, machine_id TEXT,
  feature TEXT NOT NULL,
  load_bin TEXT DEFAULT 'all',
  median REAL, mad REAL, n_samples INT, period_from TIMESTAMPTZ, period_to TIMESTAMPTZ,
  warn REAL, alarm REAL, warn_min REAL, alarm_min REAL,
  status TEXT DEFAULT 'learning',
  version INT DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT now(),
  mean REAL, std REAL, method TEXT DEFAULT 'mad'); -- [add] Beer HN μ+2σ / μ+3σ option
CREATE UNIQUE INDEX ON baselines (point_id, feature, load_bin);

CREATE TABLE alarm_rules (
  id SERIAL PRIMARY KEY, scope TEXT,
  scope_id TEXT, rule TEXT NOT NULL,
  params JSONB, severity TEXT, enabled BOOLEAN DEFAULT true);

CREATE TABLE events (
  event_id TEXT PRIMARY KEY, ts TIMESTAMPTZ NOT NULL, machine_id TEXT, point_id TEXT,
  type TEXT,
  severity TEXT,
  state TEXT,
  rule TEXT, metric TEXT, value REAL, threshold REAL, message TEXT,
  capture_id TEXT, source TEXT,
  ack_by TEXT, ack_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
  diagnosis JSONB,
  feedback JSONB,
  comments JSONB DEFAULT '[]'::jsonb,              -- [add]
  cleared_at TIMESTAMPTZ,                          -- [add] edge "cleared"
  gateway_id TEXT);                                -- [add] reporting gateway
CREATE INDEX ON events (machine_id, ts DESC);
CREATE INDEX ON events (state, severity);

CREATE TABLE maintenance_logs (
  id SERIAL PRIMARY KEY, machine_id TEXT, point_id TEXT, ts TIMESTAMPTZ,
  action TEXT,
  description TEXT, found_fault TEXT, photos TEXT[], by_user TEXT,
  reset_baseline BOOLEAN DEFAULT false);

-- ===== Kiểm chứng sai số =====
CREATE TABLE accuracy_tests (
  id SERIAL PRIMARY KEY, point_id TEXT, ts TIMESTAMPTZ, load_state TEXT,
  reference_device TEXT, reference_cert TEXT, quantity TEXT,
  axis CHAR(1), freq_hz REAL, ref_value REAL, dut_value REAL, error_pct REAL,
  capture_id TEXT, operator TEXT, notes TEXT);

-- ===== Người dùng, quyền, cấu hình =====
CREATE TABLE users (
  id SERIAL PRIMARY KEY, email TEXT UNIQUE, name TEXT, password_hash TEXT,
  phone TEXT, zalo_id TEXT, telegram_chat_id TEXT, active BOOLEAN DEFAULT true);
CREATE TABLE user_roles (
  user_id INT REFERENCES users(id), tenant_id TEXT, site_id TEXT,
  role TEXT CHECK (role IN ('viewer','operator','engineer','analyst','admin')));
CREATE TABLE notification_prefs (
  user_id INT REFERENCES users(id), channel TEXT, min_severity TEXT, enabled BOOLEAN DEFAULT true);
CREATE TABLE gateway_configs (
  gateway_id TEXT, version INT, config JSONB, created_by TEXT, created_at TIMESTAMPTZ DEFAULT now(),
  applied_at TIMESTAMPTZ, PRIMARY KEY (gateway_id, version));
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ DEFAULT now(), user_id INT, action TEXT, target TEXT, detail JSONB);

-- ===== [add] Bổ sung =====
CREATE TABLE gateway_commands (
  cmd_id TEXT PRIMARY KEY, gateway_id TEXT REFERENCES gateways(id), type TEXT NOT NULL, payload JSONB,
  status TEXT DEFAULT 'sent', detail TEXT, created_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), acked_at TIMESTAMPTZ);

CREATE TABLE diagnoses (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ NOT NULL DEFAULT now(), machine_id TEXT, point_id TEXT, capture_id TEXT,
  fault TEXT, confidence REAL, evidence JSONB, recommendation TEXT, rules_version TEXT,
  candidates JSONB, event_id TEXT, feedback JSONB);
CREATE INDEX ON diagnoses (machine_id, ts DESC);

CREATE TABLE machine_health (
  ts TIMESTAMPTZ NOT NULL, machine_id TEXT NOT NULL, point_id TEXT,
  health_index REAL, anomaly_score REAL, rul_days REAL, rul_lo_days REAL, rul_hi_days REAL, detail JSONB);
SELECT create_hypertable('machine_health', 'ts');
CREATE INDEX ON machine_health (machine_id, ts DESC);

CREATE TABLE reports (
  id SERIAL PRIMARY KEY, tenant_id TEXT, machine_id TEXT, period TEXT, object_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now());
