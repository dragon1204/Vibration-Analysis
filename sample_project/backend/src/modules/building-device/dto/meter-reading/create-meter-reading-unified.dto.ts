import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MeterReadingDataDto } from './create-meter-reading.dto';

export class CreateMeterReadingUnifiedDto {
  @ApiProperty({
    description: 'Mã thiết bị đồng hồ (UUID của BuildingDevice)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  meterId: string;

  @ApiProperty({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
    example: BuildingDeviceType.ELECTRIC_METER,
  })
  meterType: BuildingDeviceType;

  @ApiProperty({
    description: 'Dữ liệu chỉ số đồng hồ (có thể là object hoặc array)',
    oneOf: [
      { $ref: '#/components/schemas/MeterReadingDataDto' },
      {
        type: 'array',
        items: { $ref: '#/components/schemas/MeterReadingDataDto' },
      },
    ],
    example: {
      reading: 1234.567,
      recordedAt: '2024-01-15T10:30:00Z',
      unit: 'kWh',
    },
  })
  @IsNotEmpty()
  data: MeterReadingDataDto | MeterReadingDataDto[];
}
