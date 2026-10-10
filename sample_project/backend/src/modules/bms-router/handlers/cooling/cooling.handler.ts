import { Injectable } from '@nestjs/common';
import { MqttHandler } from '../../decorators/mqtt-handler.decorator';
import { BmsHandlerBaseService } from '../../services/base/bms-handler.base';
import { BMS_EVENT } from '@modules/building-device/enums/bms-event.enum';
import { CoolingDeviceMap } from './cooling-device.map';

@Injectable()
@MqttHandler('COOLING')
export class CoolingHandler extends BmsHandlerBaseService<CoolingDeviceMap[keyof CoolingDeviceMap]['input']> {
  async process<T extends keyof CoolingDeviceMap>(
    input: CoolingDeviceMap[T]['input'],
    type: T,
    data: CoolingDeviceMap[T]['data'],
  ) {
    // So sánh với Redis cache, chỉ emit nếu có thay đổi
    const cacheResult = await this.checkCache(input);
    if (!cacheResult) return;

    this.eventEmitter.emit(BMS_EVENT.ATTRIBUTE_RECEIVE, {
      type,
      deviceId: input.deviceId,
      buildingId: Number(input.buildingId),
      data: data,
    })
  }
}