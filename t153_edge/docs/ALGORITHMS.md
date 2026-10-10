# Thuật toán phân tích rung (edge + server)

Tài liệu tóm tắt các thuật toán được cài đặt. Nguồn: `SmartMotor_System_Spec.md` (mục 5.6–5.8, 6.4–6.5) và
`Beer HN Project.pptx` (phương pháp đa cảm biến cô lập nhiễu, ngưỡng dải hẹp SOP).
Cài đặt Go: `internal/dsp`, `internal/features`, `internal/rules`. Cài đặt Python (server, kiểm tra chéo):
`selink_server/services/smartmotor/common/dsp.py`.

## 1. Xử lý một capture (spec 5.6)

| Bước | Công thức | Code |
|---|---|---|
| Chuẩn bị | `a = int16/32768·16·9.80665`, bỏ DC, Hann | `dsp.ComputeSpectrum` |
| Phổ biên độ | `A_rms[k] = 2|X[k]|/Σw/√2` | `Spectrum.Amp` |
| PSD | `P[k] = 2|X[k]|²/(fs·Σw²)` | `Spectrum.PSD` |
| RMS dải | `√(Σ P·df)`; vận tốc `√(Σ P/(2πf)²·df)·1000` | `BandRMSAcc`, `BandRMSVel` |
| Dải ISO | GA55 10–1000 Hz; bơm 2–1000 Hz; trần `fs/2,56` | `features.Compute` |
| Nhiều frame | liền mạch → ghép; không → Welch (trung bình công suất) | `WelchAverage`, `FramesContiguous` |
| 1X | đỉnh trong ±3 % danh định, nội suy parabol log, đỉnh ≥ 3× nền | `EstimateSpeed` |
| Bậc | `√(Σ P·df)` trong `|f−k·f1X| ≤ max(2df, 2%)` → mm/s | `Orders` |
| Vòng bi | BPFO/BPFI/BSF/FTF từ hình học | `BearingGeometry.Frequencies` |
| Phổ bao | Butterworth HP4+LP4 filtfilt → Hilbert → |·| → Hann FFT (g, 0–500 Hz) | `Envelope` |
| Chỉ số thời gian | rms, peak, crest, kurtosis, skew | `ComputeTimeStats` |

## 2. Cô lập nhiễu đa cảm biến (Beer HN)

Bố trí: **S1** đỉnh máy nén (nguồn nhiễu), **S2** tấm đỡ động cơ (tham chiếu), **S3** đỉnh động cơ DE, **S4** NDE.

1. **Capture nhóm** (`machine.groupCapture`): S2 → S1 → S3 → S4 chụp liên tiếp cùng profile (`isolation.profile`).
   Vì chỉ dùng biên độ (không dùng pha) nên chụp tuần tự trên cùng bus RS485 là chấp nhận được.
2. **Tần số máy nén** (`dsp.DetectMesh`, phụ lục slide 7): quét phổ vận tốc S1 10–1000 Hz, bỏ 1X, lấy đỉnh trội;
   so với `male_lobes × 1X` (4 × 49,17 ≈ 196,7 Hz) và kiểm tra hài 2×, 3×.
3. **Học hệ số truyền α** (`dsp.LearnAlpha`, slide 3): khi chạy đầy tải (`load ≥ learn_min_load_pct`),
   thu `N = learn_samples` cặp phổ;
   `α(f_comp) = (1/N) Σ A_S3,i(f_comp)/A_S2,i(f_comp)` tại `f_mesh·h, h = 1..mesh_harmonics`.
   Lưu vào SQLite (`state: alpha/<machine>/<point>`) và gửi sự kiện `alpha_learned`; server có thể đẩy α qua config.
   Lệnh `learn_alpha` để học lại.
4. **Cô lập** (`dsp.Isolate`, slide 2): `A_iso(f) = √(A_S3(f)² − (α(f)·A_S2(f))²)`, **= 0 nếu âm**.
   α(f) nội suy log-tần số giữa các điểm học; ngoài dải giữ giá trị biên. PSD được nhân cùng tỷ lệ.
5. **Đối chiếu chéo S1** (`dsp.TransmittedFromSource`, slide 4): với 5 đỉnh lớn nhất của A_iso, nếu S1 có đỉnh
   cùng tần số (±2 bin), nổi ≥ 3× nền và ≥ `source_peak_ratio` × đỉnh S3 → *nhiễu truyền từ máy nén* (bỏ qua);
   ngược lại → *đỉnh cục bộ* (lỗi thật ở động cơ). Kết quả trong `features.isolation.transmitted_peaks / local_peaks`.
6. **Mức nghiêm trọng** (slide 11): `RMS_iso = √Σ A_iso²` dải 10–1000 Hz → Zone theo ISO 20816-3
   (nhóm 1 > 300 kW: 2,3 / 4,5 / 7,1 mm/s cứng). Đánh giá máy = điểm đo **xấu nhất** (server).
7. **Criterion II**: `criterion2_mode: beerhn` → `|RMS(t) − RMS(t−1)| > 0,25 × (B/C − A/B)`;
   `spec` → `|RMS − baseline| > 0,25 × B/C` (ISO 20816-1, server).

## 3. Ngưỡng dải hẹp (slide 18–21)

* Lớp 1: ISO 20816-3 (tổng dải rộng). Lớp 2: chọn dải 1X / 2X / 3X-4X / BPFO / BPFI (ISO 13373-2, VDI 3839).
  Lớp 3: ngưỡng số từ baseline: `Warning = μ + 2σ`, `Alarm = μ + 3σ` (`rules.BaselineLimits("sigma")`).
  Spec 6.4 dùng median/MAD (`"mad"`): server chọn qua `alarm_rules.params.method`.
* Bảng SOP minh họa (`rules.DefaultBandLimits`, mm/s): 1X 1,5/2,3 · 2X 1,0/1,8 · 3X4X 0,8/1,5 · BPFO 0,5/1,0 · BPFI 0,4/0,8.
* **Ràng buộc RSS** (`rules.EnforceRSS`): `√Σ Alarm_i² ≤ Zone B/C`; nếu vi phạm, nhân mọi ngưỡng với
  `B/C / RSS`. Bật bằng `rules.band_limits_enforce_rss: true`.
* Ánh xạ mức: vượt Warning dải → `watch`; vượt Alarm dải → `warning` (rule `band`, metric `<band>.<axis>`).

## 4. Quét chẩn đoán (server `analytics/diagnose.py`, slide 12–15, spec 6.5)

Kích hoạt khi RMS ≥ Zone B hoặc có sự kiện:

| Lỗi | Điều kiện |
|---|---|
| Mất cân bằng | 1X hướng kính trội (≥ 70 % năng lượng), dọc trục < 50 % hướng kính, 2X < 30 % 1X |
| Lệch tâm / trục cong | 2X ≥ 0,5 × 1X (mạnh khi 2X ≥ 1X); 1X/2X dọc trục ≥ 0,5 × hướng kính |
| Lỏng cơ khí | ≥ 4 bậc 1..6 vượt nền; có 0,5X hoặc 1,5X |
| Vòng bi BPFO/BPFI/BSF/FTF | phổ bao có đỉnh ±2 bin, ≥ 2 hài, đỉnh/nền ≥ 3; kurtosis > 4 |
| Lỗi điện stator | đỉnh 2×f_line (100 Hz) mạnh, mất cân bằng dòng > 5 % |
| Mòn thùy máy nén | thành phần f_mesh tăng đột biến theo thời gian (so baseline) |
| Nhiễu truyền | đỉnh có mặt mạnh ở S1 → loại khỏi bằng chứng |
| Xác thực nhiệt | lỗi vòng bi **và** nhiệt ổ > 90 °C → tăng độ tin cậy, nâng mức |

## 5. Khác biệt có chủ ý so với spec

Xem `docs/CHANGELOG.md`.
