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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { TransformResponseInterceptor } from '@src/interceptors/transform-response.interceptor';
import { JwtAuth } from '@src/decorators/jwt-auth.decorator';

import { CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';
import { BuildingService } from './building.service';

@ApiTags('Building - IOC')
@Controller('ioc/building')
@ApiBearerAuth()
@JwtAuth()
@UseInterceptors(TransformResponseInterceptor)
export class BuildingController {
  constructor(private readonly buildingService: BuildingService) {}

  @Get()
  @ApiOperation({ summary: 'Get buildings by urban ID' })
  @ApiQuery({ name: 'urbanId', required: false, type: Number })
  async findAll(@Query('urbanId') urbanId?: string) {
    return this.buildingService.findAll(urbanId ? Number(urbanId) : undefined);
  }

  @Get('slug/:urbanSlug/:buildingSlug')
  @ApiOperation({ summary: 'Get building by urban slug + building slug' })
  async findBySlug(
    @Param('urbanSlug') urbanSlug: string,
    @Param('buildingSlug') buildingSlug: string,
  ) {
    return this.buildingService.findBySlug(urbanSlug, buildingSlug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get building detail with floors and device counts' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.buildingService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a building with optional GLB model upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('modelFile', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
      fileFilter: (_req, file, cb) => {
        // Accept only .glb files
        if (
          file.originalname.toLowerCase().endsWith('.glb') ||
          file.mimetype === 'model/gltf-binary' ||
          file.mimetype === 'application/octet-stream'
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only .glb files are allowed'), false);
        }
      },
    }),
  )
  async create(
    @Body() data: CreateBuildingDto,
    @UploadedFile() modelFile?: Express.Multer.File,
  ) {
    // Parse numeric fields from multipart/form-data (they arrive as strings)
    if (typeof data.urbanId === 'string') data.urbanId = parseInt(data.urbanId as any, 10);
    if (typeof data.totalFloors === 'string') data.totalFloors = parseInt(data.totalFloors as any, 10);
    if (typeof data.positionX === 'string') data.positionX = parseFloat(data.positionX as any);
    if (typeof data.positionY === 'string') data.positionY = parseFloat(data.positionY as any);
    if (typeof data.positionZ === 'string') data.positionZ = parseFloat(data.positionZ as any);
    if (typeof data.rotationY === 'string') data.rotationY = parseFloat(data.rotationY as any);
    if (typeof data.scale === 'string') data.scale = parseFloat(data.scale as any);

    return this.buildingService.create(data, modelFile);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a building' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateBuildingDto,
  ) {
    return this.buildingService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a building (also removes GLB file)' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.buildingService.delete(id);
  }
}
