/**
 * Tạo bổ sung các loại thiết bị thiếu template trong Building B
 * CAMERA, FIRE_ALARM, ELECTRIC, ELECTRIC_METER, WATER_METER,
 * CO2_METER, POWER_BREAKER, BTU_METER
 */
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const p = new PrismaClient();

const TARGET_BUILDING_ID = 3;

// Template attributes cho từng loại thiết bị thiếu
const MISSING_TEMPLATES = {
  CAMERA:         { attributes: { recording: true, motion: false, online: true } },
  FIRE_ALARM:     { attributes: { alarm: false, fault: false, state: true } },
  ELECTRIC:       { attributes: { state: true, voltage: 220, current: 15.5 } },
  ELECTRIC_METER: { attributes: { energy: 0, power: 0, voltage: 220, current: 0 } },
  WATER_METER:    { attributes: { flow: 0, totalVolume: 0, pressure: 2.5 } },
  CO2_METER:      { attributes: { co2: 420, temperature: 24, humidity: 60 } },
  POWER_BREAKER:  { attributes: { state: true, tripped: false, current: 30 } },
  BTU_METER:      { attributes: { btu: 0, flowRate: 0, supplyTemp: 7, returnTemp: 12 } },
};

// Quy tắc bổ sung cho các type thiếu, theo floorType
const MISSING_RULES = {
  BASEMENT: [
    { type: 'CAMERA',         count: 4, namePrefix: 'Camera Hầm',
      positions: [[-7,-7],[7,-7],[-7,7],[7,7]] },
    { type: 'FIRE_ALARM',     count: 4, namePrefix: 'Báo Cháy Hầm',
      positions: [[-5,-5],[5,-5],[-5,5],[5,5]] },
    { type: 'ELECTRIC',       count: 1, namePrefix: 'Tủ Điện Hầm',
      positions: [[-8,0]] },
    { type: 'ELECTRIC_METER', count: 1, namePrefix: 'Đồng Hồ Điện Hầm',
      positions: [[-8,2]] },
    { type: 'WATER_METER',    count: 1, namePrefix: 'Đồng Hồ Nước Hầm',
      positions: [[-8,4]] },
  ],
  COMMERCIAL: [
    { type: 'CAMERA',         count: 6,  namePrefix: 'Camera TTTM',
      positions: [[-8,-7],[0,-7],[8,-7],[-8,7],[0,7],[8,7]] },
    { type: 'FIRE_ALARM',     count: 6,  namePrefix: 'Báo Cháy TTTM',
      positions: [[-6,-5],[0,-5],[6,-5],[-6,5],[0,5],[6,5]] },
    { type: 'ELECTRIC_METER', count: 1,  namePrefix: 'Đồng Hồ Điện TTTM',
      positions: [[-8,-9]] },
    { type: 'CO2_METER',      count: 3,  namePrefix: 'CO2 TTTM',
      positions: [[-5,-8],[0,-8],[5,-8]] },
    { type: 'POWER_BREAKER',  count: 2,  namePrefix: 'CB Tổng TTTM',
      positions: [[-9,-6],[9,-6]] },
  ],
  OFFICE: [
    { type: 'CAMERA',         count: 2, namePrefix: 'Camera Hành Lang',
      positions: [[0,-7],[0,7]] },
    { type: 'FIRE_ALARM',     count: 4, namePrefix: 'Báo Cháy Căn Hộ',
      positions: [[-5,-5],[5,-5],[-5,5],[5,5]] },
    { type: 'CO2_METER',      count: 2, namePrefix: 'CO2 Căn Hộ',
      positions: [[-4,0],[4,0]] },
    { type: 'ELECTRIC_METER', count: 1, namePrefix: 'Đồng Hồ Điện Tầng',
      positions: [[-9,0]] },
  ],
  ROOFTOP: [
    { type: 'CAMERA',         count: 4, namePrefix: 'Camera Mái',
      positions: [[-9,-9],[9,-9],[-9,9],[9,9]] },
    { type: 'FIRE_ALARM',     count: 2, namePrefix: 'Báo Cháy Mái',
      positions: [[-5,-5],[5,-5]] },
    { type: 'ELECTRIC_METER', count: 1, namePrefix: 'Đồng Hồ Điện Tổng',
      positions: [[-9,-5]] },
    { type: 'WATER_METER',    count: 1, namePrefix: 'Đồng Hồ Nước Mái',
      positions: [[-9,-3]] },
    { type: 'BTU_METER',      count: 1, namePrefix: 'BTU Meter Mái',
      positions: [[-9,-1]] },
  ],
};

async function main() {
  console.log('\n=== BỔ SUNG THIẾT BỊ THIẾU ===\n');

  const floors = await p.floor.findMany({
    where: { buildingId: TARGET_BUILDING_ID },
    orderBy: { floorNumber: 'asc' },
  });

  let totalAdded = 0;

  for (const floor of floors) {
    const rules = MISSING_RULES[floor.floorType];
    if (!rules) continue;

    const toCreate = [];
    for (const rule of rules) {
      const tmpl = MISSING_TEMPLATES[rule.type];
      if (!tmpl) continue;

      for (let i = 0; i < rule.count; i++) {
        const pos = rule.positions[i] || [0, 0];
        const suffix = rule.count > 1 ? ` ${i + 1}` : '';
        toCreate.push({
          id:          uuidv4(),
          buildingId:  TARGET_BUILDING_ID,
          floorId:     floor.id,
          type:        rule.type,
          name:        `${rule.namePrefix}${suffix}`,
          deviceId:    `B3_${rule.type}_F${floor.floorNumber}_${i + 1}`,
          status:      'ACTIVE',
          isOnline:    true,
          xCoordinate: pos[0],
          yCoordinate: pos[1],
          attributes:  tmpl.attributes,
          tags:        [],
          description: `${rule.namePrefix}${suffix} — ${floor.name}`,
        });
      }
    }

    if (toCreate.length > 0) {
      await p.buildingDevice.createMany({ data: toCreate });
      totalAdded += toCreate.length;
      console.log(`  ✓ ${floor.name.padEnd(14)} +${toCreate.length} devices (${toCreate.map(d => d.type).join(', ').substring(0, 60)}...)`);
    }
  }

  console.log(`\n✅ Đã bổ sung thêm ${totalAdded} thiết bị`);

  // Tổng kết cuối
  const total = await p.buildingDevice.count({ where: { buildingId: TARGET_BUILDING_ID } });
  console.log(`\n📊 Tổng cộng Building B hiện có: ${total} thiết bị`);

  // Thống kê theo tầng
  const byFloor = await p.buildingDevice.groupBy({
    by: ['floorId'],
    where: { buildingId: TARGET_BUILDING_ID },
    _count: { id: true },
  });
  const floorMap = new Map(floors.map(f => [f.id, f.name]));
  console.log('\n  Phân bố:');
  byFloor.sort((a, b) => a.floorId - b.floorId).forEach(row => {
    const name = floorMap.get(row.floorId) || `Floor ${row.floorId}`;
    console.log(`     ${name.padEnd(14)} ${row._count.id} thiết bị`);
  });
  console.log();
}

main().catch(console.error).finally(() => p.$disconnect());
