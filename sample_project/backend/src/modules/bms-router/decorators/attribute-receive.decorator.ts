import { BuildingDeviceType } from '@prisma/client';
import { ClassConstructor } from 'class-transformer';

const attributeReceiveRegistry = new Map<BuildingDeviceType, any>();

export function AttributeReceiveDto(type: BuildingDeviceType) {
  return function (target: any) {
    attributeReceiveRegistry.set(type, target);
  };
}

export function getAttributeReceiveDto(type: BuildingDeviceType): ClassConstructor<object> {
  return attributeReceiveRegistry.get(type);
}
