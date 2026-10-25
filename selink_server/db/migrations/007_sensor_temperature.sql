-- Temperature inside a vibration sensor is distinct from a housing/bearing PT100.
ALTER TABLE temp_metrics ADD COLUMN IF NOT EXISTS sensor_temp_c REAL;
