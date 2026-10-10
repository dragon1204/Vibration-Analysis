import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MeterReadingDataDto } from './create-meter-reading.dto';

export class CreateBatchMeterReadingDto {
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
    description: 'Mảng dữ liệu chỉ số đồng hồ',
    type: [MeterReadingDataDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeterReadingDataDto)
  @IsNotEmpty()
  data: MeterReadingDataDto[];
}
