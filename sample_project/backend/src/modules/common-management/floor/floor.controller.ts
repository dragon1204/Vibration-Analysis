import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { TransformResponseInterceptor } from '@src/interceptors/transform-response.interceptor';
import { JwtAuth } from '@src/decorators/jwt-auth.decorator';

import { CreateFloorDto, UpdateFloorDto } from './dto/floor.dto';
import { FloorService } from './floor.service';

@ApiTags('Floor - IOC')
@Controller('ioc/floor')
@ApiBearerAuth()
@JwtAuth()
@UseInterceptors(TransformResponseInterceptor)
export class FloorController {
  constructor(private readonly floorService: FloorService) {}

  @Get()
  @ApiOperation({ summary: 'Get floors by building ID' })
  @ApiQuery({ name: 'buildingId', required: false, type: Number })
  async findAll(@Query('buildingId') buildingId?: string) {
    return this.floorService.findAll(
      buildingId ? Number(buildingId) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get floor detail with devices' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.floorService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new floor' })
  async create(@Body() data: CreateFloorDto) {
    return this.floorService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a floor' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateFloorDto,
  ) {
    return this.floorService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a floor' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.floorService.delete(id);
  }
}
