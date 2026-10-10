import { OnEvent } from '@nestjs/event-emitter';

import { BMS_HANDLE_EVENT } from '@modules/building-device/enums/bms-handle-event.enum';
import { AttributeReviceDto } from '@modules/building-device/dto/attribute-receive.dto';
import { BmsEventService } from '@modules/building-device/services/bms-event.service';

export class BmsGateway {
  constructor(private readonly service: BmsEventService) {}

  @OnEvent(BMS_HANDLE_EVENT.CHANGE_STATE)
  cchangeState(data: AttributeReviceDto) {
    return this.service.changeState(data);
  }
}
