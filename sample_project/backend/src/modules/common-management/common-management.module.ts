import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';

import { UrbanController } from './urban/urban.controller';
import { UrbanService } from './urban/urban.service';
import { BuildingController } from './building/building.controller';
import { BuildingService } from './building/building.service';
import { GlbValidatorService } from './building/glb-validator.service';
import { FloorController } from './floor/floor.controller';
import { FloorService } from './floor/floor.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UrbanController, BuildingController, FloorController],
  providers: [UrbanService, BuildingService, FloorService, GlbValidatorService],
  exports: [UrbanService, BuildingService, FloorService],
})
export class CommonManagementModule {}
