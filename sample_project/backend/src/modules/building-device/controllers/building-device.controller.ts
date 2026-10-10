import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiPaginatedResponse,
  ApiResponse,
} from '@shared/response';

import { JwtAuth } from '@src/decorators/jwt-auth.decorator';
import { TransformResponseInterceptor } from '@src/interceptors/transform-response.interceptor';

import { AttributeCommandDto } from '../dto/attribute-command.dto';
import { BuildingDeviceListDto } from '../dto/building-device-list.dto';
import {
  CreateBuildingDeviceDto,
  UpdateBuildingDeviceDto,
} from '../dto/building-device.dto';
import { BuildingDeviceResponse } from '../dto/building-device.response.dto';
import { IdParamDto } from '../dto/id-param.dto';
import { BuildingDeviceService } from '../services/building-device.service';
import { AttributeCommandValidationPipe } from '../validation/attribute-command.pipe';
import { ConfigurationValidationPipe } from '../validation/configuration.pipe';

@ApiTags('Building Device - IOC')
@Controller('ioc/building-device')
@ApiBearerAuth()
@JwtAuth()
export class BuildingDeviceController {
  constructor(private readonly buildingDeviceService: BuildingDeviceService) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve the list of building devices',
    description:
      'Retrieve a paginated list of devices assigned to the current building. ' +
      'Supports filtering, sorting, and pagination.',
  })
  @ApiPaginatedResponse(BuildingDeviceResponse)
  @UseInterceptors(TransformResponseInterceptor)
  async getListBuildingDevice(
    @Query() query: BuildingDeviceListDto,
  ) {
    return await this.buildingDeviceService.getListBuildingDevice(
      query,
    );
  }

  @Post('')
  @ApiOperation({
    summary: 'Create a new building device',
    description: 'Create a new device and associate it with a building.',
  })
  @ApiResponse(BuildingDeviceResponse)
  @UseInterceptors(TransformResponseInterceptor)
  async create(
    @Body(new ConfigurationValidationPipe()) data: CreateBuildingDeviceDto,
  ) {
    return this.buildingDeviceService.createBuildingDevice(data);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an existing building device',
    description: 'Remove a device from a building by its ID.',
  })
  @ApiResponse(BuildingDeviceResponse)
  @UseInterceptors(TransformResponseInterceptor)
  async update(
    @Param() param: IdParamDto,
    @Body(new ConfigurationValidationPipe()) data: UpdateBuildingDeviceDto,
  ) {
    return this.buildingDeviceService.updateBuildingDevice(
      param.id,
      data,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a building device',
    description: 'Remove a device from a building by its ID.',
  })
  @ApiResponse(BuildingDeviceResponse)
  @UseInterceptors(TransformResponseInterceptor)
  async delete(@Param() param: IdParamDto) {
    return this.buildingDeviceService.deleteBuildingDevice(param.id);
  }

  @Get('detail/:id')
  @ApiOperation({
    summary: 'Retrieve a single building device by its ID',
    description:
      'Fetch the details of a building device belonging to the tenant. Requires authentication.',
  })
  @ApiResponse(BuildingDeviceResponse)
  @UseInterceptors(TransformResponseInterceptor)
  async getBuildingDevice(@Param() param: IdParamDto) {
    return await this.buildingDeviceService.getBuildingDevice(
      param.id,
    );
  }

  @Patch(':id/command')
  @ApiOperation({
    summary: 'Execute a control command on a building device',
    description:
      'Send a control command to a specific building device, update its attributes, and publish changes via MQTT. Requires authentication.',
  })
  @ApiResponse(BuildingDeviceResponse)
  @UseInterceptors(TransformResponseInterceptor)
  async command(
    @Param() param: IdParamDto,
    @Body(new AttributeCommandValidationPipe()) data: AttributeCommandDto,
  ) {
    return this.buildingDeviceService.command(data, param.id);
  }
}
