import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';

@AttributeCommandDto(BuildingDeviceType.DIM_LIGHT)
export class DimLightCommandDto {
  @ApiProperty({
    description: 'State: true=fire detected, false=normal',
    example: true,
  })
  @IsOptional()
  @IsOptional()
    state?: boolean;

  @ApiProperty({ description: 'Độ sáng', example: 120 })
  @IsOptional()
  @IsOptional()
    @Transform(({ value }) => Number(value))
  brightness?: number;
}
