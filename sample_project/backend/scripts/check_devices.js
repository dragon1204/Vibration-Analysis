const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.buildingDevice.findMany({ where: { buildingId: 3 } });
  console.log('Total devices:', devices.length);
  const withDeviceId = devices.filter(x => x.deviceId);
  console.log('With deviceId:', withDeviceId.length);
  const withEboId = devices.filter(x => x.eboId);
  console.log('With eboId:', withEboId.length);
  console.log('Types:', [...new Set(devices.map(x => x.type))].join(', '));
  console.log('Online count:', devices.filter(x => x.isOnline).length);
  console.log('\n--- All devices ---');
  devices.forEach(x => {
    console.log(`  ${x.name} [${x.type}] online=${x.isOnline} deviceId=${x.deviceId || 'null'} eboId=${x.eboId || 'null'}`);
  });
}

main().finally(() => prisma.$disconnect());
