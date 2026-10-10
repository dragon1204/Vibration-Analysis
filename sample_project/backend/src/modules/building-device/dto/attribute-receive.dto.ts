import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsNumber, IsObject, IsString } from 'class-validator';

export class AttributeReviceDto {
  @ApiProperty({
    description: 'Unique identifier of the device',
    example: 'FIRE-001',
  })
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: 'ID of the building to which the device belongs',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  buildingId: number;

  @ApiProperty({
    description: 'Type of the device',
    example: 'FIRE_ALARM',
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    description: 'data receive',
    required: true,
  })
  @IsNotEmpty()
  @IsObject()
  data: object;
}

