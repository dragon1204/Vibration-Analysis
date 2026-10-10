import { Injectable, BadRequestException } from '@nestjs/common';

import { BuildingDeviceType } from '@prisma/client';

import {
  CConflictException,
  CNotFoundException,
} from '@shared/custom-http-exception';

import { PrismaService } from '@src/prisma/prisma.service';

import { AttributeCommandDto } from '../dto/attribute-command.dto';
import { BuildingDeviceListDto } from '../dto/building-device-list.dto';
import {
  CreateBuildingDeviceDto,
  UpdateBuildingDeviceDto,
} from '../dto/building-device.dto';
import { BuildingDeviceGateway } from '../gateway/building-device.gateway';
import { RouterGateway } from '../mqtt/router.mqtt.gateway';
import { DeviceRuleService } from './device-rule.service';


@Injectable()
export class BuildingDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttGateway: RouterGateway,
    private readonly wsGateway: BuildingDeviceGateway,
    private readonly deviceRuleService: DeviceRuleService,
  ) { }

  /**
   * Create a new device associated with a building
   *
   * - Check if the device already exists in the building
   * - Prevent duplicate device-building records
   * - Create a new buildingDevice record if not exists
   *
   * @param data      Data needed to create building device
   * @returns         Newly created building device
   * @throws          CConflictException if device already exists in the building
   */
  async createBuildingDevice(data: CreateBuildingDeviceDto) {
    // Check if the device already exists in the building to avoid duplicate records
    const buildingDevice = await this.prisma.buildingDevice.findFirst({
      where: {
        deviceId: data.deviceId,
        buildingId: data.buildingId,
      },
    });

    // Throw error if the device already exists
    if (buildingDevice) {
      throw new CConflictException(
        BuildingDeviceService.name,
        'Device already exists',
      );
    }

    return this.prisma.buildingDevice.create({data});
  }

  /**
   * Update an existing building device
   *
   * - Ensure the building device exists before updating
   * - Check for duplicate device-building records if deviceId or buildingId is being updated
   * - Update the building device with new data
   * @param id       Building device ID
   * @param data     Data to update the building device
   * @returns        Updated building device
   */
  async updateBuildingDevice(
    id: string,
    data: UpdateBuildingDeviceDto, 
  ) {
    await this.getBuildingDevice(id);

    // If deviceId or buildingId is being changed, check for duplicates
    if (data.deviceId !== undefined || data.buildingId !== undefined) {
      const duplicate = await this.prisma.buildingDevice.findFirst({
        where: {
          deviceId: data.deviceId,
          buildingId: data.buildingId,
          id: { not: id }, // Exclude the current record
        },
      });

      if (duplicate) {
        throw new CConflictException(
          BuildingDeviceService.name,
          'Device with the same deviceId and building already exists',
        );
      }
    }

    // update building device
    return this.prisma.buildingDevice.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a building device by id
   *
   * - Ensure the building device exists
   * - Delete the building device
   *
   * @param id        Building device ID
   * @returns         Deleted building device
   * @throws          CNotFoundException if device not found
   */
  async deleteBuildingDevice(id: string) {
    await this.getBuildingDevice(id);

    // Delete building device
    return this.prisma.buildingDevice.delete({
      where: { id },
    });
  }

  /**
   * Fetches a list of building devices with optional filtering, searching, pagination, and sorting.
   * @param query - The query parameters including optional search, type, pagination, and sort options.
   * @param buildingId - The ID of the tenant (residential area) to filter devices.
   * @returns An array of BuildingDeviceResponse objects matching the query.
   */
  async getListBuildingDevice(
    query: BuildingDeviceListDto,
  ) {
    const skip = query.skip ?? 0;
    const take = query.take;
    const where = {
      type: query.type, // filter by device type if provided
      ...(query.search && { name: { contains: query.search } }), // optional name search
      ...(query.buildingId && { buildingId: query.buildingId }),
      ...(query.urbanId && { urbanId: query.urbanId }),
      ...(query.floorId && { floorId: query.floorId }),
    };

    let include = null;

    // xử lý đồng hồ điện nước thì thêm dữ liệu chỉ số tháng hiện tai
    if (
      query.type === BuildingDeviceType.WATER_METER ||
      query.type === BuildingDeviceType.ELECTRIC_METER
    ) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, -7, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 16, 59, 59);
      include = {
        meterReadings: {
          where: {
            recordedAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          orderBy: {
            recordedAt: 'asc',
          },
        },
      };
    }

    const listBuildingDevice = await this.prisma.buildingDevice.findMany({
      where,
      skip,
      take,
      orderBy: query.sort ? { [query.sort]: query.order ?? 'asc' } : {},
      include: include,
    });

    const total = await this.prisma.buildingDevice.count({ where });

    return {
      total: total,
      items: listBuildingDevice,
    };
  }

  /**
   * Retrieves information about a building device.
   *
   * @param devicedId - The unique identifier of the device.
   * @param buildingId - Identifier of the tenant (residential area).
   * @returns The device information if found, otherwise throw error.
   */
  async getBuildingDevice(id: string, buildingId?: number, type?: BuildingDeviceType) {
    const buildingDevice = await this.prisma.buildingDevice.findFirst({
      where: {
        id,
        ...(buildingId && { buildingId }),
        ...(type && { type }),
      },
    });
    // If the device does not exit -> throw "Not found"
    if (!buildingDevice) {
      throw new CNotFoundException(
        BuildingDeviceService.name,
        'Device not found',
      );
    }

    return buildingDevice;
  }

  /**
   * Executes a control command for a building device by publishing
   * the command to EBO via MQTT. The actual state update will happen
   * when EBO responds with the confirmed state change through the
   * BMS handler pipeline (BmsHandlerService → handler → BmsEventService.changeState).
   *
   * @param data Command data including device type and attributes to update
   * @param id Device ID
   * @param buildingId (optional) Building ID
   */
  async command(data: AttributeCommandDto, id: string, buildingId?: number) {
    // Retrieve the device by its ID (and buildingId if provided)
    const device = await this.getBuildingDevice(id, buildingId, data.type);

    // ── PREREQUISITE CHECK ──
    // Nếu lệnh có state=true/1 (bật thiết bị), kiểm tra ràng buộc
    const commandData = data.data as Record<string, any>;
    const isStateOn = commandData.state === true || commandData.state === 1;
    if (isStateOn) {
      const prereqResult = await this.deviceRuleService.checkPrerequisites(device.id, 'ON');
      if (!prereqResult.ok) {
        throw new BadRequestException({
          message: `Không thể bật thiết bị. Phải bật trước: ${prereqResult.failedDevices.join(', ')}`,
          code: 'PREREQUISITE_FAILED',
          requiredDevices: prereqResult.failedDevices,
        });
      }
    }

    const getFeatureCode = (type: string) => {
      if (type.includes('CHILLER') || type.includes('AHU') || type.includes('PAU') || type === 'FCU' || type === 'VAV') return 'COOLING';
      if (type === 'FAN') return 'FAN';
      if (type === 'PUMP') return 'PUMP';
      if (type === 'FIRE_PUMP' || type === 'FIRE_ALARM') return 'FIRE_PROTECTION';
      if (type === 'LIGHT' || type === 'DIM_LIGHT') return 'LIGHT';
      return type;
    };

    const targetEboId = device.eboId || device.buildingId;
    const targetFeature = device.featureCode || getFeatureCode(device.type);
    const topic = `ebo/${targetEboId}/feature_code/${targetFeature}`;

    const payload = [];
    // Loop through all keys in the incoming attribute data
    for (const key of Object.keys(commandData)) {
      let rawValue = commandData[key];
      // Convert boolean to 1/0 for EBO compatibility
      if (typeof rawValue === 'boolean') {
        rawValue = rawValue ? 1 : 0;
      }

      payload.push({
        name: "deviceType/" + device.type + "/buildingId/" + targetEboId + "/deviceId/" + device.deviceId + "/" + key,
        value: rawValue,
      });
    }

    if (payload.length > 0) {
      // Send the command via MQTT to EBO
      // DB update and WebSocket push will happen when EBO responds
      // through the BMS handler pipeline
      this.mqttGateway.sendDataToBroker(topic, payload);
    }

    return device;
  }
}
