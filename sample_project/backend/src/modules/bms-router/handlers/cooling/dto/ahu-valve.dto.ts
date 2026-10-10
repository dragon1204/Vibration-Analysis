import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

@AttributeReceiveDto(BuildingDeviceType.AHU_VALVE)
export class AhuValveAttributeDto {
    @ApiProperty({
        description: 'Trạng thái van: true = OPEN, false = CLOSED',
        example: true,
    })
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean()
    state: boolean;
}