import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

@AttributeCommandDto(BuildingDeviceType.CHILLER_COLD_PUMP)
export class ChillerColdPumpAttributeDto {
  @ApiProperty({ description: 'State: true=on, false=off', example: true })
  @Transform(({ value }) => toBoolean(value))
  @IsOptional()
  state?: boolean;

  @ApiProperty({ description: 'Set pump speed', example: 1200 })
  @Transform(({ value }) => Number(value))
  @IsOptional()
  speed?: number;

  @ApiProperty({ description: 'Set mode (0=auto, 1=manual)', example: 1 })
  @Transform(({ value }) => Number(value))
  @IsOptional()
  mode?: number;
}