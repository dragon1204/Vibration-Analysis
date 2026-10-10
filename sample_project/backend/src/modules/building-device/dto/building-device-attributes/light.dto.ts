import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.LIGHT)
export class LightCommandDto {
  @ApiProperty({
    description: 'Set light state: true = ON, false = OFF',
    example: true,
    required: false,
  })
  @IsOptional()
    state?: boolean;
}
