import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiArrayResponse, ApiResponse } from '@shared/response';
import { JwtAuth } from '@src/decorators/jwt-auth.decorator';
import { TransformResponseInterceptor } from '@src/interceptors/transform-response.interceptor';

import { CreateUrbanDto, UpdateUrbanDto } from './dto/urban.dto';
import { UrbanService } from './urban.service';

@ApiTags('Urban - IOC')
@Controller('ioc/urban')
@ApiBearerAuth()
@JwtAuth()
@UseInterceptors(TransformResponseInterceptor)
export class UrbanController {
  constructor(private readonly urbanService: UrbanService) {}

  @Get()
  @ApiOperation({ summary: 'Get all urban areas' })
  async findAll() {
    return this.urbanService.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get urban by slug (URL-friendly identifier)' })
  async findBySlug(@Param('slug') slug: string) {
    return this.urbanService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get urban with buildings' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.urbanService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new urban area' })
  async create(@Body() data: CreateUrbanDto) {
    return this.urbanService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an urban area' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateUrbanDto,
  ) {
    return this.urbanService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an urban area' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.urbanService.delete(id);
  }
}
