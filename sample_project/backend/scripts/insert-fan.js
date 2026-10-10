const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const device = await p.buildingDevice.create({
    data: {
      deviceId: 'FAN_01',
      name: 'Exhaust Fan 01',
      type: 'FAN',
      buildingId: 1096,
      xCoordinate: 5,
      yCoordinate: 4,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false,
        mode: false,
        fault: false,
        airPressure: 0,
        airTemperature: 25,
        fanSpeed: 0,
      },
      tags: ['hvac', 'fan', 'exhaust'],
      description: 'Quạt thông gió / Exhaust Fan',
    },
  });
  console.log('Created FAN_01:', device.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
