import { Injectable } from '@nestjs/common';
import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import { DimLightInputDto, LightInputDto } from './dto/light-input.dto';
import { LightAttributeDto } from './dto/light.dto';
import { DimLightAttributeDto } from './dto/dim-light.dto';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';


@Injectable()
@MqttHandler('LIGHT')
export class LightHandler extends BmsHandlerBaseService<LightInputDto | DimLightInputDto> {

  async process(
    input: LightInputDto| DimLightInputDto, 
    type: "LIGHT" | "DIM_LIGHT", 
    data: LightAttributeDto | DimLightAttributeDto) 
  {
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