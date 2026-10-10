import { ApiProperty, PartialType } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';
import { AttributeReceiveDto } from '../decorators/attribute-receive.decorator';

@AttributeReceiveDto(BuildingDeviceType.WATER_METER)
export class WaterMeterAttributeDto {
  @ApiProperty({
    description: 'Thể tích nước tiêu thụ (m³)',
    example: 12.5,
  })
  @Transform(({ value }) => Number(value))
  @IsNumber({}, { message: 'Thể tích nước phải là số' })
  waterVolume: number;
}

@AttributeCommandDto(BuildingDeviceType.WATER_METER)
export class WaterMeterCommandDto extends PartialType(WaterMeterAttributeDto) {}
