# HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY DỰ ÁN

## 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 18.x trở lên.
- **Yarn** hoặc **npm**.
- **Docker** và **Docker Compose**: Để chạy các dịch vụ (ClickHouse, Redis, Mosquitto).

## 2. Các bước chạy dự án

### Bước 1: Khởi động các dịch vụ (Database, Message Broker)
Mở terminal tại thư mục gốc của dự án (`DATN`) và chạy lệnh:
```bash
docker-compose up -d
```
Đợi một lúc để Docker tải image và khởi động các container (ClickHouse, Redis, Mosquitto).

### Bước 2: Chạy Backend (NestJS)
Mở một terminal mới, di chuyển vào thư mục `backend`:
```bash
cd backend
```
Cài đặt thư viện:
```bash
yarn install
# hoặc npm install
```
Khởi động backend:
```bash
yarn start:dev
# hoặc npm run start:dev
```
Backend sẽ chạy tại cổng mặc định (thường là 3000 hoặc 3001, tuỳ thuộc vào file `.env`).

### Bước 3: Chạy Frontend (React/Vite)
Mở một terminal mới, di chuyển vào thư mục `frontend`:
```bash
cd frontend
```
Cài đặt thư viện:
```bash
yarn install
# hoặc npm install
```
Khởi động frontend:
```bash
yarn dev
# hoặc npm run dev
```
Frontend sẽ chạy và có thể truy cập qua trình duyệt (ví dụ: `http://localhost:5173`).

## 3. Lưu ý
- Đảm bảo đã sao chép hoặc tạo các file `.env` từ `.env.sample` (hoặc `.env.example`) ở cả thư mục `backend` và `frontend` nếu cần.
- Nếu các cổng (port) mặc định bị trùng, hãy thay đổi trong file cấu hình `.env` hoặc `docker-compose.yml` trước khi chạy.
