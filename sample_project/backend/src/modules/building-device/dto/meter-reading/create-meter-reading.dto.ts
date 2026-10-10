import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MeterReadingDataDto {
  @ApiProperty({
    description: 'Chỉ số đồng hồ',
    example: 1234.567,
  })
  @IsNumber()
  @IsNotEmpty()
  reading: number;

  @ApiProperty({
    description: 'Thời điểm ghi nhận (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsString()
  @IsNotEmpty()
  recordedAt: string;

  @ApiPropertyOptional({
    description: 'Đơn vị đo (kWh hoặc m³)',
    example: 'kWh',
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Thông tin bổ sung (metadata)',
    example: { voltage: 220, current: 10 },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateMeterReadingDto {
  @ApiProperty({
    description: 'Mã thiết bị đồng hồ (deviceId của BuildingDevice)',
    example: 'METER-001',
  })
  @IsString()
  @IsNotEmpty()
  meterId: string;

  @ApiProperty({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
    example: BuildingDeviceType.ELECTRIC_METER,
  })
  @IsEnum(BuildingDeviceType)
  @IsNotEmpty()
  meterType: BuildingDeviceType;

  @ApiProperty({
    description: 'Dữ liệu chỉ số đồng hồ',
    type: MeterReadingDataDto,
  })
  @ValidateNested()
  @Type(() => MeterReadingDataDto)
  @IsNotEmpty()
  data: MeterReadingDataDto;
}
