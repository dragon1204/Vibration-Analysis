const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Đếm trước
  const before = await prisma.buildingDevice.groupBy({
    by: ['buildingId'],
    _count: true,
  });
  console.log('Trước khi update:');
  before.forEach(g => console.log(`  buildingId=${g.buildingId}: ${g._count} devices`));

  // Update tất cả về buildingId = 1
  const result = await prisma.buildingDevice.updateMany({
    data: { buildingId: 1 },
  });
  console.log(`\n✅ Đã update ${result.count} devices → buildingId = 1`);

  // Đếm sau
  const after = await prisma.buildingDevice.groupBy({
    by: ['buildingId'],
    _count: true,
  });
  console.log('\nSau khi update:');
  after.forEach(g => console.log(`  buildingId=${g.buildingId}: ${g._count} devices`));
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
