import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FloorType } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({ description: 'ID of the building', example: 1 })
  @IsInt()
  buildingId: number;

  @ApiProperty({ description: 'Floor number (-2=B2, -1=B1, 0=Ground, 1-N=upper)', example: 1 })
  @IsInt()
  floorNumber: number;

  @ApiProperty({ description: 'Display name of the floor', example: 'Floor 1' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Type of floor', enum: FloorType, default: FloorType.OFFICE })
  @IsOptional()
  @IsEnum(FloorType)
  floorType?: FloorType;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Floor plan image URL' })
  @IsOptional()
  @IsString()
  planImageUrl?: string;

  @ApiPropertyOptional({ description: 'Floor height in meters', default: 3.5 })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ description: 'Elevation from ground level in meters', default: 0 })
  @IsOptional()
  @IsNumber()
  elevation?: number;
}

export class UpdateFloorDto extends PartialType(CreateFloorDto) {}
