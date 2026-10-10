import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { MQTT_HANDLER_METADATA } from '@modules/bms-router/decorators/mqtt-handler.decorator';

import { BmsHandlerBaseService } from '../base/bms-handler.base';

@Injectable()
export class RegisterHandlerService implements OnModuleInit {
  private readonly logger = new Logger(RegisterHandlerService.name);
  private readonly handlerMapping = new Map<string, any>();

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    try {
      const modules = this.moduleRef['container'].getModules()?.values();
      for (const module of modules) {
        const providers = module.providers;
        for (const [token, wrapper] of providers) {
          const metatype = wrapper.metatype;
          if (typeof metatype === 'function' && metatype.prototype) {
            const metadata = Reflect.getMetadata(
              MQTT_HANDLER_METADATA,
              metatype,
            );

            if (metadata) {
              if (Array.isArray(metadata)) {
                for (const meta of metadata) {
                  this.registerHanlder(meta, metatype);
                }
              } else {
                this.registerHanlder(metadata as string, metatype);
              }
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Fail to register bms handler: ` + err);
    }
  }

  private registerHanlder(metadata: string, handlerClass: any): void {
    const key = `BMS::${metadata}`;
    this.handlerMapping.set(key, handlerClass);
    this.logger.log(`Registered handler: ${key} -----> ${handlerClass.name}`);
  }

  getHandler(deviceType: string): BmsHandlerBaseService<any> | null {
    const handlerClass = this.getHandlerClass(deviceType);
    if (!handlerClass) {
      return null;
    }

    try {
      return this.moduleRef.get(handlerClass, { strict: false });
    } catch (error) {
      this.logger.error(
        `Failed to resolve handler instance for ${deviceType}: `,
        error,
      );
      return null;
    }
  }

  getHandlerClass(deviceType: string): any {
    const key = `BMS::${deviceType}`;
    return this.handlerMapping.get(key);
  }
}
