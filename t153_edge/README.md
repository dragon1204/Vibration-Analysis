# t153_edge – phần mềm edge Smart Motor cho board T153

Phần mềm chạy trên board **Allwinner T153 HelperBoard**. Nó đọc cảm biến rung WTVB05 (RS485 Modbus RTU), module PT100 và đồng hồ điện, sau đó xử lý tín hiệu ngay tại chỗ:

- FFT, RMS vận tốc theo ISO 20816-3, các bậc 1X–6X, phổ bao vòng bi;
- cô lập nhiễu đa cảm biến theo phương pháp Beer HN;
- mô hình nhiệt cuộn dây và cảnh báo cấp 1 (relay/còi tại chỗ).

Dữ liệu được lưu đệm trong SQLite (outbox) rồi gửi lên server qua MQTT/TLS. Thiết kế bám theo `SmartMotor_System_Spec.md` mục 3 và 5.

Viết bằng Go (ADR-03), biên dịch tĩnh ARMv7 không dùng CGO, ra một file thực thi khoảng 11 MB.

## Cấu trúc

```
cmd/edge-agent     tiến trình chính
cmd/sensor-sim     mô phỏng WTVB05 + PT100 (TCP hoặc cổng serial/PTY) – không cần phần cứng
cmd/wtvb-config    công cụ đặt địa chỉ/baud/SR cho từng cảm biến trước khi lắp chung bus
internal/
  modbus           CRC-16, khung RTU, client Modbus TCP
  transport        cổng serial hoặc tcp:// (RTU-over-TCP)
  bus              1 goroutine sở hữu mỗi bus, hàng đợi ưu tiên P0..P3, thống kê lỗi
  drivers/         interface plugin (ADR-09): wtvb05 (B1/B2/B3, SR, RAWFIFO), pt100mod, powermeter (TCP + sim)
  dsp              FFT, Hann, PSD, RMS dải, orders, 1X, envelope (Butterworth filtfilt + Hilbert), cô lập nhiễu
  features         capture → FeatureSet (5.6.10) + phổ; IsolationResult (Beer HN)
  rules            vùng ISO, ngưỡng dải hẹp SOP + ràng buộc RSS, persistence n/m + hysteresis, tốc độ tăng
  thermal          mô hình nhiệt cuộn dây (5.7)
  scheduler        hẹn giờ capture lệch pha, phát hiện máy chạy ổn định
  store            SQLite WAL: outbox, state, counters; file sóng/phổ; dọn dữ liệu (7 ngày / 8 GB)
  uplink           MQTT (LWT, store-and-forward, cmd/config downlink)
  agent            điều phối toàn bộ; capture nhóm và học α
  health, localalarm, logx, sim, wavefile, ulid, version
deploy/            edge.yaml (HEM), edge.beerhn.yaml (Beer HN 450 kW), edge.dev.yaml (PC + sim), S99edge-agent
docs/              ALGORITHMS.md (thuật toán), CHANGELOG.md (khác biệt/bổ sung so với spec)
testdata/golden    sóng mẫu + kết quả dùng chung với server (golden test < 0,5%)
```

## Chạy thử trên PC (không cần phần cứng)

```bash
# 1) Mô phỏng 6 cảm biến: GA55 (DE healthy, NDE unbalance) + bộ 4 cảm biến Beer HN có nhiễu máy nén 4 thùy
go run ./cmd/sensor-sim --f1x 49.17 --lobes 4 \
  --devices 0x11:healthy,0x12:unbalance,0x41:healthy:mesh=9,0x42:healthy:mesh=3,0x43:healthy:mesh=1.2,0x44:healthy:mesh=0.9

# 2) Agent (cần broker: chạy selink_server bằng docker compose, hoặc để dữ liệu dồn vào outbox)
go run ./cmd/edge-agent --config deploy/edge.dev.yaml

# Đổi kịch bản lỗi khi đang chạy
curl -X POST "localhost:8089/scenario?addr=0x11&name=bearing_outer"
```

Kịch bản mô phỏng: `healthy | unbalance | misalignment | looseness | bearing_outer | sensor_flatline | saturation`.
Tùy chọn gây lỗi: `--crc-error-rate 0.05 --timeout-rate 0.02 --sr-needs-save --contiguous`.

Có thể chạy với PTY thật (đúng như spec 5.14):

```bash
socat -d -d pty,raw,echo=0 pty,raw,echo=0
go run ./cmd/sensor-sim --serial /dev/pts/3
# edge.yaml: device: /dev/pts/4
```

## Test

```bash
go test ./...                       # CRC theo ví dụ hex datasheet, DSP (sai số < 1%), rules, thermal, store, driver + sim
GOLDEN_WRITE=1 go test ./internal/features -run TestWriteGolden   # sinh lại golden cho server
```

## Build và triển khai lên T153

```bash
make arm                            # GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0 → bin/
make deploy T153=root@192.168.10.10
```

Trên board:

```
/usr/local/bin/edge-agent, wtvb-config
/etc/edge-agent/edge.yaml, mqtt.token, ca.pem      (token tạo bằng server: POST /api/v1/gateways hoặc tools.gateway_token)
/etc/init.d/S99edge-agent start                    (tự khởi động lại; rollback OTA nếu bản mới không kết nối MQTT trong 5 phút)
/data/edge/                                        (thẻ TF, ext4, noatime)
```

Cài đặt cảm biến mới (xuất xưởng 0x50 @ 9600). Làm từng con một trên bus riêng:

```bash
wtvb-config --port /dev/ttyAS6 --baud 9600 --addr 0x50 set-addr 0x11 --save
wtvb-config --port /dev/ttyAS6 --baud 9600 --addr 0x11 set-baud 230400 --save
wtvb-config --port /dev/ttyAS6 --baud 230400 --addr 0x11 info
```

Nhớ đổi mật khẩu root mặc định (`szbaijie`) và chỉ cho đăng nhập SSH bằng key.

## Giá trị `[CẦN XÁC MINH]` (đều nằm trong cấu hình, không hard-code)

| Mục | Nơi cấu hình |
|---|---|
| Hệ số vận tốc theo firmware (≤ 1.7: không chia 100) | `sensor.velocity_scale` |
| SR có cần save mới có hiệu lực | tự phát hiện → `ErrSrNeedsPersist`, giới hạn bởi `sensor_policy` |
| RAWFIFO liền mạch | `points[].contiguity: off \| auto` (mặc định off → Welch) |
| Bảng mã BAUD 0x01..0x07 | `drivers/wtvb05/registers.go` (`BaudCodes`) |
| Model PT100, bản đồ thanh ghi đồng hồ điện | `temp_modules[]`, `power_meter.register_map/custom_map` |
| GPIO relay/còi, `/dev/watchdog` | `local_alarm.*`, `health.watchdog` |
| Hình học vòng bi 6322, I_N GA55, ΔT_N, nền cứng/mềm | `points[].bearing`, `machines[].thermal`, `foundation` |
