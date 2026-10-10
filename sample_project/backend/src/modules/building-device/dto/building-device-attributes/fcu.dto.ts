import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

import { toBoolean } from '@shared/helpers/to-boolean';

import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.FCU)
export class FcuCommandDto {
  @ApiProperty({
    description: 'Set FCU state: true = ON, false = OFF',
    example: true,
    required: false,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsOptional()
  state?: boolean;

  @ApiProperty({
    description: 'Set fan speed',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  speed?: number;

  @ApiProperty({
    description: 'Set command value',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  command?: number;
}
