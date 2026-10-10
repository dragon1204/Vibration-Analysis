/**
 * migrate-to-single-building.js
 * 
 * Chuyển 21 thiết bị thật (EBO) từ Building 1 → Building 3 (Tòa Nhà B)
 * Xóa Building 1 (Landmark Tower A) + Building 2 (Landmark Tower B)
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function migrate() {
  console.log('═'.repeat(60));
  console.log('  MIGRATION: Hợp nhất về Building 3 (Tòa Nhà B)');
  console.log('═'.repeat(60));

  // ── Bước 1: Map floors Building 1 → Building 3 theo floorNumber ──
  const b3floors = await p.floor.findMany({
    where: { buildingId: 3 },
    orderBy: { floorNumber: 'asc' },
  });
  const b3FloorMap = new Map(); // floorNumber → floorId
  b3floors.forEach(f => b3FloorMap.set(f.floorNumber, f.id));
  console.log(`\n[1] Building 3 có ${b3floors.length} tầng:`);
  b3floors.forEach(f => console.log(`    fn=${f.floorNumber} → id=${f.id} (${f.name})`));

  // ── Bước 2: Chuyển 21 thiết bị thật từ Building 1 → Building 3 ──
  const b1devices = await p.buildingDevice.findMany({
    where: { buildingId: 1 },
    include: { floor: { select: { floorNumber: true, name: true } } },
  });
  console.log(`\n[2] Building 1 có ${b1devices.length} thiết bị thật cần chuyển:`);

  let moved = 0;
  const maxFloorNum = Math.max(...b3floors.map(f => f.floorNumber));
  const minFloorNum = Math.min(...b3floors.map(f => f.floorNumber));

  for (const dev of b1devices) {
    const srcFn = dev.floor?.floorNumber ?? 0;
    // Clamp floorNumber vào phạm vi Building 3
    const targetFn = Math.max(minFloorNum, Math.min(maxFloorNum, srcFn));
    const targetFloorId = b3FloorMap.get(targetFn) || b3FloorMap.get(0) || b3floors[0].id;

    await p.buildingDevice.update({
      where: { id: dev.id },
      data: {
        buildingId: 3,
        floorId: targetFloorId,
        // Giữ nguyên isOnline=true, status, coordinates
      },
    });

    const targetFloorName = b3floors.find(f => f.id === targetFloorId)?.name || '?';
    console.log(`    ✓ ${dev.name} (${dev.type}) → ${targetFloorName} (fn=${targetFn})`);
    moved++;
  }
  console.log(`    Tổng: ${moved} thiết bị đã chuyển sang Building 3`);

  // ── Bước 3: Xóa Building 1 (cascade xóa floors) ──
  console.log('\n[3] Xóa Building 1 (Landmark Tower A)...');
  const b1 = await p.building.delete({ where: { id: 1 } });
  console.log(`    ✓ Đã xóa: ${b1.name} (${b1.totalFloors} tầng cascade)`);

  // ── Bước 4: Xóa Building 2 (cascade xóa floors) ──
  console.log('\n[4] Xóa Building 2 (Landmark Tower B)...');
  const b2 = await p.building.delete({ where: { id: 2 } });
  console.log(`    ✓ Đã xóa: ${b2.name} (${b2.totalFloors} tầng cascade)`);

  // ── Verify ──
  const remaining = await p.building.findMany({ select: { id: true, name: true, totalFloors: true } });
  const devCount = await p.buildingDevice.count({ where: { buildingId: 3 } });
  const onlineCount = await p.buildingDevice.count({ where: { buildingId: 3, isOnline: true } });

  console.log('\n' + '═'.repeat(60));
  console.log('  KẾT QUẢ');
  console.log('═'.repeat(60));
  console.log(`  Buildings còn lại: ${remaining.map(b => `${b.name} (id=${b.id})`).join(', ')}`);
  console.log(`  Tổng thiết bị Building 3: ${devCount}`);
  console.log(`  Trong đó online (thật, EBO): ${onlineCount}`);
  console.log('═'.repeat(60));
}

migrate().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
}).finally(() => p.$disconnect());
