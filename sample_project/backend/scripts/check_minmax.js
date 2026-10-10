const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: 3, floor: { name: 'floor_B1' } },
  });

  let minX = 999, maxX = -999, minZ = 999, maxZ = -999;
  for (const d of devices) {
    if (d.xCoordinate < minX) minX = d.xCoordinate;
    if (d.xCoordinate > maxX) maxX = d.xCoordinate;
    if (d.yCoordinate < minZ) minZ = d.yCoordinate;
    if (d.yCoordinate > maxZ) maxZ = d.yCoordinate;
  }
  console.log(`floor_B1 X: [${minX}, ${maxX}]`);
  console.log(`floor_B1 Z: [${minZ}, ${maxZ}]`);
}
main().finally(() => prisma.$disconnect());
