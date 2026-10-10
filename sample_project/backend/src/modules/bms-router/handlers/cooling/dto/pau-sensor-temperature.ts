import { AttributeReceiveDto } from '@modules/bms-router/decorators/attribute-receive.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsNumber } from 'class-validator';

@AttributeReceiveDto(BuildingDeviceType.PAU_SENSOR_TEMPERATURE)
export class PauSensorTemperatureAttributeDto {
    @ApiProperty({
        description: 'Nhiệt độ gió',
        example: 24,
    })
    @IsNumber()
    temp: number;
}