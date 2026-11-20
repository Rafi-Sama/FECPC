import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.ts';
import { DatabaseModule } from '../database/database.module.ts';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
