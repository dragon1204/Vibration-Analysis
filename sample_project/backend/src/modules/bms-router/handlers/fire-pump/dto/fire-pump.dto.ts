import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';
import { toBoolean } from '@shared/helpers/to-boolean';


@AttributeReceiveDto(BuildingDeviceType.FIRE_PUMP)
export class FirePumpAttributeDto {
  @ApiProperty({
    description: 'Pump state: true = ON, false = OFF',
    example: true,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  state: boolean;

  @ApiProperty({
    description: 'Pump mode: true = automatic mode, false = manual mode',
    example: true,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  mode: boolean;

  @ApiProperty({
    description: 'Fault status: true = fault detected, false = normal',
    example: false,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  fault: boolean;

  @ApiProperty({
    description: 'Water pressure value (bar)',
    example: 7.5,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  pressure: number;
}
