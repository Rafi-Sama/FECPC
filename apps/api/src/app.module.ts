import { Module } from '@nestjs/common';
import { ConfigModule } from './platform/config/config.module.ts';
import { DatabaseModule } from './platform/database/database.module.ts';
import { LoggingModule } from './platform/logging/logging.module.ts';
import { HealthModule } from './platform/health/health.module.ts';
import { AuditModule } from './modules/audit/audit.module.ts';
import { AuthModule } from './modules/auth/auth.module.ts';
import { MemberAreaModule } from './modules/member-area/member-area.module.ts';
import { LearningModule } from './modules/learning/learning.module.ts';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggingModule,
    HealthModule,
    AuditModule,
    AuthModule,
    MemberAreaModule,
    LearningModule,
  ],
})
export class AppModule {}
