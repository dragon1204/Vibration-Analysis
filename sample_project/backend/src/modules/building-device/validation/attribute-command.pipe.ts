import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

import { BuildingDeviceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';

import { CBadRequestException } from '@shared/custom-http-exception';

import { BuildingDeviceService } from '../services/building-device.service';
import { getAttributeCommandDto } from './attribute-command.decorator';

@Injectable()
export class AttributeCommandValidationPipe implements PipeTransform {
  transform(value: any) {
    const type = value?.type as BuildingDeviceType;
    const dtoClass = getAttributeCommandDto(type);

    if (!dtoClass) {
      throw new BadRequestException(`No DTO registered for type ${type}`);
    }

    const dtoObject = plainToInstance(dtoClass, value.data);

    // Lấy danh sách key hợp lệ từ metadata của DTO
    const dtoKeys = [
      ...new Set(
        getMetadataStorage()
          .getTargetValidationMetadatas(dtoClass, '', false, false)
          .map((meta) => meta.propertyName),
      ),
    ];

    // Kiểm tra ít nhất 1 field hợp lệ
    const validKeys = Object.keys(dtoObject).filter((key) =>
      dtoKeys.includes(key),
    );
    if (!validKeys.length) {
      throw new CBadRequestException(
        BuildingDeviceService.name,
        'There are no controllable fields for this device type.',
      );
    }

    // Validate DTO bằng class-validator
    const errors = validateSync(dtoObject, { whitelist: true });
    if (errors.length) {
      const error = errors[0];
      const message = error.constraints
        ? Object.values(error.constraints)[0]
        : 'Validation failed';
      throw new CBadRequestException(BuildingDeviceService.name, message);
    }

    return {
      type,
      data: dtoObject,
    };
  }
}
