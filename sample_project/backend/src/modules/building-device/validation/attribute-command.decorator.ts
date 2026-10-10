import { BuildingDeviceType } from '@prisma/client';

const attributeCommandRegistry = new Map<BuildingDeviceType, any>();

export function AttributeCommandDto(type: BuildingDeviceType) {
  return function (target: any) {
    attributeCommandRegistry.set(type, target);
  };
}

export function getAttributeCommandDto(type: BuildingDeviceType): any {
  return attributeCommandRegistry.get(type);
}