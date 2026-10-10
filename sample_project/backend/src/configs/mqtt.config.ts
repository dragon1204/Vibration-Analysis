import { registerAs } from '@nestjs/config';

import { IsOptional, IsString } from 'class-validator';

import validateConfig from '@shared/validator-config';

export type TMqttConfig = {
  url: string;
  username: string;
  password: string;
};

class MqttConfigValidator {
  @IsString()
  MQTT_URL: string;

  @IsOptional()
  @IsString()
  MQTT_USERNAME: string;

  @IsOptional()
  @IsString()
  MQTT_PASSWORD: string;
}

export default registerAs<any>('mqtt', () => {
  validateConfig(process.env, MqttConfigValidator);

  return {
    url: process.env.MQTT_URL,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  };
});
