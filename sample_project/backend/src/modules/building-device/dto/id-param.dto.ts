import { ApiProperty } from '@nestjs/swagger';

import { IsUUID } from 'class-validator';

export class IdParamDto {
  @ApiProperty({
    description: 'ID của building device',
    example: '6edfeab1-ac3b-4aa3-8991-abc5687c2f2f',
  })
  @IsUUID()
  id: string;
}
