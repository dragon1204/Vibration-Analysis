# selink_server – server Smart Motor

Server nhận dữ liệu từ các gateway T153 (project `../t153_edge`), lưu trữ, phân tích, chẩn đoán và phục vụ giao diện web/app. Thiết kế bám theo `SmartMotor_System_Spec.md` mục 6–9 và phương pháp phân tích rung trong `Beer HN Project.pptx`.

## Thành phần (Docker Compose, ADR-06)

| Service | Vai trò |
|---|---|
| `emqx` | MQTT broker. Gateway kết nối qua TLS :8883. Xác thực và ACL gọi sang API (`/api/v1/internal/mqtt/*`), có ACL file dự phòng khi API khởi động lại |
| `db` | PostgreSQL 16 + TimescaleDB: hypertable, tổng hợp 1 giờ, nén và chính sách lưu trữ |
| `s3` | Object storage S3 (SeaweedFS – image MinIO không còn trên Docker Hub): sóng thô `.bin.gz`, phổ `.json.gz`, model AI, báo cáo PDF |
| `redis` | Pub/sub realtime, chống trùng `msg_id`, gom tin, giới hạn số lần đăng nhập |
| `ingest` | MQTT → validate (Pydantic) → chống trùng → ghi DB theo lô / MinIO → đẩy realtime |
| `analytics` | Tính lại từ sóng thô (kiểm tra chéo với edge, áp hiệu chuẩn), chẩn đoán bằng luật, baseline, Criterion II, xu hướng, Isolation Forest, RUL, báo cáo tháng, theo dõi gateway, nhắc lại cảnh báo |
| `api` | FastAPI: REST `/api/v1` (OpenAPI tại `/api/v1/docs`), WebSocket `/ws`, JWT + RBAC |
| `notifier` | Email, Telegram, Zalo OA, SMS; gom tin (1 tin/5 phút/máy) |
| `web` | React + TypeScript + Ant Design + ECharts (PWA), phục vụ bởi Caddy (HTTPS tự động, reverse proxy) |

## Khởi động

```bash
cp .env.example .env            # đổi toàn bộ mật khẩu và secret
docker compose up -d --build    # certs → db/redis/minio → api (chạy migration + tạo admin) → emqx → ingest/analytics/notifier → web
```

- Web: http://localhost (đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- API docs: http://localhost:8000/api/v1/docs.
- EMQX dashboard: http://127.0.0.1:18083.

Nếu cổng 80/1883 đã bị dùng trên máy, đặt `HTTP_PORT`, `MQTT_DEV_PORT`… trong `.env`. Chứng chỉ TLS cho EMQX được sinh tự động vào `emqx/certs/`. Chép `emqx/certs/ca.pem` sang gateway tại `/etc/edge-agent/ca.pem`.

### Nối một gateway

```bash
# Tạo/đổi token MQTT (chỉ in ra một lần)
docker compose exec api python -m smartmotor.tools.gateway_token hem-gw-01
# Đưa cấu hình gốc lên server (có quản lý phiên bản). Từ đó server tự gộp baseline/hiệu chuẩn/α rồi đẩy xuống gateway
docker compose cp ../t153_edge/deploy/edge.yaml api:/tmp/edge.yaml
docker compose exec api python -m smartmotor.tools.push_config /tmp/edge.yaml
```

### Demo end-to-end không cần phần cứng

```bash
docker compose up -d --build
docker compose exec api python -m smartmotor.tools.gateway_token dev-gw-01 --token dev-gw-01-token
cd ../t153_edge
go run ./cmd/sensor-sim --f1x 49.17 --lobes 4 --devices 0x11:healthy,0x12:unbalance,0x41:healthy:mesh=9,0x42:healthy:mesh=3,0x43:healthy:mesh=1.2,0x44:healthy:mesh=0.9 &
go run ./cmd/edge-agent --config deploy/edge.dev.yaml      # mqtt://localhost:1883
```

Sau khoảng 2 phút sẽ có capture, phổ, vùng ISO và cảnh báo `ga55-01-nde` (unbalance). Màn hình AI chẩn đoán hiển thị "Mất cân bằng".

## Phát triển

```bash
cd services && python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest       # golden Go↔Python (< 0,5%), chẩn đoán 3 kịch bản, cô lập nhiễu, RSS
cd ../web && npm install && npm run dev      # http://localhost:5173, proxy /api → :8000
npm run gen:api                              # sinh kiểu TS từ OpenAPI
```

## Màn hình web (spec 7.2)

| # | Màn hình | Đường dẫn |
|---|---|---|
| 1 | Tổng quan: số máy theo trạng thái, thẻ máy (sức khỏe, vùng ISO, rung, nhiệt, RUL), xu hướng 7 ngày trên nền vùng ISO, cảnh báo mới | `/` |
| 2 | Giám sát thời gian thực: điểm đo × 3 trục (WebSocket, sparkline 60 phút), nhiệt (cuộn dây ghi "ước lượng"), điện, sóng thô, bảng sai số | `/machines/:id/live` |
| 3 | AI chẩn đoán: sức khỏe, nguyên nhân theo độ tin cậy, bằng chứng, phổ đánh dấu 1X…6X/BPFO/100 Hz, cô lập nhiễu S1–S4, phản hồi Đúng/Sai/Lỗi khác | `/machines/:id/diagnosis` |
| 4–5 | Chi tiết máy, Xu hướng (nhiều điểm/trục, chồng % tải, đánh dấu bảo trì, CSV) | `/machines/:id`, `/machines/:id/trends` |
| 6 | Phân tích phổ: vận tốc/gia tốc/phổ bao/đã cô lập, trục theo bậc X, so sánh baseline, dạng sóng, waterfall, CSV | `/points/:id/spectrum` |
| 7 | Cảnh báo: lọc, luồng Mới → Đã xem → Đã chẩn đoán → Đã xử lý → Đóng, bình luận, phản hồi | `/events` |
| 8 | Bảo trì (+ học lại baseline) | `/machines/:id/maintenance` |
| 9 | Kiểm chứng sai số < 5% (nhập tay/CSV, ghép capture, biên bản PDF) | `/accuracy` |
| 10–12 | Báo cáo PDF tháng · Thiết bị (health, lỗi bus, lệnh, OTA) · Cài đặt (ngưỡng SOP, α, baseline, luật, vòng bi, người dùng, kênh thông báo) | `/reports`, `/devices`, `/settings` |

## Giả lập cảm biến khi chưa có phần cứng

Bộ giả lập tự đọc máy, điểm đo và gateway trong database, sau đó phát đúng topic MQTT
của edge T153: rung 3 trục, thống kê rung, nhiệt độ, điện năng, health, waveform/capture
và ACK lệnh gateway. Simulator không ghi trực tiếp vào database.

```bash
# Bật dữ liệu demo (nhiều vùng ISO để thử giao diện)
docker compose --profile simulation up -d simulator

# Xem log / tắt trước khi cắm gateway thật
docker compose logs -f simulator
docker compose --profile simulation stop simulator

# Chọn kịch bản: normal | demo | warning | danger
SIM_SCENARIO=warning docker compose --profile simulation up -d --force-recreate simulator
```

## Thay đổi so với spec

Xem `../t153_edge/docs/CHANGELOG.md`. Phía server có thêm các cột và bảng sau, đều đánh dấu `[add]` trong `db/migrations/001_schema.sql`:

- **Cột mới:** `gateways.health`, `machines.male_lobes/isolation/band_limits`, `measurement_points.role`, `captures.anomaly_score`, `baselines.mean/std/method`, `events.comments/cleared_at/gateway_id`.
- **Bảng mới:** `gateway_commands`, `diagnoses`, `machine_health`, `reports`.
