import { CommonInput } from '@modules/bms-router/services/base/input.base';

export class FireAlarmInputDto extends CommonInput {
  alarm: number;
  fault: number;
}
