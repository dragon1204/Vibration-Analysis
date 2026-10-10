import { Controller, Get, Query } from '@nestjs/common';
import { BmsDeviceLogService } from './service/bms-device-log.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OnEvent } from '@nestjs/event-emitter';
import { DeviceLogData } from './interface/device-log.interface';
import { LOG_EVENT } from '@modules/building-device/enums/log-event.enum';

@ApiTags('clickhouse')
@Controller('clickhouse')
export class ClickHouseController {
  constructor(private readonly service: BmsDeviceLogService) {}

  // Lắng nghe sự kiện DEVICE_LOG và gọi service để lưu log vào ClickHouse
  @OnEvent(LOG_EVENT.DEVICE_LOG)
  changeState(data: DeviceLogData[]) {
    return this.service.createDeviceLog(data);
  }

  @Get('device-logs')
  async getDeviceLogs(@Query() query: any) {
    // Parser query strings from frontend
    const filter = query.filter ? JSON.parse(query.filter) : {};
    const filterTime = query.filterTime ? JSON.parse(query.filterTime) : undefined;
    const paging = query.paging ? JSON.parse(query.paging) : undefined;
    const order = query.order ? JSON.parse(query.order) : undefined;

    return this.service.findLogs({ filter, filterTime, paging, order });
  }

  /**
   * Simplified device log query for BMS frontend.
   * Query params: deviceId, deviceType, buildingId, from, to, limit
   */
  @Get('device-logs/simple')
  @ApiOperation({ summary: 'Get device logs with simple query params' })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'deviceType', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getDeviceLogsSimple(
    @Query('deviceId') deviceId?: string,
    @Query('deviceType') deviceType?: string,
    @Query('buildingId') buildingId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: Record<string, any> = {};
    if (deviceId) filter.deviceId = deviceId;
    if (deviceType) filter.deviceType = deviceType;
    if (buildingId) filter.buildingId = buildingId;

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

    const filterTime = {
      field: 'createdAt',
      fromDate: from || defaultFrom.toISOString(),
      toDate: to || now.toISOString(),
    };

    const paging = {
      skip: 0,
      take: limit ? parseInt(limit, 10) : 500,
    };

    const order = {
      field: 'createdAt' as const,
      by: 'DESC' as const,
    };

    return this.service.findLogs({ filter, filterTime, paging, order });
  }
}
