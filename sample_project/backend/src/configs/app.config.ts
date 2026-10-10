import { registerAs } from '@nestjs/config';

import { IsBoolean, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

import validateConfig from '@shared/validator-config';

export enum ENodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

export type TAppConfig = {
  nodeEnv: ENodeEnv;
  host: string;
  port: number;
  enableTLS: boolean;
  sslCertPath: string;
  sslKeyPath: string;
  apiPrefix: string;
  yootekBackendUrl: string;
  aiBoxBackendUrl: string;
};

class AppConfigValidator {
  @IsUrl()
  @IsOptional()
  HOST?: string;

  @IsInt()
  @IsOptional()
  PORT?: number;

  @IsBoolean()
  @IsOptional()
  ENABLE_TLS?: boolean;

  @IsString()
  @IsOptional()
  SSL_CERT_PATH?: string;

  @IsString()
  @IsOptional()
  SSL_KEY_PATH?: string;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  @IsString()
  @IsOptional()
  YOOTEK_BACKEND_URL?: string;

  @IsString()
  @IsOptional()
  AIBOX_BACKEND_URL?: string;
}

export default registerAs<TAppConfig>('app', () => {
  // validateConfig(process.env, AppConfigValidator);

  return {
    nodeEnv: (process.env.NODE_ENV as ENodeEnv) || ENodeEnv.DEVELOPMENT,
    host: process.env.HOST || 'localhost',
    port: parseInt(process.env.PORT) || 4000,
    enableTLS: process.env.ENABLE_TLS === 'true',
    sslCertPath: process.env.SSL_CERT_PATH,
    sslKeyPath: process.env.SSL_KEY_PATH,
    apiPrefix: process.env.API_PREFIX || 'api',
    yootekBackendUrl: process.env.YOOTEK_BACKEND_URL,
    aiBoxBackendUrl: process.env.AIBOX_BACKEND_URL,
  };
});
