# CHANGELOG – thay đổi/bổ sung so với SmartMotor_System_Spec.md v1.0

Theo quy ước 0.2.2 của spec: mọi thay đổi hợp đồng dữ liệu được ghi ở đây.

## 0.1.0 (2026-10-09)

### Sửa công thức
- **Biên độ bậc (5.6.5)**: spec ghi `amp_k = √(Σ A_rms[f]²)`. Với cửa sổ Hann, tổng bình phương biên độ trên
  búp chính lớn hơn giá trị thật √1,5 lần (ENBW = 1,5 bin) → sai ~22 %. Cài đặt dùng
  `amp_k = √(Σ P[k]·df)` (PSD đã hiệu chỉnh năng lượng), cho sai số < 1 % với sóng sin (test `TestWelchAndOrders`).
- **Bandpass phổ bao (5.6.7)**: "Butterworth bậc 4" được hiện thực bằng HP bậc 4 tại f_lo nối tiếp LP bậc 4 tại
  f_hi (bilinear + pre-warp), filtfilt với odd-padding và điều kiện đầu như `scipy.signal.sosfiltfilt`.
  Server dùng đúng cùng thiết kế để golden test khớp.

### Bổ sung hợp đồng dữ liệu (không đổi trường cũ)
- `features/<point>`: thêm `machine_id`, `msg_id`, `axes.<a>.line_2x_mm_s`, `axes.<a>.mesh_mm_s`,
  `envelope.{band_hz, df_hz, fault_freqs_hz, axes.<a>.{faults, *_env_g}}`, và khối `isolation` (Beer HN).
- `metrics/vibstat/<point>` (spec không cho mẫu): `{msg_id, ts, point_id, sr_code, mode, axes:{x:{crest, kurtosis,
  acc_abs_mean_g, acc_var, acc_rms_g, wave_index, peak_index, pulse_coef, skew, vel_rms_mm_s, vel_kurt, disp_rms_mm,
  err_code}}, flags}`. `ts` trùng mốc cửa sổ với `metrics/vib` để ingest gộp vào cùng hàng `vib_metrics`.
- `metrics/vibenergy/<point>`: `{msg_id, ts, point_id, axes:{x:{points[8], areas[6], total}}}`.
- `spectrum/<point>`: `{msg_id, capture_id, point_id, ts, encoding:"json+gzip+base64", data}`; `data` giải ra
  `{capture_id, fs_hz, n_fft, df_hz, speed_hz, acc_unit:"m_s2_rms", acc:{x:[...]}, env:{df_hz, amp_g:{x:[...]}}, markers}`.
- `metrics/vib`: thêm `samples`, `time_unsynced`.
- `metrics/temp`: thêm `bearing_temp_c` (cột đã có trong DDL `temp_metrics`).
- `events`: thêm `source: "edge"`; loại sự kiện hệ thống: `agent_started`, `alpha_learned`, `config_applied`,
  `config_rejected`, `capture_skipped_flash_budget`, `device_offline`, `flatline`, `power_meter_offline`.
- `cmd`: thêm loại `learn_alpha` (`params.machine_id`), `group_capture` (`params.machine_id`);
  `set_sensor_param` dùng `params:{reg, value, persist}`.
- `edge.yaml`: thêm `version`, `temp_modules`, `log`, `health`, `intervals`, `machines[].male_lobes`,
  `machines[].isolation`, `machines[].band_limits`, `points[].role (bearing|base|source)`, `points[].calibration`,
  `points[].baselines`, `points[].contiguity`, `rules.kurtosis_watch|rate_factor|rate_window_s|event_capture_min_gap_s|band_limits_enforce_rss`,
  `power_meter.driver: sim`, `bus.device: tcp://...` (dùng với sensor-sim hoặc bộ chuyển RS485-Ethernet).

### Hành vi
- Máy bật `isolation`: cảnh báo vùng ISO lấy từ RMS **đã cô lập**, không dùng VRMS thô của cảm biến
  (vì còn nhiễu máy nén). Điểm `role: base|source` không phát cảnh báo ISO.
- OTA: agent tự xóa `<binary>.pending` khi kết nối MQTT; init script rollback về `.prev` nếu sau 5 phút file còn.

### Server / hạ tầng (selink_server)
- **Object storage**: image `minio/minio` đã bị gỡ khỏi Docker Hub (không pull được) → dùng **SeaweedFS 3.80**
  (S3 API, service `s3`). Code vẫn dùng S3 client (`minio` Python), biến môi trường giữ tên `MINIO_*`.
  Có thể thay lại bằng MinIO/S3 bất kỳ chỉ bằng `MINIO_ENDPOINT`.
- **EMQX ACL**: ngoài HTTP authorizer (API) có thêm ACL file dự phòng (`emqx/acl.conf`) và `deny_action = disconnect`.
  Lý do (phát hiện khi test e2e): khi API khởi động lại, ACL HTTP lỗi → `deny` + `ignore` làm EMQX vẫn PUBACK nhưng
  bỏ bản tin → edge xóa khỏi outbox → mất dữ liệu. Sau sửa: tắt API 45 s không mất cửa sổ 10 s nào.
- Cổng host cấu hình được: `HTTP_PORT`, `HTTPS_PORT`, `MQTT_TLS_PORT`, `MQTT_DEV_PORT`.
- Bảng/cột bổ sung: xem `selink_server/README.md`.

### Edge (sau test e2e)
- Học α chỉ nhận mẫu khi đỉnh tham chiếu (S2) tại f nổi ≥ 3× nền (tránh α rác ở hài không tồn tại).
- Capture sự kiện tại điểm thuộc nhóm cô lập nhiễu → chạy capture nhóm (P0) để có A_iso.
- Mô hình nhiệt chờ số đo nhiệt vỏ đầu tiên (≤ 5 phút) để khởi tạo ΔT₀ = (T_vỏ − T_mt)/c_frame (spec 5.7).
