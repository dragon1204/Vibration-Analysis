import { NestApplicationOptions, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as dotenv from 'dotenv';
import helmet from 'helmet';
import { join } from 'path';
import 'src/shared/extension/data.extension';

import { TAppConfig } from '@configs/app.config';
import { TMqttConfig } from '@configs/mqtt.config';

import { AppModule } from './app.module';
import { GlobalExceptionsFilter } from './filters/global-exception.filter';
import { CLogger } from './logger/custom-logger';
import { CValidationPipe } from './pipes/validation.pipe';

dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});

async function bootstrap() {
  const options: NestApplicationOptions = {
    logger: CLogger,
  };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    options,
  );

  // Get app configs
  const configService = app.get(ConfigService);

  const host = configService.getOrThrow<TAppConfig>('app').host;
  const port = configService.getOrThrow<TAppConfig>('app').port;
  const apiPrefix = configService.getOrThrow<TAppConfig>('app').apiPrefix;
  // End Get app configs

  // ─── Security ───────────────────────────────────────────────
  // Helmet — sets various HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for Swagger UI
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS — properly configured instead of `cors: true`
  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-language'],
    credentials: true,
    maxAge: 3600,
  });
  // ─── End Security ───────────────────────────────────────────

  // Global setup
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new CValidationPipe());
  app.useGlobalFilters(new GlobalExceptionsFilter());
  // End Global setup

  //Setup MVC view
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  // Swagger setup
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Yootek IOC onsite')
      .setDescription('Api documents for Yootek IOC API Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(apiPrefix, app, document);
  // End Swagger setup

  // MQTT setup
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.MQTT,
    options: {
      url: configService.get('MQTT_URL'),
      username: configService.get('MQTT_USERNAME'),
      password: configService.get('MQTT_PASSWORD'),
    },
  });
  // End MQTT setup

  await app.startAllMicroservices();
  CLogger.log('Microservices are running', 'Bootstrap');

  await app.listen(port, host, () => {
    CLogger.log(`Server is running on ${host}:${port}`, 'Bootstrap');
    CLogger.log(`Swagger: http://${host}:${port}/${apiPrefix}`, 'Bootstrap');
  });
}

bootstrap();
