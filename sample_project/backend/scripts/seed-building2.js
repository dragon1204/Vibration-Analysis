/**
 * ============================================================
 *  PRISMA SEED: Tạo "Tòa Nhà B" (Building 2)
 *  Cấu trúc: B1(Hầm) + G(TTTM) + F01~F12(Dân cư) + R(Thượng)
 *  Model: /models/building.glb
 *
 *  CÁCH DÙNG (từ thư mục backend):
 *    node scripts/seed-building2.js
 * ============================================================
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const N_RESIDENT = 12;

const FLOORS = [
  {
    floorNumber: -1,
    name:        'floor_B1',
    floorType:   'BASEMENT',
    description: 'Tầng Hầm — Bãi đỗ xe, kỹ thuật',
    height:      3.0,
    elevation:   -3.0,
  },
  {
    floorNumber: 0,
    name:        'floor_G',
    floorType:   'COMMERCIAL',
    description: 'Tầng Trệt — Trung tâm thương mại',
    height:      5.0,
    elevation:   0.0,
  },
  ...Array.from({ length: N_RESIDENT }, (_, i) => ({
    floorNumber: i + 1,
    name:        `floor_F${String(i + 1).padStart(2, '0')}`,
    floorType:   'OFFICE',
    description: `Tầng ${i + 1} — Căn hộ dân cư`,
    height:      3.3,
    elevation:   5.0 + i * 3.3,
  })),
  {
    floorNumber: N_RESIDENT + 1,
    name:        'floor_R',
    floorType:   'ROOFTOP',
    description: 'Tầng Thượng — Bể bơi, tiện ích ngoài trời',
    height:      4.0,
    elevation:   5.0 + N_RESIDENT * 3.3,
  },
];

async function main() {
  console.log('\n' + '='.repeat(58));
  console.log('  🏗️  SEED: Tạo Tòa Nhà B');
  console.log('='.repeat(58));

  // ── Lấy Urban đầu tiên có sẵn trong DB ───────────────────
  const urban = await prisma.urban.findFirst({ orderBy: { id: 'asc' } });
  if (!urban) {
    console.error('\n❌ Không tìm thấy Urban nào trong DB!');
    console.error('   Hãy tạo ít nhất 1 Urban trước.\n');
    process.exit(1);
  }
  console.log(`\n[1/3] Urban tìm thấy: ID=${urban.id}, name="${urban.name}"`);

  // ── Kiểm tra slug đã tồn tại chưa ────────────────────────
  const existingSlug = await prisma.building.findFirst({
    where: { urbanId: urban.id, slug: 'toa-nha-b' },
  });
  if (existingSlug) {
    console.log(`\n⚠️  Building slug "toa-nha-b" đã tồn tại (ID=${existingSlug.id})`);
    console.log('   Đang dùng building đã tồn tại để tạo floors...\n');
    await seedFloors(existingSlug.id);
    return;
  }

  // ── Tạo Building ─────────────────────────────────────────
  console.log('\n[2/3] Tạo Building record...');
  const building = await prisma.building.create({
    data: {
      urbanId:     urban.id,
      name:        'Tòa Nhà B',
      slug:        'toa-nha-b',
      description: 'Tòa nhà modular 15 tầng: Hầm + TTTM + Dân cư + Thượng',
      modelUrl:    '/models/building.glb',
      totalFloors: FLOORS.length,
      positionX:   50,
      positionY:   0,
      positionZ:   0,
      rotationY:   0,
      scale:       1.0,
    },
  });
  console.log(`     ✓ Building created: ID=${building.id}`);

  await seedFloors(building.id);
}

async function seedFloors(buildingId) {
  console.log(`\n[3/3] Tạo ${FLOORS.length} tầng cho Building ID=${buildingId}...`);

  // Xóa floors cũ nếu có (để seed lại sạch)
  const deleted = await prisma.floor.deleteMany({ where: { buildingId } });
  if (deleted.count > 0) {
    console.log(`     ℹ️  Đã xóa ${deleted.count} floor cũ`);
  }

  // Tạo tất cả floors
  const result = await prisma.floor.createMany({
    data: FLOORS.map(f => ({ buildingId, ...f })),
    skipDuplicates: true,
  });

  console.log(`     ✓ Đã tạo ${result.count} tầng`);

  // Verify
  const floors = await prisma.floor.findMany({
    where:   { buildingId },
    orderBy: { floorNumber: 'asc' },
    select:  { id: true, floorNumber: true, name: true, floorType: true },
  });

  console.log('\n' + '='.repeat(58));
  console.log('  ✅  SEED THÀNH CÔNG!');
  console.log('='.repeat(58));
  console.log(`  Building ID  : ${buildingId}`);
  console.log(`  Model URL    : /models/building.glb`);
  console.log(`  Tổng tầng    : ${floors.length}`);
  console.log();
  console.log('  📋 Floor map:');
  floors.forEach(f => {
    const num = String(f.floorNumber).padStart(3, ' ');
    console.log(`     ${num} │ ${f.name.padEnd(13)}│ ${f.floorType}`);
  });
  console.log();
  console.log('  🔗 Bước tiếp theo:');
  console.log('     1. Mở BMS app → Header → chọn "Tòa Nhà B"');
  console.log('     2. Tab BMS → 3D Viewer sẽ load building.glb');
  console.log('     3. Click tầng → Drag thiết bị lên bản đồ');
  console.log('='.repeat(58) + '\n');
}

main()
  .catch(err => {
    console.error('\n❌ SEED FAILED:', err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
