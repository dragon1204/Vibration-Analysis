# Smart Building Web

Hệ thống quản lý và giám sát tòa nhà thông minh cho 5 phân hệ chính BMS, ACS, CCTV, Parking, EMS.

## Yêu cầu hệ thống

- **Node.js**: 22.12.0 LTS (khuyến nghị)
- **npm**: >= 10.0.0

## Tech Stack

- **Core**: React 19, TypeScript, Vite, React Router v7  
- **UI**: Material-UI v7, Emotion, Styled Components  
- **3D**: Three.js, React Three Fiber, Drei,  Postprocessing  
- **State**: TanStack Query, Axios  
- **Forms**: React Hook Form, Yup  
- **Charts**: Recharts, MUI X Charts  
- **Maps**: Vietmap GL JS

## Quick Start

```bash
# Install
npm install

# Setup environment
cp .env.example .env
# Cấu hình API keys trong .env

# Dev server
npm run dev

# Build production
npm run build

# Lint
npm run lint

# Preview build
npm run preview
```

## Project Structure

```
src/
├── assets/          # Images, icons
├── base/            # HTTP service, CRUD base
├── components/      # Shared components (Header, Sidebar, InfoPanel...)
├── configs/         # Theme, constants
├── context/         # React contexts
├── hooks/           # Custom hooks
├── i18n/            # Translations (vi, en)
├── layout/          # Layout wrappers
├── pages/           # Route pages
│   ├── acs/         # Access Control System
│   ├── bms/         # Building Management (Electric, AC, Pump, Fire)
│   ├── cctv/        # Camera management
│   ├── home/        # Dashboard & overview
│   ├── parking/     # Parking management
│   └── smart-building/  # Demo modules
├── routes/          # Route definitions
├── services/        # API services & auth
└── utils/           # Utilities & constants
```

## Routes

```
/                          # Home
├── overview               # Map overview
├── projects               # Urban list
└── projects/:urban/:building
    ├── acs                # Access control
    ├── bms                # BMS modules
    │   ├── overview       # 3D visualization
    │   ├── electric       # Electric system
    │   ├── conditioner    # Air conditioner
    │   ├── pump           # Pump system
    │   └── fire           # Fire protection
    ├── cctv               # Cameras
    └── parking            # Parking

/smart-building            # Demo dashboard
```

**API Keys:**
- OpenWeather: https://openweathermap.org/api
- WAQI: https://aqicn.org/data-platform/token/
- Vietmap: https://maps.vietmap.vn/

## Tài khoản đăng nhập
- username: admin
- password: 123qwe

## Features

- Dashboard giám sát thời gian thực
- Trực quan hóa mô hình 2D, 3D cho 5 phân hệ chính
- Bản đồ tương tác sử dụng Vietmap
- Hỗ trợ đa ngôn ngữ (Tiếng Việt, Tiếng Anh)
- Giao diện responsive, tương thích nhiều thiết bị
- Quản lý thông báo & cảnh báo
- Biểu đồ và bảng dữ liệu trực quan
