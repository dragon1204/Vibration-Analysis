import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsBoolean } from 'class-validator';
import { AttributeReceiveDto } from '../decorators/attribute-receive.decorator';

@AttributeReceiveDto(BuildingDeviceType.POWER_BREAKER)
export class PowerBreakerAttributeDto {
  @ApiProperty({
    description: 'Breaker state: true = ON (open), false = OFF (close)',
    example: true,
  })
  @IsBoolean()
  state: boolean;

  @ApiProperty({
    description: 'Fault status: true = fault detected, false = normal',
    example: false,
  })
  @IsBoolean()
  fault: boolean;
}