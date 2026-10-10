import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';


@AttributeCommandDto(BuildingDeviceType.ELECTRIC_METER)
export class ElectricMeterCommandDto {
  @ApiProperty({ description: 'Voltage (V)', example: 220 })
  @IsOptional()
    @Transform(({ value }) => Number(value))
  voltage?: number;

  @ApiProperty({ description: 'Current (A)', example: 5 })
  @IsOptional()
    @Transform(({ value }) => Number(value))
  current?: number;

  @ApiProperty({
    description: 'Active power / Power consumption (W)',
    example: 120,
  })
  @IsOptional()
    @Transform(({ value }) => Number(value))
  power?: number;

  @ApiProperty({ description: 'Apparent power (VA)', example: 150 })
  @IsOptional()
    @Transform(({ value }) => Number(value))
  apparentPower?: number;
}
