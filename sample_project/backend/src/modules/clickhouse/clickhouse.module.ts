import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createClient } from '@clickhouse/client';

import { BmsRequestLogRepository } from './reposiroty/bms-request-log.repository';
import { TConfigs } from '@configs/index';
import { TClickHouseConfig } from '@configs/clickhouse.config';
import { ClickHouseController } from './clickhouse.controller';
import { BmsDeviceLogRepository } from './reposiroty/bms-device-log.repository';
import { BmsDeviceLogService } from './service/bms-device-log.service';

@Global()
@Module({
  providers: [
    {
      provide: 'CLICKHOUSE_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService<TConfigs>) => {
        return createClient({
          url: configService.get<TClickHouseConfig>('clickhouse').url,
          username: configService.get<TClickHouseConfig>('clickhouse').username,
          password: configService.get<TClickHouseConfig>('clickhouse').password,
          database: configService.get<TClickHouseConfig>('clickhouse').database,
        });
      },
    },
    BmsRequestLogRepository,
    BmsDeviceLogRepository,
    BmsDeviceLogService,
  ],
  controllers: [ClickHouseController],
  imports: [],
  exports: [BmsRequestLogRepository],
})
export class ClickHouseModule {}
