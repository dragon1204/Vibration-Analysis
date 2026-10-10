import { OnEvent } from '@nestjs/event-emitter';

import { AttributeReviceDto } from '../dto/attribute-receive.dto';
import { BmsEventService } from '../services/bms-event.service';
import { Controller } from '@nestjs/common';
import { BMS_EVENT } from '../enums/bms-event.enum';

@Controller()
export class BmsEvent {
  constructor(private readonly service: BmsEventService) {}

  // Lắng nghe sự kiện thay đổi trạng thái thuộc tính
  @OnEvent(BMS_EVENT.ATTRIBUTE_RECEIVE)
  changeState(data: AttributeReviceDto) {
    return this.service.changeState(data);
  }
}
