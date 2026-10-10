const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Thống kê thiết bị theo type và building
  const stats = await p.buildingDevice.groupBy({
    by: ['type', 'buildingId'],
    _count: { id: true },
    orderBy: { buildingId: 'asc' },
  });
  console.log('\n=== DEVICE STATS BY TYPE & BUILDING ===');
  console.log(JSON.stringify(stats, null, 2));

  // Lấy mẫu 1 thiết bị mỗi loại
  const sample = await p.buildingDevice.findMany({
    select: {
      id: true, name: true, type: true, buildingId: true, floorId: true,
      deviceId: true, eboId: true, featureCode: true,
      manufacturer: true, model: true,
      attributes: true, configuration: true, tags: true,
      isOnline: true, status: true,
    },
    orderBy: { type: 'asc' },
    take: 50,
  });
  console.log('\n=== SAMPLE DEVICES (first 50) ===');
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
