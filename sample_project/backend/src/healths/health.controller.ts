import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';

import { PrismaService } from '@src/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthsController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck({
    swaggerDocumentation: true,
  })
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('prisma', this.prisma),
    ]);
  }
}
