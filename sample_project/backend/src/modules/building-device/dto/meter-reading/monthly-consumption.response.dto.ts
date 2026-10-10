import { ApiProperty } from '@nestjs/swagger';

export class MonthlyConsumptionResponseDto {
  @ApiProperty({
    description: 'ID của meter',
    example: 'c0a8012b-1234-5678-9abc-def123456789',
  })
  meterId: string;

  @ApiProperty({
    description: 'Lượng tiêu thụ trong tháng (kWh hoặc m³)',
    example: 123.45,
  })
  consumption: number;
}