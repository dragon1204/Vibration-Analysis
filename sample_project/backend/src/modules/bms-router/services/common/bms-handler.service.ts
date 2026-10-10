import { Injectable, Logger } from '@nestjs/common';
import { RegisterHandlerService } from './register-handler.service';

@Injectable()
export class BmsHandlerService {
  private readonly logger = new Logger(BmsHandlerService.name);

  constructor(
    private readonly registry: RegisterHandlerService,
  ) { }

  //#region: Handle mqtt from EBO
  async routeMessage(topic: string, payload: any): Promise<any> {
    const topicMapping = this.parseTopic(topic);

    const handlerInstance = this.registry.getHandler(topicMapping.feature_code);

    if (!handlerInstance) {
      throw new Error(
        `No handler found for feature code: ${topicMapping.feature_code}`,
      );
    }

    /** 
     * Process parsed payload and execute handler for each item
     */
    const parsedPayloadList = this.parsePayload(payload);
    
    // Create a list of handler promises for each parsed item
    const handlerPromises = parsedPayloadList.map((parsedItem) =>
      handlerInstance.handle(
        topicMapping.eboId,
        parsedItem.deviceType,
        parsedItem
      )
    );

    // Wait for all handler executions to complete
    return await Promise.all(handlerPromises);
  }

  // ebo/<ebo_id>/feature_code/<feature_code_value>
  parseTopic(topic: string) {
    const parts = topic.split('/').filter(Boolean);
    return {
      eboId: parts[1]?.trim(),
      feature_code: parts[3]?.trim(),
    };
  }

  /**
   * Convert raw payload data into structured objects
   * @param rawPayload Input data (object or array of objects)
   * Example:
   * [{ name: "building/14235/deviceId/FAN_01/state", value: 1 }]
   */
  parsePayload(rawPayload: any) {
    const payloadArray = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    const groupedMap = new Map<string, Record<string, any>>();

    payloadArray.forEach((item) => {
      if (!item || typeof item !== 'object') return;

      const { name, value } = item;

      if (!name || typeof name !== 'string') {
        this.logger.error(`Invalid name: ${name}`);
        return;
      }

      const segments = name.split('/');

      if (segments.length % 2 === 0) {
        this.logger.error(`Invalid segment count for name: ${name}`);
        return;
      }

      const parsedObject: Record<string, any> = {};

      // Map key-value pairs từ path
      for (let i = 0; i < segments.length; i += 2) {
        const key = segments[i];
        const val = segments[i + 1];
        parsedObject[key] = val;
      }

      // Gán value vào key cuối
      const lastKey = segments[segments.length - 1];
      parsedObject[lastKey] = value;

      const { buildingId, deviceType, deviceId } = parsedObject;

      // skip nếu thiếu key quan trọng
      if (!buildingId || !deviceType || !deviceId) {
        this.logger.warn(`Missing key fields: ${name}`);
        return;
      }

      // Tạo key để group
      const groupKey = `${parsedObject.buildingId}_${parsedObject.deviceType}_${parsedObject.deviceId}`;

      if (groupedMap.has(groupKey)) {
        // merge vào object đã có
        const existing = groupedMap.get(groupKey);

        groupedMap.set(groupKey, {
          ...existing,
          ...parsedObject,
        });
      } else {
        groupedMap.set(groupKey, parsedObject);
      }
    });

    return Array.from(groupedMap.values());
  }

  //#endregion

  //#region: Handle request from user

  async command() { }

  //#endregion
}
