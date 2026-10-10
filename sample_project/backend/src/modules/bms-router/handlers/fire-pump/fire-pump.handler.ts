import { Injectable } from '@nestjs/common';
import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import { FirePumpInputDto } from './dto/fire-pump-input.dto';
import { FirePumpAttributeDto } from './dto/fire-pump.dto';

import { FireAlarmInputDto } from '../fire-alarm/dto/fire-alarm-input.dto';
import { FireAlarmAttributeDto } from '../fire-alarm/dto/fire-alarm.dto';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';

@Injectable()
@MqttHandler('FIRE_PROTECTION')
export class FirePumpHandler extends BmsHandlerBaseService<FirePumpInputDto | FireAlarmInputDto> {
  async process(
    input: FirePumpInputDto | FireAlarmInputDto,
    type: 'FIRE_PUMP' | 'FIRE_ALARM',
    data: FirePumpAttributeDto | FireAlarmAttributeDto,
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
