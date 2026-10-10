import { MessagePattern, Transport } from '@nestjs/microservices';

export function MqttBmsPrefixPattern(suffix: string = '/#'): MethodDecorator {
  const prefix = process.env.MQTT_BMS_PREFIX || 'ebo';
  const topic = prefix + suffix;
  return MessagePattern(topic, Transport.MQTT);
}
