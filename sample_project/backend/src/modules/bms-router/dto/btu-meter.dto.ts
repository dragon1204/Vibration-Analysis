import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { AttributeReceiveDto } from '../decorators/attribute-receive.decorator';

@AttributeReceiveDto(BuildingDeviceType.BTU_METER)
export class BtuMeterAttributeDto {
  @ApiProperty({
    description: 'Năng lượng nhiệt tiêu thụ (BTU)',
    example: 12500,
  })
  @Transform(({ value }) => Number(value))
  @IsNumber({}, { message: 'Giá trị BTU phải là số' })
  btuEnergy: number;
}