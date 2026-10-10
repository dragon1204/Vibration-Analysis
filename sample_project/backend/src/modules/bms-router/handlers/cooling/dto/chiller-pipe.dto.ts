import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { toBoolean } from '@shared/helpers/to-boolean';
import { Transform } from 'class-transformer';
import { IsNumber, IsBoolean } from 'class-validator';

@AttributeReceiveDto(BuildingDeviceType.CHILLER_PIPE)
export class ChillerPipeAttributeDto {
    @ApiProperty({
        description: 'Trạng thái dòng chảy: true = ON, false = CLOSED',
        example: true,
    })
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean()
    state: boolean;

    @ApiProperty({ description: 'Nhiệt độ nước (°C)', example: 12.5 })
    @Transform(({ value }) => Number(value))
    @IsNumber()
    temperature: number;

    @ApiProperty({ description: 'Lưu lượng nước', example: 23.4 })
    @Transform(({ value }) => Number(value))
    @IsNumber()
    flowRate: number;

    @ApiProperty({ description: 'Áp suất nước', example: 1.6 })
    @Transform(({ value }) => Number(value))
    @IsNumber()
    pressure: number;
}