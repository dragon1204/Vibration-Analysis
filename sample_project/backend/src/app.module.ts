import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { RedisModule } from '@nestjs-modules/ioredis';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';

import appConfig from '@configs/app.config';
import authConfig from '@configs/auth.config';
import mqttConfig from '@configs/mqtt.config';
import redisConfig, { TRedisConfig } from '@configs/redis.config';

import { BmsRouterModule } from '@modules/bms-router/bms-router.module';
import { BuildingDeviceModule } from '@modules/building-device/building-device.module';
import { AuthModule } from '@modules/auth/auth.module';
import { CommonManagementModule } from '@modules/common-management/common-management.module';

import { HealthsController } from '@src/healths/health.controller';

import { TConfigs } from './configs';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { TcpModule } from './tcp/tcp.module';
import clickhouseConfig from '@configs/clickhouse.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, mqttConfig, redisConfig, clickhouseConfig],
      envFilePath: ['.env', '.env.development', '.env.production'],
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService<TConfigs>) => ({
        type: 'single',
        url: configService.get<TRedisConfig>('redis').url,
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({
      global: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        new QueryResolver(['lang']),
        AcceptLanguageResolver,
        new HeaderResolver(['x-language', 'Content-Language']),
      ],
    }),
    TerminusModule,
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds window
      limit: 60,  // 60 requests per window per IP
    }]),
    PrismaModule,
    TcpModule,
    BuildingDeviceModule,
    BmsRouterModule,
    AuthModule,
    CommonManagementModule,
  ],
  controllers: [HealthsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
