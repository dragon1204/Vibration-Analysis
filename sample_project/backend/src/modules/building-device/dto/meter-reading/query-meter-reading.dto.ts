import { ApiPropertyOptional } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum MeterReadingQueryType {
  RAW = 'raw', // Raw data - chi tiết theo giờ
  DAILY = 'daily', // Daily aggregation - tổng hợp theo ngày
  MONTHLY = 'monthly', // Monthly aggregation - tổng hợp theo tháng
}

export class QueryMeterReadingDto {
  @ApiPropertyOptional({
    description:
      'Loại query: raw (chi tiết), daily (theo ngày), monthly (theo tháng)',
    enum: MeterReadingQueryType,
    default: MeterReadingQueryType.RAW,
    example: MeterReadingQueryType.RAW,
  })
  @IsEnum(MeterReadingQueryType)
  @IsOptional()
  queryType?: MeterReadingQueryType;

  @ApiPropertyOptional({
    description: 'Mã thiết bị đồng hồ',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsOptional()
  meterId?: string;

  @ApiPropertyOptional({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
    example: BuildingDeviceType.ELECTRIC_METER,
  })
  @IsEnum(BuildingDeviceType)
  @IsOptional()
  meterType?: BuildingDeviceType;

  @ApiPropertyOptional({
    description: 'Thời điểm bắt đầu (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Thời điểm kết thúc (ISO 8601)',
    example: '2024-01-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Số lượng bản ghi bỏ qua (pagination)',
    example: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number;

  @ApiPropertyOptional({
    description:
      'Số lượng bản ghi lấy (pagination). Max: 1000 cho raw data, 10000 cho aggregation',
    example: 100,
    default: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  take?: number;

  @ApiPropertyOptional({
    description: 'Urban ID để lọc theo khu đô thị',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  urbanId?: number;

  @ApiPropertyOptional({
    description: 'Building ID để lọc theo tòa nhà',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  buildingId?: number;

  @ApiPropertyOptional({
    description: 'Floor để lọc theo tầng',
    example: '5th Floor',
  })
  @IsString()
  @IsOptional()
  floor?: string;

  @ApiPropertyOptional({
    description: 'Room ID để lọc theo phòng',
    example: 'RM-201',
  })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Lấy toàn bộ dữ liệu',
    example: false,
  })
  @IsBooleanString()
  @IsOptional()
  isFetchAll: boolean;
}
