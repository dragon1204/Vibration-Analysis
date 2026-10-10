import { Injectable } from '@nestjs/common';
import { FireAlarmAttributeDto } from '@modules/bms-router/handlers/fire-alarm/dto/fire-alarm.dto';
import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import { FireAlarmInputDto } from './dto/fire-alarm-input.dto';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';

@Injectable()
@MqttHandler('FIRE_ALARM')
export class FireAlarmHandler extends BmsHandlerBaseService<FireAlarmInputDto> {
  async process(
    input: FireAlarmInputDto,
    type: 'FIRE_ALARM',
    data: FireAlarmAttributeDto,
  ) {
    // So sánh với Redis cache, chỉ emit nếu có thay đổi
    const cacheResult = await this.checkCache(input);
    if (!cacheResult) return;

    this.eventEmitter.emit(BMS_EVENT.ATTRIBUTE_RECEIVE, {
      type,
      deviceId: input.deviceId,
      buildingId: Number(input.buildingId),
      data: data,
    });
  }
}
