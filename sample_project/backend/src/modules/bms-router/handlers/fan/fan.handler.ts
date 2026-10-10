import { Injectable } from '@nestjs/common';
import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import { FanInputDto } from './dto/fan-input.dto';
import { FanAttributeDto } from './dto/fan.dto';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';

@Injectable()
@MqttHandler('FAN')
export class FanHandler extends BmsHandlerBaseService<FanInputDto> {

  async process(input: FanInputDto, type: "FAN", data: FanAttributeDto) { 
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
