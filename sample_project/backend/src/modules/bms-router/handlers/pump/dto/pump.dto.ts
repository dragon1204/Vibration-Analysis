import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';
import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { toBoolean } from '@shared/helpers/to-boolean';

@AttributeReceiveDto(BuildingDeviceType.PUMP)
export class PumpAttributeDto {
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
    description: 'Pump speed (RPM)',
    example: 1200,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  speed: number;

  @ApiProperty({
    description: 'Water pressure value (bar)',
    example: 6.2,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  waterPressure: number;
}