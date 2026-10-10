const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const res = await p.building.updateMany({
      where: { modelUrl: '/models/smart_building.glb' },
      data: { modelUrl: '/models/model3D.glb' }
    });
    console.log(`Updated ${res.count} buildings to use /models/model3D.glb`);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await p.$disconnect();
  }
})();
