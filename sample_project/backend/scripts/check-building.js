const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.building.findMany({ select: { id: true, name: true, modelUrl: true } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => p.$disconnect());
