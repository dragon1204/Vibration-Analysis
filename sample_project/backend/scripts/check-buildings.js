const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check devices with their floor names  
  const devices = await p.buildingDevice.findMany({ 
    where: { buildingId: 1 },
    select: { id: true, name: true, floorId: true },
    take: 10
  });
  
  const floors = await p.floor.findMany({ select: { id: true, name: true } });
  const floorMap = new Map();
  floors.forEach(f => floorMap.set(f.id, f.name));
  
  devices.forEach(d => {
    const floorName = floorMap.get(d.floorId) || 'UNKNOWN';
    console.log(`Device: ${d.name} | floorId: ${d.floorId} | floorName: "${floorName}"`);
  });
}

main().finally(() => p.$disconnect());
