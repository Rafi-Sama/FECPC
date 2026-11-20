import { Injectable } from '@nestjs/common';
import { DbService } from '../../platform/database/db.service.ts';
import { DomainException } from '../../platform/http/problem-details.filter.ts';
import { ErrorCodes } from '@fecpc/contracts';

const WINDOW = `interval '15 minutes'`;
const norm = (email: string) => email.trim().toLowerCase();

/**
 * Failed sign-ins within 15 minutes: at most 5 per (email, IP), 20 per email, 50 per IP.
 * Each (email, IP) row restarts its window once the old one has passed.
 */
@Injectable()
export class LoginThrottlingService {
  constructor(private readonly db: DbService) {}

  async checkThrottling(email: string, ip: string): Promise<void> {
    const e = norm(email);
    const row = (
      await this.db.query(
        `SELECT
           coalesce(sum(attempts) FILTER (WHERE email = $1 AND ip = $2), 0)::int AS pair,
           coalesce(sum(attempts) FILTER (WHERE email = $1), 0)::int AS by_email,
           coalesce(sum(attempts) FILTER (WHERE ip = $2), 0)::int AS by_ip
         FROM login_attempts
         WHERE (email = $1 OR ip = $2) AND window_start > now() - ${WINDOW}`,
        [e, ip],
      )
    ).rows[0];

    if (row.pair >= 5 || row.by_email >= 20 || row.by_ip >= 50) {
      throw new DomainException(
        'Too many failed login attempts. Please try again later.',
        429,
        ErrorCodes.RATE_LIMITED,
      );
    }
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    const e = norm(email);
    await this.db.query(
      `INSERT INTO login_attempts (key, email, ip, attempts, window_start, last_attempt_at)
       VALUES ($1, $2, $3, 1, now(), now())
       ON CONFLICT (key) DO UPDATE SET
         attempts = CASE WHEN login_attempts.window_start > now() - ${WINDOW}
                         THEN login_attempts.attempts + 1 ELSE 1 END,
         window_start = CASE WHEN login_attempts.window_start > now() - ${WINDOW}
                             THEN login_attempts.window_start ELSE now() END,
         email = $2, ip = $3, last_attempt_at = now()`,
      [`${e}#${ip}`, e, ip],
    );
  }

  async clearOnSuccess(email: string, ip: string): Promise<void> {
    await this.db.query(`DELETE FROM login_attempts WHERE key = $1`, [`${norm(email)}#${ip}`]);
  }
}
