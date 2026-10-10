import { Injectable, PipeTransform } from '@nestjs/common';

import { BuildingDeviceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CBadRequestException } from '@shared/custom-http-exception';

import { BuildingDeviceService } from '../services/building-device.service';
import { getConfigurationDto } from './configuration.decorator';

@Injectable()
export class ConfigurationValidationPipe implements PipeTransform {
  transform(value: any) {
    const type = value?.type as BuildingDeviceType;
    const dtoClass = getConfigurationDto(type);

    if (!dtoClass) {
      value.configuration = {};
      return value;
    }

    const dtoObject = plainToInstance(dtoClass, value?.configuration);

    // Validate DTO bằng class-validator
    const errors = validateSync(dtoObject, { whitelist: true });
    if (errors.length) {
      const error = errors[0];
      const message = error.constraints
        ? Object.values(error.constraints)[0]
        : 'Validation failed';
      throw new CBadRequestException(BuildingDeviceService.name, message);
    }

    value.configuration = dtoObject;

    return value;
  }
}
