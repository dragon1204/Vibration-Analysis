import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { IsString } from 'class-validator';

import { ConfigurationDto } from '@modules/building-device/validation/configuration.decorator';

@ConfigurationDto(BuildingDeviceType.CAMERA)
export class CameraConfigurationDto {
  @ApiProperty({
    description: 'auth',
    example: true,
  })
  @IsString()
  auth: string;
}
