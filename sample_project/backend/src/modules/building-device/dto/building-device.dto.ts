import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { BuildingDeviceType, DeviceStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateBuildingDeviceDto {
  @ApiProperty({
    description: 'mã thiết bị được cấu hình tại ebo',
    example: 'device-12345',
  })
  @IsString()
  deviceId: string;

  @ApiPropertyOptional({
    description: 'EBO identifier for MQTT communication',
    example: 'EBO-FAN-01',
  })
  @IsOptional()
  @IsString()
  eboId?: string;

  @ApiPropertyOptional({
    description: 'Feature code for BMS router mapping',
    example: 'FAN',
  })
  @IsOptional()
  @IsString()
  featureCode?: string;

  @ApiProperty({
    description: 'tên thiết bị',
    example: 'Temperature Sensor A1',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    enum: BuildingDeviceType,
    default: BuildingDeviceType.OTHER,
    description: 'loại thiết bị',
  })
  @IsOptional()
  @IsEnum(BuildingDeviceType)
  type: BuildingDeviceType;

  @ApiPropertyOptional({
    type: Number,
    description: 'Mã tòa nhà',
  })
  @IsOptional()
  @IsInt()
  buildingId?: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Urban area ID',
  })
  @IsOptional()
  @IsInt()
  urbanId?: number;

  @ApiPropertyOptional({
    description: 'Floor ID',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  floorId?: number;

  @ApiPropertyOptional({
    enum: DeviceStatus,
    description: 'Trạng thái thiết bị',
  })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional({
    description: 'Thiết bị có đang online không',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({
    type: Object,
    description: 'Thuộc tính thiết bị (speed, temperature, v.v.)',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Device configuration',
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Device description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Device image URL',
    example: 'https://example.com/device.png',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    type: Number,
    description: 'tọa độ X của vị trí thiết bị',
  })
  @IsNotEmpty()
  @IsNumber()
  xCoordinate: number;

  @ApiProperty({
    type: Number,
    description: 'tọa độ Y của vị trí thiết bị',
  })
  @IsNotEmpty()
  @IsNumber()
  yCoordinate: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'tọa độ Z của vị trí thiết bị',
  })
  @IsOptional()
  @IsNumber()
  zCoordinate?: number;

  @ApiPropertyOptional({ description: 'Nhà sản xuất thiết bị' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Model thiết bị' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Số serial thiết bị' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Phiên bản firmware' })
  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @ApiPropertyOptional({ description: 'Phiên bản phần cứng' })
  @IsOptional()
  @IsString()
  hardwareVersion?: string;

  @ApiPropertyOptional({ description: 'MAC Address' })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional({ description: 'IP Address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class UpdateBuildingDeviceDto extends PartialType(
  CreateBuildingDeviceDto,
) {}
