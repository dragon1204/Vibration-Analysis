import { ApiPropertyOptional } from '@nestjs/swagger';

import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class PaginatedInput {
  @ApiPropertyOptional({ type: 'number', default: 0 })
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional({ type: 'number', default: 10 })
  @Type(() => Number)
  take?: number = 10;
}

export class PaginatedInputV2 {
  @ApiPropertyOptional({ type: 'number', default: 0 })
  @Type(() => Number)
  skip?: number;

  @ApiPropertyOptional({ type: 'number', default: 10 })
  @Type(() => Number)
  take?: number;
}

export class SearchInput {
  @ApiPropertyOptional({ type: 'string' })
  search?: string;
}

export class SortInput {
  @ApiPropertyOptional({ type: 'string' })
  sort?: string;

  @ApiPropertyOptional({ type: 'string', enum: Prisma.SortOrder })
  order?: Prisma.SortOrder = 'asc';
}

export class PaginatedSearchInput extends PaginatedInput {
  @ApiPropertyOptional({ type: 'string' })
  search?: string;
}

export class PaginatedSortInput extends PaginatedInput {
  @ApiPropertyOptional({ type: 'string' })
  sort?: string;

  @ApiPropertyOptional({ type: 'string', enum: Prisma.SortOrder })
  order?: Prisma.SortOrder = 'asc';
}

export class PaginatedSearchSortInput extends PaginatedInput {
  @ApiPropertyOptional({ type: 'string' })
  search?: string;

  @ApiPropertyOptional({ type: 'string' })
  sort?: string;

  @ApiPropertyOptional({ type: 'string', enum: Prisma.SortOrder })
  order?: Prisma.SortOrder = 'asc';
}

export class SearchSortInput extends SearchInput {
  @ApiPropertyOptional({ type: 'string' })
  sort?: string;

  @ApiPropertyOptional({ type: 'string', enum: Prisma.SortOrder })
  order?: Prisma.SortOrder = 'asc';
}

export function PaginatedSearchSortInputV2<T extends Record<string, string>>(
  enumObj: T,
) {
  class PaginatedSearchSortInput extends PaginatedInputV2 {
    @ApiPropertyOptional({ type: 'string' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ type: 'string', enum: Object.values(enumObj) })
    @IsOptional()
    @IsString()
    @IsIn(Object.values(enumObj), {
      message: `sort field must be one of: ${Object.values(enumObj).join(', ')}`,
    })
    sort?: string;

    @ApiPropertyOptional({ type: 'string', enum: Prisma.SortOrder })
    @IsOptional()
    order?: Prisma.SortOrder = 'asc';
  }

  return PaginatedSearchSortInput;
}
