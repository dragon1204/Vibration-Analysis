import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BuildingResponse {
  @ApiProperty({ example: 1, description: 'ID toà nhà' })
  id: number;

  @ApiProperty({ example: 1, description: 'ID khu đô thị' })
  urbanId: number;

  @ApiProperty({ example: 'BLD-01', description: 'Mã toà nhà' })
  code: string;

  @ApiProperty({ example: 'Toà nhà trung tâm', description: 'Tên toà nhà' })
  name: string;

  @ApiPropertyOptional({ example: 25 })
  totalFloors?: number;

  @ApiPropertyOptional({ example: 'https://bms.example.com' })
  bmsServerUrl?: string;

  @ApiPropertyOptional({ example: 1 })
  tenantId?: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creationTime: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lastModificationTime?: Date;
}
