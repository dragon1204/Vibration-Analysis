import { CommonInput } from '@modules/bms-router/services/base/input.base';


export class ChillerInput extends CommonInput {
    state: boolean;
    mode: boolean;
    fault: boolean;
}

export class ChillerColdPumpInput extends CommonInput {
    state: boolean;
    mode: boolean;
    fault: boolean;
    speed: number;
}

export class ChillerCoolingPumpInput extends CommonInput {
    state: boolean;
    mode: boolean;
    fault: boolean;
    speed: number;
}

export class ChillerCoolingTowerInput extends CommonInput {
    state: boolean;
    mode: boolean;
    fault: boolean;
}

export class ChillerPipeInput extends CommonInput {
    state: boolean;
    temperature: number;
    flowRate: number;
    pressure: number;
}

export class ChillerValve extends CommonInput {
    state: boolean;
}

export class AhuInput extends CommonInput {
    state: boolean;
    mode: boolean;
    fault: boolean;
    fanSpeedFeedback: number;
    fanSpeed: number;
}

export class AhuValveInput extends CommonInput {
    state: boolean;
}

export class AhuFilterInput extends CommonInput {
    fault: boolean;
}

export class AhuSensorTemperatureInput extends CommonInput {
    temp: number;
}

export class PauInput extends CommonInput {
    state: boolean;
    mode: boolean;
    fault: boolean;
    fanSpeedFeedBack: number;
    fanSpeed: number;
}

export class PauValveInput extends CommonInput {
    state: boolean;
}

export class PauFilterInput extends CommonInput {
    fault: boolean;
}

export class PauSensorTemperatureInput extends CommonInput {
    temp: number;
}

export class FcuInput extends CommonInput {
  state: boolean;
  temp: number;
  speed: number;
  command: number;
}

export class VavInput extends CommonInput {
  state: boolean;
  temp: number;
  openingAngle: number;
  command: number;
}
