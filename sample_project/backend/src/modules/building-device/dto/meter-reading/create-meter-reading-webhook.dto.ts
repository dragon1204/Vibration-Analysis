import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMeterReadingWebhookDto {
  @ApiProperty({
    description: 'Mã thiết bị đồng hồ (deviceId)',
    example: '26',
  })
  deviceId: string;

  @ApiProperty({
    description: 'Product code',
    example: 'DOJILAND',
  })
  productCode: string;

  @ApiProperty({
    description: 'Feature code',
    example: 'METER_TRIGGER',
  })
  featureCode: string;

  @ApiProperty({
    description: 'Giá trị chỉ số đồng hồ',
    example: 4360,
  })
  @Transform(({ value }) => Number(value))
  value: number;

  @ApiPropertyOptional({
    description: 'Đơn vị đo',
    example: 'kWh',
  })
  unit?: string;

  @ApiProperty({
    description: 'Thời điểm ghi nhận (ISO 8601)',
    example: '2026-01-11T15:10:41.852Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Loại đồng hồ (ELECTRIC hoặc WATER)',
    example: 'ELECTRIC',
  })
  meterType: string;

  @ApiPropertyOptional({
    description: 'Code',
    example: 'ELECTRIC_26',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Tên',
    example: 'DH_26_kwh',
  })
  name?: string;
}
