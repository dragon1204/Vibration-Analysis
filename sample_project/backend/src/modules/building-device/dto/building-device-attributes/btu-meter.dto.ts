import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.BTU_METER)
export class BtuMeterCommandDto {
  @ApiProperty({
    description: 'Năng lượng nhiệt tiêu thụ (BTU)',
    example: 12500,
  })
  @Transform(({ value }) => Number(value))
  @IsOptional()
  @IsNumber({}, { message: 'Giá trị BTU phải là số' })
  btu_energy?: number;
}
