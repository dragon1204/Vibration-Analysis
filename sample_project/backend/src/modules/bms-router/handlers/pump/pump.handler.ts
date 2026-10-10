import { Injectable } from '@nestjs/common';
import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import { PumpInputDto } from './dto/pump-input.dto';
import { PumpAttributeDto } from './dto/pump.dto';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';


@Injectable()
@MqttHandler('PUMP')
export class PumpHandler extends BmsHandlerBaseService<PumpInputDto> {

  async process(input: PumpInputDto, type: "PUMP", data: PumpAttributeDto) {
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
