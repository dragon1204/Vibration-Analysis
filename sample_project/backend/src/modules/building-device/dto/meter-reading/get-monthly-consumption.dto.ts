import { ApiProperty } from '@nestjs/swagger';
import { BuildingDeviceType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxDate, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMonthlyConsumptionDto {
    @ApiProperty({
        description: 'Loại đồng hồ',
        enum: BuildingDeviceType,
        example: BuildingDeviceType.ELECTRIC_METER,
    })
    @IsEnum(BuildingDeviceType)
    @IsNotEmpty()
    meterType: BuildingDeviceType;

    @ApiProperty({
        description: 'Room ID',
        example: 'A101',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'roomId must be a string' })
    @IsNotEmpty({ message: 'roomId is required' })
    roomId: string;

    @ApiProperty({
        description: 'ID of the building',
        example: 1,
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'buildingId must be an integer' })
    @Min(1)
    buildingId: number;

    @ApiProperty({
        description: 'ID of the urban area',
        example: 10,
    })
    @Type(() => Number)
    @IsInt({ message: 'urbanId must be an integer' })
    @Min(1)
    urbanId: number;

    @ApiProperty({
        description: 'Date (YYYY-MM-DD), must be before today',
        example: '2025-01-10',
    })
    @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
    date: string;


    @ApiProperty({
        description:
        'Code of apartment',
        example: '',
        required: false,
    })
    @IsOptional()
    homeCode?: string;
}
