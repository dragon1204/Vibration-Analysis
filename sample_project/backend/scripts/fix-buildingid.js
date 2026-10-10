const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.buildingDevice.updateMany({
    where: { buildingId: 1096 },
    data: { buildingId: 1 },
  });
  console.log('Updated ' + result.count + ' devices: buildingId 1096 -> 1');

  const all = await p.buildingDevice.findMany({
    where: { buildingId: 1 },
    select: { deviceId: true, type: true, buildingId: true },
  });
  console.log('\nAll devices (buildingId=1):');
  all.forEach(d => console.log('  ' + d.type.padEnd(30) + ' | ' + d.deviceId));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
