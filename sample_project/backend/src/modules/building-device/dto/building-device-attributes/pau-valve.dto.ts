import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { AttributeCommandDto } from '@modules/building-device/validation/attribute-command.decorator';
import { Transform } from 'class-transformer';
import { toBoolean } from '@shared/helpers/to-boolean';

@AttributeCommandDto(BuildingDeviceType.PAU_VALVE)
export class PauValveCommandDto {
   @ApiProperty({ description: 'State: true=on, false=off', example: true })
   @Transform(({ value }) => toBoolean(value))
   @IsOptional()
      state?: boolean;
}
