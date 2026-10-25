-- Independent RUN/STOP telemetry.  It is emitted even when no FFT capture or
-- power meter sample exists, so Runtime and utilization never depend on capture cadence.
CREATE TABLE IF NOT EXISTS machine_run_states (
  ts TIMESTAMPTZ NOT NULL,
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  running BOOLEAN NOT NULL,
  source TEXT NOT NULL DEFAULT 'vibration',
  msg_id TEXT
);
SELECT create_hypertable('machine_run_states', 'ts', if_not_exists => TRUE);
CREATE UNIQUE INDEX IF NOT EXISTS machine_run_states_machine_ts_idx ON machine_run_states (machine_id, ts);
CREATE INDEX IF NOT EXISTS machine_run_states_machine_ts_desc_idx ON machine_run_states (machine_id, ts DESC);
