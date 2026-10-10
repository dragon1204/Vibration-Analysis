import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';
import { Transform } from 'class-transformer';
import { toBoolean } from '@shared/helpers/to-boolean';

@AttributeCommandDto(BuildingDeviceType.CHILLER)
export class ChillerCommandDto {
  @ApiProperty({
    description: 'State: true=on, false=off',
    example: true,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsOptional()
  state?: boolean;

  @ApiProperty({
    description: 'Set mode (0=auto, 1=manual)',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  mode?: number;
}
