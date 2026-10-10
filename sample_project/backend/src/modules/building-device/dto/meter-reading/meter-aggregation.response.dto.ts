import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';

import { BuildingDeviceInfoDto } from './meter-reading.response.dto';

export class MeterDailyAggregationResponseDto {
  @ApiProperty({
    description: 'ID của bản ghi',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Mã thiết bị đồng hồ',
    example: 'uuid',
  })
  meterId: string;

  @ApiProperty({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
  })
  meterType: BuildingDeviceType;

  @ApiProperty({
    description: 'Ngày tổng hợp',
    example: '2024-01-15',
  })
  date: Date;

  @ApiPropertyOptional({
    description: 'Chỉ số đầu ngày',
    example: 1234.567,
  })
  startReading?: number;

  @ApiPropertyOptional({
    description: 'Chỉ số cuối ngày',
    example: 1235.123,
  })
  endReading?: number;

  @ApiProperty({
    description: 'Lượng tiêu thụ trong ngày',
    example: 0.556,
  })
  usage: number;

  @ApiPropertyOptional({
    description: 'Đơn vị đo',
    example: 'kWh',
  })
  unit?: string;

  @ApiProperty({
    description: 'Số lượng bản ghi raw data',
    example: 24,
  })
  readingCount: number;

  @ApiPropertyOptional({
    description: 'Chỉ số nhỏ nhất trong ngày',
    example: 1234.567,
  })
  minReading?: number;

  @ApiPropertyOptional({
    description: 'Chỉ số lớn nhất trong ngày',
    example: 1235.123,
  })
  maxReading?: number;

  @ApiPropertyOptional({
    description: 'Thông tin bổ sung',
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Thời điểm tổng hợp',
    example: '2024-01-16T00:05:00Z',
  })
  aggregatedAt: Date;

  @ApiPropertyOptional({
    description: 'Thông tin thiết bị (building, tenant, urban)',
    type: BuildingDeviceInfoDto,
  })
  buildingDevice?: BuildingDeviceInfoDto;
}

export class MeterMonthlyAggregationResponseDto {
  @ApiProperty({
    description: 'ID của bản ghi',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Mã thiết bị đồng hồ',
    example: 'uuid',
  })
  meterId: string;

  @ApiProperty({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
  })
  meterType: BuildingDeviceType;

  @ApiProperty({
    description: 'Năm',
    example: 2024,
  })
  year: number;

  @ApiProperty({
    description: 'Tháng (1-12)',
    example: 1,
  })
  month: number;

  @ApiProperty({
    description: 'Tổng lượng tiêu thụ trong tháng',
    example: 150.5,
  })
  totalUsage: number;

  @ApiPropertyOptional({
    description: 'Trung bình tiêu thụ/ngày',
    example: 5.02,
  })
  avgDailyUsage?: number;

  @ApiPropertyOptional({
    description: 'Ngày tiêu thụ nhiều nhất',
    example: 8.5,
  })
  maxDailyUsage?: number;

  @ApiPropertyOptional({
    description: 'Ngày tiêu thụ ít nhất',
    example: 2.1,
  })
  minDailyUsage?: number;

  @ApiProperty({
    description: 'Số ngày có dữ liệu',
    example: 30,
  })
  daysCount: number;

  @ApiPropertyOptional({
    description: 'Chỉ số đầu tháng',
    example: 1234.567,
  })
  startReading?: number;

  @ApiPropertyOptional({
    description: 'Chỉ số cuối tháng',
    example: 1385.067,
  })
  endReading?: number;

  @ApiPropertyOptional({
    description: 'Đơn vị đo',
    example: 'kWh',
  })
  unit?: string;

  @ApiPropertyOptional({
    description: 'Thông tin bổ sung',
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Thời điểm tổng hợp',
    example: '2024-02-01T00:10:00Z',
  })
  aggregatedAt: Date;

  @ApiPropertyOptional({
    description: 'Thông tin thiết bị (building, tenant, urban)',
    type: BuildingDeviceInfoDto,
  })
  buildingDevice?: BuildingDeviceInfoDto;
}
