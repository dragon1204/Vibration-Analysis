import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { TConfigs } from '@configs/index';
import { TMqttConfig } from '@configs/mqtt.config';

import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@src/prisma/prisma.module';

import { BmsEvent } from './controllers/bms-event.controller';
import { BuildingDeviceController } from './controllers/building-device.controller';
import { DeviceRuleController } from './controllers/device-rule.controller';
import './dto/building-device-attributes/index.dto';
import './dto/building-device-configuration/index.dto';
import { BuildingDeviceGateway } from './gateway/building-device.gateway';
import { RouterGateway } from './mqtt/router.mqtt.gateway';
import { BmsEventService } from './services/bms-event.service';
import { BuildingDeviceService } from './services/building-device.service';
import { DeviceRuleService } from './services/device-rule.service';
import { BmsMeterGateway } from './gateway/bms/bms-meter.gateway';
import { BmsGateway } from './gateway/bms/bms.gateway';

@Module({
  imports: [
    PrismaModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async () => ({
        timeout: 60000,
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: 'MQTT_CLIENT_BUILDING_DEVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService<TConfigs>) => {
          return {
            transport: Transport.MQTT,
            options: {
              url: configService.get<TMqttConfig>('mqtt').url,
              username: configService.get<TMqttConfig>('mqtt').username,
              password: configService.get<TMqttConfig>('mqtt').password,
              serializer: {
                serialize(value) {
                  return value.data;
                },
              },
            },
          };
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [BmsEvent, RouterGateway, BuildingDeviceController, DeviceRuleController],
  providers: [
    BuildingDeviceGateway,
    BmsEventService,
    BuildingDeviceService,
    DeviceRuleService,
    RouterGateway,
    BmsGateway,
    BmsMeterGateway,
  ],
})
export class BuildingDeviceModule {}
