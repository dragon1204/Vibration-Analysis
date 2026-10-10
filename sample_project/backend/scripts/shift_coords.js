const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: 3 }
  });
  
  let updated = 0;
  for (const d of devices) {
    // Add 10 to X and Y
    const newX = (d.xCoordinate || 0) + 10;
    const newY = (d.yCoordinate || 0) + 10;
    
    await prisma.buildingDevice.update({
      where: { id: d.id },
      data: {
        xCoordinate: newX,
        yCoordinate: newY
      }
    });
    updated++;
  }
  console.log(`Successfully shifted coordinates (+10, +10) for ${updated} devices.`);
}

main().finally(() => prisma.$disconnect());
