/**
 * Seed Device Rules — Quy tắc ràng buộc & hoạt cảnh cho hệ HVAC
 * 
 * Logic thực tế:
 *   Van CHW → Bơm nước lạnh → Chiller → Bơm giải nhiệt → Tháp giải nhiệt
 *   Van phải mở TRƯỚC khi chạy bơm/chiller (tránh nổ đường ống)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BUILDING_ID = 1;

async function main() {
  console.log('🔧 Seeding Device Rules...\n');

  // Xóa rules cũ
  await prisma.deviceRule.deleteMany({ where: { buildingId: BUILDING_ID } });

  // Lấy tất cả thiết bị online theo deviceId
  const devices = await prisma.buildingDevice.findMany({
    where: { buildingId: BUILDING_ID },
    select: { id: true, name: true, type: true, deviceId: true },
  });

  const findByDeviceId = (did) => devices.find(d => d.deviceId === did);

  const chiller   = findByDeviceId('CHILLER_01');
  const chwPump   = findByDeviceId('CHILLER_COLD_PUMP_01');
  const cwPump    = findByDeviceId('CHILLER_COOLING_PUMP_01');
  const chwValve  = findByDeviceId('CHILLER_VALVE_01');
  const coolTower = findByDeviceId('CHILLER_COOLING_TOWER_01');
  const ahu       = findByDeviceId('AHU_01');
  const ahuValve  = findByDeviceId('AHU_VALVE_01');
  const pau       = findByDeviceId('PAU_01');
  const pauValve  = findByDeviceId('PAU_VALVE_01');

  if (!chiller || !chwPump || !cwPump || !chwValve || !coolTower) {
    console.error('❌ Không tìm thấy đủ thiết bị HVAC cơ bản!');
    console.log('Devices found:', devices.filter(d => 
      ['CHILLER', 'CHILLER_COLD_PUMP', 'CHILLER_COOLING_PUMP', 'CHILLER_VALVE', 'CHILLER_COOLING_TOWER']
        .includes(d.type)).map(d => `${d.deviceId} [${d.type}]`));
    return;
  }

  const rules = [];

  // ═══ PREREQUISITE RULES ═══
  // "source cần target đang bật trước khi source được bật"
  
  // Chiller cần Van CHW đã mở (tránh nổ ống)
  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'PREREQUISITE',
    sourceDeviceId: chiller.id,
    targetDeviceId: chwValve.id,
    description: 'Chiller cần Van CHW mở trước',
    priority: 1,
  });

  // Bơm nước lạnh cần Van CHW đã mở
  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'PREREQUISITE',
    sourceDeviceId: chwPump.id,
    targetDeviceId: chwValve.id,
    description: 'Bơm nước lạnh cần Van CHW mở trước',
    priority: 1,
  });

  // Bơm giải nhiệt cần Chiller đang chạy
  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'PREREQUISITE',
    sourceDeviceId: cwPump.id,
    targetDeviceId: chiller.id,
    description: 'Bơm giải nhiệt cần Chiller đang chạy',
    priority: 1,
  });

  // AHU cần Bơm nước lạnh đang chạy
  if (ahu && chwPump) {
    rules.push({
      buildingId: BUILDING_ID,
      ruleType: 'PREREQUISITE',
      sourceDeviceId: ahu.id,
      targetDeviceId: chwPump.id,
      description: 'AHU cần Bơm nước lạnh đang chạy',
      priority: 1,
    });
  }

  // PAU cần Bơm nước lạnh đang chạy
  if (pau && chwPump) {
    rules.push({
      buildingId: BUILDING_ID,
      ruleType: 'PREREQUISITE',
      sourceDeviceId: pau.id,
      targetDeviceId: chwPump.id,
      description: 'PAU cần Bơm nước lạnh đang chạy',
      priority: 1,
    });
  }

  // ═══ CASCADE RULES ═══
  // "Khi source BẬT → tự động BẬT target"
  // "Khi source TẮT → tự động TẮT target"

  // Chiller BẬT → Bơm giải nhiệt BẬT, Tháp giải nhiệt BẬT
  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'CASCADE',
    sourceDeviceId: chiller.id,
    targetDeviceId: cwPump.id,
    triggerOn: 'ON',
    targetAction: 'ON',
    description: 'Chiller BẬT → Bơm giải nhiệt BẬT',
    priority: 1,
  });

  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'CASCADE',
    sourceDeviceId: chiller.id,
    targetDeviceId: coolTower.id,
    triggerOn: 'ON',
    targetAction: 'ON',
    description: 'Chiller BẬT → Tháp giải nhiệt BẬT',
    priority: 2,
  });

  // Chiller TẮT → Tắt toàn bộ hệ thống cooling
  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'CASCADE',
    sourceDeviceId: chiller.id,
    targetDeviceId: chwPump.id,
    triggerOn: 'OFF',
    targetAction: 'OFF',
    description: 'Chiller TẮT → Bơm nước lạnh TẮT',
    priority: 1,
  });

  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'CASCADE',
    sourceDeviceId: chiller.id,
    targetDeviceId: cwPump.id,
    triggerOn: 'OFF',
    targetAction: 'OFF',
    description: 'Chiller TẮT → Bơm giải nhiệt TẮT',
    priority: 2,
  });

  rules.push({
    buildingId: BUILDING_ID,
    ruleType: 'CASCADE',
    sourceDeviceId: chiller.id,
    targetDeviceId: coolTower.id,
    triggerOn: 'OFF',
    targetAction: 'OFF',
    description: 'Chiller TẮT → Tháp giải nhiệt TẮT',
    priority: 3,
  });

  // AHU BẬT → Van AHU BẬT
  if (ahu && ahuValve) {
    rules.push({
      buildingId: BUILDING_ID,
      ruleType: 'CASCADE',
      sourceDeviceId: ahu.id,
      targetDeviceId: ahuValve.id,
      triggerOn: 'ON',
      targetAction: 'ON',
      description: 'AHU BẬT → Van AHU BẬT',
      priority: 1,
    });

    rules.push({
      buildingId: BUILDING_ID,
      ruleType: 'CASCADE',
      sourceDeviceId: ahu.id,
      targetDeviceId: ahuValve.id,
      triggerOn: 'OFF',
      targetAction: 'OFF',
      description: 'AHU TẮT → Van AHU TẮT',
      priority: 1,
    });
  }

  // PAU BẬT → Van PAU BẬT
  if (pau && pauValve) {
    rules.push({
      buildingId: BUILDING_ID,
      ruleType: 'CASCADE',
      sourceDeviceId: pau.id,
      targetDeviceId: pauValve.id,
      triggerOn: 'ON',
      targetAction: 'ON',
      description: 'PAU BẬT → Van PAU BẬT',
      priority: 1,
    });

    rules.push({
      buildingId: BUILDING_ID,
      ruleType: 'CASCADE',
      sourceDeviceId: pau.id,
      targetDeviceId: pauValve.id,
      triggerOn: 'OFF',
      targetAction: 'OFF',
      description: 'PAU TẮT → Van PAU TẮT',
      priority: 1,
    });
  }

  // Insert all rules
  for (const rule of rules) {
    await prisma.deviceRule.create({ data: rule });
  }

  console.log(`✅ Đã tạo ${rules.length} quy tắc:\n`);

  const prereqs = rules.filter(r => r.ruleType === 'PREREQUISITE');
  const cascades = rules.filter(r => r.ruleType === 'CASCADE');

  console.log(`📋 PREREQUISITE (${prereqs.length}):`);
  prereqs.forEach(r => console.log(`  🔒 ${r.description}`));

  console.log(`\n⚡ CASCADE (${cascades.length}):`);
  cascades.forEach(r => console.log(`  ⚡ ${r.description}`));
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
