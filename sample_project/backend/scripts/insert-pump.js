const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const device = await p.buildingDevice.create({
    data: {
      deviceId: 'PUMP_01',
      name: 'Pump 01',
      type: 'PUMP',
      buildingId: 1096,
      xCoordinate: 3,
      yCoordinate: 6,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false,
        mode: false,
      },
      tags: ['hvac', 'pump'],
      description: 'Bơm nước / Water Pump',
    },
  });
  console.log('Created PUMP_01:', device.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
