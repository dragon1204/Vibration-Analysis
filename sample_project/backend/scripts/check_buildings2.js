const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.building.findMany().then(b => {
  b.forEach(x => console.log(`id=${x.id} name=${x.name} slug=${x.slug}`));
}).finally(() => p.$disconnect());
