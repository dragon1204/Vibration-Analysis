const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const buildings = await p.building.findMany({
      include: {
        urban: { select: { name: true, slug: true } },
        _count: { select: { floors: true } },
        floors: {
          include: {
            _count: { select: { devices: true } },
          },
          orderBy: { floorNumber: 'asc' },
        },
      },
    });

    console.log('=== BUILDINGS ===');
    buildings.forEach((b) => {
      console.log(`\nBuilding: ${b.name} (ID: ${b.id})`);
      console.log(`  Urban: ${b.urban?.name || 'N/A'}`);
      console.log(`  Floors: ${b._count.floors}`);
      b.floors.forEach((f) => {
        console.log(`    - ${f.name} (ID: ${f.id}, Devices: ${f._count.devices})`);
      });
    });

    // Count devices by type
    const devices = await p.buildingDevice.groupBy({
      by: ['type', 'buildingId'],
      _count: true,
      orderBy: { _count: { type: 'desc' } },
    });

    console.log('\n=== DEVICES BY TYPE ===');
    devices.forEach((d) => {
      console.log(`  ${d.type}: ${d._count} (Building ID: ${d.buildingId})`);
    });

    const total = await p.buildingDevice.count();
    console.log(`\nTotal devices: ${total}`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
