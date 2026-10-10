import { Controller, Logger } from '@nestjs/common';
import { Ctx, MqttContext, Payload } from '@nestjs/microservices';

import { MqttBmsPrefixPattern } from './decorators/mqtt-prefix-pattern.decorator';
import { BmsHandlerService } from './services/common/bms-handler.service';

@Controller()
export class MqttHandlerController {
  private readonly logger = new Logger(MqttHandlerController.name);

  constructor(private readonly handlerService: BmsHandlerService) {}

  @MqttBmsPrefixPattern()
  async handleMqttBmsMessage(
    @Payload() payload: any,
    @Ctx() context: MqttContext,
  ) {
    const topic = context.getTopic();
    try {
      // handle routing message:
      await this.handlerService.routeMessage(topic, payload);
    } catch (error) {
      this.logger.error(
        `Failed to handle MQTT message on topic ${topic}:`,
        error,
      );
      throw error;
    }
  }
}
