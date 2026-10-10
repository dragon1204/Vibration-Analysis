import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';


@AttributeReceiveDto(BuildingDeviceType.DIM_LIGHT)
export class DimLightAttributeDto {
  @ApiProperty({ description: 'State: true=on, false=off', example: true })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  state: boolean;

  @ApiProperty({ description: 'Độ sáng', example: 120 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  brightness: number;
}