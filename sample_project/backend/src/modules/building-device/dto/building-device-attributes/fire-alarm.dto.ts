import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.FIRE_ALARM)
export class FireAlarmCommandDto {
  @ApiProperty({
    description: 'Set fire alarm state: true = ON, false = OFF',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 1 || value === true || value === 'true')
  state?: boolean;

  @ApiProperty({
    description: 'Alarm level',
    example: 0,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  alarm?: number;

  @ApiProperty({
    description: 'Silence alarm',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 1 || value === true || value === 'true')
  silence?: boolean;
}
