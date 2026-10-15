# THUYẾT MINH KỸ THUẬT THUẬT TOÁN ƯỚC LƯỢNG RUL

## Hệ thống giám sát tình trạng động cơ điện HEM Smart Motor

**Phiên bản thuật toán:** `rul-exp-theilsen-v2`  
**Phạm vi:** Động cơ quay được giám sát bằng rung động  
**Mục đích tài liệu:** Trình bày, phản biện và định hướng kiểm chứng khoa học  
**Ngày lập:** 15/10/2026

---

## 1. Tóm tắt điều hành

Thuật toán hiện tại ước lượng thời gian còn lại cho đến khi một chỉ báo rung vượt **ngưỡng cảnh báo đã học từ baseline**. Vì vậy, đại lượng đầu ra chính xác hơn nên được gọi là:

> **Thời gian có điều kiện đến ngưỡng cảnh báo** (*conditional time-to-alarm threshold*), không phải tuổi thọ vật lý còn lại đã được chứng nhận của động cơ.

Thuật toán thuộc nhóm dự báo dựa trên xu hướng (*data-driven trend extrapolation*). Với mỗi điểm đo và mỗi đặc trưng ứng viên, thuật toán:

1. Chọn dữ liệu sạch trong 180 ngày gần nhất.
2. Chuẩn hóa điều kiện vận hành theo tải và tốc độ.
3. Giảm ảnh hưởng của tần suất lấy mẫu bằng cách lấy tối đa một capture mỗi 15 phút và trung vị theo ngày.
4. Mô hình hóa tăng trưởng chỉ báo theo hàm mũ:

   ```text
   y(t) = exp(a + b·t)
   ln(y(t)) = a + b·t
   ```

5. Ước lượng `a`, `b` bằng hồi quy Theil–Sen bền vững với ngoại lai.
6. Chỉ công bố RUL khi xu hướng tăng có ý nghĩa và đạt các tiêu chí chất lượng.
7. Tính thời điểm cắt ngưỡng và dùng residual bootstrap để lượng hóa bất định.
8. Nếu nhiều đặc trưng hợp lệ, chọn RUL nhỏ nhất làm kết quả bảo thủ cấp máy.

Điểm mạnh của cách tiếp cận là dễ giải thích, ít nhạy với ngoại lai hơn OLS và phù hợp khi chưa có dữ liệu *run-to-failure*. Điểm hạn chế là chưa mô hình hóa đầy đủ tải tương lai, độ bất định của ngưỡng, thay đổi chế độ vận hành và cơ chế hư hỏng vật lý. Kết quả hiện tại nên được dùng để **ưu tiên kiểm tra/bảo trì**, không dùng độc lập để quyết định an toàn.

---

## 2. Định nghĩa bài toán

### 2.1. RUL trong hệ thống này là gì?

Tại thời điểm dự báo `t_n`, với chỉ báo sức khỏe `y(t)` và ngưỡng cảnh báo `H`, hệ thống tìm thời điểm đầu tiên `t_H` sao cho:

```text
y(t_H) ≥ H
```

Giá trị dự báo là:

```text
RUL_dự_báo = max(t_H − t_n, 0)
```

Theo cách định nghĩa này, “end of life” của mô hình là **đạt ngưỡng cảnh báo baseline**, không đồng nhất với hỏng cơ khí. Cách diễn giải này phù hợp với quan điểm PHM rằng dự báo RUL cần ba thành phần: trạng thái hiện tại, mô hình phát triển tương lai và ngưỡng kết thúc. NASA cũng nhấn mạnh RUL là một bài toán lan truyền bất định, chịu ảnh hưởng của sai số đo, sai số mô hình và điều kiện khai thác tương lai.

### 2.2. Đơn vị phân tích

Thuật toán xét các candidate theo bộ ba:

```text
candidate = (point_id, feature, load_bin)
```

Ba nhóm đặc trưng được phép tham gia:

- `iso_vrms_mm_s`: vận tốc rung RMS theo dải ISO, đại diện mức rung tổng thể;
- `env.bpfo`: biên độ phổ bao tại tần số lỗi vòng ngoài ổ lăn;
- `env.bpfi`: biên độ phổ bao tại tần số lỗi vòng trong ổ lăn.

Mỗi candidate sử dụng ngưỡng `alarm` của baseline tương ứng. Kết quả cấp máy là candidate có RUL nhỏ nhất trong số các candidate hợp lệ.

---

## 3. Dữ liệu đầu vào và điều kiện tiên quyết

### 3.1. Baseline

Baseline được học từ giai đoạn đầu sau khi lắp đặt hoặc sau lần bảo trì có yêu cầu reset. Cửa sổ học mặc định kết thúc không muộn hơn 28 ngày kể từ mốc bắt đầu.

Dữ liệu baseline phải thỏa:

- Máy đang chạy: `running = true`;
- Có vector đặc trưng: `features IS NOT NULL`;
- Không nằm gần cảnh báo mức `warning` hoặc `danger` trong khoảng ±1 giờ;
- Không mang cờ chất lượng loại trừ: `saturated`, `flatline`, `spike`, `time_unsynced`, `speed_low_confidence`.

Ngưỡng được xây dựng từ thống kê bền vững trung vị/MAD hoặc trung bình/độ lệch chuẩn tùy cấu hình. Với đặc trưng capture, baseline chuyển sang `active` khi có ít nhất 200 mẫu; với metric liên tục là 500 mẫu.

### 3.2. Dữ liệu xu hướng RUL

Cho mỗi điểm đo, truy vấn các capture trong 180 ngày gần nhất với các điều kiện:

- `running = true`;
- `features IS NOT NULL`;
- không có cờ chất lượng bị loại;
- đúng `load_bin` của baseline, trừ baseline `all`;
- giá trị đặc trưng hữu hạn và dương.

Để tránh một đợt commissioning lấy mẫu dày chi phối lịch sử nhiều tháng, hệ thống chỉ giữ capture mới nhất của mỗi bucket 15 phút.

### 3.3. Đồng nhất chế độ tốc độ

Nếu ít nhất `max(10, 0.8 × N)` mẫu có tốc độ hợp lệ, thuật toán xác định tốc độ trung tâm:

```text
f_c = median(f_i)
```

và chỉ giữ mẫu thỏa:

```text
|f_i − f_c| ≤ max(0.5 Hz, 0.05 × f_c)
```

Mục đích là không trộn các phân bố rung thuộc những chế độ quay khác nhau.

---

## 4. Tiền xử lý chuỗi thời gian

### 4.1. Điều kiện tối thiểu

Sau lọc, candidate cần:

- ít nhất 30 mẫu thô;
- ít nhất 10 bin thời gian khác nhau;
- độ dài quan sát tối thiểu 14 ngày.

Các ngưỡng này là *engineering safeguards* của implementation, chưa phải hằng số phổ quát. Chúng cần được hiệu chỉnh bằng dữ liệu thực nghiệm của đối tượng máy cụ thể.

### 4.2. Trung vị theo ngày

Các capture được gom theo bucket một ngày tính từ thời điểm đầu chuỗi. Với bucket `B_k`:

```text
t_tilde_k = median(t_i), với i thuộc B_k
y_tilde_k = median(y_i), với i thuộc B_k
```

Việc này có ba mục tiêu:

- giảm tự tương quan do lấy mẫu dày;
- giảm ảnh hưởng của các xung nhiễu ngắn hạn;
- khiến từng ngày có trọng số gần tương đương trong hồi quy.

---

## 5. Mô hình suy giảm

### 5.1. Giả định tăng trưởng hàm mũ

Mô hình giả định chỉ báo rung dương tăng theo:

```text
y(t) = exp(a + b·t)
```

tương đương mô hình tuyến tính trong miền log:

```text
z(t) = ln(y(t)) = a + b × t + epsilon(t)
```

Ý nghĩa tham số:

- `a`: mức log-ban-đầu của chỉ báo;
- `b`: tốc độ tăng tương đối mỗi ngày;
- `b > 0`: dấu hiệu suy giảm theo giả định của mô hình.

Mô hình hàm mũ thích hợp khi tốc độ tăng của chỉ báo tỷ lệ với mức hiện tại. Đây là một mô hình thực dụng, chưa phải mô hình động lực học hư hỏng ổ lăn hoặc rotor.

### 5.2. Hồi quy Theil–Sen

Thay vì OLS, implementation dùng ước lượng Theil–Sen. Về trực giác, hệ số dốc được xây dựng từ trung vị các độ dốc cặp:

```text
b_hat = median[(z_j − z_i) / (t_j − t_i)], với mọi cặp i < j
```

Ước lượng này ít nhạy với các điểm ngoại lai lớn và không đòi hỏi giả định Gaussian chặt như OLS. Nền tảng phương pháp xuất phát từ Theil (1950) và Sen (1968).

### 5.3. Loại ngoại lai theo residual

Sau fit sơ bộ, residual là:

```text
r_i = z_i − (a_hat + b_hat × t_i)
```

Độ phân tán bền vững:

```text
s_r = max(1.4826 × median(|r_i − median(r)|), 10⁻⁹)
```

Mẫu bị loại nếu:

```text
|r_i − median(r)| > 4 × s_r
```

Sau đó mô hình Theil–Sen được fit lại. Nếu còn dưới 10 bin thì candidate bị từ chối.

---

## 6. Cổng chất lượng trước khi công bố RUL

Thuật toán không luôn ép sinh ra một con số. Candidate chỉ được chấp nhận nếu đồng thời thỏa:

1. **Xu hướng dương:** `b_hat > 0`.
2. **Cận dưới 95% của dốc dương:** `low_slope > 0`.
3. **Độ phù hợp:**

   ```text
   R² = 1 − Σ(z_i − z_hat_i)² / Σ(z_i − z_mean)² ≥ 0.7
   ```

4. **Đơn điệu đủ mạnh:** Kendall `τ ≥ 0.5`.
5. **Ý nghĩa thống kê:** `p ≤ 0.05` cho kiểm định Kendall.
6. **Chân trời hợp lý:** RUL không vượt 3.650 ngày.

Nếu không thỏa, hệ thống trả về trạng thái giải thích thay vì một giá trị giả chính xác, ví dụ:

- `insufficient_samples`;
- `insufficient_time_bins`;
- `insufficient_span`;
- `no_significant_positive_trend`;
- `poor_fit`;
- `weak_monotonic_trend`;
- `too_many_outliers`;
- `horizon_too_long`.

Việc trả về “không đủ bằng chứng để dự báo” là một đặc tính an toàn của thuật toán. Máy ổn định không có xu hướng tăng rõ không nên bị ép gán RUL.

---

## 7. Tính RUL bằng giao điểm với ngưỡng

Với ngưỡng cảnh báo `H > 0`:

```text
ln(H) = a_hat + b_hat × t_H
```

Do đó:

```text
t_H = [ln(H) − a_hat] / b_hat
```

và:

```text
RUL_dự_báo = max([ln(H) − a_hat] / b_hat − t_n, 0)
```

Nếu giá trị mới nhất đã vượt ngưỡng, hệ thống trả `RUL = 0` với trạng thái `threshold_reached`.

### Ví dụ minh họa

Giả sử mô hình sau fit cho:

- `a_hat = ln(1.5)`;
- `b_hat = 0.02 ngày⁻¹`;
- thời điểm hiện tại quy đổi `t_n = 30 ngày`;
- ngưỡng `H = 4.5 mm/s`.

Khi đó:

```text
t_H = [ln(4.5) − ln(1.5)] / 0.02
    = ln(3) / 0.02
    ≈ 54.93 ngày

RUL_dự_báo = 54.93 − 30 ≈ 24.93 ngày
```

Diễn giải đúng: nếu chế độ vận hành và xu hướng hiện tại tiếp tục, chỉ báo được dự báo chạm ngưỡng alarm sau khoảng 25 ngày.

---

## 8. Lượng hóa bất định

Implementation thực hiện residual bootstrap với 500 lần lặp:

1. Tính đường dự báo `z_hat_i = a_hat + b_hat × t_i`.
2. Tâm hóa residual `e_i = z_i − z_hat_i`.
3. Lấy mẫu có hoàn lại từ tập residual để sinh:

   ```text
   z_i* = z_hat_i + e_i*
   ```

4. Fit Theil–Sen trên mỗi chuỗi bootstrap.
5. Giữ các lần có dốc dương và tính `RUL*`.
6. Yêu cầu ít nhất 250/500 lần bootstrap hợp lệ.

Code hiện lấy phân vị 10% và 90% của phân bố bootstrap:

```text
[P10(RUL*), P90(RUL*)]
```

Độ tin cậy định tính được gán theo `R²` và độ rộng tương đối của khoảng:

```text
w_r = (RUL_hi − RUL_lo) / max(RUL, 1)
```

- `high`: `R² ≥ 0.85` và `w_r ≤ 0.5`;
- `medium`: `w_r ≤ 1`;
- `low`: các trường hợp còn lại.

### Lưu ý khoa học quan trọng

Giao diện hiện ghi “cận dưới/cận trên 95%”, nhưng phân vị 10%–90% tạo **khoảng trung tâm 80%**, không phải 95%. Trước khi báo cáo chính thức cần chọn một trong hai cách:

- đổi code thành phân vị 2,5%–97,5%; hoặc
- giữ code và đổi nhãn giao diện/tài liệu thành “khoảng dự báo bootstrap 80%”.

Ngoài ra, residual bootstrap hiện chỉ phản ánh một phần bất định của đường xu hướng. Nó chưa lan truyền đầy đủ:

- bất định của ngưỡng baseline;
- sai số cảm biến và xử lý tín hiệu;
- thay đổi tải/tốc độ tương lai;
- thay đổi chế độ suy giảm;
- sai số do chọn mô hình hàm mũ.

---

## 9. Hợp nhất kết quả cấp máy

Giả sử máy có tập candidate hợp lệ `C`, kết quả cấp máy là:

```text
RUL_machine = min(RUL_c), với c thuộc C
```

Đây là quy tắc bảo thủ: điểm đo/đặc trưng được dự báo chạm ngưỡng sớm nhất chi phối khuyến nghị. Kết quả lưu kèm đầy đủ candidate để truy vết.

Nếu không candidate nào hợp lệ:

- không có baseline hợp lệ: `no_active_baseline`;
- có baseline nhưng không có xu hướng đạt chuẩn: `no_reliable_trend`.

---

## 10. Kiến trúc thực thi

Luồng nghiệp vụ:

```text
Gateway/cảm biến
      │ MQTT: features/capture
      ▼
Ingest ──► PostgreSQL/TimescaleDB
      │
      ▼
Analytics service
  ├─ học baseline: 02:00 hằng ngày
  ├─ tính RUL:      04:00 hằng ngày
  └─ chạy thủ công qua Redis command
      │
      ▼
machine_health
      │ REST API
      ▼
Trang RUL / Overview
```

Job RUL ghi một record cho mọi máy trong mỗi lần chạy, kể cả khi không tính được. Cách làm này ngăn một ước lượng cũ tiếp tục hiển thị sau khi xu hướng mới không còn đủ tin cậy.

---

## 11. Đánh giá khoa học

### 11.1. Điểm mạnh

- **Giải thích được:** công thức, ngưỡng và nguyên nhân từ chối đều rõ.
- **Bền vững với ngoại lai:** dùng trung vị, MAD và Theil–Sen.
- **Không ép kết quả:** có các cổng chất lượng thống kê.
- **Giảm lệch lấy mẫu:** bucket 15 phút và trung vị ngày.
- **Có điều kiện vận hành:** tách load bin và lọc chế độ tốc độ.
- **Có lượng hóa bất định sơ bộ:** bootstrap thay vì chỉ trả một ước lượng điểm.
- **Không cần dữ liệu hỏng hoàn toàn:** phù hợp giai đoạn triển khai ban đầu khi thiếu nhãn run-to-failure.

### 11.2. Giới hạn

1. **Không phải RUL vật lý đến hỏng hóc.** Đích là ngưỡng alarm thống kê.
2. **Giả định hàm mũ cố định.** Xu hướng rung có thể phi tuyến từng đoạn hoặc thay đổi sau bảo trì.
3. **Điều kiện tương lai bị coi như quá khứ.** Không có mô hình lịch tải tương lai.
4. **Ngưỡng được coi là xác định.** Trong thực tế baseline cũng có phân bố bất định.
5. **Residual có thể không độc lập/đồng phương sai.** Trung vị ngày giảm nhưng không loại bỏ hoàn toàn tự tương quan.
6. **Chọn giá trị nhỏ nhất gây thiên lệch bảo thủ.** Khi số candidate tăng, xác suất có một dự báo thấp bất thường cũng tăng.
7. **Chưa hiệu chuẩn xác suất.** Khoảng bootstrap chưa được kiểm tra coverage trên dữ liệu ngoài mẫu.
8. **Chưa có kiểm chứng run-to-failure.** Không thể tuyên bố độ chính xác tuổi thọ nếu chưa có ground truth sự cố.

---

## 12. Phát hiện cần sửa trước khi bảo vệ/chuyển giao

### 12.1. Sai nhãn khoảng bất định

**Hiện trạng:** backend dùng P10–P90 nhưng frontend ghi 95%.  
**Mức độ:** cao đối với tính trung thực khoa học.  
**Khuyến nghị:** thống nhất về 95% (P2.5–P97.5) hoặc đổi toàn bộ nhãn sang 80%.

### 12.2. Baseline `frozen` không được job RUL sử dụng

UI quản trị xem `active` và `frozen` đều là baseline hợp lệ, nhưng truy vấn RUL chỉ chọn `status='active'`. Vì vậy, khi chuyên gia khóa baseline bằng `frozen`, RUL có thể báo `no_active_baseline`.

**Khuyến nghị:** nếu `frozen` mang nghĩa “đã duyệt và không tự cập nhật”, truy vấn RUL nên dùng:

```sql
WHERE status IN ('active', 'frozen')
```

và frontend RUL cũng phải coi `frozen` là hợp lệ.

### 12.3. Trải nghiệm chạy thủ công

Nút “Tính lại RUL” gửi lệnh bất đồng bộ cho toàn bộ máy nhưng frontend chỉ chờ 2,5 giây rồi refetch một lần. Với nhiều máy, job có thể chưa hoàn thành nên người dùng vẫn thấy kết quả cũ.

**Khuyến nghị:** thêm `job_id`, trạng thái job, timestamp hoàn thành và polling/WebSocket đến khi hoàn tất.

### 12.4. Ngưỡng chất lượng là cấu hình kỹ thuật, chưa được hiệu chuẩn

Các ngưỡng 30 mẫu, 10 ngày, 14 ngày, `R² = 0.7`, `τ = 0.5`, 3.650 ngày cần được xem là giả thuyết thiết kế. Phải thực hiện sensitivity analysis và validation trước khi coi là tiêu chuẩn vận hành.

---

## 13. Kế hoạch kiểm chứng đề xuất

### 13.1. Kiểm thử mức hàm

Các ca bắt buộc:

- Chuỗi hàm mũ sạch: phục hồi đúng RUL trong sai số cho phép.
- Chuỗi suy giảm âm/ổn định: không sinh RUL.
- Chưa đủ số mẫu hoặc thời gian: trả đúng trạng thái.
- Có ngoại lai lớn: kết quả bền vững.
- Đã vượt ngưỡng: RUL bằng 0.
- Ngưỡng không hợp lệ: từ chối.

Repository hiện đã có các kiểm thử nền tảng cho các trường hợp trên trong `services/tests/test_rul.py`.

### 13.2. Backtesting theo thời gian

Với mỗi chuỗi lịch sử đủ dài:

1. Chọn nhiều thời điểm cắt `t_k`.
2. Chỉ sử dụng dữ liệu trước `t_k` để dự báo.
3. So sánh thời điểm chạm ngưỡng dự báo với thời điểm quan sát thực tế.
4. Báo cáo MAE, median absolute error và sai số bất đối xứng.
5. Đánh giá coverage của khoảng dự báo 80% hoặc 95%.

Không được chia train/test ngẫu nhiên vì sẽ gây rò rỉ thời gian.

### 13.3. Chỉ số đánh giá

- **MAE của thời gian đến ngưỡng**;
- **Median AE**, ít nhạy ngoại lai;
- **Prediction interval coverage probability**;
- **Mean/median interval width**;
- **Tỷ lệ dự báo sớm và muộn**;
- **Lead time hữu ích cho bảo trì**;
- **Tỷ lệ abstention**: số lần thuật toán từ chối dự báo;
- **Stability**: độ dao động của RUL giữa hai ngày liên tiếp.

Trong bảo trì dự báo, dự báo muộn thường nguy hiểm hơn dự báo sớm. Vì vậy nên bổ sung hàm mất mát bất đối xứng theo chi phí vận hành.

### 13.4. Thiết kế dữ liệu thực nghiệm

Nên thu thập:

- dữ liệu dài hạn của nhiều máy cùng chủng loại;
- tải, tốc độ, nhiệt độ và trạng thái vận hành;
- nhật ký bảo trì chính xác;
- xác nhận lỗi bởi chuyên gia;
- dữ liệu trước và sau thay ổ bi/cân bằng/căn chỉnh;
- nếu có thể, thử nghiệm accelerated degradation hoặc run-to-threshold có kiểm soát.

---

## 14. Hướng phát triển

### Giai đoạn 1 — Chuẩn hóa implementation

- Sửa khoảng 80%/95% và xử lý baseline `frozen`.
- Thêm trạng thái job và audit đầy đủ.
- Version hóa model, tham số và ngưỡng.
- Lưu snapshot dữ liệu dùng cho từng lần dự báo.

### Giai đoạn 2 — Hiệu chuẩn thống kê

- Walk-forward backtesting.
- Bootstrap theo block ngày thay cho residual độc lập nếu còn tự tương quan.
- Lan truyền bất định baseline.
- Sensitivity analysis cho mọi cổng chất lượng.
- Hiệu chuẩn interval coverage.

### Giai đoạn 3 — Mô hình nâng cao

- Mô hình phân cấp theo loại máy/điểm đo;
- state-space/Bayesian degradation model;
- change-point detection sau bảo trì hoặc thay đổi chế độ;
- survival analysis khi có dữ liệu kiểm duyệt;
- mô hình vật lý–dữ liệu lai khi có kiến thức cơ chế hư hỏng.

Mô hình phức tạp hơn chỉ nên triển khai nếu backtesting chứng minh cải thiện so với baseline Theil–Sen hiện tại.

---

## 15. Các câu hỏi phản biện dự kiến

**1. Tại sao dùng hàm mũ?**  
Vì nó mô tả tốc độ tăng tương đối và tuyến tính hóa được trong miền log, phù hợp cho một baseline giải thích được. Đây là giả thuyết cần kiểm chứng, không phải định luật hư hỏng phổ quát.

**2. Tại sao dùng Theil–Sen thay OLS?**  
Dữ liệu rung dễ có outlier và phân phối residual không chuẩn. Theil–Sen bền vững hơn trong khi vẫn cho hệ số dốc có diễn giải trực tiếp.

**3. Vì sao RUL không luôn xuất hiện?**  
Thuật toán có cơ chế abstention. Không đủ dữ liệu hoặc không có xu hướng tăng đáng tin cậy thì việc không dự báo khoa học hơn việc xuất một con số thiếu căn cứ.

**4. Đây có phải tuổi thọ ổ bi không?**  
Không. Đây là thời gian có điều kiện đến ngưỡng cảnh báo của đặc trưng rung. Muốn tuyên bố tuổi thọ ổ bi cần mô hình failure threshold và validation run-to-failure.

**5. Khoảng tin cậy có bao phủ mọi bất định không?**  
Chưa. Bootstrap hiện chủ yếu phản ánh residual của mô hình xu hướng, chưa bao phủ bất định tải tương lai, ngưỡng và model form.

**6. Vì sao chọn RUL nhỏ nhất?**  
Đó là lựa chọn bảo thủ cho vận hành. Tuy nhiên cần kiểm soát multiple-candidate bias và luôn hiển thị candidate chi phối.

**7. Có thể dùng deep learning không?**  
Có, nhưng chỉ hợp lý khi có đủ dữ liệu đa máy và nhãn lịch sử. Với dữ liệu hiện tại, mô hình đơn giản, kiểm chứng được và biết từ chối thường đáng tin cậy hơn.

---

## 16. Dàn ý trình bày 12 slide

1. Bài toán bảo trì dự báo và định nghĩa RUL.
2. Phạm vi tuyên bố: time-to-alarm, không phải certified failure life.
3. Kiến trúc dữ liệu từ cảm biến đến RUL.
4. Đặc trưng rung và baseline alarm.
5. Lọc dữ liệu theo chất lượng, tải và tốc độ.
6. Mô hình hàm mũ trong miền log.
7. Theil–Sen và xử lý ngoại lai.
8. Các cổng chất lượng thống kê.
9. Công thức giao ngưỡng và ví dụ số.
10. Bootstrap và bất định.
11. Kết quả kiểm thử, kế hoạch backtesting.
12. Hạn chế, phát hiện audit và lộ trình nghiên cứu.

---

## 17. Ánh xạ sang mã nguồn

- Thuật toán RUL và bootstrap: `services/smartmotor/analytics/anomaly.py`, hàm `rul_exponential`.
- Lựa chọn dữ liệu và hợp nhất candidate: `services/smartmotor/analytics/service.py`, hàm `job_rul_estimate`.
- Học baseline: `services/smartmotor/analytics/service.py`, hàm `job_baseline_learn`.
- Trích xuất feature: `services/smartmotor/analytics/baseline.py`, hàm `extract_capture_features`.
- API đọc RUL: `services/smartmotor/api/routers/machines.py`, endpoint `/machines/{machine_id}/diagnosis` và `/health`.
- Giao diện: `web/src/pages/Rul.tsx`.
- Kiểm thử: `services/tests/test_rul.py`.

---

## 18. Tài liệu tham khảo

1. Theil, H. (1950), *A Rank-invariant Method of Linear and Polynomial Regression Analysis*. [CWI repository](https://ir.cwi.nl/pub/18449).
2. Sen, P. K. (1968), “Estimates of the Regression Coefficient Based on Kendall's Tau,” *Journal of the American Statistical Association*, 63(324), 1379–1389. [DOI: 10.1080/01621459.1968.10480934](https://doi.org/10.1080/01621459.1968.10480934).
3. Sankararaman, S. & Goebel, K. (2013), *Remaining Useful Life Estimation in Prognosis: An Uncertainty Propagation Problem*. [NASA Technical Reports Server](https://ntrs.nasa.gov/api/citations/20140010623/downloads/20140010623.pdf).
4. Sankararaman, S. & Goebel, K. (2013), “Why is the Remaining Useful Life Prediction Uncertain?”, *Annual Conference of the PHM Society*. [DOI: 10.36001/phmconf.2013.v5i1.2263](https://doi.org/10.36001/phmconf.2013.v5i1.2263).
5. Efron, B. (1979), “Bootstrap Methods: Another Look at the Jackknife,” *The Annals of Statistics*, 7(1), 1–26. [DOI: 10.1214/aos/1176344552](https://doi.org/10.1214/aos/1176344552).

---

## 19. Kết luận dùng khi trình bày

Thuật toán hiện tại là một **baseline dự báo có khả năng giải thích và biết từ chối**, phù hợp cho giai đoạn hệ thống chưa có dữ liệu run-to-failure. Giá trị sinh ra là thời gian có điều kiện đến ngưỡng cảnh báo baseline dưới giả định xu hướng và chế độ vận hành được duy trì. Đóng góp kỹ thuật chính nằm ở pipeline kiểm soát chất lượng, hồi quy bền vững, cổng ý nghĩa thống kê và lượng hóa bất định sơ bộ.

Để nâng kết quả từ “công cụ hỗ trợ bảo trì” lên “mô hình RUL đã được xác nhận khoa học”, cần hoàn thành ba việc: sửa các bất nhất implementation, backtest theo thời gian trên dữ liệu thực, và hiệu chuẩn độ bao phủ của khoảng dự báo cùng chi phí dự báo sớm/muộn.
