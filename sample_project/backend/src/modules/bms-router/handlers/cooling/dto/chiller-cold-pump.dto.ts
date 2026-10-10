import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';


@AttributeReceiveDto(BuildingDeviceType.CHILLER_COLD_PUMP)
export class ChillerColdPumpAttributeDto {
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

  @ApiProperty({ description: 'Tốc độ bơm', example: 1200 })
  @Transform(({ value }) => Number(value)) 
  @IsNumber()
  speed: number;
}