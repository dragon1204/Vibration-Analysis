const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: 3 },
    include: { floor: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Total devices in building 3:', devices.length);
  console.log('Currently online:', devices.filter(d => d.isOnline).length);
  console.log('');

  // Group by floor
  const byFloor = {};
  devices.forEach(d => {
    const fn = d.floor ? d.floor.name : 'No floor';
    if (!byFloor[fn]) byFloor[fn] = [];
    byFloor[fn].push(d);
  });

  for (const [floor, devs] of Object.entries(byFloor)) {
    console.log(`\n=== ${floor} (${devs.length} devices) ===`);
    const byType = {};
    devs.forEach(d => {
      if (!byType[d.type]) byType[d.type] = 0;
      byType[d.type]++;
    });
    console.log('  Types:', Object.entries(byType).map(([t, c]) => `${t}:${c}`).join(', '));
  }

  // Check which unique types exist
  const types = [...new Set(devices.map(d => d.type))];
  console.log('\n\nAll unique types:', types.join(', '));
  console.log('Type counts:');
  types.forEach(t => {
    const count = devices.filter(d => d.type === t).length;
    console.log(`  ${t}: ${count}`);
  });
}

main().finally(() => prisma.$disconnect());
