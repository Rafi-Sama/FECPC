import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { IS_PUBLIC_KEY } from './decorators.ts';
import { DbService } from '../../platform/database/db.service.ts';
import { ConfigService } from '../../platform/config/config.service.ts';
import { DomainException } from '../../platform/http/problem-details.filter.ts';
import { ErrorCodes } from '@fecpc/contracts';
import type { RequestUser } from './decorators.ts';

/** The session token from the cookie. Only the cookie: it is httpOnly, so page scripts never hold it. */
export const sessionToken = (req: FastifyRequest, cookieName: string): string | undefined =>
  (req as FastifyRequest & { cookies?: Record<string, string | undefined> }).cookies?.[
    cookieName
  ] || undefined;

const unauthenticated = (msg: string) =>
  new DomainException(msg, HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHENTICATED);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = sessionToken(request, this.config.sessionCookieName);
    if (!token) throw unauthenticated('Authentication required.');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { SESSION_IDLE_DAYS: idle, SESSION_ABSOLUTE_DAYS: absolute } = this.config.env;

    // Role and status are read fresh on every request, so a demotion or suspension applies immediately.
    const row = (
      await this.db.query(
        `SELECT s.last_seen_at, u.id, u.email, u.name, u.role, u.status, u.suspended, u.handle, u.squad
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()
           AND s.created_at > now() - make_interval(days => $2)`,
        [tokenHash, absolute],
      )
    ).rows[0];

    if (!row || row.status === 'deleted') throw unauthenticated('Invalid or expired session.');
    if (row.status === 'suspended' || row.suspended) {
      throw new DomainException(
        'Account is suspended.',
        HttpStatus.FORBIDDEN,
        ErrorCodes.ACCOUNT_SUSPENDED,
      );
    }

    const user: RequestUser = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      handle: row.handle,
      squad: row.squad,
    };
    (request as FastifyRequest & { user?: RequestUser }).user = user;

    // Sliding expiry, at most one write per 10 minutes, never past the absolute lifetime.
    if (Date.now() - new Date(row.last_seen_at).getTime() > 10 * 60 * 1000) {
      this.db
        .query(
          `UPDATE sessions SET last_seen_at = now(),
             expires_at = least(now() + make_interval(days => $2), created_at + make_interval(days => $3))
           WHERE token_hash = $1`,
          [tokenHash, idle, absolute],
        )
        .catch(() => {});
    }

    return true;
  }
}
