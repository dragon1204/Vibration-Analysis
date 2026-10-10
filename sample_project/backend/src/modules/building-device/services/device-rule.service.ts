import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { RuleType } from '@prisma/client';
import { RouterGateway } from '../mqtt/router.mqtt.gateway';

@Injectable()
export class DeviceRuleService {
  private readonly logger = new Logger(DeviceRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttGateway: RouterGateway,
  ) {}

  /**
   * Lấy tất cả quy tắc cho một building
   */
  async getRules(buildingId: number) {
    return this.prisma.deviceRule.findMany({
      where: { buildingId },
      include: {
        sourceDevice: { select: { id: true, name: true, type: true, deviceId: true } },
        targetDevice: { select: { id: true, name: true, type: true, deviceId: true } },
      },
      orderBy: [{ ruleType: 'asc' }, { priority: 'asc' }],
    });
  }

  /**
   * Tạo quy tắc mới
   */
  async createRule(data: {
    buildingId: number;
    ruleType: RuleType;
    sourceDeviceId: string;
    targetDeviceId: string;
    triggerOn?: string;
    targetAction?: string;
    priority?: number;
    description?: string;
  }) {
    return this.prisma.deviceRule.create({
      data: {
        buildingId: data.buildingId,
        ruleType: data.ruleType,
        sourceDeviceId: data.sourceDeviceId,
        targetDeviceId: data.targetDeviceId,
        triggerOn: data.triggerOn,
        targetAction: data.targetAction,
        priority: data.priority ?? 0,
        description: data.description,
      },
      include: {
        sourceDevice: { select: { id: true, name: true, type: true } },
        targetDevice: { select: { id: true, name: true, type: true } },
      },
    });
  }

  /**
   * Xóa quy tắc
   */
  async deleteRule(id: string) {
    return this.prisma.deviceRule.delete({ where: { id } });
  }

  /**
   * PREREQUISITE CHECK — Gọi trước khi bật thiết bị
   * 
   * Kiểm tra: thiết bị này có quy tắc PREREQUISITE nào không?
   * Nếu có, target device (thiết bị phải bật trước) phải đang ON.
   * 
   * Ví dụ: Chiller muốn bật → Van CHW phải đang bật
   *         (source=Chiller, target=Van, ruleType=PREREQUISITE)
   *         Nghĩa là: "source cần target đang bật"
   */
  async checkPrerequisites(deviceId: string, action: 'ON' | 'OFF'): Promise<{ ok: boolean; failedDevices: string[] }> {
    // Chỉ check khi BẬT thiết bị
    if (action !== 'ON') return { ok: true, failedDevices: [] };

    const rules = await this.prisma.deviceRule.findMany({
      where: {
        sourceDeviceId: deviceId,
        ruleType: RuleType.PREREQUISITE,
        isActive: true,
      },
      include: {
        targetDevice: { select: { id: true, name: true, attributes: true, isOnline: true } },
      },
    });

    if (rules.length === 0) return { ok: true, failedDevices: [] };

    const failedDevices: string[] = [];

    for (const rule of rules) {
      const target = rule.targetDevice;
      const attrs = target.attributes as Record<string, any> | null;
      const isTargetOn = attrs?.state === 1 || attrs?.state === true || attrs?.running === 1;

      if (!isTargetOn) {
        failedDevices.push(target.name);
        this.logger.warn(
          `PREREQUISITE FAILED: ${deviceId} requires "${target.name}" to be ON first`,
        );
      }
    }

    return { ok: failedDevices.length === 0, failedDevices };
  }

  /**
   * CASCADE EXECUTION — Gọi sau khi thiết bị thay đổi state
   *
   * Khi source device thay đổi trạng thái → tìm các CASCADE rule
   * → gửi lệnh MQTT thật tới các target device
   * 
   * Anti-loop: dùng Set để theo dõi thiết bị đã xử lý
   */
  async executeCascade(
    deviceId: string,
    newState: 'ON' | 'OFF',
    processedDeviceIds: Set<string> = new Set(),
  ): Promise<void> {
    // Anti-loop: nếu thiết bị này đã được xử lý trong chain → dừng
    if (processedDeviceIds.has(deviceId)) {
      this.logger.warn(`CASCADE LOOP DETECTED for device ${deviceId}, stopping.`);
      return;
    }
    processedDeviceIds.add(deviceId);

    const rules = await this.prisma.deviceRule.findMany({
      where: {
        sourceDeviceId: deviceId,
        ruleType: RuleType.CASCADE,
        triggerOn: newState,
        isActive: true,
      },
      include: {
        targetDevice: {
          select: {
            id: true, name: true, type: true, deviceId: true,
            eboId: true, buildingId: true, featureCode: true,
          },
        },
      },
      orderBy: { priority: 'asc' },
    });

    if (rules.length === 0) return;

    this.logger.log(
      `CASCADE: Device ${deviceId} → ${newState} → triggering ${rules.length} targets`,
    );

    for (const rule of rules) {
      const target = rule.targetDevice;
      const targetAction = rule.targetAction; // "ON" or "OFF"

      if (!target.deviceId) continue;
      if (processedDeviceIds.has(target.id)) continue;

      const stateValue = targetAction === 'ON' ? 1 : 0;

      // Gửi lệnh MQTT thật tới EBO
      const getFeatureCode = (type: string) => {
        if (type.includes('CHILLER') || type.includes('AHU') || type.includes('PAU') || type === 'FCU' || type === 'VAV') return 'COOLING';
        if (type === 'FAN') return 'FAN';
        if (type === 'PUMP') return 'PUMP';
        if (type === 'FIRE_PUMP' || type === 'FIRE_ALARM') return 'FIRE_PROTECTION';
        if (type === 'LIGHT' || type === 'DIM_LIGHT') return 'LIGHT';
        return type;
      };

      const targetEboId = target.eboId || target.buildingId;
      const targetFeature = target.featureCode || getFeatureCode(target.type);
      const topic = `ebo/${targetEboId}/feature_code/${targetFeature}`;

      const payload = [{
        name: `deviceType/${target.type}/buildingId/${targetEboId}/deviceId/${target.deviceId}/state`,
        value: stateValue,
      }];

      this.logger.log(
        `  CASCADE → ${target.name} [${target.type}] → state=${stateValue}`,
      );

      this.mqttGateway.sendDataToBroker(topic, payload);

      // Delay nhỏ giữa các lệnh (100ms) để EBO xử lý tuần tự
      await new Promise(r => setTimeout(r, 100));
    }
  }
}
