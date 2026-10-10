import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';
import { toBoolean } from '@shared/helpers/to-boolean';
import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';

@AttributeReceiveDto(BuildingDeviceType.VAV)
export class VavAttributeDto {
  @ApiProperty({
    description: 'VAV state: true = ON, false = OFF',
    example: true,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  state: boolean;

  @ApiProperty({
    description: 'Room temperature',
    example: 24.5,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  temp: number;

  @ApiProperty({
    description: 'Valve opening angle',
    example: 45.0,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  openingAngle: number;

  @ApiProperty({
    description: 'Command value',
    example: 1,
  })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  command: number;
}
