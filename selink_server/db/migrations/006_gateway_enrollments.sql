-- Zero-touch gateway enrolment: an unconfigured gateway announces its MAC (outbound HTTP, works
-- behind any NAT); an admin claims it on the web by MAC; the gateway then fetches its bootstrap
-- bundle (MQTT credentials, CA, base configuration) once, authenticated by its own device secret.
CREATE TABLE IF NOT EXISTS gateway_enrollments (
  mac           TEXT PRIMARY KEY,             -- lower-case aa:bb:cc:dd:ee:ff (eth0)
  secret_hash   TEXT NOT NULL,                -- sha256 of the secret the device generated on first boot
  serial        TEXT,
  hostname      TEXT,
  hw_model      TEXT,
  fw_version    TEXT,
  ip            TEXT,                         -- public address seen by the server
  local_ips     TEXT[],
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | claimed | delivered
  gateway_id    TEXT,
  claimed_by    TEXT,
  claimed_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  bundle        JSONB                          -- cleared once the device acknowledges it
);

ALTER TABLE gateways ADD COLUMN IF NOT EXISTS mac TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS gateways_mac_key ON gateways (mac) WHERE mac IS NOT NULL;
