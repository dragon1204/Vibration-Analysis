-- Standardize the driven-machine measurement position as LOAD.
-- COMP remains accepted by API/edge compatibility code but is no longer stored or displayed.
UPDATE measurement_points
SET location = 'LOAD'
WHERE upper(location) = 'COMP';

UPDATE installation_models
SET name = replace(name, 'COMP', 'LOAD'),
    description = replace(description, 'COMP', 'LOAD'),
    slots = replace(slots::text, '"COMP"', '"LOAD"')::jsonb,
    updated_at = now()
WHERE name LIKE '%COMP%'
   OR description LIKE '%COMP%'
   OR slots::text LIKE '%"COMP"%';
