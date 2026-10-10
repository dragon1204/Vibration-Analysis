const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const b = await p.building.findMany({ select: { id: true, name: true, modelUrl: true } });
  console.log(JSON.stringify(b, null, 2));
  await p.$disconnect();
})();
