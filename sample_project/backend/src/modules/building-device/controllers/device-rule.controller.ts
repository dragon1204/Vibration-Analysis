import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuth } from '@src/decorators/jwt-auth.decorator';
import { DeviceRuleService } from '../services/device-rule.service';

@ApiTags('Device Rules - Interlock & Cascade')
@Controller('ioc/device-rule')
@ApiBearerAuth()
@JwtAuth()
export class DeviceRuleController {
  constructor(private readonly deviceRuleService: DeviceRuleService) {}

  @Get()
  @ApiOperation({ summary: 'Get all device rules for a building' })
  async getRules(@Query('buildingId') buildingId: string) {
    return {
      success: true,
      data: await this.deviceRuleService.getRules(Number(buildingId)),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new device rule' })
  async createRule(@Body() data: any) {
    return {
      success: true,
      data: await this.deviceRuleService.createRule(data),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a device rule' })
  async deleteRule(@Param('id') id: string) {
    return {
      success: true,
      data: await this.deviceRuleService.deleteRule(id),
    };
  }
}
