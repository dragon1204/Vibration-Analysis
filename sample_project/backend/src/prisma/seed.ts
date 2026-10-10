import { PrismaClient, FloorType, BuildingDeviceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── 1. Create Urban ─────────────────────────────────────────────
  const urban = await prisma.urban.upsert({
    where: { code: 'VCP' },
    update: {},
    create: {
      code: 'VCP',
      slug: 'vinhomes-central-park',
      name: 'Vinhomes Central Park',
      address: '720A Điện Biên Phủ, Bình Thạnh, TP.HCM',
      description: 'Khu đô thị thông minh Vinhomes Central Park',
      latitude: 10.7942,
      longitude: 106.7222,
    },
  });
  console.log(`✅ Urban: ${urban.name} (id=${urban.id})`);

  // ─── 2. Create Buildings ──────────────────────────────────────────
  const buildingA = await prisma.building.create({
    data: {
      urbanId: urban.id,
      code: 'LM-A',
      slug: 'landmark-tower-a',
      name: 'Landmark Tower A',
      description: 'Tòa văn phòng chính',
      modelUrl: '/models/model3D.glb',
      totalFloors: 25,
      positionX: -15,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
      scale: 1,
    },
  });

  const buildingB = await prisma.building.create({
    data: {
      urbanId: urban.id,
      code: 'LM-B',
      slug: 'landmark-tower-b',
      name: 'Landmark Tower B',
      description: 'Tòa thương mại và dịch vụ',
      modelUrl: '/models/model3D.glb',
      totalFloors: 20,
      positionX: 15,
      positionY: 0,
      positionZ: 5,
      rotationY: 0.3,
      scale: 0.85,
    },
  });
  console.log(`✅ Buildings: ${buildingA.name}, ${buildingB.name}`);

  // ─── 3. Create Floors for Building A ──────────────────────────────
  const floorConfigs = [
    { floorNumber: -2, name: 'B2',        floorType: FloorType.BASEMENT,   elevation: -7.0, height: 3.5 },
    { floorNumber: -1, name: 'B1',        floorType: FloorType.BASEMENT,   elevation: -3.5, height: 3.5 },
    { floorNumber: 0,  name: 'Ground',    floorType: FloorType.GROUND,     elevation: 0,    height: 4.5 },
    { floorNumber: 1,  name: 'Floor 1',   floorType: FloorType.COMMERCIAL, elevation: 4.5,  height: 4.0 },
    { floorNumber: 2,  name: 'Floor 2',   floorType: FloorType.COMMERCIAL, elevation: 8.5,  height: 4.0 },
    { floorNumber: 3,  name: 'Floor 3',   floorType: FloorType.OFFICE,     elevation: 12.5, height: 3.5 },
    { floorNumber: 4,  name: 'Floor 4',   floorType: FloorType.OFFICE,     elevation: 16.0, height: 3.5 },
    { floorNumber: 5,  name: 'Floor 5',   floorType: FloorType.OFFICE,     elevation: 19.5, height: 3.5 },
    { floorNumber: 6,  name: 'Floor 6',   floorType: FloorType.OFFICE,     elevation: 23.0, height: 3.5 },
    { floorNumber: 7,  name: 'Floor 7',   floorType: FloorType.OFFICE,     elevation: 26.5, height: 3.5 },
    { floorNumber: 8,  name: 'Floor 8',   floorType: FloorType.OFFICE,     elevation: 30.0, height: 3.5 },
    { floorNumber: 9,  name: 'Floor 9',   floorType: FloorType.OFFICE,     elevation: 33.5, height: 3.5 },
    { floorNumber: 10, name: 'Floor 10',  floorType: FloorType.OFFICE,     elevation: 37.0, height: 3.5 },
    { floorNumber: 11, name: 'Floor 11',  floorType: FloorType.MECHANICAL, elevation: 40.5, height: 4.0 },
    { floorNumber: 12, name: 'Floor 12',  floorType: FloorType.OFFICE,     elevation: 44.5, height: 3.5 },
    { floorNumber: 13, name: 'Floor 13',  floorType: FloorType.OFFICE,     elevation: 48.0, height: 3.5 },
    { floorNumber: 14, name: 'Floor 14',  floorType: FloorType.OFFICE,     elevation: 51.5, height: 3.5 },
    { floorNumber: 15, name: 'Floor 15',  floorType: FloorType.OFFICE,     elevation: 55.0, height: 3.5 },
    { floorNumber: 16, name: 'Floor 16',  floorType: FloorType.OFFICE,     elevation: 58.5, height: 3.5 },
    { floorNumber: 17, name: 'Floor 17',  floorType: FloorType.OFFICE,     elevation: 62.0, height: 3.5 },
    { floorNumber: 18, name: 'Floor 18',  floorType: FloorType.OFFICE,     elevation: 65.5, height: 3.5 },
    { floorNumber: 19, name: 'Floor 19',  floorType: FloorType.OFFICE,     elevation: 69.0, height: 3.5 },
    { floorNumber: 20, name: 'Floor 20',  floorType: FloorType.OFFICE,     elevation: 72.5, height: 3.5 },
    { floorNumber: 21, name: 'Rooftop',   floorType: FloorType.ROOFTOP,    elevation: 76.0, height: 4.0 },
  ];

  const createdFloors = new Map<number, number>(); // floorNumber → floorId

  for (const fc of floorConfigs) {
    const floor = await prisma.floor.create({
      data: { buildingId: buildingA.id, ...fc },
    });
    createdFloors.set(fc.floorNumber, floor.id);
  }
  console.log(`✅ Floors: ${floorConfigs.length} floors for ${buildingA.name}`);

  // Also create floors for Building B (simpler)
  const floorConfigsB = [
    { floorNumber: -1, name: 'B1',       floorType: FloorType.BASEMENT, elevation: -3.5, height: 3.5 },
    { floorNumber: 0,  name: 'Ground',   floorType: FloorType.GROUND,   elevation: 0,    height: 4.5 },
    ...Array.from({ length: 18 }, (_, i) => ({
      floorNumber: i + 1,
      name: `Floor ${i + 1}`,
      floorType: i < 3 ? FloorType.COMMERCIAL : FloorType.OFFICE,
      elevation: 4.5 + i * 3.5,
      height: 3.5,
    })),
    { floorNumber: 19, name: 'Rooftop', floorType: FloorType.ROOFTOP, elevation: 67.5, height: 4.0 },
  ];

  for (const fc of floorConfigsB) {
    await prisma.floor.create({
      data: { buildingId: buildingB.id, ...fc },
    });
  }
  console.log(`✅ Floors: ${floorConfigsB.length} floors for ${buildingB.name}`);

  // ─── 4. Seed Devices for Building A ───────────────────────────────
  // deviceId and attribute keys MUST match EBO registered names exactly.
  // Format: deviceType/{TYPE}/buildingId/{id}/deviceId/{DEVICE_ID}/{attrKey}

  const devices = [
    // ═══ BASEMENT B2: Chiller Plant (cooling.xlsx — buildingId=1 in EBO) ═══
    {
      deviceId: 'CHILLER_01', name: 'Chiller 1', type: BuildingDeviceType.CHILLER,
      floorNumber: -2, x: 2, y: 3,
      attributes: { state: false, mode: 0, fault: 0 },
    },
    {
      deviceId: 'CHILLER_COLD_PUMP_01', name: 'CHW Pump 1', type: BuildingDeviceType.CHILLER_COLD_PUMP,
      floorNumber: -2, x: 2, y: 6,
      attributes: { state: false, mode: 0, speed: 0, fault: 0 },
    },
    {
      deviceId: 'CHILLER_COOLING_PUMP_01', name: 'CW Pump 1', type: BuildingDeviceType.CHILLER_COOLING_PUMP,
      floorNumber: -2, x: 6, y: 6,
      attributes: { state: false, mode: 0, speed: 0, fault: 0 },
    },
    {
      deviceId: 'CHILLER_VALVE_01', name: 'CHW Valve 1', type: BuildingDeviceType.CHILLER_VALVE,
      floorNumber: -2, x: 4, y: 5,
      attributes: { state: false },
    },
    {
      deviceId: 'CHILLER_PIPE_01', name: 'CHW Pipe Main', type: BuildingDeviceType.CHILLER_PIPE,
      floorNumber: -2, x: 4, y: 4,
      attributes: { state: false, flowRate: 0, pressure: 0, temperature: 0 },
    },
    {
      deviceId: 'CHILLER_COOLING_TOWER_01', name: 'Cooling Tower 1', type: BuildingDeviceType.CHILLER_COOLING_TOWER,
      floorNumber: -2, x: 7, y: 3,
      attributes: { state: false, mode: 0, fault: 0 },
    },

    // ═══ BASEMENT B1: Fire Pump + General Pumps (fire-pump.xlsx, pump.xlsx) ═══
    {
      deviceId: 'FIRE_PUMP_01', name: 'Fire Pump 1', type: BuildingDeviceType.FIRE_PUMP,
      eboId: '1096', floorNumber: -1, x: 2, y: 2,
      attributes: { state: false, mode: 0, pressure: 0, fault: 0 },
    },
    {
      deviceId: 'PUMP_01', name: 'Water Pump 1', type: BuildingDeviceType.PUMP,
      eboId: '1096', floorNumber: -1, x: 5, y: 2,
      attributes: { state: false, mode: 0 },
    },

    // ═══ GROUND: PAU + Entry devices (cooling.xlsx) ═══
    {
      deviceId: 'PAU_01', name: 'PAU Lobby', type: BuildingDeviceType.PAU,
      floorNumber: 0, x: 4, y: 3,
      attributes: { state: false, mode: 0, fanSpeed: 0, fanSpeedFeedBack: 0, fault: 0 },
    },
    {
      deviceId: 'PAU_VALVE_01', name: 'PAU Valve 1', type: BuildingDeviceType.PAU_VALVE,
      floorNumber: 0, x: 3, y: 3,
      attributes: { state: false },
    },
    {
      deviceId: 'PAU_FILTER_01', name: 'PAU Filter 1', type: BuildingDeviceType.PAU_FILTER,
      floorNumber: 0, x: 5, y: 3,
      attributes: { fault: 0 },
    },
    {
      deviceId: 'PAU_SENSOR_TEMPERATURE_01', name: 'PAU Temp Sensor 1', type: BuildingDeviceType.PAU_SENSOR_TEMPERATURE,
      floorNumber: 0, x: 4, y: 4,
      attributes: { temp: 0 },
    },

    // ═══ OFFICE Floors: AHU + VAV + FCU + FAN + LIGHT (cooling.xlsx, fan.xlsx, light.xlsx) ═══

    // Floor 3
    {
      deviceId: 'AHU_01', name: 'AHU 1', type: BuildingDeviceType.AHU,
      floorNumber: 3, x: 4, y: 2,
      attributes: { state: false, mode: 0, fanSpeed: 0, fanSpeedFeedback: 0, fault: 0 },
    },
    {
      deviceId: 'AHU_VALVE_01', name: 'AHU Valve 1', type: BuildingDeviceType.AHU_VALVE,
      floorNumber: 3, x: 3, y: 2,
      attributes: { state: false },
    },
    {
      deviceId: 'AHU_FILTER_01', name: 'AHU Filter 1', type: BuildingDeviceType.AHU_FILTER,
      floorNumber: 3, x: 5, y: 2,
      attributes: { fault: 0 },
    },
    {
      deviceId: 'AHU_SENSOR_TEMPERATURE_01', name: 'AHU Temp Sensor 1', type: BuildingDeviceType.AHU_SENSOR_TEMPERATURE,
      floorNumber: 3, x: 4, y: 3,
      attributes: { temp: 0 },
    },

    // Floor 5
    {
      deviceId: 'VAV_01', name: 'VAV Zone A', type: BuildingDeviceType.VAV,
      floorNumber: 5, x: 2, y: 5,
      attributes: { state: false, openingAngle: 0, command: 0, temp: 0 },
    },
    {
      deviceId: 'FCU_01', name: 'FCU Room 501', type: BuildingDeviceType.FCU,
      floorNumber: 5, x: 2, y: 7,
      attributes: { state: false, speed: 0, command: 0, temp: 0 },
    },
    {
      deviceId: 'FAN_01', name: 'Exhaust Fan 1', type: BuildingDeviceType.FAN,
      floorNumber: 5, x: 8, y: 4,
      attributes: { state: false, mode: 0, fan_speed: 0, air_pressure: 0, air_temperature: 0, fault: 0 },
    },

    // Floor 10
    {
      deviceId: 'LIGHT_01', name: 'Light Hall', type: BuildingDeviceType.LIGHT,
      eboId: '1096', floorNumber: 10, x: 4, y: 4,
      attributes: { state: false },
    },
    {
      deviceId: 'DIM_LIGHT_01', name: 'Dim Light Office', type: BuildingDeviceType.DIM_LIGHT,
      eboId: '1096', floorNumber: 10, x: 6, y: 4,
      attributes: { state: false, brightness: 0 },
    },
  ];

  let deviceCount = 0;
  for (const d of devices) {
    const floorId = createdFloors.get(d.floorNumber);
    await prisma.buildingDevice.create({
      data: {
        deviceId: d.deviceId,
        eboId: (d as any).eboId ?? null,
        name: d.name,
        type: d.type,
        buildingId: buildingA.id,
        urbanId: urban.id,
        floorId: floorId ?? null,
        xCoordinate: d.x,
        yCoordinate: d.y,
        zCoordinate: 0,
        isOnline: true,
        status: 'ACTIVE',
        attributes: d.attributes as any,
        tags: [],
      },
    });
    deviceCount++;
  }
  console.log(`✅ Devices: ${deviceCount} devices seeded for ${buildingA.name}`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
