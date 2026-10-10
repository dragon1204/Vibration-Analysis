const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const devices = await p.buildingDevice.findMany({
      where: { buildingId: 1 }, // Sapphire Tower
      select: {
        name: true,
        type: true,
        floorId: true,
        xCoordinate: true,
        yCoordinate: true,
        zCoordinate: true,
        floor: { select: { name: true } },
      },
      orderBy: { floorId: 'asc' },
    });

    console.log('=== DEVICE COORDINATES (Sapphire Tower) ===\n');
    console.log('Name'.padEnd(25), 'Type'.padEnd(15), 'Floor'.padEnd(12), 'X'.padEnd(8), 'Y'.padEnd(8), 'Z');
    console.log('-'.repeat(80));
    devices.forEach((d) => {
      console.log(
        (d.name || '').padEnd(25),
        d.type.padEnd(15),
        (d.floor?.name || '').padEnd(12),
        String(d.xCoordinate ?? 'null').padEnd(8),
        String(d.yCoordinate ?? 'null').padEnd(8),
        String(d.zCoordinate ?? 'null'),
      );
    });
    console.log(`\nTotal: ${devices.length} devices`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
