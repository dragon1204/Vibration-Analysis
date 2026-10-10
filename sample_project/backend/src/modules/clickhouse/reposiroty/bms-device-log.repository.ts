import { Inject, Injectable } from '@nestjs/common';

import { ClickHouseClient } from '@clickhouse/client';
import { BaseClickHouseRepository } from './clickhouse.repository';


@Injectable()
export class BmsDeviceLogRepository extends BaseClickHouseRepository {
  constructor(@Inject('CLICKHOUSE_CLIENT') client: ClickHouseClient) {
    super('default.bms_device_log', client);
  }
}
