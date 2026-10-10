import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import './dto/index.dto';
import { EnergyHandler } from './handlers/energy/enery.handler';
import { FanHandler } from './handlers/fan/fan.handler';
import { FireAlarmHandler } from './handlers/fire-alarm/fire-alarm.handler';
import { FirePumpHandler } from './handlers/fire-pump/fire-pump.handler';
import './handlers/index.dto';
import { LightHandler } from './handlers/light/light.handler';
import { PumpHandler } from './handlers/pump/pump.handler';
import { MqttHandlerController } from './mqtt-handler.controller';
import { BmsHandlerService } from './services/common/bms-handler.service';
import { RegisterHandlerService } from './services/common/register-handler.service';
import { ClickHouseModule } from '@modules/clickhouse/clickhouse.module';
import { CoolingHandler } from './handlers/cooling/cooling.handler';

@Module({
  imports: [DiscoveryModule, ClickHouseModule],
  controllers: [MqttHandlerController],
  providers: [
    RegisterHandlerService,
    BmsHandlerService,
    FanHandler,
    EnergyHandler,
    PumpHandler,
    LightHandler,
    FirePumpHandler,
    FireAlarmHandler,
    CoolingHandler,
  ],
})
export class BmsRouterModule {}
