const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const d = await p.buildingDevice.findFirst({ where: { type: 'PUMP' } });
  console.log(JSON.stringify(d, null, 2));
  await p.$disconnect();
})();
