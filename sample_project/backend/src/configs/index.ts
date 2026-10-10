import { TAppConfig } from './app.config';
import { TAuthConfig } from './auth.config';
import { TClickHouseConfig } from './clickhouse.config';
import { TMqttConfig } from './mqtt.config';
import { TRedisConfig } from './redis.config';

export type TConfigs = {
  app: TAppConfig;
  mqtt: TMqttConfig;
  auth: TAuthConfig;
  redis: TRedisConfig;
  clickhouse: TClickHouseConfig;
};
