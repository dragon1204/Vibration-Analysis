import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

@AttributeReceiveDto(BuildingDeviceType.LIGHT)
export class LightAttributeDto {
  @ApiProperty({
    description: 'Light state: true = ON, false = OFF',
    example: true,
  })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  state: boolean;
}
