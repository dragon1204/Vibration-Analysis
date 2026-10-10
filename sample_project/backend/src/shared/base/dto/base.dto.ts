import { ApiProperty } from '@nestjs/swagger';

import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class BQueryParams {
  @ApiProperty({
    required: true,
    type: Number,
    default: 1,
    description: 'Page number',
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Page must be greater than or equal to 1' })
  page: number;

  @ApiProperty({
    required: false,
    type: Number,
    default: 10,
    description: 'Number of items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Limit must be greater than or equal to 1' })
  limit?: number;

  @ApiProperty({
    required: false,
    type: String,
    description: 'Sort by field',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    required: false,
    type: String,
    enum: SortOrder,
    default: SortOrder.DESC,
    description: 'Sort order',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;

  @ApiProperty({
    required: false,
    type: String,
    description: 'Search value',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Search fields',
  })
  @IsOptional()
  @Transform(({ value }) => {
    return typeof value === 'string' ? [value] : value;
  })
  searchFields?: string[];
}
