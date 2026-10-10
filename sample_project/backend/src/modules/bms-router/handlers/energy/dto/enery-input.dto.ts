import { CommonInput } from '@modules/bms-router/services/base/input.base';

export class EnergyInput extends CommonInput {
  deviceType: string;
}

export class ElectricInputDto extends EnergyInput {
  voltage: number;

  current: number;

  power: number;

  apparentPower: number;
}

export class WaterInputDto extends EnergyInput {
  water_volume: number;
}

export class BtuInputDto extends EnergyInput {
  btu_energy: number;
}

export class Co2MeterDto extends EnergyInput {
  concentration: number;
}
