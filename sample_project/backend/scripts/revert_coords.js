const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: 3 }
  });
  
  let updated = 0;
  for (const d of devices) {
    // Subtract 10 from X and Y to revert my previous script
    const newX = (d.xCoordinate || 0) - 10;
    const newY = (d.yCoordinate || 0) - 10;
    
    await prisma.buildingDevice.update({
      where: { id: d.id },
      data: {
        xCoordinate: newX,
        yCoordinate: newY
      }
    });
    updated++;
  }
  console.log(`Successfully reverted coordinates (-10, -10) for ${updated} devices.`);
}

main().finally(() => prisma.$disconnect());
