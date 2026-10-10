import { Module } from '@nestjs/common';

import { CustomTcpServer } from './tcp.service';

@Module({
  imports: [],
  controllers: [],
  providers: [CustomTcpServer], // Add services here if needed
})
export class TcpModule {}
