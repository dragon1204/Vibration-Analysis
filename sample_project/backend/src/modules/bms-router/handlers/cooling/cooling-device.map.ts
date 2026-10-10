import { BuildingDeviceType } from '@prisma/client';
import { ChillerAttributeDto } from './dto/chiller.dto';
import { ChillerPipeAttributeDto } from './dto/chiller-pipe.dto';
import { ChillerValveAttributeDto } from './dto/chiller-valve.dto';
import { ChillerColdPumpAttributeDto } from './dto/chiller-cold-pump.dto';
import { ChillerCoolingPumpAttributeDto } from './dto/chiller-cooling-pump.dto';
import { ChillerCoolingTowerAttributeDto } from './dto/chiller-cooling-tower.dto';
import { AhuAttributeDto } from './dto/ahu.dto';
import { AhuValveAttributeDto } from './dto/ahu-valve.dto';
import { AhuFilterAttributeDto } from './dto/ahu-filter.dto';
import { AhuSensorTemperatureAttributeDto } from './dto/ahu-sensor-temperature';
import { PauAttributeDto } from './dto/pau.dto';
import { PauValveAttributeDto } from './dto/pau-valve.dto';
import { PauFilterAttributeDto } from './dto/pau-filter.dto';
import { PauSensorTemperatureAttributeDto } from './dto/pau-sensor-temperature';
import { FcuAttributeDto } from './dto/fcu.dto';
import { VavAttributeDto } from './dto/vav.dto';
import { AhuFilterInput, AhuInput, AhuSensorTemperatureInput, AhuValveInput, ChillerColdPumpInput, ChillerCoolingPumpInput, ChillerCoolingTowerInput, ChillerInput, ChillerPipeInput, ChillerValve, FcuInput, PauFilterInput, PauInput, PauSensorTemperatureInput, PauValveInput, VavInput } from './dto/cooling-input.dto';


export type CoolingDeviceMap = {
  [BuildingDeviceType.CHILLER]: {
    input: ChillerInput;
    data: ChillerAttributeDto;
  };
  [BuildingDeviceType.CHILLER_PIPE]: {
    input: ChillerPipeInput;
    data: ChillerPipeAttributeDto;
  };
  [BuildingDeviceType.CHILLER_VALVE]: {
    input: ChillerValve;
    data: ChillerValveAttributeDto;
  };
  [BuildingDeviceType.CHILLER_COLD_PUMP]: {
    input: ChillerColdPumpInput;
    data: ChillerColdPumpAttributeDto;
  };
  [BuildingDeviceType.CHILLER_COOLING_PUMP]: {
    input: ChillerCoolingPumpInput;
    data: ChillerCoolingPumpAttributeDto;
  };
  [BuildingDeviceType.CHILLER_COOLING_TOWER]: {
    input: ChillerCoolingTowerInput;
    data: ChillerCoolingTowerAttributeDto;
  };

  [BuildingDeviceType.AHU]: {
    input: AhuInput;
    data: AhuAttributeDto;
  };
  [BuildingDeviceType.AHU_VALVE]: {
    input: AhuValveInput;
    data: AhuValveAttributeDto;
  };
  [BuildingDeviceType.AHU_FILTER]: {
    input: AhuFilterInput;
    data: AhuFilterAttributeDto;
  };
  [BuildingDeviceType.AHU_SENSOR_TEMPERATURE]: {
    input: AhuSensorTemperatureInput;
    data: AhuSensorTemperatureAttributeDto;
  };

  [BuildingDeviceType.PAU]: {
    input: PauInput;
    data: PauAttributeDto;
  };
  [BuildingDeviceType.PAU_VALVE]: {
    input: PauValveInput;
    data: PauValveAttributeDto;
  };
  [BuildingDeviceType.PAU_FILTER]: {
    input: PauFilterInput;
    data: PauFilterAttributeDto;
  };
  [BuildingDeviceType.PAU_SENSOR_TEMPERATURE]: {
    input: PauSensorTemperatureInput;
    data: PauSensorTemperatureAttributeDto;
  };

  [BuildingDeviceType.FCU]: {
    input: FcuInput;
    data: FcuAttributeDto;
  };

  [BuildingDeviceType.VAV]: {
    input: VavInput;
    data: VavAttributeDto;
  };
};