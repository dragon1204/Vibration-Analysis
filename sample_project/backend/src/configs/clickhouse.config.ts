import { registerAs } from '@nestjs/config';

import { IsString } from 'class-validator';

import validateConfig from '@shared/validator-config';

export type TClickHouseConfig = {
  url: string;
  username: string;
  password: string;
  database: string;
};

class ClickHouseConfigValidator {
  @IsString()
  CLICKHOUSE_HOST: string;

  @IsString()
  CLICKHOUSE_USERNAME: string;

  @IsString()
  CLICKHOUSE_PASSWORD: string;

  @IsString()
  CLICKHOUSE_DB: string;
}

export default registerAs<TClickHouseConfig>('clickhouse', () => {
  validateConfig(process.env, ClickHouseConfigValidator);

  return {
    url: process.env.CLICKHOUSE_HOST || 'http://clickhouse:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'admin',
    password: process.env.CLICKHOUSE_PASSWORD || 'Long1204@',
    database: process.env.CLICKHOUSE_DB || 'default',
  };
});
