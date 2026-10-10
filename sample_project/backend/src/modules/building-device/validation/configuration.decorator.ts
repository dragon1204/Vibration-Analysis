import { BuildingDeviceType } from '@prisma/client';

const ConfigurationRegistry = new Map<BuildingDeviceType, any>();

export function ConfigurationDto(type: BuildingDeviceType) {
  return function (target: any) {
    ConfigurationRegistry.set(type, target);
  };
}

export function getConfigurationDto(type: BuildingDeviceType): any {
  return ConfigurationRegistry.get(type);
}
