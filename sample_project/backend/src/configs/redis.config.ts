import { registerAs } from '@nestjs/config';

import { IsString } from 'class-validator';

import validateConfig from '@shared/validator-config';

export type TRedisConfig = {
  url: string;
};

class RedisConfigValidator {
  @IsString()
  REDIS_URL: string;
}

export default registerAs<TRedisConfig>('redis', () => {
  validateConfig(process.env, RedisConfigValidator);

  return {
    url: process.env.REDIS_URL,
  };
});
