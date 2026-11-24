import { Module, type OnModuleInit } from '@nestjs/common';
import { MemberAreaController } from './member-area.controller.ts';
import { DatabaseModule } from '../../platform/database/database.module.ts';
import { DbService } from '../../platform/database/db.service.ts';
import { pool, usePool } from './db.ts';
import { ensureWeekly } from './sheets.ts';
import { drainMail } from './mail.ts';

@Module({
  imports: [DatabaseModule],
  controllers: [MemberAreaController],
})
export class MemberAreaModule implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  // Legacy handlers share the API's connection pool instead of opening a second one.
  onModuleInit() {
    usePool(this.db.getPool());
    // A serverless instance sleeps between requests, so timers never fire there: GET /v1/cron does this instead.
    if (process.env.VERCEL) return;
    // The weekly sheet appears within a few hours of Monday 00:00 club time, whenever the API is up.
    const weekly = () => void ensureWeekly(pool()).catch(() => {});
    weekly();
    setInterval(weekly, 3 * 3600_000).unref();
    // Queued email: at startup (a sleeping free host wakes with mail waiting) and every minute after.
    const mail = () => void drainMail().catch(() => {});
    mail();
    setInterval(mail, 60_000).unref();
  }
}
