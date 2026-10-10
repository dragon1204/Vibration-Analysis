import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsObject } from 'class-validator';

export class AttributeCommandDto {
  @ApiProperty({
    description:
      'Type of the building device to retrieve. Must be one of the supported device types.',
    enum: BuildingDeviceType,
    example: BuildingDeviceType.CAMERA,
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(BuildingDeviceType, {
    message: 'type must be a valid BuildingDeviceType',
  })
  type: BuildingDeviceType;

  @ApiProperty({
    description: 'ID of the building to which the device belongs',
    example: 123, 
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  buildingId: number;

  @ApiProperty({
    description: 'data',
    required: false,
  })
  @IsNotEmpty()
  @IsObject()
  data: object;
}
