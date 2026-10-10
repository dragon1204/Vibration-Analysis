import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { BuildingDeviceGateway } from '../gateway/building-device.gateway';
import { AttributeReviceDto } from '../dto/attribute-receive.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOG_EVENT } from '../enums/log-event.enum';
import { DeviceRuleService } from './device-rule.service';

@Injectable()
export class BmsEventService {
  private readonly logger = new Logger(BmsEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buildingDeviceGateway: BuildingDeviceGateway,
    private readonly eventEmitter: EventEmitter2,
    private readonly deviceRuleService: DeviceRuleService,
  ) {}

  /**
   * Updates the device state and triggers related actions:
   * - Save the new state to the database
   * - Send real-time updates to the frontend via WebSocket
   * - Execute CASCADE rules if state changed
   */
  async changeState(data: AttributeReviceDto) {
    const device = await this.prisma.buildingDevice.findFirst({
      where: {
        deviceId: data.deviceId,
        buildingId: data.buildingId,
      },
    });

    if (!device) {
      throw new Error(
        `Device not found for deviceId: ${data.deviceId} and buildingId: ${data.buildingId}`,
      );
    }

    // Lưu state cũ để so sánh
    const oldAttrs = device.attributes as Record<string, any> | null;
    const oldState = oldAttrs?.state;

    // Initialize the attributes object if it does not exist (prevents runtime errors)
    if (!device.attributes) {
      device.attributes = {};
    }

    device.attributes = {
      ...device.attributes,
      ...data.data
    };

    this.eventEmitter.emit(LOG_EVENT.DEVICE_LOG, [{
      deviceId: device.id,
      deviceType: device.type,
      featureCode: device.featureCode,
      buildingId: device.buildingId ? device.buildingId.toString() : null,
      attribute: JSON.stringify(device.attributes),
      xCoordinate: device.xCoordinate,
      yCoordinate: device.yCoordinate,
      zCoordinate: device.zCoordinate,
    }]);


    await this.prisma.buildingDevice.update({
      where: { id: device.id },
      data: device,
    });

    // Send the updated device state to the frontend via WebSocket
    // Building-level update
    this.buildingDeviceGateway.sendSocket(device.buildingId, device.id, device.attributes);
    // Floor-level update
    if (device.floorId) {
      this.buildingDeviceGateway.sendAttributeDevice(device.buildingId, device.floorId, device.id, device.attributes);
    }

    // ── CASCADE: Kiểm tra nếu state thay đổi → trigger cascade ──
    const newAttrs = device.attributes as Record<string, any>;
    const newState = newAttrs?.state;
    if (newState !== undefined && newState !== oldState) {
      const action = (newState === 1 || newState === true) ? 'ON' : 'OFF';
      this.logger.log(`State changed for ${device.name}: ${oldState} → ${newState} (${action})`);

      // Fire-and-forget cascade (non-blocking)
      this.deviceRuleService.executeCascade(device.id, action).catch(err => {
        this.logger.error(`Cascade failed for ${device.name}: ${err.message}`);
      });
    }

  }
}
