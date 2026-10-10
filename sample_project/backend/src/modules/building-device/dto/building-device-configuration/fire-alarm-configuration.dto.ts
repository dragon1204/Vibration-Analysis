import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType} from '@prisma/client';
import { IsEnum } from 'class-validator';

import { SCOPE } from '@modules/building-device/enums/scope.enum';
import { ConfigurationDto } from '@modules/building-device/validation/configuration.decorator';

@ConfigurationDto(BuildingDeviceType.FIRE_ALARM)
export class FireAlarmConfigurationDto {
  @ApiProperty({
    description: 'Scope of notification',
    enum: SCOPE,
    example: SCOPE.TENANT,
  })
  @IsEnum(SCOPE)
  scope: SCOPE;
}
