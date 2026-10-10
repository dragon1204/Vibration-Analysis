import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBuildingDto {
  @ApiProperty({ description: 'Building Code', example: 'BLD-01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Building Name', example: 'Toà nhà trung tâm' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'ID của khu đô thị (Urban)', example: 1 })
  @IsInt()
  urbanId: number;

  @ApiPropertyOptional({ description: 'Địa chỉ tòa nhà' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Mô tả tòa nhà' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL hình ảnh tòa nhà' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'URL model 3D (.glb)', example: '/models/building-a.glb' })
  @IsOptional()
  @IsString()
  modelUrl?: string;

  @ApiPropertyOptional({ description: 'Số tầng', example: 25, default: 1 })
  @IsOptional()
  @IsInt()
  totalFloors?: number;

  @ApiPropertyOptional({ description: 'Vị trí X trong không gian 3D', default: 0 })
  @IsOptional()
  @IsNumber()
  positionX?: number;

  @ApiPropertyOptional({ description: 'Vị trí Y trong không gian 3D', default: 0 })
  @IsOptional()
  @IsNumber()
  positionY?: number;

  @ApiPropertyOptional({ description: 'Vị trí Z trong không gian 3D', default: 0 })
  @IsOptional()
  @IsNumber()
  positionZ?: number;

  @ApiPropertyOptional({ description: 'Góc xoay Y (Rotation)', default: 0 })
  @IsOptional()
  @IsNumber()
  rotationY?: number;

  @ApiPropertyOptional({ description: 'Tỉ lệ phóng (Scale)', default: 1 })
  @IsOptional()
  @IsNumber()
  scale?: number;
}

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {}

