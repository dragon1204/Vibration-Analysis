import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';

export class BuildingDeviceInfoDto {
  @ApiProperty({
    description: 'ID thiết bị',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Tên thiết bị',
    example: 'Đồng hồ điện tầng 5',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Building ID',
    example: 5,
  })
  buildingId?: number;

  @ApiPropertyOptional({
    description: 'Tên tòa nhà',
    example: 'Tòa nhà A',
  })
  buildingName?: string;


  @ApiPropertyOptional({
    description: 'Urban ID',
    example: 1,
  })
  urbanId?: number;

  @ApiPropertyOptional({
    description: 'Tầng',
    example: '5th Floor',
  })
  floor?: string;

  @ApiPropertyOptional({
    description: 'Room ID',
    example: 'RM-201',
  })
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Tên phòng',
    example: 'Phòng 201',
  })
  roomName?: string;
}

export class MeterReadingResponseDto {
  @ApiProperty({
    description: 'ID của bản ghi',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Mã thiết bị đồng hồ',
    example: 'METER-001',
  })
  meterId: string;

  @ApiProperty({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
  })
  meterType: BuildingDeviceType;

  @ApiProperty({
    description: 'Chỉ số đồng hồ',
    example: 1234.567,
  })
  reading: number;

  @ApiPropertyOptional({
    description: 'Đơn vị đo',
    example: 'kWh',
  })
  unit?: string;

  @ApiProperty({
    description: 'Thời điểm ghi nhận',
    example: '2024-01-15T10:30:00Z',
  })
  recordedAt: Date;

  @ApiPropertyOptional({
    description: 'Thông tin bổ sung',
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Thời điểm tạo',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Thông tin thiết bị (building, tenant, urban)',
    type: BuildingDeviceInfoDto,
  })
  buildingDevice?: BuildingDeviceInfoDto;
}

export class BatchMeterReadingResponseDto {
  @ApiProperty({
    description: 'Số lượng bản ghi thành công',
    example: 2,
  })
  success: number;

  @ApiProperty({
    description: 'Số lượng bản ghi thất bại',
    example: 0,
  })
  failed: number;

  @ApiProperty({
    description: 'Kết quả các bản ghi thành công',
    type: [MeterReadingResponseDto],
  })
  results: MeterReadingResponseDto[];

  @ApiPropertyOptional({
    description: 'Danh sách lỗi (nếu có)',
    type: [String],
  })
  errors?: string[];
}

// Hierarchical DTOs
export class HierarchicalMeterReadingDto {
  @ApiProperty({
    description: 'ID của bản ghi',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Chỉ số đồng hồ',
    example: 1234.567,
  })
  reading: number;

  @ApiPropertyOptional({
    description: 'Đơn vị đo',
    example: 'kWh',
  })
  unit?: string;

  @ApiProperty({
    description: 'Thời điểm ghi nhận',
    example: '2024-01-15T10:30:00Z',
  })
  recordedAt: Date;

  @ApiPropertyOptional({
    description: 'Thông tin bổ sung',
  })
  metadata?: Record<string, any>;
}

export class HierarchicalMeterDto {
  @ApiProperty({
    description: 'ID thiết bị đồng hồ',
    example: 'uuid',
  })
  meterId: string;

  @ApiProperty({
    description: 'Tên thiết bị',
    example: 'Đồng hồ điện tầng 5',
  })
  meterName: string;

  @ApiProperty({
    description: 'Loại đồng hồ',
    enum: BuildingDeviceType,
  })
  meterType: BuildingDeviceType;

  @ApiPropertyOptional({
    description: 'Room ID',
    example: 'RM-201',
  })
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Tên phòng',
    example: 'Phòng 201',
  })
  roomName?: string;

  @ApiProperty({
    description: 'Danh sách chỉ số đồng hồ',
    type: [HierarchicalMeterReadingDto],
  })
  readings: HierarchicalMeterReadingDto[];
}

export class HierarchicalFloorDto {
  @ApiProperty({
    description: 'Tầng',
    example: '5th Floor',
  })
  floor: string;

  @ApiProperty({
    description: 'Danh sách đồng hồ',
    type: [HierarchicalMeterDto],
  })
  meters: HierarchicalMeterDto[];
}

export class HierarchicalBuildingDto {
  @ApiProperty({
    description: 'Building ID (null nếu không có)',
    example: 5,
    nullable: true,
  })
  buildingId: number | null;

  @ApiProperty({
    description: 'Tên tòa nhà',
    example: 'Tòa nhà A',
  })
  buildingName: string;

  @ApiProperty({
    description: 'Danh sách tầng',
    type: [HierarchicalFloorDto],
  })
  floors: HierarchicalFloorDto[];
}

export class HierarchicalTenantDto {

  @ApiProperty({
    description: 'Danh sách tòa nhà',
    type: [HierarchicalBuildingDto],
  })
  buildings: HierarchicalBuildingDto[];
}

export class HierarchicalUrbanDto {
  @ApiProperty({
    description: 'Urban ID (null nếu không có)',
    example: 1,
    nullable: true,
  })
  urbanId: number | null;

  @ApiPropertyOptional({
    description: 'Tên khu đô thị',
    example: 'Khu đô thị ABC',
  })
  urbanName?: string;

  @ApiProperty({
    description: 'Danh sách tenant',
    type: [HierarchicalTenantDto],
  })
  tenants: HierarchicalTenantDto[];
}

export class HierarchicalMeterReadingResponseDto {
  @ApiProperty({
    description: 'Tổng số bản ghi',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description:
      'Dữ liệu phân tầng theo urban -> tenant -> building -> floor -> meter -> readings',
    type: [HierarchicalUrbanDto],
  })
  urbans: HierarchicalUrbanDto[];
}
