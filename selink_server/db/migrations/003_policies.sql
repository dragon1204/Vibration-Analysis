-- Retention / compression (spec 6.2 "Chính sách lưu trữ")
SELECT add_continuous_aggregate_policy('vib_metrics_1h',
  start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '30 minutes');

ALTER TABLE vib_metrics SET (timescaledb.compress, timescaledb.compress_segmentby = 'point_id, axis');
SELECT add_compression_policy('vib_metrics', INTERVAL '7 days');
SELECT add_retention_policy('vib_metrics', INTERVAL '180 days');

ALTER TABLE power_metrics SET (timescaledb.compress, timescaledb.compress_segmentby = 'machine_id');
SELECT add_compression_policy('power_metrics', INTERVAL '7 days');
SELECT add_retention_policy('power_metrics', INTERVAL '365 days');

ALTER TABLE temp_metrics SET (timescaledb.compress, timescaledb.compress_segmentby = 'machine_id');
SELECT add_compression_policy('temp_metrics', INTERVAL '7 days');
SELECT add_retention_policy('temp_metrics', INTERVAL '365 days');

SELECT add_retention_policy('vib_energy', INTERVAL '180 days');
