-- Seed: tenants, sites, machines and measurement points (spec 1.3, 2.3, 3.6; Beer HN pptx).
-- Gateway MQTT passwords are set by scripts/create_gateway.py (bcrypt), not here.
INSERT INTO tenants(id, name) VALUES
  ('hem', 'HEM – Động cơ điện Việt Nam'),
  ('beerhn', 'Bia Hà Nội')
ON CONFLICT DO NOTHING;

INSERT INTO sites(id, tenant_id, name, address, network) VALUES
  ('hem-factory', 'hem', 'Nhà máy HEM (pilot)', 'Hà Nội', 'lan'),
  ('namhong', 'hem', 'Trạm bơm Nam Hồng', 'Hà Nội', '4g'),
  ('beerhn-plant', 'beerhn', 'Nhà máy Bia Hà Nội – Máy nén lạnh', 'Hà Nội', 'lan')
ON CONFLICT DO NOTHING;

INSERT INTO gateways(id, site_id, mqtt_username) VALUES
  ('hem-gw-01', 'hem-factory', 'hem-gw-01'),
  ('dev-gw-01', 'hem-factory', 'dev-gw-01'),
  ('nh-gw-01', 'namhong', 'nh-gw-01'),
  ('beerhn-gw-01', 'beerhn-plant', 'beerhn-gw-01')
ON CONFLICT DO NOTHING;

-- 6322 geometry is [CẦN XÁC MINH]; row created so points can reference it.
INSERT INTO bearings(id, model, maker, n_balls, bd_mm, pd_mm, contact_deg) VALUES
  (1, '6322', 'SKF', NULL, NULL, NULL, 0),
  (2, '6313', 'SKF', 8, 25.4, 102.5, 0)
ON CONFLICT DO NOTHING;
SELECT setval('bearings_id_seq', (SELECT max(id) FROM bearings));

INSERT INTO machines(id, site_id, name, type, maker, model, rated_power_kw, rated_speed_rpm, poles, line_freq_hz,
  rated_voltage_v, rated_current_a, insulation_class, mounting, iso_group, foundation, iso_band_lo_hz, iso_band_hi_hz,
  thermal_params, male_lobes) VALUES
  ('ga55-01', 'hem-factory', 'Máy nén GA55 #1', 'compressor_motor', 'Atlas Copco', 'GA55', 55, 2978, 2, 50, 400, 100, 'F',
   'horizontal', 2, 'rigid', 10, 1000, '{"i_n_a":100,"dt_n_k":80,"a":0.25,"tau_run_s":2700,"k_neg":3,"c_frame":0.4}', NULL),
  ('ga55-02', 'hem-factory', 'Máy nén GA55 #2', 'compressor_motor', 'Atlas Copco', 'GA55', 55, 2978, 2, 50, 400, 100, 'F',
   'horizontal', 2, 'rigid', 10, 1000, '{"i_n_a":100,"dt_n_k":80,"a":0.25,"tau_run_s":2700,"k_neg":3,"c_frame":0.4}', NULL),
  ('pump-01', 'namhong', 'Bơm Nam Hồng #1', 'pump_motor', 'HEM', '4KA355M10', 110, 590, 10, 50, 380, 226, 'F',
   'vertical', 2, 'flexible', 2, 1000, '{"i_n_a":226,"dt_n_k":80,"a":0.25,"tau_run_s":3600,"k_neg":3}', NULL),
  ('pump-02', 'namhong', 'Bơm Nam Hồng #2', 'pump_motor', 'HEM', '4KA355M10', 110, 590, 10, 50, 380, 226, 'F',
   'vertical', 2, 'flexible', 2, 1000, '{"i_n_a":226,"dt_n_k":80,"a":0.25,"tau_run_s":3600,"k_neg":3}', NULL),
  ('pump-03', 'namhong', 'Bơm Nam Hồng #3', 'pump_motor', 'HEM', '4KA355M10', 110, 590, 10, 50, 380, 226, 'F',
   'vertical', 2, 'flexible', 2, 1000, '{"i_n_a":226,"dt_n_k":80,"a":0.25,"tau_run_s":3600,"k_neg":3}', NULL),
  ('mycom-01', 'beerhn-plant', 'MYCOM #1 – Honeywell HPM 450 kW', 'compressor_motor', 'Honeywell', 'HPM 450kW', 450, 2950, 2, 50,
   NULL, NULL, 'F', 'horizontal', 1, 'rigid', 10, 1000, '{"dt_n_k":80,"a":0.25,"tau_run_s":3600,"k_neg":3}', 4)
ON CONFLICT DO NOTHING;

UPDATE machines SET isolation = '{"enabled":true,"reference_point":"mycom-01-s2","source_point":"mycom-01-s1","targets":["mycom-01-s3","mycom-01-s4"],"criterion2_mode":"beerhn","alpha":{}}',
  band_limits = '[{"band":"1x","warn":1.5,"alarm":2.3},{"band":"2x","warn":1.0,"alarm":1.8},{"band":"3x4x","warn":0.8,"alarm":1.5},{"band":"bpfo","warn":0.5,"alarm":1.0},{"band":"bpfi","warn":0.4,"alarm":0.8}]'
WHERE id = 'mycom-01';

INSERT INTO measurement_points(id, machine_id, name, location, gateway_id, sensor_addr, axes_map, iso_axes, bearing_id, role) VALUES
  ('ga55-01-de',  'ga55-01', 'Ổ DE',  'de',  'hem-gw-01', 17, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'bearing'),
  ('ga55-01-nde', 'ga55-01', 'Ổ NDE', 'nde', 'hem-gw-01', 18, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'bearing'),
  ('ga55-02-de',  'ga55-02', 'Ổ DE',  'de',  'hem-gw-01', 33, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'bearing'),
  ('ga55-02-nde', 'ga55-02', 'Ổ NDE', 'nde', 'hem-gw-01', 34, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'bearing'),
  ('pump-01-top', 'pump-01', 'Ổ trên', 'nde_top', 'nh-gw-01', 49, '{"x":"radial_h","y":"radial_h2","z":"axial"}', '{x,y}', 1, 'bearing'),
  ('pump-01-bot', 'pump-01', 'Ổ dưới', 'de_bottom', 'nh-gw-01', 50, '{"x":"radial_h","y":"radial_h2","z":"axial"}', '{x,y}', 1, 'bearing'),
  ('pump-02-top', 'pump-02', 'Ổ trên', 'nde_top', 'nh-gw-01', 65, '{"x":"radial_h","y":"radial_h2","z":"axial"}', '{x,y}', 1, 'bearing'),
  ('pump-02-bot', 'pump-02', 'Ổ dưới', 'de_bottom', 'nh-gw-01', 66, '{"x":"radial_h","y":"radial_h2","z":"axial"}', '{x,y}', 1, 'bearing'),
  ('pump-03-top', 'pump-03', 'Ổ trên', 'nde_top', 'nh-gw-01', 81, '{"x":"radial_h","y":"radial_h2","z":"axial"}', '{x,y}', 1, 'bearing'),
  ('pump-03-bot', 'pump-03', 'Ổ dưới', 'de_bottom', 'nh-gw-01', 82, '{"x":"radial_h","y":"radial_h2","z":"axial"}', '{x,y}', 1, 'bearing'),
  ('mycom-01-s1', 'mycom-01', 'S1 – đỉnh máy nén', 'compressor_top', 'beerhn-gw-01', 65, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'source'),
  ('mycom-01-s2', 'mycom-01', 'S2 – tấm đỡ động cơ', 'base', 'beerhn-gw-01', 66, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'base'),
  ('mycom-01-s3', 'mycom-01', 'S3 – đỉnh động cơ DE', 'de', 'beerhn-gw-01', 67, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'bearing'),
  ('mycom-01-s4', 'mycom-01', 'S4 – đỉnh động cơ NDE', 'nde', 'beerhn-gw-01', 68, '{"x":"radial_h","y":"axial","z":"radial_v"}', '{x,z}', NULL, 'bearing')
ON CONFLICT DO NOTHING;

-- Default diagnosis/baseline parameters (spec 6.5; Beer HN slide 18).
INSERT INTO alarm_rules(scope, scope_id, rule, params, severity) VALUES
  ('global', NULL, 'baseline', '{"method":"mad","warn_k":3,"alarm_k":6,"min_samples_metrics":500,"min_samples_captures":200,"learn_days":[14,28]}', 'watch'),
  ('global', NULL, 'criterion2', '{"fraction_of_bc":0.25}', 'watch'),
  ('global', NULL, 'trend_rate', '{"days":7,"max_slope_pct_per_day":5}', 'watch'),
  ('global', NULL, 'anomaly', '{"min_days":60,"score_threshold":0.7,"consecutive":3}', 'warning'),
  ('global', NULL, 'diagnose', '{"unbalance_energy_ratio":0.7,"unbalance_axial_ratio":0.5,"unbalance_2x_ratio":0.3,"misalign_2x_ratio":0.5,"misalign_axial_ratio":0.5,"looseness_min_orders":4,"bearing_min_harmonics":2,"bearing_peak_floor":3,"electrical_unbalance_pct":5,"bearing_temp_confirm_c":90}', 'watch'),
  ('machine', 'mycom-01', 'baseline', '{"method":"sigma","warn_k":2,"alarm_k":3}', 'watch');
