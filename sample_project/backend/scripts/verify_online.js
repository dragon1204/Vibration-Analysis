const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.buildingDevice.findMany({
  where: { buildingId: 1 },
  select: { name: true, isOnline: true },
  take: 15,
}).then(d => {
  d.forEach(x => console.log(`${x.isOnline ? '✅' : '❌'} ${x.name}`));
  return p.buildingDevice.count({ where: { buildingId: 1, isOnline: true } });
}).then(c => {
  console.log(`\nTotal online: ${c}`);
}).finally(() => p.$disconnect());
