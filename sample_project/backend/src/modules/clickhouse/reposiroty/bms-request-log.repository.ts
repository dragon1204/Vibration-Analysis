import { Inject, Injectable } from '@nestjs/common';

import { ClickHouseClient } from '@clickhouse/client';
import { BaseClickHouseRepository } from './clickhouse.repository';


@Injectable()
export class BmsRequestLogRepository extends BaseClickHouseRepository {
  constructor(@Inject('CLICKHOUSE_CLIENT') client: ClickHouseClient) {
    super('bms_request_log', client);
  }
}
