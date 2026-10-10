/**
 * ============================================================
 *  CLONE & DISTRIBUTE DEVICES — Tòa Nhà B (Building ID=3)
 *
 *  Nhân bản thiết bị từ Building 1 → Building 3
 *  Phân bổ hợp lý theo từng loại tầng:
 *
 *  tang_B1  (Hầm)      → Camera, Fire Alarm, Fire Pump, Fan, Light
 *                         Electric, Electric Meter, Water Meter
 *  tang_G   (TTTM)     → Camera, Light, DimLight, FCU, PAU, Fire Alarm
 *                         Electric Meter, CO2 Meter, AHU
 *  tang_F01~F12 (Dân cư) → FCU, VAV, DimLight, Camera, Fire Alarm
 *                           CO2 Meter, Light
 *  tang_R   (Thượng)   → Camera, Light, Fan, Pump, Fire Alarm
 *                         Chiller systems (khu kỹ thuật)
 *
 *  CÁCH DÙNG:
 *    node scripts/clone-devices-building2.js
 * ============================================================
 */

const { PrismaClient, Prisma } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const p = new PrismaClient();

const TARGET_BUILDING_ID = 3;   // Tòa Nhà B
const SOURCE_BUILDING_ID = 1;   // Tòa nhà nguồn

// ══════════════════════════════════════════════════════════
//  QUY TẮC PHÂN BỔ THIẾT BỊ THEO LOẠI TẦNG
//
//  Mỗi entry: { floorType, devices[] }
//  Mỗi device: { type, count, namePrefix, positions[] }
//  positions: mảng [x, y] chuẩn hóa -10..10
// ══════════════════════════════════════════════════════════

const FLOOR_DEVICE_RULES = {

  // ── TẦNG HẦM (BASEMENT) ──────────────────────────────────
  BASEMENT: [
    { type: 'CAMERA',         count: 4, namePrefix: 'Camera Hầm',
      positions: [[-7,-7],[7,-7],[-7,7],[7,7]] },
    { type: 'FIRE_ALARM',     count: 4, namePrefix: 'Báo Cháy Hầm',
      positions: [[-5,-5],[5,-5],[-5,5],[5,5]] },
    { type: 'FIRE_PUMP',      count: 2, namePrefix: 'Bơm PCCC Hầm',
      positions: [[-3,0],[3,0]] },
    { type: 'FAN',            count: 2, namePrefix: 'Quạt Thông Gió Hầm',
      positions: [[0,-7],[0,7]] },
    { type: 'LIGHT',          count: 6, namePrefix: 'Đèn Hầm',
      positions: [[-6,0],[0,0],[6,0],[-6,4],[0,4],[6,4]] },
    { type: 'ELECTRIC',       count: 1, namePrefix: 'Tủ Điện Hầm',
      positions: [[-8,0]] },
    { type: 'ELECTRIC_METER', count: 1, namePrefix: 'Đồng Hồ Điện Hầm',
      positions: [[-8,2]] },
    { type: 'WATER_METER',    count: 1, namePrefix: 'Đồng Hồ Nước Hầm',
      positions: [[-8,4]] },
  ],

  // ── TẦNG TTTM (COMMERCIAL) ───────────────────────────────
  COMMERCIAL: [
    { type: 'CAMERA',                count: 6,  namePrefix: 'Camera TTTM',
      positions: [[-8,-7],[0,-7],[8,-7],[-8,7],[0,7],[8,7]] },
    { type: 'FIRE_ALARM',            count: 6,  namePrefix: 'Báo Cháy TTTM',
      positions: [[-6,-5],[0,-5],[6,-5],[-6,5],[0,5],[6,5]] },
    { type: 'LIGHT',                 count: 8,  namePrefix: 'Đèn TTTM',
      positions: [[-7,-3],[-3,-3],[3,-3],[7,-3],[-7,3],[-3,3],[3,3],[7,3]] },
    { type: 'DIM_LIGHT',             count: 4,  namePrefix: 'Đèn Điều Chỉnh TTTM',
      positions: [[-5,0],[0,0],[5,0],[0,-6]] },
    { type: 'PAU',                   count: 2,  namePrefix: 'PAU TTTM',
      positions: [[-7,-8],[7,-8]] },
    { type: 'PAU_FILTER',            count: 2,  namePrefix: 'PAU Filter TTTM',
      positions: [[-6,-8],[8,-8]] },
    { type: 'PAU_VALVE',             count: 2,  namePrefix: 'PAU Valve TTTM',
      positions: [[-7,-7],[7,-7]] },
    { type: 'AHU',                   count: 2,  namePrefix: 'AHU TTTM',
      positions: [[-8,8],[8,8]] },
    { type: 'AHU_FILTER',            count: 2,  namePrefix: 'AHU Filter TTTM',
      positions: [[-7,8],[7,8]] },
    { type: 'AHU_VALVE',             count: 2,  namePrefix: 'AHU Valve TTTM',
      positions: [[-8,7],[8,7]] },
    { type: 'ELECTRIC_METER',        count: 1,  namePrefix: 'Đồng Hồ Điện TTTM',
      positions: [[-8,-9]] },
    { type: 'CO2_METER',             count: 3,  namePrefix: 'Cảm Biến CO2 TTTM',
      positions: [[-5,-8],[0,-8],[5,-8]] },
    { type: 'POWER_BREAKER',         count: 2,  namePrefix: 'CB Tổng TTTM',
      positions: [[-9,-6],[9,-6]] },
  ],

  // ── TẦNG DÂN CƯ (OFFICE) ─────────────────────────────────
  OFFICE: [
    { type: 'FCU',            count: 4, namePrefix: 'FCU Căn Hộ',
      positions: [[-6,-6],[6,-6],[-6,6],[6,6]] },
    { type: 'VAV',            count: 4, namePrefix: 'VAV Căn Hộ',
      positions: [[-4,-6],[4,-6],[-4,6],[4,6]] },
    { type: 'CAMERA',         count: 2, namePrefix: 'Camera Hành Lang',
      positions: [[0,-7],[0,7]] },
    { type: 'FIRE_ALARM',     count: 4, namePrefix: 'Báo Cháy Căn Hộ',
      positions: [[-5,-5],[5,-5],[-5,5],[5,5]] },
    { type: 'DIM_LIGHT',      count: 4, namePrefix: 'Đèn Căn Hộ',
      positions: [[-6,0],[6,0],[-6,3],[6,3]] },
    { type: 'LIGHT',          count: 4, namePrefix: 'Đèn Hành Lang',
      positions: [[-3,0],[0,0],[3,0],[0,-5]] },
    { type: 'CO2_METER',      count: 2, namePrefix: 'Cảm Biến CO2 Căn Hộ',
      positions: [[-4,0],[4,0]] },
    { type: 'ELECTRIC_METER', count: 1, namePrefix: 'Đồng Hồ Điện Tầng',
      positions: [[-9,0]] },
  ],

  // ── TẦNG THƯỢNG (ROOFTOP) ────────────────────────────────
  ROOFTOP: [
    { type: 'CHILLER',              count: 2, namePrefix: 'Chiller Mái',
      positions: [[5,7],[7,7]] },
    { type: 'CHILLER_PIPE',         count: 2, namePrefix: 'Ống CHW Mái',
      positions: [[5,5],[7,5]] },
    { type: 'CHILLER_VALVE',        count: 2, namePrefix: 'Van CHW Mái',
      positions: [[5,3],[7,3]] },
    { type: 'CHILLER_COLD_PUMP',    count: 2, namePrefix: 'Bơm Lạnh Mái',
      positions: [[5,1],[7,1]] },
    { type: 'CHILLER_COOLING_PUMP', count: 2, namePrefix: 'Bơm Giải Nhiệt Mái',
      positions: [[5,-1],[7,-1]] },
    { type: 'CHILLER_COOLING_TOWER',count: 2, namePrefix: 'Tháp Giải Nhiệt',
      positions: [[5,-5],[7,-5]] },
    { type: 'PUMP',                 count: 2, namePrefix: 'Bơm Nước Mái',
      positions: [[-5,7],[-7,7]] },
    { type: 'FAN',                  count: 2, namePrefix: 'Quạt Hút Mái',
      positions: [[-5,5],[-7,5]] },
    { type: 'CAMERA',               count: 4, namePrefix: 'Camera Mái',
      positions: [[-9,-9],[9,-9],[-9,9],[9,9]] },
    { type: 'FIRE_ALARM',           count: 2, namePrefix: 'Báo Cháy Mái',
      positions: [[-5,-5],[5,-5]] },
    { type: 'LIGHT',                count: 4, namePrefix: 'Đèn Mái',
      positions: [[-5,0],[5,0],[-3,-5],[3,-5]] },
    { type: 'ELECTRIC_METER',       count: 1, namePrefix: 'Đồng Hồ Điện Tổng',
      positions: [[-9,-5]] },
    { type: 'WATER_METER',          count: 1, namePrefix: 'Đồng Hồ Nước Mái',
      positions: [[-9,-3]] },
    { type: 'BTU_METER',            count: 1, namePrefix: 'BTU Meter Mái',
      positions: [[-9,-1]] },
  ],
};

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('\n' + '='.repeat(62));
  console.log('  🔧  CLONE & DISTRIBUTE DEVICES — Tòa Nhà B');
  console.log('='.repeat(62));

  // ── 1. Lấy floors của Building 3 ─────────────────────────
  const floors = await p.floor.findMany({
    where:   { buildingId: TARGET_BUILDING_ID },
    orderBy: { floorNumber: 'asc' },
  });
  if (floors.length === 0) {
    console.error('\n❌ Không tìm thấy floors của Building 3!');
    process.exit(1);
  }
  console.log(`\n[1/4] Tìm thấy ${floors.length} tầng trong Tòa Nhà B`);

  // ── 2. Lấy template devices từ Building nguồn ─────────────
  const sourceDevices = await p.buildingDevice.findMany({
    where: { buildingId: SOURCE_BUILDING_ID },
  });
  console.log(`[2/4] Tìm thấy ${sourceDevices.length} thiết bị nguồn (Building ${SOURCE_BUILDING_ID})`);

  // Index template theo type để tra cứu nhanh
  const templateByType = {};
  for (const d of sourceDevices) {
    if (!templateByType[d.type]) templateByType[d.type] = d;
  }
  const availableTypes = Object.keys(templateByType);
  console.log(`      Types có sẵn: ${availableTypes.join(', ')}`);

  // ── 3. Xóa devices cũ của Building 3 (nếu có) ─────────────
  const deleted = await p.buildingDevice.deleteMany({
    where: { buildingId: TARGET_BUILDING_ID },
  });
  if (deleted.count > 0) {
    console.log(`[3/4] Đã xóa ${deleted.count} device cũ của Tòa Nhà B`);
  }

  // ── 4. Tạo devices cho từng tầng ──────────────────────────
  console.log('\n[4/4] Tạo thiết bị cho từng tầng...\n');

  let totalCreated = 0;
  const floorSummary = [];

  for (const floor of floors) {
    const rules = FLOOR_DEVICE_RULES[floor.floorType];
    if (!rules) {
      console.log(`  ⚠️  ${floor.name} (${floor.floorType}) — không có quy tắc, bỏ qua`);
      continue;
    }

    const devicesToCreate = [];
    let floorDeviceCount = 0;

    for (const rule of rules) {
      const template = templateByType[rule.type];
      if (!template) {
        // Tạo device cơ bản nếu không có template
        console.log(`     ⚠️  Không có template cho ${rule.type}`);
        continue;
      }

      for (let i = 0; i < rule.count; i++) {
        const pos = rule.positions[i] || [0, 0];
        const suffix = rule.count > 1 ? ` ${i + 1}` : '';

        // Tạo deviceId unique cho building mới
        const newDeviceId = template.deviceId
          ? `B3_${template.deviceId}_F${floor.floorNumber}_${i + 1}`
          : null;

        devicesToCreate.push({
          id:            uuidv4(),
          buildingId:    TARGET_BUILDING_ID,
          floorId:       floor.id,
          type:          template.type,
          name:          `${rule.namePrefix}${suffix}`,
          deviceId:      newDeviceId,
          eboId:         template.eboId || null,
          featureCode:   template.featureCode || null,
          manufacturer:  template.manufacturer || null,
          model:         template.model || null,
          serialNumber:  null,
          status:        'ACTIVE',
          isOnline:      true,
          xCoordinate:   pos[0],
          yCoordinate:   pos[1],
          zCoordinate:   null,
          attributes:    template.attributes || Prisma.DbNull,
          configuration: template.configuration || Prisma.DbNull,
          tags:          [],
          description:   `${rule.namePrefix}${suffix} — ${floor.name}`,
        });
        floorDeviceCount++;
      }
    }

    if (devicesToCreate.length > 0) {
      await p.buildingDevice.createMany({ data: devicesToCreate });
      totalCreated += devicesToCreate.length;
    }

    floorSummary.push({
      name:   floor.name,
      type:   floor.floorType,
      count:  floorDeviceCount,
    });

    // Log với màu sắc theo loại tầng
    const icon = {
      BASEMENT:   '🅿️ ',
      COMMERCIAL: '🏬',
      OFFICE:     '🏠',
      ROOFTOP:    '🏖️',
    }[floor.floorType] || '🏢';

    console.log(`  ${icon} ${floor.name.padEnd(14)} ${floor.floorType.padEnd(12)} → ${floorDeviceCount} thiết bị`);
  }

  // ── TỔNG KẾT ────────────────────────────────────────────
  console.log('\n' + '='.repeat(62));
  console.log('  ✅  PHÂN BỔ THIẾT BỊ THÀNH CÔNG!');
  console.log('='.repeat(62));
  console.log(`  Building     : Tòa Nhà B (ID=${TARGET_BUILDING_ID})`);
  console.log(`  Tổng thiết bị: ${totalCreated}`);
  console.log();
  console.log('  📋 Chi tiết theo tầng:');

  // Nhóm để hiển thị gọn hơn
  const groups = {};
  for (const f of floorSummary) {
    if (!groups[f.type]) groups[f.type] = [];
    groups[f.type].push(f);
  }

  for (const [type, fList] of Object.entries(groups)) {
    const totalInGroup = fList.reduce((s, f) => s + f.count, 0);
    if (fList.length === 1) {
      console.log(`     ${fList[0].name.padEnd(14)} ${type.padEnd(12)} ${fList[0].count} devices`);
    } else {
      console.log(`     ${fList.length} tầng ${type.padEnd(10)} × ${fList[0].count} devices = ${totalInGroup} tổng`);
      console.log(`       (${fList.map(f => f.name).join(', ')})`);
    }
  }

  console.log();
  console.log('  🔗 Bước tiếp theo:');
  console.log('     1. Vào BMS → Tòa Nhà B → 3D Viewer');
  console.log('     2. Click từng tầng → thấy thiết bị đã được đặt vị trí');
  console.log('     3. Drag thiết bị để điều chỉnh vị trí nếu cần');
  console.log('='.repeat(62) + '\n');
}

main()
  .catch(err => {
    console.error('\n❌ LỖI:', err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
