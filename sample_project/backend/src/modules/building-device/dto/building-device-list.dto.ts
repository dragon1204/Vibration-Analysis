import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BuildingDeviceType, Prisma } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { PaginatedSearchSortInputV2 } from '@shared/base-get-input';
import { Type } from 'class-transformer';

export class BuildingDeviceListDto extends PaginatedSearchSortInputV2(
  Prisma.BuildingDeviceScalarFieldEnum,
) {
  @ApiProperty({
    description:
      'Type of the building device to retrieve. Must be one of the supported device types.',
    enum: BuildingDeviceType,
    example: BuildingDeviceType.CAMERA,
    required: false,
  })
  @IsOptional()
  @IsEnum(BuildingDeviceType, {
    message: 'type must be a valid BuildingDeviceType value',
  })
  type?: BuildingDeviceType;


  @ApiPropertyOptional({
    description: 'ID of the building',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'buildingId must be an integer' })
  @Min(1)
  buildingId?: number;

  @ApiPropertyOptional({
    description: 'Floor of the building to filter devices by',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'floorId must be an integer' })
  @Min(1)
  floorId?: number;

  @ApiPropertyOptional({
    description: 'ID of the urban area',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'urbanId must be an integer' })
  @Min(1)
  urbanId?: number;
}
