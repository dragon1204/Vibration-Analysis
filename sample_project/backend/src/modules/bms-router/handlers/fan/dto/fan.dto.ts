import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';
import { toBoolean } from '@shared/helpers/to-boolean';
import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';

@AttributeReceiveDto(BuildingDeviceType.FAN)
export class FanAttributeDto {
  @ApiProperty({
    description: 'Fan state: true = ON, false = OFF',
    example: true,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  state: boolean;

  @ApiProperty({
    description: 'Fan mode: true = automatic mode, false = manual mode',
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
    description: 'Air pressure value (Pa)',
    example: 120,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  air_pressure: number;

  @ApiProperty({
    description: 'Air temperature value (°C)',
    example: 32,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  air_temperature: number;

  @ApiProperty({
    description: 'Fan speed (RPM)',
    example: 1500,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  fan_speed: number;
}