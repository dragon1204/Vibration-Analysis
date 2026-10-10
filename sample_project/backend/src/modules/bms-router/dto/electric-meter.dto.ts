import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { AttributeReceiveDto } from '../decorators/attribute-receive.decorator';


@AttributeReceiveDto(BuildingDeviceType.ELECTRIC_METER)
export class ElectricMeterAttributeDto {
  @ApiProperty({ description: 'Voltage (V)', example: 220 })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  voltage: number;

  @ApiProperty({ description: 'Current (A)', example: 5 })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  current: number;

  @ApiProperty({
    description: 'Active power / Power consumption (W)',
    example: 120,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  power: number;

  @ApiProperty({ description: 'Apparent power (VA)', example: 150 })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  apparentPower: number;
}