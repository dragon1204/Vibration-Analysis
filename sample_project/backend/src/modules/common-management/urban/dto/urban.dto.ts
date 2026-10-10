import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUrbanDto {
  @ApiProperty({ description: 'Mã khu đô thị / Dự án', example: 'URB-01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Tên khu đô thị / Dự án',
    example: 'Vinhomes Central Park',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Địa chỉ khu đô thị' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Mô tả thêm về dự án' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL hình ảnh khu đô thị' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Vĩ độ (Latitude)', example: 10.7769 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Kinh độ (Longitude)', example: 106.7009 })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateUrbanDto extends PartialType(CreateUrbanDto) {}

