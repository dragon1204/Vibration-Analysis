const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Tìm tháp giải nhiệt ở tầng B1
  const devices = await p.buildingDevice.findMany({
    where: { type: 'CHILLER_COOLING_TOWER' },
    include: { floor: true },
  });
  console.log('Tháp giải nhiệt hiện tại:');
  devices.forEach(d => console.log(`  ${d.name} — floor: ${d.floor?.name} (id=${d.floorId})`));

  // Tìm tầng thượng
  const rooftop = await p.floor.findFirst({
    where: { name: { contains: 'floor_R' } },
  });
  if (!rooftop) {
    // Try other names
    const allFloors = await p.floor.findMany({ orderBy: { floorNumber: 'desc' }, take: 3 });
    console.log('\nCác tầng cao nhất:');
    allFloors.forEach(f => console.log(`  id=${f.id} name=${f.name} floorNumber=${f.floorNumber}`));
    return;
  }
  console.log(`\nTầng thượng: id=${rooftop.id} name=${rooftop.name}`);

  // Update
  const result = await p.buildingDevice.updateMany({
    where: { type: 'CHILLER_COOLING_TOWER' },
    data: { floorId: rooftop.id },
  });
  console.log(`\n✅ Đã chuyển ${result.count} tháp giải nhiệt lên tầng thượng`);
}

main().catch(console.error).finally(() => p.$disconnect());
