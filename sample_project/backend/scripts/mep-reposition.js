/**
 * ============================================================
 *  MEP DEVICE REPOSITIONING — Tòa Nhà B (Building ID=3)
 *  Theo tiêu chuẩn thiết kế cơ điện thực tế (MEP Engineering)
 *
 *  Hệ tọa độ: X,Y ∈ [-10, 10] (đã chuẩn hóa từ 20×20m)
 *  Mặt bằng:
 *    +Y = Bắc    -Y = Nam
 *    +X = Đông   -X = Tây
 *
 *  CÁCH DÙNG:
 *    node scripts/mep-reposition.js
 * ============================================================
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 }   = require('uuid');
const p = new PrismaClient();

const BUILDING_ID = 3;

// ══════════════════════════════════════════════════════════
//  LAYOUT MEP THEO TỪNG LOẠI TẦNG
//
//  Nguyên tắc thực tế:
//  • Phòng kỹ thuật điện (MDB/SDB) → góc, gần lõi thang máy
//  • AHU/PAU → phòng kỹ thuật cơ, thường cạnh Bắc hoặc Tây
//  • FCU → gắn tường trong căn hộ, gần cửa sổ
//  • VAV → trên hệ thống duct, gần FCU
//  • Camera → góc phòng, hành lang, lối vào
//  • Báo cháy → theo lưới trần, mỗi 40m² 1 đầu báo
//  • Bơm PCCC + van → phòng bơm riêng
//  • Chiller + Cooling Tower → khu kỹ thuật mái, tách biệt
// ══════════════════════════════════════════════════════════

const MEP_LAYOUT = {

  // ────────────────────────────────────────────────────────
  //  TẦNG HẦM (BASEMENT) — 20×20m, H=3m
  //  Bố cục:
  //  ┌─────────────────────────────────┐  Y=+10
  //  │ [MDB] [PUMP]   Khu kỹ thuật NW │
  //  │─────────────────────────────────│  Y=+5
  //  │         Bãi đậu xe              │
  //  │    [RAMP]              [QUẠT]   │
  //  │─────────────────────────────────│  Y=-5
  //  │  Bãi đậu xe                     │  Y=-10
  //  └─────────────────────────────────┘
  //    X=-10               X=+10
  // ────────────────────────────────────────────────────────
  BASEMENT: [
    // ── Phòng kỹ thuật điện (góc NW)
    { type: 'ELECTRIC',       name: 'Tủ MDB Tầng Hầm',     x: -8.5, y:  9.0 },
    { type: 'ELECTRIC_METER', name: 'Đồng Hồ Điện Hầm',   x: -7.0, y:  9.0 },
    { type: 'POWER_BREAKER',  name: 'CB Tổng Hầm',         x: -9.0, y:  8.0 },

    // ── Phòng bơm PCCC (góc NE)
    { type: 'FIRE_PUMP',      name: 'Bơm PCCC Chính',      x:  8.0, y:  9.0 },
    { type: 'FIRE_PUMP',      name: 'Bơm PCCC Dự Phòng',   x:  8.0, y:  7.5 },
    { type: 'WATER_METER',    name: 'Đồng Hồ Nước Hầm',    x:  9.0, y:  8.0 },

    // ── Quạt thông gió (gắn tường, phân đều 4 hướng)
    { type: 'FAN',            name: 'Quạt Hút Hầm T1',     x:  0.0, y: -9.5 },  // Tường Nam
    { type: 'FAN',            name: 'Quạt Hút Hầm T2',     x:  0.0, y:  4.5 },  // Tường giữa
    { type: 'FAN',            name: 'Quạt Cấp Hầm Đ1',     x:  9.5, y:  0.0 },  // Tường Đông
    { type: 'FAN',            name: 'Quạt Cấp Hầm T1',     x: -9.5, y:  0.0 },  // Tường Tây

    // ── Camera an ninh (bao phủ bãi xe + lối ra vào)
    { type: 'CAMERA',         name: 'Camera Hầm NW',        x: -8.5, y:  6.0 },  // Góc NW
    { type: 'CAMERA',         name: 'Camera Hầm NE',        x:  8.5, y:  6.0 },  // Góc NE
    { type: 'CAMERA',         name: 'Camera Hầm SW',        x: -8.5, y: -8.5 }, // Góc SW
    { type: 'CAMERA',         name: 'Camera Hầm SE',        x:  8.5, y: -8.5 }, // Góc SE (lối xuống)
    { type: 'CAMERA',         name: 'Camera Ramp',          x:  6.0, y: -9.0 },  // Đường dốc

    // ── Báo cháy (lưới trần ~40m²/đầu, lưới 4×4m → 5×5=25 đầu, chọn 16)
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 01',     x: -7.0, y: -7.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 02',     x: -3.0, y: -7.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 03',     x:  1.0, y: -7.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 04',     x:  5.0, y: -7.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 05',     x: -7.0, y: -2.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 06',     x: -3.0, y: -2.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 07',     x:  1.0, y: -2.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 08',     x:  5.0, y: -2.0 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 09',     x: -7.0, y:  3.5 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 10',     x: -3.0, y:  3.5 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 11',     x:  1.0, y:  3.5 },
    { type: 'FIRE_ALARM',     name: 'Báo Cháy Hầm 12',     x:  5.0, y:  3.5 },

    // ── Đèn (dãy đèn dọc lối đi giữa hàng xe)
    { type: 'LIGHT',          name: 'Đèn Hầm D1',          x: -5.0, y: -8.0 },
    { type: 'LIGHT',          name: 'Đèn Hầm D2',          x: -1.0, y: -8.0 },
    { type: 'LIGHT',          name: 'Đèn Hầm D3',          x:  3.0, y: -8.0 },
    { type: 'LIGHT',          name: 'Đèn Hầm D4',          x: -5.0, y: -0.5 },
    { type: 'LIGHT',          name: 'Đèn Hầm D5',          x: -1.0, y: -0.5 },
    { type: 'LIGHT',          name: 'Đèn Hầm D6',          x:  3.0, y: -0.5 },
  ],

  // ────────────────────────────────────────────────────────
  //  TẦNG TTTM (COMMERCIAL) — 20×20m, H=5m
  //  Bố cục:
  //  ┌────────────────────────────────────┐  Y=+10
  //  │ [AHU1] [PAU1]  Phòng KT cơ điện   │
  //  │─────────────────────────────────── │  Y=+7
  //  │      Khu mua sắm mở (open space)   │
  //  │   [Escalator]    [FCU]             │
  //  │─────────────────────────────────── │  Y=-7
  //  │ Mặt tiền kính (Curtain Wall)       │  Y=-10
  //  └────────────────────────────────────┘
  // ────────────────────────────────────────────────────────
  COMMERCIAL: [
    // ── Phòng kỹ thuật cơ (phía Bắc-Tây)
    { type: 'AHU',                   name: 'AHU TTTM Trái',         x: -8.0, y: 8.5 },
    { type: 'AHU',                   name: 'AHU TTTM Phải',         x: -4.0, y: 8.5 },
    { type: 'AHU_FILTER',            name: 'Lọc AHU T1',            x: -7.0, y: 8.5 },
    { type: 'AHU_FILTER',            name: 'Lọc AHU T2',            x: -3.0, y: 8.5 },
    { type: 'AHU_VALVE',             name: 'Van AHU T1',            x: -8.0, y: 7.5 },
    { type: 'AHU_VALVE',             name: 'Van AHU T2',            x: -4.0, y: 7.5 },
    { type: 'AHU_SENSOR_TEMPERATURE',name: 'Cảm Biến Nhiệt AHU T1', x: -6.0, y: 8.0 },
    { type: 'AHU_SENSOR_TEMPERATURE',name: 'Cảm Biến Nhiệt AHU T2', x: -2.0, y: 8.0 },

    // ── PAU (Pre-treated Air Unit — xử lý gió tươi)
    { type: 'PAU',                   name: 'PAU TTTM 1',            x:  3.0, y: 8.5 },
    { type: 'PAU',                   name: 'PAU TTTM 2',            x:  7.0, y: 8.5 },
    { type: 'PAU_FILTER',            name: 'Lọc PAU 1',             x:  3.5, y: 8.5 },
    { type: 'PAU_FILTER',            name: 'Lọc PAU 2',             x:  7.5, y: 8.5 },
    { type: 'PAU_VALVE',             name: 'Van PAU 1',             x:  3.0, y: 7.5 },
    { type: 'PAU_VALVE',             name: 'Van PAU 2',             x:  7.0, y: 7.5 },
    { type: 'PAU_SENSOR_TEMPERATURE',name: 'Cảm Biến Gió Tươi 1',  x:  5.0, y: 8.0 },
    { type: 'PAU_SENSOR_TEMPERATURE',name: 'Cảm Biến Gió Tươi 2',  x:  9.0, y: 8.0 },

    // ── Phòng kỹ thuật điện (góc NE)
    { type: 'ELECTRIC_METER',        name: 'Đồng Hồ Điện TTTM',    x:  9.0, y: 9.0 },
    { type: 'POWER_BREAKER',         name: 'CB Phân Phối TTTM T1',  x:  8.0, y: 9.5 },
    { type: 'POWER_BREAKER',         name: 'CB Phân Phối TTTM T2',  x:  9.0, y: 8.5 },

    // ── Đèn LED (khu mua sắm — lưới đèn 4×4m)
    { type: 'DIM_LIGHT',             name: 'Đèn TTTM Khu A1',       x: -7.0, y:  4.0 },
    { type: 'DIM_LIGHT',             name: 'Đèn TTTM Khu A2',       x: -3.0, y:  4.0 },
    { type: 'DIM_LIGHT',             name: 'Đèn TTTM Khu B1',       x:  1.0, y:  4.0 },
    { type: 'DIM_LIGHT',             name: 'Đèn TTTM Khu B2',       x:  5.0, y:  4.0 },
    { type: 'LIGHT',                 name: 'Đèn Hành Lang TTTM N1', x: -7.0, y:  0.0 },
    { type: 'LIGHT',                 name: 'Đèn Hành Lang TTTM N2', x: -3.0, y:  0.0 },
    { type: 'LIGHT',                 name: 'Đèn Hành Lang TTTM N3', x:  1.0, y:  0.0 },
    { type: 'LIGHT',                 name: 'Đèn Hành Lang TTTM N4', x:  5.0, y:  0.0 },
    { type: 'LIGHT',                 name: 'Đèn Sảnh TTTM 1',      x: -7.0, y: -5.0 },
    { type: 'LIGHT',                 name: 'Đèn Sảnh TTTM 2',      x:  0.0, y: -5.0 },
    { type: 'LIGHT',                 name: 'Đèn Sảnh TTTM 3',      x:  7.0, y: -5.0 },
    { type: 'LIGHT',                 name: 'Đèn Lối Vào TTTM',     x:  0.0, y: -9.0 },

    // ── Camera (bao phủ khu vực mua sắm + lối vào)
    { type: 'CAMERA',                name: 'Camera Lối Vào Chính',  x:  0.0, y: -9.5 },
    { type: 'CAMERA',                name: 'Camera Khu A',          x: -6.0, y:  1.0 },
    { type: 'CAMERA',                name: 'Camera Khu B',          x:  6.0, y:  1.0 },
    { type: 'CAMERA',                name: 'Camera Khu C',          x: -6.0, y: -5.0 },
    { type: 'CAMERA',                name: 'Camera Khu D',          x:  6.0, y: -5.0 },
    { type: 'CAMERA',                name: 'Camera Phòng KT',       x:  0.0, y:  9.0 },

    // ── Cảm biến CO2 (khu vực tập trung người)
    { type: 'CO2_METER',             name: 'CO2 Khu Vực A',         x: -5.0, y:  2.0 },
    { type: 'CO2_METER',             name: 'CO2 Khu Vực B',         x:  0.0, y:  2.0 },
    { type: 'CO2_METER',             name: 'CO2 Khu Vực C',         x:  5.0, y:  2.0 },

    // ── Báo cháy (lưới 4×4m, khu mở)
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 01',     x: -8.0, y: -8.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 02',     x: -4.0, y: -8.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 03',     x:  0.0, y: -8.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 04',     x:  4.0, y: -8.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 05',     x:  8.0, y: -8.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 06',     x: -8.0, y: -2.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 07',     x: -4.0, y: -2.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 08',     x:  0.0, y: -2.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 09',     x:  4.0, y: -2.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 10',     x:  8.0, y: -2.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 11',     x: -8.0, y:  4.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 12',     x:  0.0, y:  4.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy TTTM 13',     x:  8.0, y:  4.0 },
  ],

  // ────────────────────────────────────────────────────────
  //  TẦNG DÂN CƯ (OFFICE/Residential) — 20×20m, H=3.3m
  //
  //  Mặt bằng 4 căn hộ + hành lang trung tâm:
  //  ┌──────────┬──────┬──────────┐  Y=+10
  //  │  Căn B   │      │  Căn D   │  ← ban công Bắc
  //  │(NW 9×8m) │ HC   │(NE 9×8m)│
  //  ├──────────┤      ├──────────┤  Y=+1
  //  │    Hành lang 2m (lõi thang)│  Y=-1 → +1
  //  ├──────────┤      ├──────────┤  Y=-1
  //  │  Căn A   │      │  Căn C   │
  //  │(SW 9×8m) │      │(SE 9×8m) │  ← ban công Nam
  //  └──────────┴──────┴──────────┘  Y=-10
  //    X=-10   X=-1  X=1      X=10
  //
  //  Quy ước: Lõi thang/thang máy tại X=0, Y=0
  // ────────────────────────────────────────────────────────
  OFFICE: [
    // ── FCU (gần cửa sổ từng phòng ngủ/phòng khách)
    { type: 'FCU',   name: 'FCU Căn A Phòng Khách',  x: -7.5, y: -2.5 }, // Căn A - PK
    { type: 'FCU',   name: 'FCU Căn A Phòng Ngủ',    x: -3.5, y: -7.0 }, // Căn A - PN
    { type: 'FCU',   name: 'FCU Căn B Phòng Khách',  x: -7.5, y:  2.5 }, // Căn B - PK
    { type: 'FCU',   name: 'FCU Căn B Phòng Ngủ',    x: -3.5, y:  7.0 }, // Căn B - PN
    { type: 'FCU',   name: 'FCU Căn C Phòng Khách',  x:  7.5, y: -2.5 }, // Căn C - PK
    { type: 'FCU',   name: 'FCU Căn C Phòng Ngủ',    x:  3.5, y: -7.0 }, // Căn C - PN
    { type: 'FCU',   name: 'FCU Căn D Phòng Khách',  x:  7.5, y:  2.5 }, // Căn D - PK
    { type: 'FCU',   name: 'FCU Căn D Phòng Ngủ',    x:  3.5, y:  7.0 }, // Căn D - PN

    // ── VAV (trên duct, gần FCU — kiểm soát lưu lượng từng zone)
    { type: 'VAV',   name: 'VAV Căn A Zone 1',        x: -6.5, y: -3.0 },
    { type: 'VAV',   name: 'VAV Căn A Zone 2',        x: -4.0, y: -6.5 },
    { type: 'VAV',   name: 'VAV Căn B Zone 1',        x: -6.5, y:  3.0 },
    { type: 'VAV',   name: 'VAV Căn B Zone 2',        x: -4.0, y:  6.5 },
    { type: 'VAV',   name: 'VAV Căn C Zone 1',        x:  6.5, y: -3.0 },
    { type: 'VAV',   name: 'VAV Căn C Zone 2',        x:  4.0, y: -6.5 },
    { type: 'VAV',   name: 'VAV Căn D Zone 1',        x:  6.5, y:  3.0 },
    { type: 'VAV',   name: 'VAV Căn D Zone 2',        x:  4.0, y:  6.5 },

    // ── Camera (hành lang + nút thang máy, KHÔNG vào trong căn hộ)
    { type: 'CAMERA', name: 'Camera Hành Lang Trái',  x: -3.0, y:  0.0 },
    { type: 'CAMERA', name: 'Camera Hành Lang Phải',  x:  3.0, y:  0.0 },

    // ── Báo cháy (mỗi phòng 1 đầu báo + hành lang)
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn A PK', x: -7.0, y: -1.5 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn A PN', x: -5.0, y: -8.0 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn B PK', x: -7.0, y:  1.5 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn B PN', x: -5.0, y:  8.0 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn C PK', x:  7.0, y: -1.5 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn C PN', x:  5.0, y: -8.0 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn D PK', x:  7.0, y:  1.5 },
    { type: 'FIRE_ALARM', name: 'Báo Cháy Căn D PN', x:  5.0, y:  8.0 },

    // ── Đèn (trần căn hộ + đèn hành lang)
    { type: 'DIM_LIGHT', name: 'Đèn Căn A PK',       x: -7.5, y: -4.0 },
    { type: 'DIM_LIGHT', name: 'Đèn Căn B PK',       x: -7.5, y:  4.0 },
    { type: 'DIM_LIGHT', name: 'Đèn Căn C PK',       x:  7.5, y: -4.0 },
    { type: 'DIM_LIGHT', name: 'Đèn Căn D PK',       x:  7.5, y:  4.0 },
    { type: 'LIGHT',     name: 'Đèn Hành Lang HC 1', x: -4.5, y:  0.0 },
    { type: 'LIGHT',     name: 'Đèn Hành Lang HC 2', x:  0.0, y:  0.0 },
    { type: 'LIGHT',     name: 'Đèn Hành Lang HC 3', x:  4.5, y:  0.0 },
    { type: 'LIGHT',     name: 'Đèn Thang Máy',      x:  0.0, y:  0.5 },

    // ── Cảm biến CO2 (phòng ngủ + phòng khách)
    { type: 'CO2_METER', name: 'CO2 Căn A',          x: -6.0, y: -5.0 },
    { type: 'CO2_METER', name: 'CO2 Căn B',          x: -6.0, y:  5.0 },
    { type: 'CO2_METER', name: 'CO2 Căn C',          x:  6.0, y: -5.0 },
    { type: 'CO2_METER', name: 'CO2 Căn D',          x:  6.0, y:  5.0 },

    // ── Đồng hồ điện (tủ điện tầng, đặt trong hộp kỹ thuật hành lang)
    { type: 'ELECTRIC_METER', name: 'Công Tơ Căn A', x: -0.5, y: -2.0 },
    { type: 'ELECTRIC_METER', name: 'Công Tơ Căn B', x: -0.5, y:  2.0 },
    { type: 'ELECTRIC_METER', name: 'Công Tơ Căn C', x:  0.5, y: -2.0 },
    { type: 'ELECTRIC_METER', name: 'Công Tơ Căn D', x:  0.5, y:  2.0 },
  ],

  // ────────────────────────────────────────────────────────
  //  TẦNG THƯỢNG (ROOFTOP) — 20×20m, ngoài trời
  //  Bố cục:
  //  ┌──────────────────────────────────────┐  Y=+10
  //  │  Khu kỹ thuật (Chiller + Cooling)    │  Y=+5~+10
  //  │─────────────────────────────────────│
  //  │         [Pergola / Mái che]          │  Y=0~+5
  //  │─────────────────────────────────────│
  //  │  [Bể bơi 8×4m]     [Sun Deck]       │  Y=-5~0
  //  │─────────────────────────────────────│
  //  │  [Vườn]        [Bể nước] [Thang]    │  Y=-10~-5
  //  └──────────────────────────────────────┘
  //    X=-10                          X=+10
  // ────────────────────────────────────────────────────────
  ROOFTOP: [
    // ── Cụm Chiller (khu kỹ thuật góc NE, X=+5~+10, Y=+5~+10)
    { type: 'CHILLER',               name: 'Chiller 1',              x:  6.0, y:  8.5 },
    { type: 'CHILLER',               name: 'Chiller 2',              x:  8.5, y:  8.5 },
    { type: 'CHILLER_PIPE',          name: 'Ống CHW Supply',         x:  6.0, y:  6.5 },
    { type: 'CHILLER_PIPE',          name: 'Ống CHW Return',         x:  8.5, y:  6.5 },
    { type: 'CHILLER_VALVE',         name: 'Van Cân Bằng CHW 1',     x:  5.0, y:  7.5 },
    { type: 'CHILLER_VALVE',         name: 'Van Cân Bằng CHW 2',     x:  9.5, y:  7.5 },
    { type: 'CHILLER_COLD_PUMP',     name: 'Bơm Nước Lạnh 1',        x:  6.0, y:  5.5 },
    { type: 'CHILLER_COLD_PUMP',     name: 'Bơm Nước Lạnh 2 (DP)',   x:  8.5, y:  5.5 },

    // ── Cụm Cooling Tower (phía Bắc, X=0~+5, Y=+7~+10)
    { type: 'CHILLER_COOLING_TOWER', name: 'Tháp Giải Nhiệt 1',      x:  1.0, y:  9.0 },
    { type: 'CHILLER_COOLING_TOWER', name: 'Tháp Giải Nhiệt 2',      x:  3.5, y:  9.0 },
    { type: 'CHILLER_COOLING_PUMP',  name: 'Bơm Giải Nhiệt 1',       x:  1.0, y:  7.0 },
    { type: 'CHILLER_COOLING_PUMP',  name: 'Bơm Giải Nhiệt 2 (DP)',  x:  3.5, y:  7.0 },

    // ── Bể nước mái + Bơm tăng áp (góc NW)
    { type: 'WATER_METER',           name: 'Đồng Hồ Nước Mái',       x: -8.5, y:  8.0 },
    { type: 'PUMP',                  name: 'Bơm Tăng Áp 1',          x: -7.0, y:  9.0 },
    { type: 'PUMP',                  name: 'Bơm Tăng Áp 2 (DP)',     x: -7.0, y:  7.5 },

    // ── Quạt (exhaust/fresh air rooftop)
    { type: 'FAN',                   name: 'Quạt Hút Khói Mái T1',   x: -5.0, y:  9.5 },
    { type: 'FAN',                   name: 'Quạt Hút Khói Mái T2',   x: -3.0, y:  9.5 },

    // ── Phòng kỹ thuật điện mái (góc NW)
    { type: 'ELECTRIC_METER',        name: 'Công Tơ Tổng Hệ HVAC',   x: -9.5, y:  9.5 },
    { type: 'BTU_METER',             name: 'BTU Meter Hệ Chiller',    x: -9.5, y:  8.0 },

    // ── Camera an ninh (chu vi mái + khu kỹ thuật)
    { type: 'CAMERA',                name: 'Camera Mái NW',           x: -9.5, y:  9.5 },
    { type: 'CAMERA',                name: 'Camera Mái NE',           x:  9.5, y:  9.5 },
    { type: 'CAMERA',                name: 'Camera Mái SW',           x: -9.5, y: -9.5 },
    { type: 'CAMERA',                name: 'Camera Mái SE',           x:  9.5, y: -9.5 },

    // ── Báo cháy (khu vực kỹ thuật + tiện ích)
    { type: 'FIRE_ALARM',            name: 'Báo Cháy Khu KT 1',      x:  5.0, y:  6.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy Khu KT 2',      x:  9.0, y:  6.0 },
    { type: 'FIRE_ALARM',            name: 'Báo Cháy Khu Bể Bơi',    x: -3.0, y: -5.0 },

    // ── Đèn ngoài trời + khu bể bơi
    { type: 'LIGHT',                 name: 'Đèn Khu Bể Bơi 1',       x: -5.0, y: -5.0 },
    { type: 'LIGHT',                 name: 'Đèn Khu Bể Bơi 2',       x: -1.0, y: -5.0 },
    { type: 'LIGHT',                 name: 'Đèn Pergola 1',           x: -4.0, y:  2.5 },
    { type: 'LIGHT',                 name: 'Đèn Pergola 2',           x:  4.0, y:  2.5 },
    { type: 'LIGHT',                 name: 'Đèn Ngoài Trời 1',       x: -9.0, y: -9.0 },
    { type: 'LIGHT',                 name: 'Đèn Ngoài Trời 2',       x:  9.0, y: -9.0 },
  ],
};

// ══════════════════════════════════════════════════════════
//  TEMPLATE ATTRIBUTES (giống thiết bị nguồn Building 1)
// ══════════════════════════════════════════════════════════
const ATTR_TEMPLATES = {
  CAMERA:                  { recording: true, motion: false, online: true },
  FIRE_ALARM:              { alarm: false, fault: false, state: true },
  FIRE_PUMP:               { state: false, mode: false, fault: false, pressure: 6.5 },
  FAN:                     { state: false, mode: false, fault: false, speed: 0 },
  PUMP:                    { state: false, fault: false, speed: 0, pressure: 4.0 },
  LIGHT:                   { state: false },
  DIM_LIGHT:               { state: true, brightness: 80 },
  ELECTRIC:                { state: true, voltage: 220, current: 15.5 },
  ELECTRIC_METER:          { energy: 0, power: 0, voltage: 220, current: 0 },
  POWER_BREAKER:           { state: true, tripped: false, current: 30 },
  WATER_METER:             { flow: 0, totalVolume: 0, pressure: 2.5 },
  BTU_METER:               { btu: 0, flowRate: 0, supplyTemp: 7, returnTemp: 12 },
  CO2_METER:               { co2: 420, temperature: 24, humidity: 60 },
  CHILLER:                 { state: false, mode: false, fault: false },
  CHILLER_PIPE:            { state: true, flowRate: 20, pressure: 1.0, temperature: 12 },
  CHILLER_VALVE:           { state: true },
  CHILLER_COLD_PUMP:       { state: false, mode: false, fault: false, speed: 0 },
  CHILLER_COOLING_PUMP:    { state: false, mode: false, fault: false, speed: 0 },
  CHILLER_COOLING_TOWER:   { state: false, mode: false, fault: false },
  FCU:                     { state: true, speed: 2, temp: 24, command: 1 },
  VAV:                     { state: true, openingAngle: 75, temp: 24, command: 1 },
  AHU:                     { state: false, mode: false, fault: false, fanSpeed: 1, fanSpeedFeedback: 1 },
  AHU_FILTER:              { fault: false },
  AHU_VALVE:               { state: true },
  AHU_SENSOR_TEMPERATURE:  { temp: 24 },
  PAU:                     { state: false, mode: false, fault: false, fanSpeed: 1, fanSpeedFeedBack: 1 },
  PAU_FILTER:              { fault: false },
  PAU_VALVE:               { state: true },
  PAU_SENSOR_TEMPERATURE:  { temp: 24 },
};

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(65));
  console.log('  🔧  MEP REPOSITION — Tòa Nhà B (Theo tiêu chuẩn thực tế)');
  console.log('═'.repeat(65));

  // Lấy floors
  const floors = await p.floor.findMany({
    where:   { buildingId: BUILDING_ID },
    orderBy: { floorNumber: 'asc' },
  });
  console.log(`\n✓ Tìm thấy ${floors.length} tầng`);

  // Xóa toàn bộ devices cũ của Building 3
  const deleted = await p.buildingDevice.deleteMany({ where: { buildingId: BUILDING_ID } });
  console.log(`✓ Đã xóa ${deleted.count} device cũ\n`);

  let totalCreated = 0;
  const summary = [];

  for (const floor of floors) {
    let layout = MEP_LAYOUT[floor.floorType];
    if (!layout) {
      console.log(`  ⚠  ${floor.name} (${floor.floorType}) — không có layout MEP, bỏ qua`);
      continue;
    }

    // Với tầng OFFICE (dân cư): dùng cùng 1 layout cho tất cả 12 tầng
    // Đánh số thứ tự thiết bị theo floorNumber
    const fn = floor.floorNumber;

    const toCreate = layout.map((dev, idx) => ({
      id:          uuidv4(),
      buildingId:  BUILDING_ID,
      floorId:     floor.id,
      type:        dev.type,
      name:        floor.floorType === 'OFFICE'
                     ? `[T${fn}] ${dev.name}`  // Prefix tầng cho dân cư
                     : dev.name,
      deviceId:    `B3_${dev.type}_F${fn}_${String(idx+1).padStart(2,'0')}`,
      status:      'ACTIVE',
      isOnline:    true,
      xCoordinate: dev.x,
      yCoordinate: dev.y,
      attributes:  ATTR_TEMPLATES[dev.type] || { state: false },
      tags:        [],
      description: `${dev.name} — ${floor.name}`,
    }));

    await p.buildingDevice.createMany({ data: toCreate });
    totalCreated += toCreate.length;

    const icon = { BASEMENT:'🅿️', COMMERCIAL:'🏬', OFFICE:'🏠', ROOFTOP:'🏖️' }[floor.floorType] || '🏢';
    console.log(`  ${icon} ${floor.name.padEnd(14)} ${floor.floorType.padEnd(12)} → ${toCreate.length} thiết bị`);

    summary.push({ floor: floor.name, type: floor.floorType, count: toCreate.length });
  }

  // Tổng kết
  console.log('\n' + '═'.repeat(65));
  console.log('  ✅  HOÀN TẤT PHÂN BỔ MEP!');
  console.log('═'.repeat(65));
  console.log(`  Tổng thiết bị : ${totalCreated}`);
  console.log(`  Số tầng       : ${floors.length}`);
  console.log();

  const byType = {};
  for (const s of summary) {
    byType[s.type] = (byType[s.type] || 0) + s.count;
  }
  console.log('  📊 Tổng hợp theo loại tầng:');
  for (const [type, cnt] of Object.entries(byType)) {
    console.log(`     ${type.padEnd(12)} → ${cnt} thiết bị`);
  }
  console.log();
  console.log('  📌 MEP Notes:');
  console.log('     • Phòng kỹ thuật điện : góc NW/NE mỗi tầng');
  console.log('     • AHU/PAU             : cạnh Bắc (phòng kỹ thuật cơ)');
  console.log('     • FCU + VAV           : trong căn hộ, gần cửa sổ/duct');
  console.log('     • Camera              : góc phòng + hành lang chỉ');
  console.log('     • Báo cháy            : lưới trần 4×4m (~40m²/đầu)');
  console.log('     • Chiller + Tower     : khu kỹ thuật mái NE');
  console.log('     • Bơm PCCC            : phòng bơm độc lập NE hầm');
  console.log('═'.repeat(65) + '\n');
}

main().catch(console.error).finally(() => p.$disconnect());
