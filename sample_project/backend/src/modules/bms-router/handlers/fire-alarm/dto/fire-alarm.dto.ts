import { ApiProperty } from '@nestjs/swagger';

import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';

import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';

@AttributeReceiveDto(BuildingDeviceType.FIRE_ALARM)
export class FireAlarmAttributeDto {
  @ApiProperty({ description: 'Alarm status', example: 0 })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  alarm: number;

  @ApiProperty({ description: 'Fault status', example: 0 })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  fault: number;
}
