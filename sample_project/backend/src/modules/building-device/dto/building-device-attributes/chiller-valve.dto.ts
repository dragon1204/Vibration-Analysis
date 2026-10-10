import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.CHILLER_VALVE)
export class ChillerValveCommandDto {
  @ApiProperty({
    description: 'State: true= open, false=close',
    example: true,
  })
  @IsOptional()
  @IsOptional()
    state?: boolean;
}
