// src/modules/public-device/public-device.gateway.ts
import { Controller, Inject, Injectable } from '@nestjs/common';
import {
  ClientMqtt,
  Ctx,
  MessagePattern,
  MqttContext,
  Payload,
  Transport,
} from '@nestjs/microservices';

import { IsPublic } from '@src/decorators/is-public.decorator';

@Controller('building-device/router/gateways')
@Injectable()
export class RouterGateway {
  constructor(
    @Inject('MQTT_CLIENT_BUILDING_DEVICE')
    private readonly mqttClient: ClientMqtt,
  ) {}

  @IsPublic()
  @MessagePattern('/yootek/test', Transport.MQTT)
  handleDeviceState(@Payload() data: any, @Ctx() context: MqttContext) {
    console.log(data);
    this.sendDataToBroker('/yootek/test/res', {
      message: 'Hello',
    });
  }

  sendDataToBroker(topic: string, payload?: any) {
    this.mqttClient.emit(topic, payload).subscribe({
      error: (err) => console.error(`MQTT publish error on ${topic}:`, err),
    });
  }
}
