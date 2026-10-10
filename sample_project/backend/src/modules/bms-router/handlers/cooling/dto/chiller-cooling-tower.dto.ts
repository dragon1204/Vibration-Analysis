import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';


@AttributeReceiveDto(BuildingDeviceType.CHILLER_COOLING_TOWER)
export class ChillerCoolingTowerAttributeDto {
  @ApiProperty({ description: 'State: true=on, false=off', example: true })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  state: boolean;

  @ApiProperty({ description: 'Chế độ hoạt động: true=auto, false=manual', example: true })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  mode: boolean;

  @ApiProperty({ description: 'Tình trạng lỗi: true=có lỗi, false=không lỗi', example: false })
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  fault: boolean;
}