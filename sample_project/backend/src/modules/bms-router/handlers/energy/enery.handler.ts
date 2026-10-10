import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

import { BtuMeterAttributeDto } from '@modules/bms-router/dto/btu-meter.dto';
import { Co2MeterAttributeDto } from '@modules/bms-router/dto/co2-meter.dto';
import { ElectricMeterAttributeDto } from '@modules/bms-router/dto/electric-meter.dto';
import { WaterMeterAttributeDto } from '@modules/bms-router/dto/water-meter.dto';
import { BMS_HANDLE_EVENT } from '@modules/building-device/enums/bms-handle-event.enum';
import { BmsRequestLogRepository } from '@modules/clickhouse/reposiroty/bms-request-log.repository';

import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import {
  BtuInputDto,
  Co2MeterDto,
  ElectricInputDto,
  WaterInputDto,
} from './dto/enery-input.dto';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';

@Injectable()
@MqttHandler('ENERGY')
export class EnergyHandler extends BmsHandlerBaseService<
  ElectricInputDto | WaterInputDto | BtuInputDto | Co2MeterDto
> {
  constructor(
    public readonly eventEmitter: EventEmitter2,
    redis: Redis,
    private readonly bmsRequestLogRepository: BmsRequestLogRepository,
  ) {
    super(eventEmitter, redis);
  }

  async process(
    input: ElectricInputDto | WaterInputDto | BtuInputDto | Co2MeterDto,
    type: 'ELECTRIC_METER' | 'WATER_METER' | 'BTU_METER' | 'CO2_METER',
    data:
      | ElectricMeterAttributeDto
      | WaterMeterAttributeDto
      | BtuMeterAttributeDto
      | Co2MeterAttributeDto,
  ) {
    // create record meter reading

    // So sánh với Redis cache, chỉ emit nếu có thay đổi
    const cacheResult = await this.checkCache(input);
    if (!cacheResult) return;

    // Send the updated device state to the frontend via WebSocket
    this.eventEmitter.emit(BMS_EVENT.ATTRIBUTE_RECEIVE, {
      type,
      deviceId: input.deviceId,
      buildingId: Number(input.buildingId),
      data: data,
    });
  }
}
