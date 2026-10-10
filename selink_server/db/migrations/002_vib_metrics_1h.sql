-- Continuous aggregate (must run outside a transaction: single statement file)
CREATE MATERIALIZED VIEW vib_metrics_1h WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', ts) AS bucket, point_id, axis,
       avg(vel_mm_s) AS vel_avg, max(vel_mm_s_max) AS vel_max,
       avg(acc_rms_g) AS acc_rms_avg, max(kurtosis) AS kurt_max, avg(temp_c) AS temp_avg,
       avg(vel_rms_mm_s) AS vel_rms_avg
FROM vib_metrics GROUP BY bucket, point_id, axis WITH NO DATA;
