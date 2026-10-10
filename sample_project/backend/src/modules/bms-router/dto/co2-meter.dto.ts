import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.CO2_METER)
export class Co2MeterAttributeDto {
  @ApiProperty({
    description: 'Nồng độ CO2 (ppm)',
    example: 200,
  })
  @Transform(({ value }) => Number(value))
  @IsNumber({}, { message: 'Giá trị BTU phải là số' })
  concentration: number;
}
