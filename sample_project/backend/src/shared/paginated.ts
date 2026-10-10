import { ApiProperty } from '@nestjs/swagger';

export class PaginatedData<T> {
  @ApiProperty({ type: 'number' })
  total: number;

  @ApiProperty({ type: [Object] })
  items: T[];

  constructor(total: number, items: T[]) {
    this.total = total;
    this.items = items;
  }
}
