import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

@AttributeReceiveDto(BuildingDeviceType.AHU_FILTER)
export class AhuFilterAttributeDto {
    @ApiProperty({
        description: 'Trạng thái lỗi bộ lọc: true = OPEN, false = CLOSED',
        example: true,
    })
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean()
    fault: boolean;
}