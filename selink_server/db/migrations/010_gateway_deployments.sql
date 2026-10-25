-- A gateway is mobile hardware.  Deployments retain the asset-centric
-- measurement history while making exactly one current assignment explicit.
CREATE TABLE IF NOT EXISTS gateway_deployments (
  id TEXT PRIMARY KEY,
  gateway_id TEXT NOT NULL REFERENCES gateways(id),
  machine_id TEXT NOT NULL REFERENCES machines(id),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'ended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  started_by TEXT,
  ended_by TEXT,
  note TEXT NOT NULL DEFAULT '',
  config_version INT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_deployment_per_gateway
  ON gateway_deployments(gateway_id) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS gateway_deployments_machine_history
  ON gateway_deployments(machine_id, started_at DESC);
