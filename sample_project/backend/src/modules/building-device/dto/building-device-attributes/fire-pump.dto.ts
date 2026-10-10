import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.FIRE_PUMP)
export class FirePumpCommandDto {
  @ApiProperty({
    description: 'Set fire pump state: true = ON, false = OFF',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 1 || value === true || value === 'true')
  state?: boolean;

  @ApiProperty({
    description: 'Set mode (0=auto, 1=manual)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  mode?: number;
}
