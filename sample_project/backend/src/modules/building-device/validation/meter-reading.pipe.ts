import { Injectable, PipeTransform } from '@nestjs/common';

import { BuildingDeviceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CBadRequestException } from '@shared/custom-http-exception';

import { CreateMeterReadingUnifiedDto } from '../dto/meter-reading/create-meter-reading-unified.dto';
import { CreateMeterReadingWebhookDto } from '../dto/meter-reading/create-meter-reading-webhook.dto';
import { MeterReadingDataDto } from '../dto/meter-reading/create-meter-reading.dto';

@Injectable()
export class MeterReadingValidationPipe implements PipeTransform {
  transform(value: any): CreateMeterReadingUnifiedDto {
    // Kiểm tra xem có phải format webhook mới không (có productCode, featureCode, value, timestamp)
    const isWebhookFormat =
      value.productCode &&
      value.featureCode &&
      value.value !== undefined &&
      value.timestamp &&
      !value.data;

    if (isWebhookFormat) {
      // Validate webhook format
      const webhookDto = plainToInstance(CreateMeterReadingWebhookDto, value);
      const errors = validateSync(webhookDto, {
        skipMissingProperties: false,
        whitelist: true,
      });

      if (errors.length > 0) {
        const errorMessages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .join('; ');
        throw new CBadRequestException(
          MeterReadingValidationPipe.name,
          `Validation failed: ${errorMessages}`,
        );
      }

      // Map từ webhook format sang unified format
      const meterTypeMap: Record<string, BuildingDeviceType> = {
        ELECTRIC: BuildingDeviceType.ELECTRIC_METER,
        WATER: BuildingDeviceType.WATER_METER,
      };

      const meterType = meterTypeMap[value.meterType?.toUpperCase()];
      if (!meterType) {
        throw new CBadRequestException(
          MeterReadingValidationPipe.name,
          `Invalid meterType: ${value.meterType}. Must be ELECTRIC or WATER`,
        );
      }

      return {
        meterId: value.meterId,
        meterType,
        data: {
          reading: value.value,
          recordedAt: value.timestamp,
          unit: value.unit,
          metadata: {
            productCode: value.productCode,
            featureCode: value.featureCode,
            code: value.code,
            name: value.name,
          },
        },
      };
    }

    // Format cũ - validate các field cơ bản
    const dto = plainToInstance(CreateMeterReadingUnifiedDto, value);
    const errors = validateSync(dto, {
      skipMissingProperties: false,
      whitelist: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors
        .map((e) => Object.values(e.constraints || {}).join(', '))
        .join('; ');
      throw new CBadRequestException(
        MeterReadingValidationPipe.name,
        `Validation failed: ${errorMessages}`,
      );
    }

    // Validate data field - có thể là object hoặc array
    if (!value.data) {
      throw new CBadRequestException(
        MeterReadingValidationPipe.name,
        'data field is required',
      );
    }

    if (Array.isArray(value.data)) {
      // Validate array
      if (value.data.length === 0) {
        throw new CBadRequestException(
          MeterReadingValidationPipe.name,
          'data array cannot be empty',
        );
      }

      value.data.forEach((item: any, index: number) => {
        const itemDto = plainToInstance(MeterReadingDataDto, item);
        const itemErrors = validateSync(itemDto, {
          skipMissingProperties: false,
          whitelist: true,
        });

        if (itemErrors.length > 0) {
          const errorMessages = itemErrors
            .map((e) => Object.values(e.constraints || {}).join(', '))
            .join('; ');
          throw new CBadRequestException(
            MeterReadingValidationPipe.name,
            `Validation failed for data[${index}]: ${errorMessages}`,
          );
        }
      });
    } else {
      // Validate single object
      const itemDto = plainToInstance(MeterReadingDataDto, value.data);
      const itemErrors = validateSync(itemDto, {
        skipMissingProperties: false,
        whitelist: true,
      });

      if (itemErrors.length > 0) {
        const errorMessages = itemErrors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .join('; ');
        throw new CBadRequestException(
          MeterReadingValidationPipe.name,
          `Validation failed for data: ${errorMessages}`,
        );
      }
    }

    return value;
  }
}
