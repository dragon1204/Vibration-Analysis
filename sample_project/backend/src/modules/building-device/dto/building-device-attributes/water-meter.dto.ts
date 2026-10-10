import { ApiProperty, PartialType } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.WATER_METER)
export class WaterMeterCommandDto {
  @ApiProperty({
    description: 'Thể tích nước tiêu thụ (m³)',
    example: 12.5,
  })
  @Transform(({ value }) => Number(value))
  @IsOptional()
  @IsNumber({}, { message: 'Thể tích nước phải là số' })
  water_volume?: number;
}