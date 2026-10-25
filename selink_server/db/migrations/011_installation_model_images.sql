-- Attach the curated dashboard illustrations to the built-in installation models.
-- Static paths are served by the web application from public/installation-templates.
UPDATE installation_models
SET image_url = CASE id
  WHEN 'motor-pump-3point' THEN '/installation-templates/motor-pump-3point.png'
  WHEN 'motor-pump-4point' THEN '/installation-templates/motor-pump-4point.png'
  WHEN 'belt-driven-fan-3point' THEN '/installation-templates/belt-driven-fan-3point.png'
  WHEN 'motor-gearbox-load-4point' THEN '/installation-templates/motor-gearbox-load-4point.png'
  WHEN 'vertical-pump-4point' THEN '/installation-templates/vertical-pump-4point.png'
  ELSE image_url
END,
updated_at = now()
WHERE id IN (
  'motor-pump-3point',
  'motor-pump-4point',
  'belt-driven-fan-3point',
  'motor-gearbox-load-4point',
  'vertical-pump-4point'
);
