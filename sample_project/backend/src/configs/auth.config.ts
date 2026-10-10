import { registerAs } from '@nestjs/config';

import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import validateConfig from '@shared/validator-config';

export type TAuthConfig = {
  jwtSecretKey: string;
  accessTokenExpireIn: number;
  refreshTokenExpireIn: number;
};

class AuthConfigValidator {
  @IsString()
  @IsNotEmpty()
  JWT_SECRET_KEY: string;

  @IsInt()
  @IsOptional()
  ACCESS_TOKEN_EXPIRE_IN?: number;

  @IsInt()
  @IsOptional()
  REFRESH_TOKEN_EXPIRE_IN?: number;
}

export default registerAs<TAuthConfig>('auth', () => {
  // validateConfig(process.env, AuthConfigValidator);

  return {
    jwtSecretKey: process.env.JWT_SECRET_KEY,
    accessTokenExpireIn: parseInt(process.env.ACCESS_TOKEN_EXPIRE_IN) || 3600,
    refreshTokenExpireIn:
      parseInt(process.env.REFRESH_TOKEN_EXPIRE_IN) || 2592000,
  };
});
