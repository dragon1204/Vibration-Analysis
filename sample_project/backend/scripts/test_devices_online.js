const { PrismaClient } = require('@prisma/client');
const mqtt = require('mqtt');
const Redis = require('ioredis');
const prisma = new PrismaClient();

const BUILDING_ID = 1; // Đã chuyển tất cả về building 1
const MQTT_URL = 'mqtt://localhost:1883';
const MQTT_USER = 'admin';
const MQTT_PASS = 'admin';
const REDIS_URL = 'redis://localhost:6379';
const LISTEN_SECONDS = 15;

async function main() {
  console.log('='.repeat(60));
  console.log('  🧹 CLEAN TEST for buildingId=1');
  console.log('='.repeat(60));

  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: BUILDING_ID },
    include: { floor: true },
  });
  console.log(`\n📦 Tổng thiết bị buildingId=${BUILDING_ID}: ${devices.length}`);
  console.log(`  Hiện tại online: ${devices.filter(d => d.isOnline).length}`);

  // Flush Redis
  const redis = new Redis(REDIS_URL);
  const allKeys = await redis.keys('base-router/*');
  if (allKeys.length > 0) await redis.del(...allKeys);
  console.log(`🧹 Đã xóa ${allKeys.length} Redis cache keys`);
  redis.disconnect();

  // Passive listen MQTT
  console.log(`\n📡 Lắng nghe MQTT ${LISTEN_SECONDS}s...`);
  const respondedDeviceIds = new Set();

  const client = mqtt.connect(MQTT_URL, {
    username: MQTT_USER, password: MQTT_PASS,
    clientId: `test_b1_${Date.now()}`, connectTimeout: 5000,
  });

  await new Promise((resolve, reject) => {
    client.on('connect', () => {
      client.subscribe('ebo/#', (err) => err ? reject(err) : resolve());
    });
    client.on('error', reject);
    setTimeout(() => reject(new Error('timeout')), 5000);
  });

  client.on('message', (topic, msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        if (!item.name) continue;
        const segs = item.name.split('/');
        const idx = segs.indexOf('deviceId');
        if (idx >= 0 && segs[idx + 1]) respondedDeviceIds.add(segs[idx + 1]);
      }
    } catch (e) {}
  });

  for (let i = 0; i < LISTEN_SECONDS; i += 5) {
    await new Promise(r => setTimeout(r, 5000));
    console.log(`  ${i + 5}s — ${respondedDeviceIds.size} deviceIds`);
  }
  client.end();

  console.log(`\n✅ EBO phản hồi: ${respondedDeviceIds.size} deviceIds`);
  if (respondedDeviceIds.size > 0) {
    console.log('  IDs:', [...respondedDeviceIds].sort().join(', '));
  }

  // Match to DB
  const onlineDevices = devices.filter(d => respondedDeviceIds.has(d.deviceId));
  console.log(`  Khớp DB: ${onlineDevices.length} devices`);

  // Update ALL to offline first
  await prisma.buildingDevice.updateMany({
    where: { buildingId: BUILDING_ID },
    data: { isOnline: false },
  });

  // Then set matched ones online
  if (onlineDevices.length > 0) {
    await prisma.buildingDevice.updateMany({
      where: { id: { in: onlineDevices.map(d => d.id) } },
      data: { isOnline: true, lastSeenAt: new Date() },
    });
  }

  const finalOnline = await prisma.buildingDevice.count({
    where: { buildingId: BUILDING_ID, isOnline: true },
  });
  const finalOffline = await prisma.buildingDevice.count({
    where: { buildingId: BUILDING_ID, isOnline: false },
  });

  console.log('\n' + '='.repeat(60));
  console.log(`  ✅ Online:  ${finalOnline}`);
  console.log(`  ❌ Offline: ${finalOffline}`);
  console.log(`  📦 Tổng:    ${devices.length}`);
  console.log('='.repeat(60));

  if (onlineDevices.length > 0) {
    for (const d of onlineDevices) {
      console.log(`  ✅ ${d.name} [${d.type}] — ${d.floor?.name || 'N/A'}`);
    }
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
