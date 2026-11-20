import { Injectable } from '@nestjs/common';
import { DbService } from '../../platform/database/db.service.ts';

@Injectable()
export class AuditService {
  constructor(private readonly db: DbService) {}

  async record(params: {
    actorId?: string | null;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    summary?: Record<string, unknown>;
    ipHash?: string | null;
    requestId?: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_log (at, actor_id, actor_role, action, entity_type, entity_id, summary, ip_hash, request_id)
       VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.actorId ?? null,
        params.actorRole,
        params.action,
        params.entityType,
        params.entityId,
        JSON.stringify(params.summary ?? {}),
        params.ipHash ?? null,
        params.requestId ?? null,
      ],
    );
    // The admin panel's log reads `audit`; mirror a readable line there so every event is visible.
    await this.db.query(
      `INSERT INTO audit (who, what)
       VALUES (coalesce((SELECT name FROM users WHERE id = $1), 'System'), $2)`,
      [params.actorId ?? null, `${params.action} (${params.entityType} ${params.entityId})`],
    );
  }
}
