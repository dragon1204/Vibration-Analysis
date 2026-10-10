import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.POWER_BREAKER)
export class PowerBreakerCommandDto {
  @ApiProperty({
    description:
      'Set breaker state: true = ON (open breaker), false = OFF (close breaker)',
    example: true,
    required: false,
  })
  @IsOptional()
    state?: boolean;
}
