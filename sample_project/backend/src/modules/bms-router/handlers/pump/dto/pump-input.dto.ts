import { CommonInput } from '@modules/bms-router/services/base/input.base';

export class PumpInputDto extends CommonInput {
    state: boolean;
    mode: boolean;
}
