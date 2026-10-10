import { CommonInput } from '@modules/bms-router/services/base/input.base';

export class FirePumpInputDto extends CommonInput {
  state: boolean;
  mode: boolean;
  fault: boolean;
  pressure: number;
}
