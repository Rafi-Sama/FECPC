import { Module, type OnModuleInit } from '@nestjs/common';
import { MemberAreaController } from './member-area.controller.ts';
import { DatabaseModule } from '../../platform/database/database.module.ts';
import { DbService } from '../../platform/database/db.service.ts';
import { usePool } from './db.ts';

@Module({
  imports: [DatabaseModule],
  controllers: [MemberAreaController],
})
export class MemberAreaModule implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  // Legacy handlers share the API's connection pool instead of opening a second one.
  onModuleInit() {
    usePool(this.db.getPool());
  }
}
