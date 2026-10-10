const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: 3 },
    take: 5
  });
  
  for (const d of devices) {
    console.log(d.id, d.xCoordinate, d.yCoordinate);
  }
}
main().finally(() => prisma.$disconnect());
