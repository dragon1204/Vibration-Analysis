import { SetMetadata } from '@nestjs/common';

export const MQTT_HANDLER_METADATA = 'MQTT_HANDLER_METADATA';

export const MqttHandler = (options: string | string[]) =>
  SetMetadata(MQTT_HANDLER_METADATA, options);
