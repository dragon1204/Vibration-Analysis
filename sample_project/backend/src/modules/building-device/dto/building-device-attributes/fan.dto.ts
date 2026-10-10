import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';
import { toBoolean } from '@shared/helpers/to-boolean';


@AttributeCommandDto(BuildingDeviceType.FAN)
export class FanCommandDto {
  @ApiProperty({
    description: 'Set fan state: true = ON, false = OFF',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  state?: boolean;

  @ApiProperty({
    description: 'Set fan speed (RPM)',
    example: 1500,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  fan_speed?: number;

  @ApiProperty({
    description: 'Set fan mode (0=auto, 1=manual)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  mode?: number;
}
