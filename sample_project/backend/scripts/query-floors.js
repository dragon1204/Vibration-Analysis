const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const f = await p.floor.findMany({
    where: { buildingId: 1 },
    select: { id: true, name: true, floorNumber: true },
    orderBy: { floorNumber: 'asc' },
  });
  console.log(JSON.stringify(f, null, 2));
  await p.$disconnect();
})();
