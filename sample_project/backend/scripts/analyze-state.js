const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function analyze() {
  // Devices per building with status
  const devices = await p.buildingDevice.findMany({
    select: { id: true, name: true, type: true, buildingId: true, floorId: true, status: true, isOnline: true }
  });
  console.log('=== DEVICES SUMMARY ===');
  const buildings = await p.building.findMany({ select: { id: true, name: true } });
  const devByBuilding = {};
  devices.forEach(d => {
    const bid = d.buildingId;
    if (!devByBuilding[bid]) devByBuilding[bid] = { total: 0, online: 0, offline: 0, types: {} };
    devByBuilding[bid].total++;
    if (d.isOnline) devByBuilding[bid].online++;
    else devByBuilding[bid].offline++;
    devByBuilding[bid].types[d.type] = (devByBuilding[bid].types[d.type] || 0) + 1;
  });
  Object.entries(devByBuilding).forEach(([bid, info]) => {
    const bname = buildings.find(b => b.id === parseInt(bid))?.name || '?';
    console.log(`  Building ${bid} (${bname}): ${info.total} devices (${info.online} online, ${info.offline} offline)`);
    console.log(`    Types: ${JSON.stringify(info.types)}`);
  });

  // Online devices from building 2
  const b2online = devices.filter(d => d.buildingId === 2 && d.isOnline);
  console.log(`\nBuilding 2 online devices: ${b2online.length}`);
  // Online devices from building 1
  const b1online = devices.filter(d => d.buildingId === 1 && d.isOnline);
  console.log(`Building 1 online devices: ${b1online.length}`);
  // Building 3 devices
  const b3 = devices.filter(d => d.buildingId === 3);
  console.log(`Building 3 total devices: ${b3.length} (online: ${b3.filter(d=>d.isOnline).length}, offline: ${b3.filter(d=>!d.isOnline).length})`);

  // Floor mapping for B2 → B3
  const b2floors = await p.floor.findMany({ where: { buildingId: 2 }, orderBy: { floorNumber: 'asc' }, select: { id: true, name: true, floorNumber: true } });
  const b3floors = await p.floor.findMany({ where: { buildingId: 3 }, orderBy: { floorNumber: 'asc' }, select: { id: true, name: true, floorNumber: true } });
  console.log('\n=== FLOOR MAPPING B2 → B3 ===');
  console.log('B2 floors:', b2floors.map(f => `${f.name}(id=${f.id},fn=${f.floorNumber})`).join(', '));
  console.log('B3 floors:', b3floors.map(f => `${f.name}(id=${f.id},fn=${f.floorNumber})`).join(', '));

  // Device fields
  const sample = await p.buildingDevice.findFirst();
  if (sample) {
    console.log('\n=== DEVICE FIELDS ===');
    console.log(Object.keys(sample).join(', '));
  }
}

analyze().catch(console.error).finally(() => p.$disconnect());
