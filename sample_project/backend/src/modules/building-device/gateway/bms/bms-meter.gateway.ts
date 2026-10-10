import { OnEvent } from '@nestjs/event-emitter';

import { BMS_HANDLE_EVENT } from '@modules/building-device/enums/bms-handle-event.enum';

export class BmsMeterGateway {
  @OnEvent(BMS_HANDLE_EVENT.CREATE_METER_RECORD)
  createRecord(data) {}
}
