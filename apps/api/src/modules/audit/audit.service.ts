import { Injectable } from '@nestjs/common';
import { DbService } from '../../platform/database/db.service.ts';

const READABLE: Record<string, string> = {
  'invite.accepted': 'accepted their invite and set a password',
  'auth.password_changed': 'changed their password',
  'auth.google_linked': 'linked a Google account for signing in',
  'auth.github_linked': 'linked a GitHub account for signing in',
};

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
      `INSERT INTO audit (who, what, area)
       VALUES (coalesce((SELECT name FROM users WHERE id = $1), 'System'), $2, 'Security & settings')`,
      [
        params.actorId ?? null,
        READABLE[params.action] ?? `${params.action} (${params.entityType} ${params.entityId})`,
      ],
    );
  }
}
