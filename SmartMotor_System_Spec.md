# SMART MOTOR – ĐẶC TẢ HỆ THỐNG GIÁM SÁT & CHẨN ĐOÁN RUNG ĐỘNG CƠ

**Tài liệu kỹ thuật dùng làm context cho AI lập trình (Claude Opus / Antigravity)**

Phiên bản: 1.0 · Ngày: 10/2026 · Dự án: Smart Motor (HEM) · Phạm vi: Edge (T153) + Server + Web/App

---

## 0. Hướng dẫn sử dụng tài liệu này (đọc trước khi code)

### 0.1 Mục đích

Tài liệu này mô tả **toàn bộ** hệ thống cần xây dựng: phần cứng, giao thức cảm biến, phần mềm edge chạy trên board T153, server, cơ sở dữ liệu, API, giao diện web/app, thuật toán xử lý tín hiệu, luật cảnh báo, quy trình kiểm chứng sai số và lộ trình triển khai. Mục tiêu là để một AI lập trình (hoặc kỹ sư mới) có thể bắt đầu viết code mà không cần hỏi lại bối cảnh.

### 0.2 Quy ước cho AI lập trình

1. **Nguồn sự thật**: khi có mâu thuẫn, thứ tự ưu tiên là: (1) mục "Quyết định kiến trúc" (ADR) trong tài liệu này → (2) schema/hợp đồng dữ liệu (MQTT payload, SQL DDL, REST API) → (3) phần mô tả văn xuôi.
2. **Không tự đổi hợp đồng dữ liệu** (tên topic MQTT, tên trường JSON, tên bảng/cột SQL, endpoint REST) khi chưa cập nhật tài liệu. Nếu cần đổi, ghi rõ trong `docs/CHANGELOG.md`.
3. **Mọi thông số phần cứng có nhãn `[CẦN XÁC MINH]`** là suy luận từ datasheet hoặc chưa được hãng xác nhận. Code phải cho phép cấu hình các giá trị đó (không hard-code) và có log rõ ràng khi giá trị thực tế khác giả định.
4. **Đơn vị**: dùng SI trong code nội bộ (m/s², m/s, m, °C, Hz, s). Chỉ quy đổi sang mm/s, µm, g khi hiển thị hoặc khi giao thức yêu cầu. Tên trường JSON luôn có hậu tố đơn vị (ví dụ `vrms_mm_s`, `temp_c`, `freq_hz`).
5. **Thời gian**: mọi timestamp là **UTC, ISO-8601 có mili-giây** (`2026-10-08T14:03:21.123Z`) trong JSON; trong DB dùng `TIMESTAMPTZ`. Hiển thị trên web theo múi giờ `Asia/Ho_Chi_Minh`.
6. **Ngôn ngữ giao diện**: tiếng Việt. Ngôn ngữ code, tên biến, comment trong code: tiếng Anh.
7. **Mọi thứ phải chạy được mà không có phần cứng thật**: phải có bộ mô phỏng cảm biến (simulator) để phát triển và test (xem mục 5.14).
8. **Không được gửi lệnh "save" (ghi flash) tới cảm biến trong vòng lặp thường xuyên** trừ khi cấu hình cho phép (xem ADR-04).

### 0.3 Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| Edge / T153 | Board Allwinner T153 (HelperBoard của Bách Kiệt) đặt tại hiện trường, đọc cảm biến, xử lý, gửi lên server |
| WTVB05 | Cảm biến rung + nhiệt 3 trục WitMotion WTVB05-485/CAN |
| DE / NDE | Ổ đỡ phía trục ra (Drive End) / phía đối diện (Non-Drive End) |
| 1X, 2X… | Bội số tần số quay của trục. 1X = rpm/60 (Hz) |
| RMS | Căn quân phương – độ mạnh trung bình của tín hiệu |
| FFT | Biến đổi Fourier nhanh – tách tín hiệu thành các thành phần tần số |
| Phổ bao (envelope) | Phổ của đường bao tín hiệu gia tốc sau lọc thông dải – dùng phát hiện lỗi vòng bi |
| BPFO / BPFI / BSF / FTF | Tần số lỗi vòng ngoài / vòng trong / viên bi / vòng cách của vòng bi |
| RAWFIFO | Thanh ghi WTVB05 trả 1024 mẫu gia tốc thô 3 trục |
| SR | Thanh ghi tần số lấy mẫu của WTVB05 |
| Baseline | Trạng thái "bình thường" học được của từng máy |
| ISO 20816-3 | Tiêu chuẩn đánh giá rung máy công nghiệp > 15 kW |
| RUL | Remaining Useful Life – tuổi thọ còn lại |
| Frame | Một lần đọc RAWFIFO = 1024 mẫu × 3 trục |
| Capture | Một lần thu sóng gồm 1 hoặc nhiều frame ở một tần số lấy mẫu |
| Outbox | Hàng đợi bản tin chờ gửi lên server (lưu trên đĩa của edge) |

### 0.4 Quyết định kiến trúc (ADR) – tóm tắt

| Mã | Quyết định | Lý do |
|---|---|---|
| ADR-01 | Cảm biến pilot: **WitMotion WTVB05-485** qua **RS485 Modbus RTU** nối thẳng T153 | Có sóng thô (RAWFIFO), lấy mẫu tới 32 kHz, giá thấp, đã có sẵn 4 con, không cần IO-Link master |
| ADR-02 | Gateway/edge: **T153 HelperBoard**, vỏ và nguồn do đội tự sản xuất | Làm chủ phần cứng và phần mềm; 3 cổng Ethernet, RS485, CAN, 4G, Linux |
| ADR-03 | Phần mềm edge viết bằng **Go** (biên dịch tĩnh ARMv7, không CGO) | Board chạy Buildroot (không có Python mặc định), RAM 512 MB; Go cho 1 file thực thi, dễ cross-compile, đủ thư viện (serial, MQTT, SQLite thuần Go, FFT) |
| ADR-04 | Đổi tần số lấy mẫu (SR) của WTVB05 **mặc định không gửi lệnh save**; nếu cảm biến bắt buộc save mới áp dụng thì giới hạn số lần ghi/ngày (cấu hình) | Bảo vệ flash cảm biến |
| ADR-05 | Truyền dữ liệu edge → server bằng **MQTT 3.1.1/5 qua TLS**, có **store-and-forward** (outbox SQLite) | Chịu mất mạng 4G; chuẩn IoT |
| ADR-06 | Server: **Docker Compose** gồm EMQX (MQTT), PostgreSQL 16 + TimescaleDB, MinIO (S3), Python services (ingest, analytics), FastAPI (REST + WebSocket), React + TypeScript (web), Caddy (reverse proxy + TLS) | Tách vai trò rõ, chạy được trên 1 VPS, nâng cấp dần |
| ADR-07 | Xử lý tín hiệu chính chạy **tại edge** (FFT, phổ bao, RMS ISO, mô hình nhiệt, luật cảnh báo cấp 1). Server tính lại/phân tích sâu từ sóng thô, học baseline, AI | Cảnh báo không phụ thuộc mạng; giảm băng thông |
| ADR-08 | Sóng thô và phổ lưu dạng file nhị phân nén trong MinIO; DB chỉ lưu metadata + chỉ số | DB gọn, truy vấn nhanh |
| ADR-09 | Thiết kế **driver cảm biến dạng plugin** (interface chung) để sau này thêm ifm VVB306 (IO-Link qua AL1352 REST) hoặc Banner QM30VT3 (Modbus) mà không sửa lõi | Có thể đổi cảm biến sau giai đoạn kiểm chứng |
| ADR-10 | Nhiệt cuộn dây là **giá trị ước lượng** từ mô hình nhiệt (dòng điện + nhiệt vỏ + nhiệt môi trường). UI phải ghi rõ "ước lượng" | Yêu cầu không can thiệp vào động cơ |

---

## 1. Bối cảnh và mục tiêu

### 1.1 Bài toán

HEM (nhà sản xuất động cơ điện) cùng Selink triển khai dự án **Smart Motor**: giám sát tình trạng động cơ bằng rung và nhiệt, chẩn đoán lỗi, cảnh báo sớm và về lâu dài dự báo tuổi thọ còn lại (RUL). Thứ tự xây dựng đã thống nhất: **Cảm biến → Thu thập → Xử lý (FFT) → Phân tích → AI/RUL**. AI, FFT và RUL chỉ có giá trị khi lớp dữ liệu phía dưới đáng tin cậy.

### 1.2 Yêu cầu của khách hàng

| Mã | Yêu cầu | Diễn giải kỹ thuật |
|---|---|---|
| R1 | Thu thập dữ liệu | Rung 3 trục + nhiệt tại mỗi ổ đỡ; điện (U, I, P, cosφ); nhiệt vỏ máy, nhiệt môi trường |
| R2 | Không can thiệp máy | Chỉ gắn ngoài vỏ (đế dán/nam châm), không khoan, không đầu dò tiệm cận; CT kẹp ngoài cáp |
| R3 | Cảnh báo bất thường | 2 cấp: tuyệt đối (ISO 20816-3, IEC 60034-1) và tương đối (so baseline từng máy) |
| R4 | Web/App dễ dùng | 3 màn hình chính: Tổng quan, Giám sát thời gian thực, AI chẩn đoán; app mobile |
| R5 | AI học máy | Bắt đầu bằng luật + phát hiện bất thường; RUL khi đủ dữ liệu |
| R6 | FFT và sóng thô | Có FFT, phân tích đường bao, sóng thô 3 trục |
| R7 | Nhiệt cuộn dây | Ước lượng bằng mô hình nhiệt |
| R8 | Sai số < 5% | Có thiết bị đối chứng, điểm đo, điều kiện tải, cách tính, biên bản |

### 1.3 Đối tượng áp dụng

| Tiêu chí | Máy nén khí tại công ty HEM (thử nghiệm) | Bơm trạm Nam Hồng (thực tế) |
|---|---|---|
| Số lượng | 2 máy | 3 động cơ |
| Thiết bị | Máy nén Atlas Copco GA55, sản xuất 2018 | Động cơ HEM 4KA355M10 |
| Công suất · tốc độ | 55 kW · 2978 v/ph (2 cực) | 110 kW · 590 v/ph (10 cực) |
| 1X | 49,63 Hz | 9,833 Hz |
| Điện | 400 V, 3 pha, 50 Hz (dòng chưa có trên nhãn) | 380/660 V (Δ/Y), 226/131 A, 50 Hz – hạ thế |
| Kiểu lắp | Nằm ngang, trong vỏ máy nén (chật, nóng, bụi dầu) | Trục đứng; IP55, cách điện cấp F, IE2, S1; môi trường ẩm |
| Ổ đỡ | Chưa có thông tin `[CẦN XÁC MINH]` | 6322 ở cả DE và NDE |
| Nhóm ISO 20816-3 | Nhóm 2 (15–300 kW) | Nhóm 2 (15–300 kW), tốc độ thấp |
| Dải tần tính RMS ISO | 10–1000 Hz | 2–1000 Hz (máy 120–600 v/ph) |
| Mạng | LAN nội bộ | 4G |
| Điểm đo rung | 2/máy (DE, NDE) → 4 cảm biến | 2/máy (ổ trên, ổ dưới) → 6 cảm biến |

### 1.4 Phạm vi phần mềm cần xây dựng

1. **edge-agent** (Go, chạy trên T153): đọc cảm biến, xử lý tín hiệu, cảnh báo cục bộ, lưu đệm, gửi MQTT.
2. **sensor-simulator** (Go hoặc Python): giả lập WTVB05 qua cổng serial ảo để phát triển không cần phần cứng.
3. **server**: MQTT broker, ingest, DB, object storage, analytics/AI, REST API + WebSocket, notifier.
4. **web**: ứng dụng web React (PWA, dùng được trên điện thoại).
5. **tools**: công cụ cấu hình cảm biến (đổi địa chỉ, baud), công cụ kiểm chứng sai số, script triển khai.
## 2. Kiến trúc tổng thể

### 2.1 Sơ đồ hệ thống

```
 HIỆN TRƯỜNG (mỗi site)                                          CLOUD / SERVER
 ┌─────────────────────────────────────────────┐
 │ WTVB05 #1..#n (rung 3 trục + nhiệt ổ)        │
 │   └─ RS485 bus A (230400 bps) ─┐             │
 │ Module PT100→RS485 (vỏ máy, môi trường)      │
 │   └─ RS485 bus B (9600 bps) ───┤ (USB-RS485) │
 │ Đồng hồ điện 3 pha + CT kẹp                  │
 │   └─ Modbus TCP (eth1 100M) ───┤             │
 │                                ▼             │      ┌──────────────────────────────────┐
 │                  ┌──────────────────────┐    │      │ Caddy (HTTPS, reverse proxy)     │
 │                  │ T153 edge-agent (Go) │    │ MQTT │ EMQX (MQTT/TLS :8883)            │
 │                  │ - drivers            │────┼─TLS─►│ ingest (Python)                  │
 │                  │ - DSP (FFT, envelope)│    │ 4G / │ PostgreSQL 16 + TimescaleDB      │
 │                  │ - rules, thermal     │    │ LAN  │ MinIO (sóng thô, phổ)            │
 │                  │ - outbox SQLite      │    │      │ analytics worker (Python, AI)    │
 │                  │ - local alarm (GPIO) │    │      │ api (FastAPI REST + WebSocket)   │
 │                  └──────────────────────┘    │      │ notifier (email/Zalo/Telegram/SMS)│
 │                   eth0 (1G) → LAN / router   │      │ web (React PWA)                  │
 └─────────────────────────────────────────────┘      └──────────────────────────────────┘
                                                                     ▲
                                                     Trình duyệt / điện thoại (HTTPS)
```

### 2.2 Luồng dữ liệu

| Loại dữ liệu | Nguồn | Chu kỳ mặc định | Xử lý tại edge | Gửi lên server |
|---|---|---|---|---|
| Chỉ số rung tức thời (V, D, Hz, A, T) | WTVB05 thanh ghi 0x34–0x46 | 2 s | Lọc, kiểm tra hợp lệ | Gộp 10 s (trung bình, max) |
| Chỉ số thống kê (RMS, kurtosis, crest…) | WTVB05 thanh ghi 0x47–0x6D | 10 s | Luật cảnh báo | 10 s |
| Năng lượng phổ theo bậc | WTVB05 thanh ghi 0x6E–0x9A | 60 s | — | 60 s |
| Sóng thô định kỳ | WTVB05 RAWFIFO | 15–60 phút / điểm đo | FFT, phổ bao, RMS ISO, bậc 1X–6X, BPFO… | Đặc trưng + sóng thô nén + phổ |
| Sóng thô sự kiện | WTVB05 RAWFIFO | Khi vượt ngưỡng | Như trên | Ngay lập tức, ưu tiên cao |
| Điện | Đồng hồ Modbus TCP/RTU | 1 s đọc, gộp 10 s | Mô hình nhiệt, nhận tải | 10 s |
| Nhiệt vỏ, môi trường | PT100 qua module RS485 | 10 s | Mô hình nhiệt | 10 s |
| Nhiệt cuộn dây (ước lượng) | Mô hình tại edge | 60 s | Cảnh báo nhiệt | 60 s |
| Sự kiện/cảnh báo | Rules engine | Khi xảy ra | Còi/đèn tại chỗ | Ngay, QoS 1 |
| Sức khỏe thiết bị | edge-agent | 60 s | — | 60 s |

### 2.3 Triển khai theo site

| Site | Cảm biến rung | PT100 | Điện | Mạng | Ghi chú |
|---|---|---|---|---|---|
| HEM (pilot) | 4 × WTVB05 (2 GA55 × DE/NDE) | 2 vỏ máy + 1 môi trường | 2 đồng hồ + 6 CT | LAN | Kiểm chứng sai số tại đây |
| Nam Hồng | 6 × WTVB05 (3 bơm × ổ trên/ổ dưới) | 3 vỏ máy (+ tùy chọn ổ trên) + 1 môi trường | 3 đồng hồ + CT | 4G (module EC20/EC25) | Tủ edge đặt trên cao; ẩm |

---

## 3. Phần cứng

### 3.1 Cảm biến rung WitMotion WTVB05-485/CAN (datasheet V260519)

#### 3.1.1 Thông số chính

| Thông số | Giá trị | Ghi chú |
|---|---|---|
| Đo | 3 trục MEMS: gia tốc, vận tốc rung, chuyển vị rung, tần số rung; nhiệt độ | |
| Dải đo | Vận tốc 0–600 mm/s; chuyển vị 0–60000 µm; tần số rung 5–2000 Hz (định nghĩa khác ghi 1–2000 Hz); gia tốc ±16 g | |
| Độ chính xác | < FS ±4% | `[CẦN XÁC MINH]` FS tính theo thang nào. Phải hiệu chuẩn từng cảm biến (mục 9) |
| Tần số lấy mẫu | Cài được 64 Hz → 32 kHz (thanh ghi SR) | Bảng 3.1.4 |
| Sóng thô | RAWFIFO: 1024 mẫu × 3 trục mỗi lần đọc | Mục 3.1.6 |
| Giao tiếp | RS485 (Modbus RTU, 4800–230400 bps, mặc định 9600) và CAN (3K–1M, mặc định 250K) | Pilot dùng RS485 |
| Địa chỉ Modbus | Mặc định 0x50, dải 0x01–0x7F | Tối đa 32 thiết bị/bus |
| Nguồn | 5–36 VDC, 12 mA @ 12 V | Cấp 24 VDC từ tủ |
| Nhiệt độ làm việc | −20…85 °C; lưu kho −40…85 °C | |
| Chịu va đập | 20000 g | |
| Bảo vệ | IP67 | |
| Lắp | Ren M8/M5 hoặc nam châm (7 kg) | Dùng đế dán epoxy + vít, không khoan máy |
| Lưu ý firmware | Firmware ≤ 1.7 (10141.1.7): giá trị vận tốc VX..VZ **không** chia 100 | Edge phải đọc phiên bản firmware hoặc cấu hình `velocity_scale` |

#### 3.1.2 Khung Modbus RTU

Mọi khung là nhị phân (hex), CRC-16/Modbus (đa thức 0xA001, khởi tạo 0xFFFF), byte thấp CRC gửi trước theo chuẩn Modbus. **Lưu ý:** trong datasheet các ví dụ viết CRCH CRCL nhưng giá trị thực tế theo chuẩn Modbus (ví dụ `50 03 00 34 00 03 49 84`); dùng thư viện CRC Modbus chuẩn và test với các ví dụ trong datasheet.

Đọc (function 0x03):

```
Request : [ID][0x03][ADDR_H][ADDR_L][LEN_H][LEN_L][CRC_lo][CRC_hi]
Response: [ID][0x03][BYTECOUNT][D1_H][D1_L]...[Dn_H][Dn_L][CRC_lo][CRC_hi]
Ví dụ đọc gia tốc 3 trục: 50 03 00 34 00 03 49 84
```

Ghi (function 0x06):

```
Request : [ID][0x06][ADDR_H][ADDR_L][DATA_H][DATA_L][CRC_lo][CRC_hi]
Response: echo y hệt request
```

**Quy trình ghi cấu hình (bắt buộc 3 bước):**

```
1. Unlock (hiệu lực 10 s):  [ID] 06 00 69 B5 88 [CRC]    ví dụ ID=0x50: 50 06 00 69 B5 88 22 A1
2. Ghi thanh ghi cần đổi:   [ID] 06 [ADDR] [DATA] [CRC]
3. Save:                    [ID] 06 00 00 00 00 [CRC]     ví dụ: 50 06 00 00 00 00 84 4B
   Reboot:                  [ID] 06 00 00 00 FF [CRC]     ví dụ: 50 06 00 00 00 FF C4 0B
   Factory reset:           [ID] 06 00 00 00 01 [CRC]
```

Giá trị 16-bit là **số có dấu** (signed int16, big-endian trong Modbus): `value = (int16)((H << 8) | L)`.

#### 3.1.3 Bảng thanh ghi dùng trong dự án

| Địa chỉ | Tên | R/W | Ý nghĩa | Quy đổi |
|---|---|---|---|---|
| 0x00 | SAVE | W | 0x0000 save, 0x00FF reboot, 0x0001 factory reset | |
| 0x03 | RRATE | R/W | Tốc độ xuất chủ động (dùng cho CAN) | mã → Hz |
| 0x04 | BAUD | R/W | Baud RS485 | Mã: 0x03=19200, 0x06=115200 (theo ví dụ). Suy luận: 0x01=4800, 0x02=9600, 0x04=38400, 0x05=57600, 0x07=230400 `[CẦN XÁC MINH]` |
| 0x05 | CANBAUD | R/W | Baud CAN | 0x02 = 500K (theo ví dụ) |
| 0x07 | MODE | R/W | Thuật toán: 0x00 miền thời gian tần thấp (10–200 Hz); 0x01 miền thời gian tần cao; 0x02 miền tần số | |
| 0x08 | STATICDETECTION | R/W | Hệ số xóa dữ liệu khi đứng yên, 80–120 (100 = 1,00) | |
| 0x1A | IICADDR | R/W | Địa chỉ Modbus 0x01–0x7F | |
| 0x29 | SR | R/W | Tần số lấy mẫu (bảng 3.1.4) | |
| 0x2B | DRM | R/W | Dải chuyển vị: 0x01 = 60000 µm (phân giải 1 µm); 0x02 = 600 µm (0,01 µm) | |
| 0x2C | RAWFIFO | R | Đọc 1024 mẫu gia tốc thô 3 trục (mục 3.1.6) | |
| 0x30–0x33 | YYMM, DDHH, MMSS, MS | R/W | Đồng hồ trong cảm biến | |
| 0x34–0x36 | AX, AY, AZ | R | Gia tốc | `raw/32768*16` (g) |
| 0x37–0x39 | AXF, AYF, AZF | R | Biên độ gia tốc | (g) `[CẦN XÁC MINH hệ số]` |
| 0x3A–0x3C | VX, VY, VZ | R | Vận tốc rung | `raw/100` (mm/s); firmware ≤1.7: `raw` |
| 0x40 | TEMP | R | Nhiệt độ sản phẩm | `raw/100` (°C) |
| 0x41–0x43 | DX, DY, DZ | R | Chuyển vị rung | `raw` (µm) (DRM=0x01) |
| 0x44–0x46 | HZX, HZY, HZZ | R | Tần số rung trội | `raw/10` (Hz) |
| 0x47–0x52 | CFX, KX, AAVGX, VARX, RRAX, WIX, PIX, PCX, SKX, VRMSX, VKX, DRMSX | R | Thống kê trục X | tất cả `raw/1000`; RRAX (g), VRMSX (mm/s), DRMSX (mm) |
| 0x53–0x5E | …Y | R | Thống kê trục Y | như trên |
| 0x5F–0x6A | …Z | R | Thống kê trục Z | như trên |
| 0x6B–0x6D | ERRX, ERRY, ERRZ | R | Mã chẩn đoán lỗi theo trục | `raw` – ý nghĩa mã `[CẦN XÁC MINH]` |
| 0x6E–0x7C | AX_ENERGY_POINT1..8, AX_ENERGY_AREA1..6, AX_ENERGY | R | Năng lượng phổ gia tốc trục X tại 0,25X, 0,5X, 1X, 2X, 3X, 4X, 5X, 6X; dải 0–0,5X, 0,5–1X, 1–2X, 2–3X, 3–4X, 4–5X; tổng | `raw` (không có đơn vị công bố) |
| 0x7D–0x8B | AY_ENERGY_… | R | Như trên cho trục Y | |
| 0x8C–0x9A | AZ_ENERGY_… | R | Như trên cho trục Z | |

**Ghi chú datasheet có chỗ mâu thuẫn** (ví dụ ví dụ đọc CFY, CFZ đều dùng địa chỉ 0x47). AI lập trình phải dùng **địa chỉ trong bảng thanh ghi** ở trên, và viết test đọc thực tế để xác nhận.

**Kế hoạch đọc khối (một lệnh tối đa 125 thanh ghi):**

| Khối | Địa chỉ | Số thanh ghi | Byte dữ liệu | Thời gian ở 230400 bps (ước tính) |
|---|---|---|---|---|
| B1 – tức thời | 0x34–0x46 | 19 | 38 | ~3 ms + turnaround |
| B2 – thống kê | 0x47–0x6D | 39 | 78 | ~5 ms |
| B3 – năng lượng phổ | 0x6E–0x9A | 45 | 90 | ~6 ms |
| RAWFIFO | 0x2C | (đặc biệt) | 6144 | ~270 ms |

#### 3.1.4 Tần số lấy mẫu (thanh ghi SR 0x29)

| Mã | fs | Dải đo được (datasheet) | Thời gian 1 frame (1024 mẫu) | Độ phân giải phổ Δf = fs/1024 | Dùng cho |
|---|---|---|---|---|---|
| 0x00 | 32 kHz (mặc định) | 128 Hz–16 kHz | 32 ms | 31,25 Hz | Va đập rất cao tần (ít dùng) |
| 0x01 | 16 kHz | 64 Hz–8 kHz | 64 ms | 15,6 Hz | |
| 0x02 | 8 kHz | 32 Hz–4 kHz | 128 ms | 7,81 Hz | **Phổ bao vòng bi** |
| 0x03 | 4 kHz | 16 Hz–2 kHz | 256 ms | 3,91 Hz | |
| 0x04 | 2 kHz | 8 Hz–1 kHz | 512 ms | 1,95 Hz | **Bậc 1X–6X GA55; RMS ISO 10–1000 Hz** |
| 0x05 | 1 kHz | 4–512 Hz | 1,024 s | 0,98 Hz | |
| 0x06 | 512 Hz | 2–256 Hz | 2 s | 0,5 Hz | **Bậc 1X–6X bơm 590 v/ph** |
| 0x07 | 256 Hz | 1–128 Hz | 4 s | 0,25 Hz | |
| 0x08 | 128 Hz | 1–64 Hz | 8 s | 0,125 Hz | |
| 0x09 | 64 Hz | 0,1–32 Hz | 16 s | 0,0625 Hz | |

Thực tế nên coi tần số phân tích tối đa ≈ fs/2,56 (chừa dải chuyển tiếp của bộ lọc chống chồng phổ), không phải fs/2. Đáp ứng tần số thật của chip MEMS ở dải kHz `[CẦN XÁC MINH bằng bàn rung]`.

#### 3.1.5 Thanh ghi MODE (0x07) và quan hệ với SR

- Chế độ 0x00 (miền thời gian tần thấp 10–200 Hz) là mặc định, ảnh hưởng cách cảm biến tính các chỉ số V/D/Hz.
- Chưa rõ SR có ảnh hưởng tới các chỉ số tính sẵn hay chỉ ảnh hưởng RAWFIFO `[CẦN XÁC MINH]`. Edge phải ghi kèm `sr_code` và `mode` vào mọi bản ghi chỉ số để phân tích sau.

#### 3.1.6 RAWFIFO (0x2C) – định dạng đặc biệt (không chuẩn Modbus)

```
Request : [ID] 03 00 2C 00 01 [CRC]          ví dụ: 50 03 00 2C 00 01 48 42
Nếu chưa đủ 1024 mẫu:
Response: [ID] 03 01 [CNT_H] [CNT_L] [CRC]    CNT = số mẫu hiện có
Nếu đã đủ:
Response: [ID] 03 00 [AX_H AX_L AY_H AY_L AZ_H AZ_L] × 1024 [CRC]
          → 6144 byte dữ liệu + 3 byte đầu + 2 byte CRC = 6149 byte
Quy đổi: a_g = int16(H<<8|L) / 32768 * 16
```

Yêu cầu cho driver:

1. Byte thứ 3 **không phải byte count** như Modbus chuẩn: `0x01` = chưa sẵn sàng, `0x00` = có dữ liệu. Không dùng thư viện Modbus chuẩn cho lệnh này; viết parser riêng đọc đúng 6149 byte với timeout ≥ 1,5 × thời gian truyền.
2. Thứ tự mẫu, có hay không khoảng hở giữa các frame liên tiếp, và việc cảm biến có tiếp tục lấy mẫu trong lúc truyền là `[CẦN XÁC MINH]`. Driver phải đo và ghi `frame_start_ts`, `frame_end_ts` (thời điểm T153 nhận) để module kiểm tra tính liền mạch (mục 5.6.9) đánh giá.
3. Kiểm tra CRC cho toàn khung 6147 byte. Sai CRC → đọc lại tối đa 2 lần, sau đó ghi lỗi.
4. Nếu nhận `0x01` → chờ `(1024 − CNT)/fs + 20 ms` rồi hỏi lại.

#### 3.1.7 Các câu hỏi đã gửi WitMotion (chưa có trả lời)

1. Có đọc RAWFIFO liên tục nhiều frame **không bị hở** được không (có double-buffer)?
2. Ghi SR có cần save (ghi flash) mới có hiệu lực? Tuổi thọ flash (số lần ghi)?
3. Chip MEMS bên trong, đáp ứng tần số thực tế, có bộ lọc chống chồng phổ không?
4. "FS ±4%" tính trên thang nào? Có số liệu sai số theo tần số không?
5. Ý nghĩa mã ERRX/ERRY/ERRZ; đơn vị của các thanh ghi năng lượng phổ; tần số 1X các thanh ghi năng lượng dùng ở đâu ra (tự dò hay cấu hình)?
6. Bảng mã BAUD đầy đủ.

### 3.2 Board edge T153 HelperBoard (Bách Kiệt)

| Hạng mục | Thông số | Dùng trong dự án |
|---|---|---|
| SoC | Allwinner T153: 4 × Cortex-A7 (tới 1,6 GHz) + RISC-V E907 (600 MHz) | edge-agent chạy trên A7; RISC-V chưa dùng |
| RAM | 512 MB DDR3/DDR4 | Giới hạn bộ nhớ edge-agent ≤ 150 MB |
| Lưu trữ | eMMC 5.0 / thẻ TF (SD 3.0) | Dữ liệu và outbox trên thẻ TF ≥ 32 GB (industrial) |
| Ethernet | 1 × 1 Gbps (cổng ㉔) + 2 × 100 Mbps (㉓, ㉕) | eth (1G): LAN/router; 100M: đồng hồ điện |
| RS485 | 1 cổng (485_UART6) → **`/dev/ttyAS6`** | Bus A: WTVB05 |
| CAN | 1 cổng (can0) | Dự phòng (WTVB05-CAN) |
| USB Host | 2 cổng | USB-RS485 cho bus B (PT100) |
| 4G | Khe module EC20/EC25 (mua riêng), script `4g_set.sh` / `4g_del.sh`, giao diện `ppp0` | Nam Hồng |
| WiFi | 2,4 GHz, script `wifi_set.sh` | Cài đặt tại chỗ |
| Khác | RTC có pin, còi (buzzer), nút bấm, GPIO, GPADC 12-bit (không dùng cho rung) | Còi + GPIO relay cho cảnh báo tại chỗ |
| Nguồn | 12 VDC | Bộ DC-DC 24→12 V cách ly trong vỏ tự làm |
| OS | Buildroot (2022.05) + Qt 5.12.5, kernel Linux 5.10 | Không có Python mặc định |
| Toolchain | `arm-linux-gnueabihf-gcc/g++` (trong VM Ubuntu của hãng) | Go không cần toolchain này nếu `CGO_ENABLED=0` |
| Đăng nhập | root, mật khẩu `szbaijie` | **Đổi mật khẩu khi triển khai** |
| Tự khởi động | Sửa `/etc/init.d/rcS` hoặc thêm `/etc/init.d/S99edge-agent` | Mục 5.13 |
| IP tĩnh | `ifconfig eth0 <ip> netmask <mask> up; route add default gw <gw>` | Lưu vào script khởi động |

**Yêu cầu vỏ/phần cứng tự làm:** DC-DC 24→12 V cách ly, TVS/chống sét trên nguồn, RS485 và Ethernet; RS485 cách ly (nếu board chưa có); điện trở đầu cuối 120 Ω ở hai đầu bus; anten 4G/WiFi ra ngoài vỏ; gắn thanh DIN; 1–2 relay khô (qua GPIO + transistor) cho còi/đèn; LED trạng thái.

### 3.3 Nhiệt độ PT100

- PT100 dán bề mặt (vỏ máy) và PT100 không khí (môi trường), qua **module chuyển đổi PT100 → RS485 Modbus RTU** (loại 2–8 kênh phổ thông). Model chốt sau `[CẦN XÁC MINH]`; driver đọc theo cấu hình: địa chỉ, thanh ghi, hệ số, offset.
- Đặt trên **bus B** riêng (USB-RS485, 9600 bps) để không làm chậm bus WTVB05 ở 230400 bps.
- Chu kỳ đọc 10 s.

### 3.4 Đồng hồ điện + CT

- Đồng hồ đa năng 3 pha có **Modbus TCP** (ưu tiên) hoặc Modbus RTU; CT kẹp (split-core) theo dòng định mức: GA55 ~150/5 A, 4KA355M10 300/5 A `[CẦN XÁC MINH khi chọn model]`.
- Thanh ghi đọc (cấu hình theo model): U1–U3, I1–I3, P tổng, Q, S, PF, tần số, kWh, THD-U, THD-I.
- Edge tính thêm: dòng trung bình, mất cân bằng dòng/áp (%), thành phần thứ tự nghịch I2 (gần đúng từ độ lớn 3 pha), trạng thái chạy/dừng (I > 10% I_N), % tải (I/I_N).

### 3.5 Cảm biến dự phòng (plugin sau này)

| Cảm biến | Kết nối | Ghi chú tích hợp |
|---|---|---|
| ifm VVB306 | IO-Link → ifm AL1352 (JSON/REST qua Ethernet) | Sóng thô BLOB 4 s 3 trục / 12 s 1 trục; 2–5600 Hz |
| Banner QM30VT3 | RS485 Modbus RTU | Chỉ số (6 Hz–5,3 kHz, ±5%), không có sóng thô |

### 3.6 Bảng địa chỉ thiết bị (pilot HEM)

| Bus | Thiết bị | Địa chỉ | Baud | Vị trí |
|---|---|---|---|---|
| A `/dev/ttyAS6` | WTVB05 | 0x11 | 230400 | GA55-01 DE |
| A | WTVB05 | 0x12 | 230400 | GA55-01 NDE |
| A | WTVB05 | 0x21 | 230400 | GA55-02 DE |
| A | WTVB05 | 0x22 | 230400 | GA55-02 NDE |
| B `/dev/ttyUSB0` | Module PT100 4 kênh | 0x01 | 9600 | Kênh 1: vỏ GA55-01; kênh 2: vỏ GA55-02; kênh 3: môi trường |
| TCP 192.168.10.21:502 | Đồng hồ điện | unit 1 | — | Tủ GA55-01 |
| TCP 192.168.10.22:502 | Đồng hồ điện | unit 1 | — | Tủ GA55-02 |

Quy tắc địa chỉ WTVB05: `0x{máy}{vị trí}` (vị trí 1 = DE/ổ trên, 2 = NDE/ổ dưới). Cảm biến xuất xưởng đều là 0x50 và 9600 bps → phải đặt địa chỉ/baud **từng con một** bằng công cụ `tools/wtvb-config` trước khi lắp chung bus.
## 4. Cấu trúc kho mã (monorepo)

```
smart-motor/
├── docs/                         # tài liệu này (markdown), ADR, CHANGELOG
├── edge/                         # Go – chạy trên T153
│   ├── cmd/edge-agent/main.go
│   ├── cmd/wtvb-config/main.go   # công cụ đặt địa chỉ/baud/SR cho WTVB05
│   ├── cmd/sensor-sim/main.go    # mô phỏng WTVB05 trên cổng serial ảo
│   ├── internal/
│   │   ├── config/               # load/validate YAML, hot-reload
│   │   ├── bus/                  # quản lý cổng serial: hàng đợi, ưu tiên, timeout
│   │   ├── modbus/               # CRC, đóng/mở khung RTU, client TCP
│   │   ├── drivers/
│   │   │   ├── driver.go         # interface VibrationSensor, TempSensor, PowerMeter
│   │   │   ├── wtvb05/           # thanh ghi, RAWFIFO parser, scale
│   │   │   ├── pt100mod/         # module PT100 Modbus (cấu hình được)
│   │   │   ├── powermeter/       # đồng hồ điện Modbus TCP/RTU (bản đồ thanh ghi cấu hình)
│   │   │   └── ifmvvb/           # (sau) ifm AL1352 REST
│   │   ├── scheduler/            # lịch đọc chỉ số, lịch capture sóng
│   │   ├── dsp/                  # FFT, window, envelope, band RMS, orders, bearing freq
│   │   ├── features/             # trích đặc trưng từ capture
│   │   ├── thermal/              # mô hình nhiệt cuộn dây
│   │   ├── rules/                # ISO zones, ngưỡng, persistence, sự kiện
│   │   ├── store/                # SQLite (outbox, cache), file sóng
│   │   ├── uplink/               # MQTT client, TLS, store-and-forward, downlink commands
│   │   ├── localalarm/           # GPIO relay, buzzer, LED
│   │   ├── health/               # CPU, RAM, disk, nhiệt độ SoC, link, watchdog
│   │   └── version/
│   ├── testdata/                 # khung RAWFIFO mẫu, sóng tổng hợp
│   ├── Makefile                  # build GOARCH=arm GOARM=7 CGO_ENABLED=0
│   └── deploy/                   # S99edge-agent, edge.yaml mẫu
├── server/
│   ├── docker-compose.yml
│   ├── caddy/Caddyfile
│   ├── emqx/                     # cấu hình broker, ACL
│   ├── db/migrations/            # SQL (Alembic hoặc file .sql đánh số)
│   ├── services/
│   │   ├── common/               # models Pydantic, schema MQTT, util
│   │   ├── ingest/               # subscribe MQTT → DB/MinIO
│   │   ├── analytics/            # baseline, Criterion II, anomaly, RUL, reprocess
│   │   ├── api/                  # FastAPI REST + WebSocket
│   │   └── notifier/             # email, Zalo OA, Telegram, SMS
│   └── tests/
├── web/                          # React + TypeScript + Vite + ECharts, PWA
│   ├── src/pages/ ...
│   └── src/api/ (client sinh từ OpenAPI)
└── tools/
    ├── accuracy-check/           # công cụ kiểm chứng sai số (mục 9)
    └── scripts/
```

---

## 5. Phần mềm edge (edge-agent, Go)

### 5.1 Môi trường và build

- Go ≥ 1.22. Build: `GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X version.Version=$(git describe)" ./cmd/edge-agent`.
- Thư viện gợi ý (thuần Go, không CGO):
  - Serial: `go.bug.st/serial`
  - MQTT: `github.com/eclipse/paho.golang` (MQTT 5) hoặc `github.com/eclipse/paho.mqtt.golang` (3.1.1)
  - SQLite: `modernc.org/sqlite`
  - FFT: `gonum.org/v1/gonum/dsp/fourier`
  - Modbus TCP (đồng hồ điện): `github.com/simonvetter/modbus` hoặc tự viết (đơn giản)
  - YAML: `gopkg.in/yaml.v3`; log: `log/slog` (JSON); metrics nội bộ: tự viết
- Giới hạn tài nguyên: RSS ≤ 150 MB; CPU trung bình ≤ 30% của 1 nhân; ghi đĩa ≤ 2 GB/ngày.
- Không dùng thời gian hệ thống đơn điệu cho timestamp dữ liệu: dùng `time.Now().UTC()`; đồng bộ NTP (`ntpd`/`chrony` của Buildroot) khi có mạng; RTC giữ giờ khi mất điện. Nếu chưa đồng bộ giờ (năm < 2026) → gắn cờ `time_unsynced=true` vào bản ghi.

### 5.2 Kiến trúc tiến trình

Một tiến trình duy nhất `edge-agent`, các goroutine giao tiếp qua channel:

```
             ┌──────────────┐  jobs   ┌──────────────┐ frames ┌──────────┐ features ┌─────────┐
config ─────►│  scheduler   │────────►│ bus manager A│───────►│ features │─────────►│  rules  │──┐
             └──────────────┘         │ (ttyAS6)     │        │ + dsp    │          └─────────┘  │
                    │                 └──────────────┘        └──────────┘               │       │
                    │ jobs            ┌──────────────┐ values      │                     ▼       │
                    └────────────────►│ bus manager B│──────┐      │               localalarm    │
                                      │ (ttyUSB0)    │      ▼      ▼                             │
                                      └──────────────┘   ┌──────────┐   ┌──────────┐            │
                         power meter (Modbus TCP) ──────►│ thermal  │──►│  store   │◄───────────┘
                                                         └──────────┘   │ (outbox) │
                                                                        └────┬─────┘
                                                                             ▼
                                                           uplink (MQTT/TLS) ◄──► server
                                                                             ▲
                                                 commands (downlink) ────────┘
health ──► store
```

Quy tắc:

1. **Mỗi bus RS485 chỉ có một goroutine sở hữu** (bus manager). Mọi yêu cầu đọc/ghi đi qua hàng đợi có ưu tiên: `P0` lệnh khẩn (capture sự kiện) > `P1` đọc chỉ số định kỳ > `P2` capture định kỳ > `P3` cấu hình.
2. Một capture RAWFIFO chiếm bus ~0,3 s/frame; trong thời gian đó các lần đọc chỉ số của cảm biến khác bị lùi lại. Scheduler phải tính ngân sách thời gian bus (mục 5.4.3).
3. Lỗi một thiết bị không được làm treo bus: timeout cứng, 3 lần lỗi liên tiếp → đánh dấu `device_offline`, giảm tần suất thử lại (backoff 5 s → 60 s).

### 5.3 Interface driver (plugin)

```go
type Axis int // 0=X,1=Y,2=Z

type VibrationIndicators struct {
    TS          time.Time
    AccG        [3]float64 // AX..AZ
    VelMMs      [3]float64 // VX..VZ
    DispUm      [3]float64 // DX..DZ
    FreqHz      [3]float64 // HZX..HZZ
    TempC       float64
    // thống kê (khối B2), NaN nếu không có
    CrestFactor [3]float64
    Kurtosis    [3]float64
    AccAbsMeanG [3]float64
    AccVarG     [3]float64
    AccRmsG     [3]float64
    WaveIndex   [3]float64
    PeakIndex   [3]float64
    PulseCoef   [3]float64
    Skewness    [3]float64
    VelRmsMMs   [3]float64
    VelKurt     [3]float64
    DispRmsMm   [3]float64
    ErrCode     [3]uint16
    SrCode      uint8
    Mode        uint8
}

type SpectrumEnergy struct { // khối B3
    TS     time.Time
    Points [3][8]float64 // 0.25X,0.5X,1X..6X
    Areas  [3][6]float64
    Total  [3]float64
}

type RawFrame struct {
    FsHz       float64
    Samples    [3][]float32 // m/s^2 sau quy đổi
    StartTS    time.Time    // thời điểm gửi lệnh / bắt đầu nhận
    EndTS      time.Time
    SrCode     uint8
}

type VibrationSensor interface {
    ID() string
    ReadIndicators(ctx context.Context) (VibrationIndicators, error)
    ReadSpectrumEnergy(ctx context.Context) (SpectrumEnergy, error)
    SetSampleRate(ctx context.Context, srCode uint8, persist bool) error
    ReadRawFrame(ctx context.Context) (RawFrame, error)
    Info(ctx context.Context) (DeviceInfo, error) // firmware, địa chỉ, baud nếu đọc được
}
```

Tương tự: `TempSensor.Read(ctx) ([]ChannelValue, error)`, `PowerMeter.Read(ctx) (PowerReading, error)`.

### 5.4 Lịch thu thập

#### 5.4.1 Chỉ số

| Nhiệm vụ | Chu kỳ mặc định | Khối | Ghi chú |
|---|---|---|---|
| Đọc B1 mỗi WTVB05 | 2 s | 0x34–0x46 | Tính trung bình/max cửa sổ 10 s trước khi gửi |
| Đọc B2 mỗi WTVB05 | 10 s | 0x47–0x6D | |
| Đọc B3 mỗi WTVB05 | 60 s | 0x6E–0x9A | |
| Đọc PT100 | 10 s | theo cấu hình | Bus B |
| Đọc đồng hồ điện | 1 s | theo cấu hình | Modbus TCP |

#### 5.4.2 Capture sóng thô

Mỗi điểm đo có danh sách **capture profile** trong cấu hình:

| Profile | Mục đích | GA55 (1X ≈ 49,6 Hz) | Bơm (1X ≈ 9,83 Hz) |
|---|---|---|---|
| `orders` | Bậc 1X–6X, RMS ISO | SR 0x04 (2 kHz), 4 frame | SR 0x06 (512 Hz), 2 frame |
| `iso_band` | RMS vận tốc theo dải ISO | dùng chung `orders` (fs 2 kHz → tới ~780 Hz; ghi chú giới hạn) | SR 0x05 (1 kHz) 2 frame hoặc dùng `orders` |
| `bearing` | Phổ bao vòng bi | SR 0x02 (8 kHz), 8 frame | SR 0x02 (8 kHz), 8 frame |

- Chu kỳ: `orders` mỗi 15 phút, `bearing` mỗi 60 phút (cấu hình). Lệch pha giữa các điểm đo để không dồn bus.
- Chỉ capture khi máy **đang chạy ổn định**: `running=true` (I > 10% I_N hoặc RMS vận tốc > ngưỡng chạy) trong ≥ 120 s, và biến thiên dòng điện trong 60 s gần nhất < 5%.
- **Capture sự kiện**: khi rules engine phát hiện vượt ngưỡng cấp ≥ Cảnh báo → chạy ngay `orders` + `bearing` cho điểm đo đó (ưu tiên P0), tối đa 1 lần/10 phút/điểm.
- Trình tự một capture: (1) đọc SR hiện tại; (2) nếu khác → unlock + ghi SR (không save, theo ADR-04) → đọc lại xác nhận; (3) chờ ổn định 0,5 s + 1 frame để bỏ dữ liệu cũ (đọc và bỏ 1 frame đầu); (4) đọc N frame liên tiếp; (5) trả SR về giá trị mặc định cấu hình (`idle_sr`); (6) đẩy capture sang module features.
- Nếu ghi SR không có hiệu lực khi không save → driver báo `ErrSrNeedsPersist`; scheduler chỉ dùng save khi `allow_flash_write=true` và số lần ghi trong ngày < `max_flash_writes_per_day` (mặc định 24); nếu vượt → bỏ capture, ghi sự kiện `capture_skipped_flash_budget`.

#### 5.4.3 Ngân sách thời gian bus A (ví dụ HEM, 4 cảm biến, 230400 bps)

```
Chỉ số B1: 4 cảm biến × 0,5 lần/s × ~10 ms  ≈ 20 ms/s (2%)
Chỉ số B2: 4 × 0,1/s × ~12 ms              ≈ 5 ms/s
Chỉ số B3: 4 × 1/60 × ~14 ms               ≈ 1 ms/s
Capture orders: 4 điểm × (1+4) frame × 0,3 s / 900 s ≈ 7 ms/s
Capture bearing: 4 × (1+8) × 0,3 s / 3600 s        ≈ 3 ms/s
Tổng ≈ 4% thời gian bus → dư rất nhiều. Với 6 cảm biến (Nam Hồng) vẫn < 10%.
```

Khi đang capture một cảm biến (chiếm bus tới ~3 s cho 8 frame), các lần đọc B1 khác bị trễ; chấp nhận được. Không được chặn bus > 5 s liên tục: chia capture dài thành từng frame, xen kẽ lệnh B1.

### 5.5 Kiểm tra chất lượng dữ liệu (edge)

| Kiểm tra | Điều kiện | Hành động |
|---|---|---|
| Timeout / CRC | > 3 lần liên tiếp | `device_offline`, sự kiện `sensor_fault` |
| Bão hòa | |a| ≥ 15,5 g ở bất kỳ mẫu nào | Gắn cờ `saturated`, không dùng frame cho RMS |
| Tín hiệu phẳng | std(a) < 0,0005 g trong khi máy chạy | Cờ `flatline`, sự kiện `sensor_suspect` |
| Nhiệt độ cảm biến | < −20 hoặc > 85 °C | Cờ `out_of_range` |
| Giá trị chỉ số nhảy bất thường | |Δ| > 10× trung vị 1 giờ | Cờ `spike`, không đưa vào baseline |
| Đồng hồ thời gian | chưa đồng bộ | `time_unsynced` |

### 5.6 Xử lý tín hiệu (module dsp + features)

Tất cả công thức dưới đây được cài đặt trong `internal/dsp`, có unit test với sóng sin tổng hợp (biên độ, tần số biết trước, sai số < 1%).

#### 5.6.1 Chuẩn bị

```
a_g[n]    = int16 / 32768 * 16
a[n]      = a_g[n] * 9.80665                     (m/s^2)
a[n]     -= mean(a)                               (bỏ DC, trọng lực)
N         = 1024 * số_frame_ghép (nếu liền mạch) hoặc 1024 (nếu không)
w[n]      = Hann: 0.5 - 0.5*cos(2*pi*n/(N-1))
```

#### 5.6.2 Phổ biên độ gia tốc

```
X[k]      = FFT(a[n]*w[n]),  k = 0..N/2
f[k]      = k * fs / N
A_pk[k]   = 2 * |X[k]| / sum(w)                   (biên độ đỉnh, đã hiệu chỉnh cửa sổ)
A_rms[k]  = A_pk[k] / sqrt(2)
```

Nếu có nhiều frame không liền mạch: tính phổ từng frame rồi **trung bình công suất** (Welch không chồng lấp): `A_rms_avg[k] = sqrt(mean_i(A_rms_i[k]^2))`.

#### 5.6.3 Phổ vận tốc và RMS theo dải

```
V_rms[k]  = A_rms[k] / (2*pi*f[k]) * 1000         (mm/s), với f[k] >= f_lo
RMS dải [f1,f2] (Parseval, có hiệu chỉnh năng lượng Hann):
  P[k]    = |X[k]|^2 * 2 / (fs * sum(w^2))        (PSD một phía)
  rms_a   = sqrt( sum_{f1<=f[k]<=f2} P[k] * df )  với df = fs/N
  rms_v   = sqrt( sum P[k]/(2*pi*f[k])^2 * df ) * 1000    (mm/s)
```

- `iso_vrms_mm_s` = `rms_v` trong dải ISO: GA55 10–1000 Hz; bơm 2–1000 Hz. Giới hạn trên thực tế = min(1000, fs/2,56). Ghi trường `iso_band_hz=[f1,f2_thực]` vào payload.
- Bỏ các bin f < f_lo (0,5 × dải dưới) để tránh "trượt dốc" do tích phân.

#### 5.6.4 Ước lượng tốc độ quay (1X)

```
1. Tìm đỉnh lớn nhất của A_rms trong [0.97*f1X_nom, 1.03*f1X_nom] (f1X_nom từ cấu hình)
2. Nội suy parabol 3 điểm quanh đỉnh để lấy tần số chính xác
3. Nếu biên độ đỉnh < 3 × trung vị nền xung quanh → speed_confidence = low, dùng f1X_nom
4. Có thể kết hợp tần số HZx của cảm biến nếu gần f1X_nom
```

#### 5.6.5 Giá trị theo bậc (orders)

```
Cho k = 0.5, 1, 1.5, 2, 3, 4, 5, 6 ... (cấu hình):
  f_k      = k * f1X
  amp_k    = sqrt( sum_{|f - f_k| <= max(2*df, 0.02*f_k)} A_rms[f]^2 )   (gia tốc, m/s^2 rms)
  vel_k    = amp_k / (2*pi*f_k) * 1000                                       (mm/s rms)
  Xuất cả 3 trục.
```

#### 5.6.6 Tần số đặc trưng vòng bi

```
fr  = f1X (Hz);  N = số viên bi;  Bd = đường kính bi;  Pd = đường kính vòng chia;  beta = góc tiếp xúc
BPFO = N/2 * fr * (1 - Bd/Pd*cos(beta))
BPFI = N/2 * fr * (1 + Bd/Pd*cos(beta))
BSF  = Pd/(2*Bd) * fr * (1 - (Bd/Pd*cos(beta))^2)
FTF  = fr/2 * (1 - Bd/Pd*cos(beta))
```

Hình học vòng bi lấy từ bảng `bearings` (server) và đẩy xuống edge qua cấu hình. Khi chưa có hình học (GA55) → bỏ qua đặc trưng vòng bi, chỉ tính phổ bao tổng.

#### 5.6.7 Phổ bao (envelope) – từ capture `bearing` (fs = 8 kHz)

```
1. Bandpass Butterworth bậc 4 (zero-phase, filtfilt) dải [f_bp_lo, f_bp_hi]
   mặc định [1000, 3000] Hz cho fs = 8 kHz; cấu hình theo điểm đo
2. Hilbert qua FFT: analytic = IFFT(H * FFT(x)), H = [1, 2...2, 1, 0...0]
3. env = |analytic|;  env -= mean(env)
4. Hann + FFT → E[k] (biên độ đỉnh, g), dải 0 .. 500 Hz
5. Với mỗi f_fault in {BPFO, BPFI, BSF*2, FTF}: amp tại f_fault và 2, 3 hài (± 2 bin)
6. Đặc trưng: env_rms_g, bpfo_env_g, bpfi_env_g, bsf_env_g, ftf_env_g, hài, và tỷ số đỉnh/nền
```

Giới hạn: với 1024 mẫu ở 8 kHz, Δf = 7,8 Hz → chỉ phát hiện được, không phân giải sideband. Nếu chứng minh được frame liền mạch → ghép 8 frame (Δf ≈ 0,98 Hz).

#### 5.6.8 Chỉ số miền thời gian (tính lại từ sóng để đối chiếu với cảm biến)

```
rms   = sqrt(mean(a^2))
peak  = max|a|
crest = peak / rms
kurt  = mean((a-mu)^4) / std^4
skew  = mean((a-mu)^3) / std^3
```

#### 5.6.9 Kiểm tra liền mạch giữa các frame

Ghép frame i và i+1 khi: (1) `StartTS(i+1) − EndTS(i) <` 1 mẫu (theo thông tin hãng), hoặc (2) kiểm tra thực nghiệm: với tín hiệu có thành phần 1X mạnh, pha của 1X ước lượng ở cuối frame i khớp với đầu frame i+1 (sai < 10°). Nếu không chắc chắn → **không ghép**, dùng trung bình Welch. Kết quả ghi `frames_contiguous: true|false`.

#### 5.6.10 Đầu ra của một capture (FeatureSet)

```json
{
  "capture_id": "c_20261008T140321Z_ga55-01-de_orders",
  "point_id": "ga55-01-de",
  "profile": "orders",
  "ts": "2026-10-08T14:03:21.123Z",
  "fs_hz": 2000,
  "sr_code": 4,
  "frames": 4,
  "frames_contiguous": false,
  "n_fft": 1024,
  "df_hz": 1.953,
  "running": true,
  "load_pct": 78.5,
  "speed_hz": 49.61,
  "speed_confidence": "high",
  "axes": {
    "x": {
      "acc_rms_g": 0.412, "acc_peak_g": 1.35, "crest": 3.28, "kurtosis": 3.4, "skew": 0.02,
      "iso_vrms_mm_s": 2.31, "iso_band_hz": [10, 781],
      "orders": {"0.5": 0.05, "1": 1.92, "2": 0.71, "3": 0.21, "4": 0.12, "5": 0.08, "6": 0.05},
      "orders_unit": "mm_s_rms"
    },
    "y": { "...": "..." },
    "z": { "...": "..." }
  },
  "envelope": null,
  "quality_flags": [],
  "waveform_ref": "raw/ga55-01-de/2026/10/08/c_20261008T140321Z_ga55-01-de_orders.bin.gz",
  "spectrum_ref": "spec/ga55-01-de/2026/10/08/c_20261008T140321Z_ga55-01-de_orders.json.gz"
}
```

### 5.7 Mô hình nhiệt cuộn dây (module thermal)

Chạy mỗi 60 s cho mỗi máy (có đồng hồ điện).

```
Tham số (cấu hình theo mã động cơ; lấy từ biên bản thử phát nóng của HEM):
  I_N        dòng định mức (A)              4KA355M10: 226 A @ 380 V
  dT_N       độ tăng nhiệt cuộn dây định mức (K)        [CẦN dữ liệu HEM], mặc định 80
  a          tỷ lệ tổn hao không tải (sắt+cơ)            mặc định 0.25
  tau_run    hằng số thời gian khi chạy (s)              mặc định 2700 (45 phút)
  tau_stop   hằng số thời gian khi dừng (s)              mặc định 3 * tau_run
  K_neg      hệ số dòng thứ tự nghịch                    mặc định 3
  k_frame    hệ số hiệu chỉnh theo nhiệt vỏ              mặc định 0 (bật sau khi hiệu chỉnh)
  c_frame    tỷ lệ tăng nhiệt vỏ / tăng nhiệt cuộn dây   mặc định 0.4

Mỗi bước dt = 60 s:
  I1 ≈ mean(Ia,Ib,Ic);  I2 ≈ (max(Ia,Ib,Ic) - min(Ia,Ib,Ic)) / 2      (xấp xỉ thứ tự nghịch)
  I_eq = sqrt(I1^2 + K_neg * I2^2)
  if running:  dT_ss = dT_N * (a + (1-a) * (I_eq/I_N)^2);  tau = tau_run
  else:        dT_ss = 0;                                   tau = tau_stop
  dT = dT_ss + (dT_prev - dT_ss) * exp(-dt/tau)
  T_frame_model = T_amb + c_frame * dT
  T_w = T_amb + dT + k_frame * (T_frame_meas - T_frame_model)
Khởi động agent: dT_prev = max(0, (T_frame_meas - T_amb) / c_frame)
Xuất: winding_temp_est_c, winding_rise_est_k, model_version
```

Ngưỡng (cách điện cấp F, IEC 60034-1): giới hạn vật liệu 155 °C; tăng nhiệt cho phép 105 K. Mặc định cảnh báo: `T_w > 130 °C` (Warning), `T_w > 145 °C` (Alarm), có thể sửa theo máy.

### 5.8 Luật cảnh báo cục bộ (rules engine – cấp 1)

#### 5.8.1 Vùng ISO 20816-3 (nhóm 2: 15–300 kW)

| Nền | A/B | B/C | C/D |
|---|---|---|---|
| Cứng (rigid) | 1,4 mm/s | 2,8 mm/s | 4,5 mm/s |
| Mềm (flexible) | 2,3 mm/s | 4,5 mm/s | 7,1 mm/s |

- Đại lượng so sánh: `iso_vrms_mm_s` lớn nhất trong 3 trục (bỏ trục dọc trục nếu cấu hình `iso_axes` chỉ gồm hướng kính) của capture gần nhất; giữa các capture dùng VRMS (0x50/0x5C/0x68) của cảm biến làm chỉ báo nhanh (ghi rõ nguồn).
- Loại nền mỗi máy là cấu hình (`foundation: rigid|flexible`). Mặc định: GA55 rigid, bơm trục đứng flexible `[CẦN XÁC MINH bằng bump test]`.

#### 5.8.2 Mức cảnh báo

| Mức | Mã | Điều kiện (bất kỳ) |
|---|---|---|
| Bình thường | `normal` | Zone A/B, không vượt ngưỡng nào |
| Theo dõi | `watch` | Zone B cao (> 0,8 × B/C); hoặc một chỉ số vượt W_i baseline; hoặc kurtosis > 4; hoặc Criterion II |
| Cảnh báo | `warning` | Zone C; hoặc vượt A_i baseline; hoặc T_w > 130 °C; hoặc nhiệt vỏ ổ > 90 °C |
| Nguy hiểm | `danger` | Zone D; hoặc T_w > 145 °C; hoặc nhiệt ổ > 100 °C; hoặc tăng đột biến > 2× trong 10 phút |

- **Persistence**: chỉ phát cảnh báo khi điều kiện đúng ≥ `n` trong `m` lần đánh giá liên tiếp (mặc định 3/5); hủy khi sai ≥ 5 lần liên tiếp (hysteresis 10%).
- **Criterion II**: `|iso_vrms − baseline_iso_vrms| > 0.25 × B/C` (ISO 20816-1) với baseline cùng nhóm tải.
- Ngưỡng baseline (W_i, A_i) do server học và đẩy xuống edge (mục 6.6). Khi chưa có baseline → chỉ dùng ISO + nhiệt.
- Cảnh báo `warning` trở lên → kích relay/còi tại chỗ (nếu cấu hình), gửi sự kiện MQTT QoS 1, kích capture sự kiện.

### 5.9 Lưu trữ tại edge

```
/data/edge/
  edge.db                 SQLite (WAL): outbox, state, baseline cache, counters
  raw/<point>/<yyyy>/<mm>/<dd>/<capture_id>.bin.gz
  spec/<point>/.../<capture_id>.json.gz
  logs/edge-agent.log     (xoay vòng 10 × 10 MB)
```

Bảng outbox:

```sql
CREATE TABLE outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic       TEXT NOT NULL,
  qos         INTEGER NOT NULL DEFAULT 1,
  priority    INTEGER NOT NULL DEFAULT 2,   -- 0 = cao nhất (event), 3 = thấp (waveform)
  payload     BLOB NOT NULL,                -- đã nén nếu lớn
  created_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  sent_at     TEXT
);
CREATE INDEX idx_outbox_pending ON outbox(sent_at, priority, id);
```

- Gửi theo thứ tự `priority, id`. Xóa sau khi có PUBACK. Giữ tối đa 7 ngày hoặc 8 GB; quá thì xóa waveform cũ nhất trước, giữ events và metrics.
- Định dạng file sóng `.bin.gz`: header JSON 1 dòng (`{"fs_hz":..,"axes":["x","y","z"],"scale":"g_per_lsb=0.00048828125","frames":..}\n`) + int16 little-endian xen kẽ X,Y,Z; gzip.

### 5.10 Giao tiếp MQTT (hợp đồng dữ liệu)

- Broker: `mqtts://<server>:8883`, TLS 1.2+, xác thực: username = `gateway_id`, password = token riêng mỗi gateway (hoặc chứng chỉ client).
- Client ID: `edge-<gateway_id>`; keepalive 60 s; clean start = false; LWT: topic `sm/v1/<tenant>/<site>/<gw>/status`, payload `{"online":false}`, retained.
- Tiền tố topic: `sm/v1/<tenant>/<site>/<gateway>/`

| Topic (sau tiền tố) | Hướng | QoS | Retained | Chu kỳ | Nội dung |
|---|---|---|---|---|---|
| `status` | up | 1 | có | khi đổi | online/offline, version |
| `health` | up | 0 | không | 60 s | CPU, RAM, disk, nhiệt SoC, RSSI 4G, outbox size |
| `metrics/vib/<point>` | up | 1 | không | 10 s | Chỉ số rung gộp 10 s |
| `metrics/vibstat/<point>` | up | 1 | không | 10 s | Khối B2 |
| `metrics/vibenergy/<point>` | up | 0 | không | 60 s | Khối B3 |
| `metrics/power/<machine>` | up | 1 | không | 10 s | Điện |
| `metrics/temp/<machine>` | up | 1 | không | 10 s | PT100 + nhiệt cuộn dây ước lượng |
| `features/<point>` | up | 1 | không | mỗi capture | FeatureSet (5.6.10) |
| `waveform/<point>` | up | 1 | không | mỗi capture | Sóng thô nén (base64) – có thể tắt khi băng thông thấp |
| `spectrum/<point>` | up | 1 | không | mỗi capture | Phổ đã tính (nén) |
| `events` | up | 1 | không | khi xảy ra | Cảnh báo, lỗi cảm biến, sự kiện hệ thống |
| `cmd` | down | 1 | không | — | Lệnh từ server |
| `cmd/ack` | up | 1 | không | — | Kết quả thực hiện lệnh |
| `config` | down | 1 | có | — | Cấu hình đầy đủ (JSON tương đương YAML) |

Payload mẫu:

```json
// metrics/vib/ga55-01-de
{
  "msg_id": "01J9ZK7Q3W8V...",           // ULID, dùng để chống trùng
  "ts": "2026-10-08T14:03:30.000Z",       // cuối cửa sổ
  "window_s": 10,
  "point_id": "ga55-01-de",
  "sensor": {"model": "WTVB05", "addr": 17, "sr_code": 4, "mode": 0, "fw": "1.8"},
  "vel_mm_s":  {"x": 1.82, "y": 2.05, "z": 0.91},       // trung bình VX..VZ
  "vel_mm_s_max": {"x": 1.95, "y": 2.20, "z": 0.98},
  "disp_um":   {"x": 21, "y": 25, "z": 9},
  "freq_hz":   {"x": 49.6, "y": 49.6, "z": 99.2},
  "acc_g":     {"x": 0.01, "y": -0.02, "z": 1.00},
  "temp_c": 41.25,
  "flags": []
}
```

```json
// metrics/power/ga55-01
{ "msg_id": "...", "ts": "...", "window_s": 10, "machine_id": "ga55-01",
  "u_v": [398.2, 399.1, 397.8], "i_a": [82.1, 83.0, 81.7], "p_kw": 49.8, "q_kvar": 21.2,
  "pf": 0.92, "f_hz": 50.01, "thd_u_pct": 2.1, "thd_i_pct": 6.3, "kwh": 12345.6,
  "i_unbalance_pct": 0.8, "u_unbalance_pct": 0.3, "load_pct": 81.2, "running": true }
```

```json
// metrics/temp/ga55-01
{ "msg_id": "...", "ts": "...", "machine_id": "ga55-01",
  "frame_temp_c": 58.3, "ambient_temp_c": 33.1,
  "winding_temp_est_c": 101.7, "winding_rise_est_k": 68.6, "thermal_model": "v1" }
```

```json
// events
{ "msg_id": "...", "ts": "...", "event_id": "ev_...", "type": "alarm",
  "state": "raised",                         // raised | cleared | acknowledged
  "severity": "warning",                     // watch | warning | danger
  "machine_id": "ga55-01", "point_id": "ga55-01-de",
  "rule": "iso_zone", "metric": "iso_vrms_mm_s", "value": 3.1, "threshold": 2.8,
  "message": "Rung vượt vùng B/C (ISO 20816-3)", "capture_id": "c_..." }
```

```json
// waveform/<point>
{ "msg_id": "...", "capture_id": "c_...", "ts": "...", "fs_hz": 8000, "frames": 8,
  "frames_contiguous": false, "encoding": "int16le-xyz-interleaved+gzip+base64",
  "g_per_lsb": 0.00048828125, "data": "H4sIAAAA..." }
```

```json
// cmd (down) – ví dụ
{ "cmd_id": "cmd_123", "type": "capture_now", "point_id": "ga55-01-de", "profile": "bearing" }
// các type: capture_now | reload_config | set_sensor_param | reboot | ota_update | ping | upload_logs
// cmd/ack
{ "cmd_id": "cmd_123", "status": "ok", "detail": "capture c_... queued" }
```

Ước tính dữ liệu 4G (Nam Hồng, 6 điểm, có gửi waveform): metrics ≈ 6 × 3 bản tin/10 s × ~400 B ≈ 6 MB/ngày; features ≈ 1 MB/ngày; waveform orders (2 frame × 6 KB nén ~4 KB) × 96/ngày × 6 ≈ 2,3 MB; bearing (8 frame) × 24 × 6 ≈ 4 MB → **tổng ~15–20 MB/ngày (~0,5 GB/tháng)**.

### 5.11 Cấu hình edge (`/etc/edge-agent/edge.yaml`)

```yaml
gateway:
  id: hem-gw-01
  tenant: hem
  site: hem-factory
  timezone: Asia/Ho_Chi_Minh
mqtt:
  url: mqtts://iot.example.vn:8883
  username: hem-gw-01
  password_file: /etc/edge-agent/mqtt.token
  ca_file: /etc/edge-agent/ca.pem
  send_waveforms: true
storage:
  dir: /data/edge
  max_bytes: 8589934592
  retention_days: 7
buses:
  - id: busA
    device: /dev/ttyAS6
    baud: 230400
    timeout_ms: 150
    raw_timeout_ms: 800
  - id: busB
    device: /dev/ttyUSB0
    baud: 9600
    timeout_ms: 300
machines:
  - id: ga55-01
    name: "Máy nén GA55 #1"
    type: compressor_motor
    rated_power_kw: 55
    rated_speed_rpm: 2978
    poles: 2
    line_freq_hz: 50
    iso_group: 2
    foundation: rigid
    iso_band_hz: [10, 1000]
    thermal:
      i_n_a: 100          # [CẦN XÁC MINH] chưa có trên nhãn
      dt_n_k: 80
      a: 0.25
      tau_run_s: 2700
      k_neg: 3
      k_frame: 0
      c_frame: 0.4
    power_meter:
      driver: modbus_tcp
      host: 192.168.10.21
      port: 502
      unit_id: 1
      register_map: generic_3ph_v1     # tên bản đồ thanh ghi trong code
    temps:
      - {role: frame,   bus: busB, addr: 1, channel: 1}
      - {role: ambient, bus: busB, addr: 1, channel: 3}
    points:
      - id: ga55-01-de
        name: "Ổ DE"
        location: de
        sensor: {driver: wtvb05, bus: busA, addr: 0x11, velocity_scale: 0.01}
        axes_map: {x: radial_h, y: axial, z: radial_v}   # ghi theo cách lắp thực tế
        iso_axes: [x, z]
        bearing: null                                    # chưa có mã ổ GA55
        idle_sr: 4
        profiles:
          - {name: orders,  sr: 4, frames: 4, every_s: 900}
          - {name: bearing, sr: 2, frames: 8, every_s: 3600, bandpass_hz: [1000, 3000]}
      - id: ga55-01-nde
        location: nde
        sensor: {driver: wtvb05, bus: busA, addr: 0x12, velocity_scale: 0.01}
        axes_map: {x: radial_h, y: axial, z: radial_v}
        iso_axes: [x, z]
        idle_sr: 4
        profiles:
          - {name: orders,  sr: 4, frames: 4, every_s: 900}
          - {name: bearing, sr: 2, frames: 8, every_s: 3600, bandpass_hz: [1000, 3000]}
sensor_policy:
  allow_flash_write: false
  max_flash_writes_per_day: 24
rules:
  persistence: {n: 3, m: 5}
  winding_warning_c: 130
  winding_alarm_c: 145
  bearing_temp_warning_c: 90
  bearing_temp_alarm_c: 100
local_alarm:
  enabled: true
  relay_gpio: 203            # [CẦN XÁC MINH] số GPIO thực tế trên board
  buzzer: true
  min_severity: warning
```

Ví dụ khối bơm Nam Hồng (khác biệt chính):

```yaml
  - id: pump-01
    rated_power_kw: 110
    rated_speed_rpm: 590
    poles: 10
    foundation: flexible
    iso_band_hz: [2, 1000]
    thermal: {i_n_a: 226, dt_n_k: 80, a: 0.25, tau_run_s: 3600, k_neg: 3}
    points:
      - id: pump-01-top
        location: nde_top
        sensor: {driver: wtvb05, bus: busA, addr: 0x31, velocity_scale: 0.01}
        bearing: {model: "6322", n_balls: null, bd_mm: null, pd_mm: null, contact_deg: 0}  # [CẦN XÁC MINH hình học]
        idle_sr: 6
        profiles:
          - {name: orders,  sr: 6, frames: 2, every_s: 900}
          - {name: iso,     sr: 5, frames: 2, every_s: 900}
          - {name: bearing, sr: 2, frames: 8, every_s: 3600, bandpass_hz: [1000, 3000]}
```

### 5.12 Sức khỏe, watchdog, nhật ký

- Watchdog phần cứng (`/dev/watchdog` nếu có `[CẦN XÁC MINH]`): agent "kick" mỗi 10 s; nếu vòng chính treo > 60 s thì không kick → board reset.
- Supervisor: init script tự khởi động lại agent nếu thoát (vòng `while true` hoặc `start-stop-daemon` + respawn).
- Health 60 s: `cpu_pct`, `mem_rss_mb`, `disk_free_mb`, `soc_temp_c` (`/sys/class/thermal/...`), `uptime_s`, `outbox_pending`, `bus_stats` (request/timeout/crc theo thiết bị), `mqtt_connected`, `net_iface` (eth0/ppp0), `rssi_dbm` (AT+CSQ qua EC20 nếu có).

### 5.13 Triển khai lên T153

```
/usr/local/bin/edge-agent            (binary)
/usr/local/bin/wtvb-config
/etc/edge-agent/edge.yaml, mqtt.token, ca.pem
/etc/init.d/S99edge-agent            (start/stop, respawn)
/data/edge/                          (thẻ TF mount tại /data, ext4, noatime)
```

- OTA: lệnh `ota_update` chứa URL + SHA-256; agent tải binary mới vào `/usr/local/bin/edge-agent.new`, kiểm tra hash, chạy `--self-test`, đổi tên (giữ `.prev`), restart; nếu agent mới không kết nối MQTT trong 5 phút → script init quay về `.prev`.
- Đổi mật khẩu root mặc định; tắt SSH bằng mật khẩu, dùng key.

### 5.14 Bộ mô phỏng cảm biến (sensor-sim)

- Mở một đầu của cặp PTY ảo (`socat -d -d pty,raw,echo=0 pty,raw,echo=0`), agent dùng đầu còn lại.
- Đáp ứng đúng khung Modbus và RAWFIFO như mục 3.1 (nhiều địa chỉ trên cùng bus).
- Sinh tín hiệu: `a(t) = Σ A_k sin(2π k f1X t + φ_k) + bearing_impulses(BPFO) + noise`, có tham số kịch bản: `healthy`, `unbalance` (tăng 1X), `misalignment` (2X lớn, trục dọc trục), `looseness` (chuỗi hài), `bearing_outer` (xung lặp BPFO điều chế cộng hưởng 2,5 kHz), `sensor_flatline`, `saturation`.
- Tính và trả các thanh ghi chỉ số (V, D, Hz, thống kê) nhất quán với tín hiệu sinh ra.
- Có thể cấu hình độ trễ, tỷ lệ lỗi CRC, timeout để test độ bền.
## 6. Server

### 6.1 Thành phần (docker-compose)

| Service | Image / công nghệ | Cổng | Vai trò |
|---|---|---|---|
| `caddy` | caddy:2 | 80, 443 | HTTPS tự động (Let's Encrypt), reverse proxy `/api`, `/ws`, web tĩnh |
| `emqx` | emqx/emqx:5 | 8883 (TLS), 18083 (dashboard, chỉ nội bộ) | MQTT broker; xác thực gateway bằng DB/HTTP auth; ACL theo topic |
| `db` | timescale/timescaledb:latest-pg16 | 5432 (nội bộ) | Dữ liệu quan hệ + chuỗi thời gian |
| `minio` | minio/minio | 9000 (nội bộ) | Sóng thô, phổ, báo cáo PDF |
| `ingest` | Python 3.12, `paho-mqtt` hoặc `aiomqtt`, `asyncpg`, `pydantic` | — | Subscribe MQTT → validate → ghi DB/MinIO → đẩy realtime |
| `analytics` | Python 3.12, `numpy`, `scipy`, `scikit-learn`, `pandas`, APScheduler | — | Baseline, Criterion II, phát hiện bất thường, tính lại phổ, RUL, báo cáo |
| `api` | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2 (async) | 8000 (nội bộ) | REST + WebSocket, xác thực JWT, RBAC, OpenAPI |
| `notifier` | Python 3.12 | — | Email (SMTP), Zalo OA, Telegram bot, SMS gateway |
| `redis` | redis:7 | 6379 (nội bộ) | Pub/sub realtime giữa ingest → api (WebSocket), cache, khóa job |
| `web` | build tĩnh React (phục vụ bởi Caddy) | — | Giao diện |

Yêu cầu máy chủ khởi điểm: 4 vCPU, 8 GB RAM, 200 GB SSD (VPS). Có bản cài **tại chỗ (on-premise)** dùng cùng compose.

Biến môi trường chính (`.env`): `DB_URL`, `MQTT_URL`, `MQTT_INGEST_USER/PASS`, `MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET`, `JWT_SECRET`, `SMTP_*`, `ZALO_OA_TOKEN`, `TELEGRAM_BOT_TOKEN`, `SMS_*`, `PUBLIC_BASE_URL`.

### 6.2 Mô hình dữ liệu (PostgreSQL + TimescaleDB)

```sql
-- ===== Danh mục / tài sản =====
CREATE TABLE tenants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE sites (
  id TEXT PRIMARY KEY, tenant_id TEXT REFERENCES tenants(id),
  name TEXT NOT NULL, address TEXT, timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  network TEXT CHECK (network IN ('lan','4g','other')));

CREATE TABLE gateways (
  id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id),
  hw_model TEXT DEFAULT 'T153-HelperBoard', fw_version TEXT,
  mqtt_username TEXT UNIQUE, mqtt_password_hash TEXT,
  last_seen TIMESTAMPTZ, online BOOLEAN DEFAULT false, config_version INT DEFAULT 0);

CREATE TABLE bearings (
  id SERIAL PRIMARY KEY, model TEXT NOT NULL, maker TEXT,
  n_balls INT, bd_mm NUMERIC, pd_mm NUMERIC, contact_deg NUMERIC DEFAULT 0,
  -- hệ số tần số lỗi theo bậc (nếu nhà sản xuất cho sẵn), ưu tiên dùng nếu có
  bpfo_x NUMERIC, bpfi_x NUMERIC, bsf_x NUMERIC, ftf_x NUMERIC);

CREATE TABLE machines (
  id TEXT PRIMARY KEY, site_id TEXT REFERENCES sites(id), name TEXT NOT NULL,
  type TEXT,                         -- compressor_motor | pump_motor | fan_motor ...
  maker TEXT, model TEXT, serial TEXT,
  rated_power_kw NUMERIC, rated_speed_rpm NUMERIC, poles INT, line_freq_hz NUMERIC DEFAULT 50,
  rated_voltage_v NUMERIC, rated_current_a NUMERIC, insulation_class TEXT,
  mounting TEXT,                     -- horizontal | vertical
  iso_group INT DEFAULT 2, foundation TEXT CHECK (foundation IN ('rigid','flexible')),
  iso_band_lo_hz NUMERIC, iso_band_hi_hz NUMERIC DEFAULT 1000,
  thermal_params JSONB,              -- {i_n_a, dt_n_k, a, tau_run_s, ...}
  meta JSONB, photo_url TEXT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE measurement_points (
  id TEXT PRIMARY KEY, machine_id TEXT REFERENCES machines(id),
  name TEXT, location TEXT,          -- de | nde | nde_top | de_bottom
  gateway_id TEXT REFERENCES gateways(id),
  sensor_model TEXT DEFAULT 'WTVB05', sensor_serial TEXT, sensor_addr INT,
  axes_map JSONB,                    -- {"x":"radial_h","y":"axial","z":"radial_v"}
  iso_axes TEXT[] DEFAULT '{x,z}',
  bearing_id INT REFERENCES bearings(id),
  calibration JSONB,                 -- hệ số hiệu chuẩn theo trục/tần số (mục 9)
  installed_at TIMESTAMPTZ, photo_url TEXT, active BOOLEAN DEFAULT true);

-- ===== Chuỗi thời gian =====
CREATE TABLE vib_metrics (
  ts TIMESTAMPTZ NOT NULL, point_id TEXT NOT NULL, axis CHAR(1) NOT NULL,   -- x|y|z
  vel_mm_s REAL, vel_mm_s_max REAL, disp_um REAL, freq_hz REAL, acc_g REAL,
  acc_rms_g REAL, vel_rms_mm_s REAL, disp_rms_mm REAL, crest REAL, kurtosis REAL,
  skew REAL, wave_index REAL, peak_index REAL, pulse_coef REAL, acc_var REAL,
  vel_kurt REAL, err_code INT, temp_c REAL, sr_code SMALLINT, mode SMALLINT,
  flags TEXT[], msg_id TEXT);
SELECT create_hypertable('vib_metrics', 'ts', chunk_time_interval => INTERVAL '7 days');
CREATE INDEX ON vib_metrics (point_id, axis, ts DESC);
CREATE UNIQUE INDEX ON vib_metrics (point_id, axis, ts);   -- chống trùng khi gửi lại

CREATE TABLE vib_energy (
  ts TIMESTAMPTZ NOT NULL, point_id TEXT NOT NULL, axis CHAR(1) NOT NULL,
  points REAL[8], areas REAL[6], total REAL);
SELECT create_hypertable('vib_energy', 'ts');

CREATE TABLE power_metrics (
  ts TIMESTAMPTZ NOT NULL, machine_id TEXT NOT NULL,
  u_v REAL[3], i_a REAL[3], p_kw REAL, q_kvar REAL, pf REAL, f_hz REAL,
  thd_u_pct REAL, thd_i_pct REAL, kwh DOUBLE PRECISION,
  i_unbalance_pct REAL, u_unbalance_pct REAL, load_pct REAL, running BOOLEAN);
SELECT create_hypertable('power_metrics', 'ts');

CREATE TABLE temp_metrics (
  ts TIMESTAMPTZ NOT NULL, machine_id TEXT NOT NULL,
  frame_temp_c REAL, ambient_temp_c REAL, bearing_temp_c REAL,
  winding_temp_est_c REAL, winding_rise_est_k REAL, thermal_model TEXT);
SELECT create_hypertable('temp_metrics', 'ts');

CREATE TABLE captures (                 -- mỗi lần thu sóng + đặc trưng
  capture_id TEXT PRIMARY KEY, ts TIMESTAMPTZ NOT NULL, point_id TEXT NOT NULL,
  profile TEXT, fs_hz REAL, sr_code SMALLINT, frames INT, frames_contiguous BOOLEAN,
  n_fft INT, df_hz REAL, running BOOLEAN, load_pct REAL, speed_hz REAL, speed_confidence TEXT,
  features JSONB,                       -- nguyên khối "axes" + "envelope" của FeatureSet
  iso_vrms_max_mm_s REAL, iso_zone CHAR(1),
  waveform_key TEXT, spectrum_key TEXT, quality_flags TEXT[],
  processed_by TEXT DEFAULT 'edge', reprocessed_at TIMESTAMPTZ);
CREATE INDEX ON captures (point_id, ts DESC);

-- Tổng hợp liên tục cho biểu đồ dài hạn
CREATE MATERIALIZED VIEW vib_metrics_1h WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', ts) AS bucket, point_id, axis,
       avg(vel_mm_s) AS vel_avg, max(vel_mm_s_max) AS vel_max,
       avg(acc_rms_g) AS acc_rms_avg, max(kurtosis) AS kurt_max, avg(temp_c) AS temp_avg
FROM vib_metrics GROUP BY bucket, point_id, axis;

-- ===== Baseline, ngưỡng, sự kiện =====
CREATE TABLE baselines (
  id SERIAL PRIMARY KEY, point_id TEXT, machine_id TEXT,
  feature TEXT NOT NULL,                -- vd 'iso_vrms_mm_s', 'x.orders.1', 'env.bpfo'
  load_bin TEXT DEFAULT 'all',          -- '<50' | '50-80' | '>80' | 'all'
  median REAL, mad REAL, n_samples INT, period_from TIMESTAMPTZ, period_to TIMESTAMPTZ,
  warn REAL, alarm REAL, warn_min REAL, alarm_min REAL,
  status TEXT DEFAULT 'learning',       -- learning | active | frozen
  version INT DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE alarm_rules (
  id SERIAL PRIMARY KEY, scope TEXT,    -- global | machine | point
  scope_id TEXT, rule TEXT NOT NULL,    -- iso_zone | baseline | criterion2 | winding_temp | bearing_temp | anomaly | rate
  params JSONB, severity TEXT, enabled BOOLEAN DEFAULT true);

CREATE TABLE events (
  event_id TEXT PRIMARY KEY, ts TIMESTAMPTZ NOT NULL, machine_id TEXT, point_id TEXT,
  type TEXT,                            -- alarm | sensor_fault | gateway | system | maintenance
  severity TEXT,                        -- info | watch | warning | danger
  state TEXT,                           -- raised | acknowledged | diagnosed | resolved | closed
  rule TEXT, metric TEXT, value REAL, threshold REAL, message TEXT,
  capture_id TEXT, source TEXT,         -- edge | server
  ack_by TEXT, ack_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
  diagnosis JSONB,                      -- {fault, confidence, evidence[], recommendation}
  feedback JSONB);                      -- phản hồi kỹ sư: đúng/sai, lỗi thật
CREATE INDEX ON events (machine_id, ts DESC);

CREATE TABLE maintenance_logs (
  id SERIAL PRIMARY KEY, machine_id TEXT, point_id TEXT, ts TIMESTAMPTZ,
  action TEXT,                          -- bearing_replace | alignment | balancing | lubrication | other
  description TEXT, found_fault TEXT, photos TEXT[], by_user TEXT,
  reset_baseline BOOLEAN DEFAULT false);

-- ===== Kiểm chứng sai số =====
CREATE TABLE accuracy_tests (
  id SERIAL PRIMARY KEY, point_id TEXT, ts TIMESTAMPTZ, load_state TEXT,
  reference_device TEXT, reference_cert TEXT, quantity TEXT,   -- iso_vrms | acc_rms | amp_1x | temp
  axis CHAR(1), freq_hz REAL, ref_value REAL, dut_value REAL, error_pct REAL,
  capture_id TEXT, operator TEXT, notes TEXT);

-- ===== Người dùng, quyền, cấu hình =====
CREATE TABLE users (
  id SERIAL PRIMARY KEY, email TEXT UNIQUE, name TEXT, password_hash TEXT,
  phone TEXT, zalo_id TEXT, telegram_chat_id TEXT, active BOOLEAN DEFAULT true);
CREATE TABLE user_roles (
  user_id INT REFERENCES users(id), tenant_id TEXT, site_id TEXT,
  role TEXT CHECK (role IN ('viewer','operator','engineer','analyst','admin')));
CREATE TABLE notification_prefs (
  user_id INT REFERENCES users(id), channel TEXT, min_severity TEXT, enabled BOOLEAN DEFAULT true);
CREATE TABLE gateway_configs (
  gateway_id TEXT, version INT, config JSONB, created_by TEXT, created_at TIMESTAMPTZ DEFAULT now(),
  applied_at TIMESTAMPTZ, PRIMARY KEY (gateway_id, version));
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ DEFAULT now(), user_id INT, action TEXT, target TEXT, detail JSONB);
```

Chính sách lưu trữ: `vib_metrics` raw 10 s giữ 180 ngày (nén chunk sau 7 ngày), aggregate 1 h giữ vĩnh viễn; captures/waveform giữ 2 năm (MinIO lifecycle); events giữ vĩnh viễn.

Khóa đối tượng MinIO: `raw/<point>/<yyyy>/<mm>/<dd>/<capture_id>.bin.gz`, `spec/...json.gz`, `reports/<tenant>/<yyyy-mm>/<machine>.pdf`.

### 6.3 Dịch vụ ingest

1. Subscribe `sm/v1/+/+/+/#` với user nội bộ.
2. Tách `tenant/site/gateway` từ topic; kiểm tra gateway thuộc đúng tenant/site trong DB (chống giả mạo).
3. Validate payload bằng Pydantic model tương ứng topic; lỗi → ghi `ingest_errors` (log) và bỏ qua.
4. Chống trùng: `msg_id` lưu Redis 48 h (SETNX); DB có unique index.
5. Ghi DB theo lô (batch 500 dòng hoặc 1 s). Waveform/spectrum: giải base64 → lưu MinIO → cập nhật `captures.waveform_key`.
6. Publish Redis channel `rt:<point_id>` / `rt:machine:<id>` / `rt:events` để API đẩy WebSocket.
7. Event `alarm` → lưu `events` → publish Redis `notify` → notifier.
8. Cập nhật `gateways.last_seen`, `online`.

### 6.4 Dịch vụ analytics (job định kỳ)

| Job | Chu kỳ | Mô tả |
|---|---|---|
| `reprocess_capture` | khi có capture mới | Đọc sóng từ MinIO, tính lại bằng Python (numpy/scipy) đúng thuật toán mục 5.6 để kiểm tra chéo edge; áp hệ số hiệu chuẩn; cập nhật `captures.features` (giữ bản edge trong `features.edge`) |
| `iso_zone` | khi có capture | Xếp vùng A/B/C/D theo máy |
| `baseline_learn` | hằng ngày 02:00 | Với mỗi feature và nhóm tải: lấy dữ liệu "sạch" (running, không cờ lỗi, không có event warning+) trong cửa sổ học (mặc định 14–28 ngày đầu, hoặc sau bảo trì); tính median, MAD; `warn = max(median + 3·1.4826·MAD, warn_min)`, `alarm = max(median + 6·1.4826·MAD, alarm_min)`; trạng thái `learning` → `active` khi n ≥ 500 mẫu chỉ số hoặc ≥ 200 capture |
| `push_thresholds` | khi baseline đổi | Ghép ngưỡng vào cấu hình gateway, tăng `config_version`, publish `config` (retained) |
| `criterion2` | mỗi giờ | So `iso_vrms` trung vị 1 h với baseline cùng nhóm tải; vượt 0,25 × B/C → event `watch` |
| `trend_rate` | mỗi giờ | Hồi quy tuyến tính 7 ngày của các feature chính; độ dốc vượt ngưỡng → event `watch` "tăng nhanh bất thường" |
| `anomaly_train` | hằng tuần | Khi đủ ≥ 60 ngày dữ liệu sạch: Isolation Forest (scikit-learn) trên vector đặc trưng chuẩn hóa theo tải; lưu model theo máy (joblib trong MinIO) |
| `anomaly_score` | mỗi capture | Điểm bất thường 0–1; health index = 100 × (1 − score); > 0,7 liên tục 3 lần → event `watch`/`warning` |
| `diagnose` | khi có event hoặc capture vượt ngưỡng | Luật chẩn đoán (6.5) → `events.diagnosis` |
| `rul_estimate` | hằng ngày (giai đoạn sau) | Khi health index giảm có xu hướng: khớp hàm mũ `y = a·e^(b·t)` lên feature xuống cấp (vd `env.bpfo`); RUL = thời điểm chạm ngưỡng `alarm`; khoảng tin cậy bằng bootstrap; chỉ hiển thị khi R² > 0,7 và ≥ 10 điểm |
| `monthly_report` | ngày 1 hằng tháng | PDF báo cáo theo máy (vùng ISO, xu hướng, sự kiện, khuyến nghị) → MinIO + email |
| `gateway_watch` | mỗi phút | Gateway không gửi health > 3 phút → event `gateway offline` |

Vector đặc trưng cho AI (mỗi capture): `iso_vrms` (3 trục), `orders.0.5..6` (3 trục), `acc_rms`, `kurtosis`, `crest`, `env_rms`, `bpfo/bpfi_env` (nếu có), `temp_c`, `winding_rise_est_k`, `load_pct`, `speed_hz`. Chuẩn hóa: chia cho median baseline của nhóm tải tương ứng.

### 6.5 Luật chẩn đoán (phiên bản 1)

Tỷ lệ là ngưỡng khởi điểm, cấu hình được trong `alarm_rules.params`, hiệu chỉnh sau giai đoạn thử nghiệm.

| Lỗi | Điều kiện chính | Bằng chứng phụ | Khuyến nghị |
|---|---|---|---|
| Mất cân bằng | `orders.1` hướng kính ≥ 70% năng lượng 10–1000 Hz và vượt W | Dọc trục thấp (< 50% hướng kính); 2X < 30% 1X | Kiểm tra bám bẩn cánh quạt; cân bằng động |
| Lệch tâm | `orders.2 ≥ 0,5 × orders.1` | `orders.1/2` dọc trục ≥ 0,5 × hướng kính; DE > NDE | Căn chỉnh trục bằng laser |
| Lỏng cơ khí | ≥ 4 trong các bậc 1..6 vượt ngưỡng nền; có 0,5X hoặc 1,5X | Kurtosis dao động; biên độ thất thường giữa các capture | Kiểm tra bulông chân, bệ, mặt bích |
| Lỗi vòng bi | Phổ bao có đỉnh tại BPFO/BPFI/2×BSF/FTF (± 2 bin) với ≥ 2 hài, tỷ số đỉnh/nền ≥ 3 | Kurtosis > 4; `acc_rms` tăng; nhiệt ổ tăng (giai đoạn muộn) | Bôi trơn; lên kế hoạch thay vòng bi |
| Lỗi điện stator | Đỉnh 2×f_line (100 Hz) mạnh, không đổi theo tốc độ | Mất cân bằng dòng > 5%; THD cao | Kiểm tra nguồn, cuộn dây |
| Quá nhiệt cuộn dây | `winding_temp_est_c` > ngưỡng | Tải > 100%, mất cân bằng pha, nhiệt môi trường cao | Giảm tải; kiểm tra làm mát |
| Cộng hưởng (bơm trục đứng) | Biên độ lớn ở một phương ngang, không trùng bậc | Thay đổi mạnh theo điều kiện vận hành | Bump test, gia cường kết cấu |
| Không xác định | Anomaly score cao nhưng không khớp luật nào | — | Kỹ sư xem phổ |

`diagnosis` JSON:

```json
{ "fault": "misalignment", "confidence": 0.72,
  "evidence": [
    {"feature": "x.orders.2", "value": 1.9, "ref": 1.4, "note": "2X ≥ 0,5 × 1X"},
    {"feature": "y.orders.1", "value": 1.2, "note": "rung dọc trục cao"}],
  "recommendation": "Căn chỉnh trục động cơ – máy nén bằng thiết bị laser",
  "rules_version": "diag-v1" }
```

Edge xử lý cấp 1 (ISO, nhiệt, ngưỡng baseline, persistence). Server xử lý cấp 2 (Criterion II, xu hướng, chẩn đoán, AI). Sự kiện có trường `source` để phân biệt.

### 6.6 REST API (FastAPI, tiền tố `/api/v1`)

Xác thực: `POST /auth/login` → JWT access (15 phút) + refresh (7 ngày, httpOnly cookie). Mọi endpoint lọc theo quyền tenant/site của user.

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/auth/login`, `/auth/refresh`, `/auth/logout` | Đăng nhập |
| GET | `/me` | Thông tin user, quyền |
| GET | `/sites` | Danh sách site |
| GET | `/overview?site_id=` | Tổng quan: số máy theo trạng thái, thẻ từng máy (health, iso_zone, rung max, nhiệt, RUL), cảnh báo mới nhất |
| GET/POST/PATCH | `/machines`, `/machines/{id}` | CRUD máy |
| GET/POST/PATCH | `/points`, `/points/{id}` | CRUD điểm đo |
| GET/POST | `/bearings` | Thư viện vòng bi |
| GET | `/machines/{id}/status` | Trạng thái hiện tại: chỉ số mới nhất từng điểm × trục, điện, nhiệt, nhiệt cuộn dây ước lượng |
| GET | `/points/{id}/metrics?from=&to=&fields=&axis=&agg=auto` | Chuỗi thời gian; `agg=auto` chọn raw/1h theo khoảng |
| GET | `/machines/{id}/power?from=&to=` | Chuỗi điện |
| GET | `/machines/{id}/temps?from=&to=` | Chuỗi nhiệt |
| GET | `/points/{id}/captures?from=&to=&profile=` | Danh sách capture + đặc trưng tóm tắt |
| GET | `/captures/{capture_id}` | Chi tiết FeatureSet |
| GET | `/captures/{capture_id}/waveform?axis=` | Sóng (JSON float, có downsample tùy chọn) |
| GET | `/captures/{capture_id}/spectrum?axis=&type=acc|vel|env&fmax=` | Phổ + vị trí con trỏ 1X..6X, BPFO… |
| GET | `/points/{id}/waterfall?from=&to=&type=` | Ma trận phổ theo thời gian |
| GET | `/events?site_id=&machine_id=&severity=&state=&from=&to=` | Danh sách sự kiện |
| PATCH | `/events/{id}` | Đổi trạng thái (ack, diagnosed, resolved), ghi chú, phản hồi đúng/sai |
| GET/POST | `/machines/{id}/maintenance` | Nhật ký bảo trì; `reset_baseline=true` → analytics học lại |
| GET | `/machines/{id}/diagnosis` | Chẩn đoán AI hiện tại + bằng chứng + khuyến nghị |
| GET | `/machines/{id}/health?from=&to=` | Chỉ số sức khỏe, anomaly score, RUL |
| GET/PUT | `/baselines?point_id=` | Xem/khóa/đặt lại baseline |
| GET/POST | `/alarm-rules` | Quản lý luật |
| GET/POST | `/accuracy-tests`, `GET /accuracy-tests/report?point_id=` | Kiểm chứng sai số, xuất biên bản PDF |
| GET | `/gateways`, `/gateways/{id}` | Trạng thái gateway, health |
| POST | `/gateways/{id}/commands` | Gửi lệnh (capture_now, reboot, ota_update…) |
| GET/PUT | `/gateways/{id}/config` | Cấu hình (có phiên bản) |
| GET | `/reports?machine_id=&month=` | Báo cáo PDF |
| GET/POST/PATCH | `/users`, `/notification-prefs` | Quản trị |
| WS | `/ws?token=` | Realtime: subscribe `{"sub":["point:ga55-01-de","machine:ga55-01","events"]}`; server đẩy bản tin metrics/events mới |

Quyền (RBAC):

| Vai trò | Quyền |
|---|---|
| viewer | Xem tổng quan, báo cáo |
| operator | + xác nhận cảnh báo |
| engineer | + xem phổ, sóng, ghi bảo trì, phản hồi chẩn đoán |
| analyst | + sửa ngưỡng, baseline, luật, kiểm chứng sai số, gửi lệnh gateway |
| admin | + quản lý user, tài sản, gateway, cấu hình |

### 6.7 Thông báo

- Kênh: email, Zalo OA (ưu tiên tại Việt Nam), Telegram (dễ thử nghiệm), SMS (tùy chọn).
- Gửi khi event `raised` có severity ≥ `min_severity` của user; nhắc lại nếu chưa ack sau 30 phút (warning) / 10 phút (danger); gom tin (không quá 1 tin/5 phút/máy).
- Nội dung: tên máy, điểm đo, mức, giá trị/ngưỡng, chẩn đoán sơ bộ, link mở trực tiếp trang sự kiện.

### 6.8 Bảo mật

- MQTT chỉ qua TLS 8883; mỗi gateway một tài khoản; ACL: gateway chỉ publish `sm/v1/<tenant>/<site>/<gw>/#` của mình, chỉ subscribe `.../<gw>/cmd` và `.../<gw>/config`.
- API: HTTPS, JWT, rate limit đăng nhập, mật khẩu bcrypt/argon2, audit log cho thao tác sửa cấu hình/ngưỡng/lệnh.
- Không mở cổng DB/MinIO/EMQX dashboard ra internet.
- Edge: chỉ kết nối ra ngoài (outbound); không mở cổng vào từ internet; đổi mật khẩu mặc định; SSH bằng key.
- Sao lưu DB hằng ngày (pg_dump + WAL), MinIO versioning.
## 7. Web / App (React + TypeScript)

### 7.1 Công nghệ

- React 18 + TypeScript + Vite; router: React Router; state server: TanStack Query; UI: Ant Design hoặc shadcn/ui + Tailwind; biểu đồ: **Apache ECharts** (phổ, waterfall, xu hướng hàng trăm nghìn điểm với `sampling: 'lttb'`).
- Client API sinh tự động từ OpenAPI của FastAPI (`openapi-typescript`).
- PWA (manifest + service worker) để cài lên điện thoại; push notification qua Web Push (giai đoạn sau).
- Ngôn ngữ: tiếng Việt; định dạng số kiểu Việt Nam (dấu phẩy thập phân) trên giao diện; múi giờ Asia/Ho_Chi_Minh.
- Màu trạng thái (dùng kèm icon + chữ, không chỉ màu): Bình thường (xanh lá), Theo dõi (vàng), Cảnh báo (cam), Nguy hiểm (đỏ), Mất kết nối (xám).

### 7.2 Danh sách màn hình

| # | Màn hình | Đường dẫn | Nội dung chính | Đáp ứng |
|---|---|---|---|---|
| 1 | **Tổng quan** | `/` | Bộ lọc site (HEM / Nam Hồng); số động cơ theo trạng thái ở cả 2 khu vực; thẻ từng máy (ảnh, sức khỏe 0–100, vùng ISO, rung max mm/s, nhiệt ổ, nhiệt cuộn dây ước lượng, RUL nếu có, trạng thái chạy/dừng, mất kết nối); xu hướng rung 7 ngày vẽ trên nền dải màu vùng ISO; danh sách cảnh báo mới nhất | R1, R3, R4 |
| 2 | **Giám sát thời gian thực** | `/machines/:id/live` | Sơ đồ máy với 2 điểm đo; với mỗi điểm × 3 trục: vận tốc, gia tốc, chuyển vị (số + sparkline 60 phút, cập nhật qua WebSocket); nhiệt ổ, nhiệt vỏ, nhiệt cuộn dây (nhãn "ước lượng"); điện U/I/P/cosφ/% tải; dạng sóng thô mới nhất; bảng đối chứng sai số < 5% (từ accuracy_tests) | R1, R4, R8 |
| 3 | **AI chẩn đoán kỹ thuật** | `/machines/:id/diagnosis` | Điểm bất thường + nguyên nhân có khả năng (xếp theo độ tin cậy); bằng chứng: phổ có đánh dấu 1X…6X, BPFO/BPFI, 100 Hz; dạng sóng; luật HEM đã kích hoạt; khuyến nghị hành động cụ thể; nút phản hồi "Đúng / Sai / Lỗi khác" để AI học | R5, R3 |
| 4 | Chi tiết máy | `/machines/:id` | Thông tin máy, điểm đo, ảnh lắp đặt, vòng bi, thông số nhiệt, lịch sử bảo trì | |
| 5 | Xu hướng | `/machines/:id/trends` | Chọn nhiều chỉ số/điểm/trục; khoảng thời gian; chồng % tải; dải ngưỡng W/A; đánh dấu sự kiện bảo trì | R1 |
| 6 | Phân tích phổ | `/points/:id/spectrum` | Chọn capture; phổ gia tốc/vận tốc/phổ bao; con trỏ bậc (harmonic cursor), con trỏ tần số lỗi vòng bi; so sánh với phổ baseline (vẽ chồng); waterfall theo thời gian; tải CSV | R6 |
| 7 | Cảnh báo | `/events` | Bảng lọc theo mức/trạng thái/máy; chi tiết sự kiện: giá trị, ngưỡng, chẩn đoán, capture liên quan; luồng: Mới → Đã xem → Đã chẩn đoán → Đã xử lý → Đóng; bình luận | R3 |
| 8 | Bảo trì | `/machines/:id/maintenance` | Ghi công việc, ảnh, lỗi tìm thấy; tùy chọn "học lại baseline"; so sánh trước/sau | |
| 9 | Kiểm chứng sai số | `/accuracy` | Nhập/nhập file số đo thiết bị đối chứng, ghép với capture cùng thời điểm; bảng e_i; kết luận đạt/không; xuất biên bản PDF | R8 |
| 10 | Báo cáo | `/reports` | Báo cáo tháng/quý PDF | |
| 11 | Thiết bị | `/devices` | Gateway: online, health, phiên bản, outbox; cảm biến: lần đọc cuối, lỗi CRC/timeout; gửi lệnh capture_now/reboot/OTA | |
| 12 | Cài đặt | `/settings` | Tài sản, vòng bi, luật cảnh báo, baseline, người dùng, kênh thông báo | |

Mobile (PWA): ưu tiên màn hình 1, 2 (rút gọn), 7, và thông báo đẩy; bố cục 1 cột.

### 7.3 Quy tắc biểu đồ

- Xu hướng vận tốc luôn vẽ **dải nền vùng ISO** (A xanh nhạt, B vàng nhạt, C cam nhạt, D đỏ nhạt) theo loại nền của máy.
- Phổ: trục x Hz (tùy chọn hiển thị theo bậc "X"), trục y biên độ (mm/s RMS cho vận tốc, g cho gia tốc/bao); con trỏ dọc có nhãn "1X 49,6 Hz", "BPFO 152 Hz"…
- Giá trị ước lượng (nhiệt cuộn dây, RUL) hiển thị kèm chữ "ước lượng" và khoảng tin cậy.
- Mỗi biểu đồ có nút tải dữ liệu (CSV) và hiển thị thời điểm cập nhật cuối.

---

## 8. Phương pháp đo và lắp đặt (để code đúng giả định)

| Hạng mục | GA55 (nằm ngang) | Bơm 4KA355M10 (trục đứng) |
|---|---|---|
| Vị trí | Vỏ ổ DE (phía máy nén) và NDE (phía quạt, không gắn lên nắp quạt) | Vỏ ổ trên (vị trí đánh giá chính theo ISO) và ổ dưới (sát mặt bích lắp đầu bơm) |
| Hướng trục cảm biến | Ghi trong `axes_map`; khuyến nghị một trục hướng kính ngang, một hướng kính đứng, một dọc trục | Hai trục hướng kính (ngang), một trục dọc trục (đứng) |
| Lắp | Đế dán epoxy + vít M5/M8, không khoan máy; nam châm chỉ để khảo sát | Như trên |
| Cáp | RS485 xoắn đôi chống nhiễu, đi máng riêng, cách cáp động lực ≥ 30 cm, nối đất vỏ chống nhiễu một đầu tại tủ, điện trở 120 Ω hai đầu bus | Như trên; tủ edge đặt trên cao, chống ẩm |
| Điều kiện đo hợp lệ | Máy chạy ổn định ≥ 2 phút; tách trạng thái có tải / không tải (máy nén chạy luân phiên) | Máy chạy ổn định; ghi mức nước/áp nếu có |
| Bump test | Khuyến nghị | **Bắt buộc** (xác định nền cứng/mềm, cộng hưởng gần 1X = 9,83 Hz) |

---

## 9. Kiểm chứng sai số < 5% (module `tools/accuracy-check` + màn hình 9)

### 9.1 Quy trình

1. **Thiết bị đối chứng**: gia tốc kế chuẩn có giấy hiệu chuẩn còn hạn (độ không đảm bảo ≤ ±2%) + máy phân tích rung/DAQ; bộ hiệu chuẩn rung cầm tay 1 g @ 159,2 Hz (≈ 9,8 mm/s đỉnh, ≈ 6,9 mm/s RMS); nhiệt kế tiếp xúc chuẩn.
2. **Trên bàn rung (phòng thí nghiệm)**: gắn WTVB05 lưng-kề-lưng với cảm biến chuẩn (ISO 16063-21). Đo tại 10, 20, 50, 100, 159,2, 500, 1000, 2000, 3000 Hz; biên độ 1–10 mm/s. Kết quả → **bảng hiệu chuẩn theo tần số** từng cảm biến (`measurement_points.calibration`).
3. **Tại hiện trường**: cảm biến chuẩn dán cạnh WTVB05 (≤ 30 mm, cùng phương), đo đồng thời (gửi lệnh `capture_now` cùng lúc bấm đo thiết bị chuẩn), ≥ 10 lần cho mỗi điểm × mỗi trạng thái tải.
4. **Đại lượng so sánh**: RMS vận tốc theo dải ISO; RMS gia tốc; biên độ 1X; tần số các đỉnh chính; nhiệt bề mặt.

### 9.2 Công thức và tiêu chí

```
e_i      = |X_dut,i − X_ref,i| / X_ref,i × 100%
Đạt khi: mean(e_i) ≤ 5%  VÀ  P95(e_i) ≤ 8%   (cho từng đại lượng, từng trạng thái tải)
Tần số đỉnh: |f_dut − f_ref| ≤ 1 bin (Δf)
Nhiệt độ:   |T_dut − T_ref| ≤ 2 °C  (tính theo độ, không theo %)
```

### 9.3 Hiệu chỉnh

- Hệ số hiệu chuẩn theo tần số `c(f)` (nội suy log-tần số giữa các điểm bàn rung) áp lên phổ trước khi tính RMS dải: `A_cal(f) = A(f) × c(f)`.
- Hiệu chỉnh thực hiện ở **server** (`reprocess_capture`) và đồng thời đẩy xuống edge qua cấu hình để cảnh báo tại chỗ dùng giá trị đã hiệu chỉnh.
- Biên bản PDF gồm: thiết bị chuẩn (model, số giấy hiệu chuẩn), điểm đo, điều kiện tải, bảng số liệu, e_i, kết luận, chữ ký.

---

## 10. Lộ trình lập trình (milestones) và tiêu chí nghiệm thu

| Mốc | Nội dung | Tiêu chí hoàn thành |
|---|---|---|
| M0 – Khung dự án | Monorepo, CI (lint, test), docker-compose chạy được DB + EMQX + MinIO + API rỗng + web rỗng | `docker compose up` chạy; healthcheck xanh |
| M1 – Driver WTVB05 + simulator | `modbus` (CRC, khung), driver WTVB05 (B1/B2/B3, unlock/write/save, SR, RAWFIFO), `sensor-sim`, `wtvb-config` CLI | Test đơn vị khớp các ví dụ hex trong datasheet; đọc được sim qua PTY; đọc được cảm biến thật trên PC qua USB-RS485 |
| M2 – Edge pipeline cơ bản | Scheduler, bus manager, store/outbox, MQTT uplink (metrics, health, status), config YAML | Chạy 24 h với sim: không rò bộ nhớ (RSS ổn định), outbox gửi bù đúng khi ngắt broker 1 h |
| M3 – DSP + features | FFT, phổ vận tốc, RMS ISO, orders, envelope, bearing freq, kiểm tra chất lượng; FeatureSet; waveform/spectrum upload | Sai số < 1% với sóng sin tổng hợp; simulator kịch bản unbalance/misalignment/bearing cho đặc trưng đúng hướng |
| M4 – Ingest + DB + API đọc | Ingest đầy đủ topic, DDL, API status/metrics/captures/spectrum/events, WebSocket | Dữ liệu từ edge (sim) hiện qua API trong < 5 s |
| M5 – Web MVP | Màn hình 1, 2, 6, 7, 11 | Demo end-to-end với sim và với 1 cảm biến thật |
| M6 – Cảnh báo + thông báo | Rules edge cấp 1, local alarm, events, notifier (email + Telegram/Zalo), luồng xử lý cảnh báo | Kịch bản vượt ngưỡng trên sim → còi kêu + tin nhắn trong < 1 phút |
| M7 – Thermal + điện + PT100 | Driver đồng hồ điện, PT100, mô hình nhiệt, màn hình liên quan | Mô hình chạy; so sánh với PT100 trên động cơ thử của HEM (khi có) |
| M8 – Triển khai T153 tại HEM | Build ARM, init script, OTA, cấu hình 4 điểm GA55 | Chạy ổn định 2 tuần; dữ liệu đầy đủ ≥ 95% |
| M9 – Kiểm chứng sai số | Tool + màn hình 9 + biên bản | Có biên bản cho 4 điểm đo |
| M10 – Analytics | Baseline, Criterion II, trend, chẩn đoán luật, màn hình 3 | Baseline active cho mọi điểm; chẩn đoán hiển thị bằng chứng |
| M11 – AI bất thường + báo cáo | Isolation Forest, health index, báo cáo tháng | Báo động giả ≤ 1/máy/tháng ở mức warning |
| M12 – Nam Hồng | 4G, 6 điểm, bump test, cấu hình bơm | Như M8 với 4G |
| M13 – RUL (sau) | Mô hình xu hướng xuống cấp | Dự báo có khoảng tin cậy |

---

## 11. Chiến lược kiểm thử

| Loại | Phạm vi | Công cụ |
|---|---|---|
| Unit (edge) | CRC, parser khung, scale, RAWFIFO, FFT/RMS/orders/envelope, thermal, rules, outbox | `go test`, dữ liệu trong `testdata/` |
| Golden test DSP | Cùng một sóng → edge (Go) và server (Python) cho kết quả lệch < 0,5% | File sóng mẫu dùng chung |
| Tích hợp | edge + sim + EMQX + ingest + DB | docker compose profile `test` |
| Độ bền | Ngắt mạng, ngắt broker, rút cảm biến, CRC lỗi 5%, đầy đĩa | Kịch bản trong simulator |
| Hiệu năng | 10 điểm đo, 1 năm dữ liệu giả lập; truy vấn xu hướng 30 ngày < 1 s | Script sinh dữ liệu |
| Thực địa | Đối chứng sai số (mục 9), chạy 2 tuần | Biên bản |

---

## 12. Câu hỏi mở và giả định

| # | Nội dung | Giả định tạm thời trong code |
|---|---|---|
| Q1 | WTVB05: RAWFIFO liền mạch? double-buffer? | Không liền mạch; dùng Welch |
| Q2 | WTVB05: ghi SR có cần save? | Thử không save; fallback theo `sensor_policy` |
| Q3 | WTVB05: "FS ±4%" theo thang nào; đáp ứng tần số thực | Hiệu chuẩn bằng bàn rung (mục 9) |
| Q4 | WTVB05: ý nghĩa ERRX..Z, đơn vị năng lượng phổ, nguồn 1X cho thanh ghi năng lượng | Lưu raw, chưa dùng cho luật |
| Q5 | WTVB05: bảng mã BAUD đầy đủ | 0x01..0x07 = 4800..230400 (kiểm tra bằng thực nghiệm) |
| Q6 | T153: số GPIO cho relay/còi, có `/dev/watchdog` không | Cấu hình được; tắt nếu không có |
| Q7 | Model đồng hồ điện, bản đồ thanh ghi | Driver "generic map" cấu hình bằng YAML |
| Q8 | Model module PT100 RS485 | Driver cấu hình được (địa chỉ, thanh ghi, hệ số) |
| Q9 | GA55: mã ổ đỡ, kiểu truyền động, dòng định mức | Bỏ đặc trưng vòng bi; I_N = 100 A tạm |
| Q10 | 6322: hình học (số bi, Bd, Pd) | Nhập khi có số liệu hãng vòng bi |
| Q11 | Biên bản thử phát nóng HEM cho 4KA355M10 (ΔT_N, τ) | dT_N = 80 K, τ = 45–60 phút |
| Q12 | Loại nền (cứng/mềm) từng máy | GA55 rigid, bơm flexible |

---

## 13. Phụ lục

### 13.1 Tần số đặc trưng

| Đại lượng | GA55 (2978 v/ph) | Bơm 4KA355M10 (590 v/ph, 10 cực) |
|---|---|---|
| 0,5X | 24,8 Hz | 4,92 Hz |
| 1X | 49,63 Hz | 9,833 Hz |
| 2X | 99,27 Hz (sát 100 Hz điện) | 19,67 Hz |
| 3X | 148,9 Hz | 29,5 Hz |
| 2 × f_line | 100 Hz | 100 Hz |
| Tần số trượt × số cực (sideband rotor) | phụ thuộc độ trượt thực | 10 × (10 − 9,833) ≈ 1,67 Hz |
| Cánh bơm qua (VPF) | — | số cánh × 9,833 Hz `[CẦN số cánh]` |
| BPFO/BPFI | `[CẦN mã ổ]` | 6322: tính từ hình học |

### 13.2 Ngưỡng ISO 20816-3 (RMS vận tốc, mm/s)

| Nhóm | Nền | A/B | B/C | C/D |
|---|---|---|---|---|
| 1 (> 300 kW) | cứng | 2,3 | 4,5 | 7,1 |
| 1 | mềm | 3,5 | 7,1 | 11,0 |
| 2 (15–300 kW) | cứng | 1,4 | 2,8 | 4,5 |
| 2 | mềm | 2,3 | 4,5 | 7,1 |

Dải tần: tốc độ > 600 v/ph → 10–1000 Hz; 120–600 v/ph → 2–1000 Hz.

### 13.3 Lệnh hex mẫu WTVB05 (địa chỉ 0x50)

```
Đọc gia tốc 3 trục            50 03 00 34 00 03 49 84
Đọc vận tốc 3 trục            50 03 00 3A 00 03 28 47
Đọc nhiệt độ                  50 03 00 40 00 01 88 5F
Đọc chuyển vị 3 trục          50 03 00 41 00 03 58 5E
Đọc RAWFIFO                   50 03 00 2C 00 01 48 42
Unlock                        50 06 00 69 B5 88 22 A1
Save                          50 06 00 00 00 00 84 4B
Reboot                        50 06 00 00 00 FF C4 0B
Đặt SR = 256 Hz (0x07)        50 06 00 29 00 07 14 41
Đặt baud 115200 (0x06)        50 06 00 04 00 06 45 88
Đặt địa chỉ 0x02              50 06 00 1A 00 02 24 4D
Đặt dải chuyển vị 600 µm      50 06 00 2B 00 02 75 82
Đặt MODE tần cao (0x01)       50 06 00 07 00 01 F4 4A
CRC: Modbus CRC-16 (0xA001, init 0xFFFF), byte thấp trước – đã kiểm với các ví dụ trên.
```

### 13.4 Nguồn tham khảo

- WitMotion – *WTVB05 Data Sheet & User Manual* V260519 (file nội bộ).
- Bách Kiệt – *HelperBoard T153 开发手册 V1.2* (file nội bộ).
- Tài liệu cuộc họp *Smartmotor.pptx* (HEM, 10/2026).
- ISO 20816-1, ISO 20816-3, ISO 16063-21, ISO 13373, ISO 17359, IEC 60034-1, ISO 281.
