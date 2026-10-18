-- Report API v2: one row per requested report with a lifecycle (queued → running → done | failed),
-- the exact period bounds, who asked for it and a machine-readable summary/analysis.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS period_type  TEXT,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS error        TEXT,
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS size_bytes   INTEGER,
  ADD COLUMN IF NOT EXISTS summary      JSONB,
  ADD COLUMN IF NOT EXISTS analysis     JSONB,
  ADD COLUMN IF NOT EXISTS format_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS reports_machine_period_idx ON reports (machine_id, period, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status) WHERE status IN ('queued', 'running');
