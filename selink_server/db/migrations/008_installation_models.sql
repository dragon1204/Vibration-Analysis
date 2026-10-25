-- Reusable, versioned machine-installation models.  A model defines physical
-- sensor slots and approved analysis profiles; it never contains executable code.
CREATE TABLE IF NOT EXISTS installation_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  asset_class TEXT NOT NULL DEFAULT 'rotating_machine',
  image_url TEXT,
  image_key TEXT,
  image_content_type TEXT,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  algorithms JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO installation_models (id, name, description, asset_class, image_url, slots, algorithms, builtin) VALUES
('motor-de-base', 'Motor — DE + BASE', 'Standalone motor with one bearing location and a foundation reference.', 'standalone_motor', '/installation-templates/motor-de-base.jpg',
 '[{"code":"DE","label":"Drive end","role":"bearing","axes":["x","y","z"],"marker":{"x":41.2,"y":34.2}},{"code":"BASE","label":"Foundation","role":"base","axes":["x","y","z"],"marker":{"x":59.4,"y":68.8}}]'::jsonb,
 '["iso_corrected_rms","bearing_envelope","run_detection"]'::jsonb, TRUE),
('motor-load-4point', 'Motor train — Load + DE + NDE + BASE', 'Motor and driven load with four monitoring locations.', 'motor_driven_load', '/installation-templates/motor-load-4point.jpg',
 '[{"code":"COMP","label":"Driven load","role":"driven","axes":["x","y","z"],"marker":{"x":28.0,"y":28.8}},{"code":"DE","label":"Drive end","role":"bearing","axes":["x","y","z"],"marker":{"x":54.6,"y":33.4}},{"code":"NDE","label":"Non-drive end","role":"bearing","axes":["x","y","z"],"marker":{"x":74.2,"y":23.1}},{"code":"BASE","label":"Foundation","role":"base","axes":["x","y","z"],"marker":{"x":64.5,"y":66.8}}]'::jsonb,
 '["iso_corrected_rms","bearing_envelope","alignment_screening","unbalance_screening","run_detection"]'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;
