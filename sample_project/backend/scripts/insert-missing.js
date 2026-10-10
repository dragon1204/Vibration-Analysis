const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const BUILDING_ID = 1;

  const devices = [
    {
      deviceId: 'CHILLER_COOLING_PUMP_01',
      name: 'Chiller Cooling Pump 01',
      type: 'CHILLER_COOLING_PUMP',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false,
        mode: false,
        fault: false,
        speed: 0
      },
      tags: ['hvac', 'cooling', 'pump'],
      description: 'Bơm giải nhiệt Chiller',
    },
    {
      deviceId: 'CHILLER_COLD_PUMP_01',
      name: 'Chiller Cold Pump 01',
      type: 'CHILLER_COLD_PUMP',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false,
        mode: false,
        fault: false,
        speed: 0
      },
      tags: ['hvac', 'cooling', 'pump'],
      description: 'Bơm nước lạnh Chiller',
    },
    {
      deviceId: 'CHILLER_01',
      name: 'Chiller 01',
      type: 'CHILLER',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false,
        mode: false,
        fault: false
      },
      tags: ['hvac', 'cooling', 'chiller'],
      description: 'Máy làm lạnh Chiller',
    },
    {
      deviceId: 'AHU_01',
      name: 'AHU 01',
      type: 'AHU',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false,
        mode: false,
        fault: false,
        fanSpeed: 0,
        fanSpeedFeedback: 0
      },
      tags: ['hvac', 'ahu'],
      description: 'Air Handling Unit 01',
    },
    {
      deviceId: 'AHU_FILTER_01',
      name: 'AHU Filter 01',
      type: 'AHU_FILTER',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        fault: false
      },
      tags: ['hvac', 'ahu', 'filter'],
      description: 'Lưới lọc AHU 01',
    },
    {
      deviceId: 'AHU_SENSOR_TEMPERATURE_01',
      name: 'AHU Temp Sensor 01',
      type: 'AHU_SENSOR_TEMPERATURE',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        temp: 25.0
      },
      tags: ['hvac', 'ahu', 'sensor'],
      description: 'Cảm biến nhiệt độ AHU 01',
    },
    {
      deviceId: 'AHU_VALVE_01',
      name: 'AHU Valve 01',
      type: 'AHU_VALVE',
      buildingId: BUILDING_ID,
      xCoordinate: 0,
      yCoordinate: 0,
      zCoordinate: 0,
      isOnline: true,
      status: 'ACTIVE',
      attributes: {
        state: false
      },
      tags: ['hvac', 'ahu', 'valve'],
      description: 'Van AHU 01',
    }
  ];

  console.log(`Inserting ${devices.length} missing devices...`);

  for (const device of devices) {
    const existing = await p.buildingDevice.findFirst({
      where: { deviceId: device.deviceId, buildingId: BUILDING_ID }
    });

    if (!existing) {
      await p.buildingDevice.create({ data: device });
      console.log(`Created ${device.deviceId}`);
    } else {
      console.log(`Skipped ${device.deviceId} (already exists)`);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
