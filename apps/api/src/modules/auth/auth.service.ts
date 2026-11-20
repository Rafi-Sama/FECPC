import { Injectable, HttpStatus } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { DbService } from '../../platform/database/db.service.ts';
import { ConfigService } from '../../platform/config/config.service.ts';
import { LoginThrottlingService } from './login-throttling.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import { PasswordHasher } from './password.ts';
import { DomainException } from '../../platform/http/problem-details.filter.ts';
import { ErrorCodes, type Role, type UserStatus } from '@fecpc/contracts';

export interface AuthSessionResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    status: UserStatus;
    handle: string;
    squad: string;
    avatarUrl: string | null;
  };
}

const USER_COLS = `u.id, u.email, u.name, u.role, u.status, u.suspended, u.handle, u.squad, u.avatar_url`;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const toUser = (r: any): AuthSessionResult['user'] => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  status: r.status,
  handle: r.handle,
  squad: r.squad,
  avatarUrl: r.avatar_url,
});
const badLogin = () =>
  new DomainException(
    'Invalid email or password.',
    HttpStatus.UNAUTHORIZED,
    ErrorCodes.INVALID_CREDENTIALS,
  );
const suspended = () =>
  new DomainException('Account is suspended.', HttpStatus.FORBIDDEN, ErrorCodes.ACCOUNT_SUSPENDED);
const isSuspended = (r: { status: string; suspended?: boolean }) =>
  r.status === 'suspended' || r.suspended === true;

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
    private readonly throttling: LoginThrottlingService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, pass: string, ip: string): Promise<AuthSessionResult> {
    await this.throttling.checkThrottling(email, ip);

    const row = (
      await this.db.query(
        `SELECT ${USER_COLS}, coalesce(c.password_hash, u.pass_hash) AS hash
         FROM users u LEFT JOIN credentials c ON c.user_id = u.id
         WHERE u.email = $1 AND u.status <> 'deleted' AND NOT u.system`,
        [email.trim().toLowerCase()],
      )
    ).rows[0];

    // Same work and the same answer for "no such account", "no password yet" and "wrong password".
    const result = row?.hash
      ? await PasswordHasher.verify(pass, row.hash)
      : (await PasswordHasher.dummyVerify(), { valid: false, needsRehash: false });
    if (!result.valid) {
      await this.throttling.recordFailure(email, ip);
      throw badLogin();
    }
    await this.throttling.clearOnSuccess(email, ip);
    // Only someone who knows the password learns that the account is suspended.
    if (isSuspended(row)) throw suspended();

    if (result.needsRehash) await this.setPassword(row.id, await PasswordHasher.hash(pass));
    return { token: await this.createSession(row.id), user: toUser(row) };
  }

  async logout(token: string): Promise<void> {
    await this.db.query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
  }

  /** Writes the password to both columns that hold it, so every reader agrees. */
  private async setPassword(userId: string, hash: string): Promise<void> {
    await this.db.query(
      `INSERT INTO credentials (user_id, password_hash, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (user_id) DO UPDATE SET password_hash = $2, updated_at = now()`,
      [userId, hash],
    );
    await this.db.query(`UPDATE users SET pass_hash = $2, updated_at = now() WHERE id = $1`, [
      userId,
      hash,
    ]);
  }

  async createSession(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    await this.db.run(async (client) => {
      // Keep at most SESSION_MAX_PER_USER sessions: drop the least recently used.
      await client.query(
        `DELETE FROM sessions WHERE token_hash IN (
           SELECT token_hash FROM sessions WHERE user_id = $1 ORDER BY last_seen_at DESC OFFSET $2)`,
        [userId, this.config.env.SESSION_MAX_PER_USER - 1],
      );
      await client.query(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
         VALUES ($1, $2, now() + make_interval(days => $3), now(), now())`,
        [sha256(rawToken), userId, this.config.env.SESSION_IDLE_DAYS],
      );
    });
    return rawToken;
  }

  async getInvite(token: string): Promise<{ name: string; maskedEmail: string }> {
    const row = (
      await this.db.query(
        `SELECT u.name, u.email, u.status, u.suspended FROM users u
         WHERE u.invite_hash = $1 AND (u.invite_expires IS NULL OR u.invite_expires > now())
         UNION ALL
         SELECT u.name, u.email, u.status, u.suspended FROM invite_tokens i JOIN users u ON u.id = i.user_id
         WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()
         LIMIT 1`,
        [sha256(token)],
      )
    ).rows[0];

    if (!row || row.status === 'deleted') {
      throw new DomainException(
        'Invitation link has expired or has already been used.',
        HttpStatus.GONE,
        ErrorCodes.INVITE_EXPIRED,
      );
    }
    if (isSuspended(row)) throw suspended();

    const [local, domain] = row.email.split('@');
    return { name: row.name, maskedEmail: `${local.slice(0, 2)}•••@${domain}` };
  }

  async acceptInvite(token: string, newPass: string, ip: string): Promise<AuthSessionResult> {
    const tokenHash = sha256(token);
    const passwordHash = await PasswordHasher.hash(newPass); // slow: done before the transaction holds locks

    return this.db.run(async (client) => {
      const user = (
        await client.query(
          `SELECT ${USER_COLS} FROM users u
           WHERE u.status <> 'deleted' AND (
             (u.invite_hash = $1 AND (u.invite_expires IS NULL OR u.invite_expires > now()))
             OR u.id = (SELECT user_id FROM invite_tokens
                        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()))
           FOR UPDATE OF u`,
          [tokenHash],
        )
      ).rows[0];

      if (!user) {
        throw new DomainException(
          'Invitation link is invalid, expired, or already used.',
          HttpStatus.GONE,
          ErrorCodes.INVITE_EXPIRED,
        );
      }
      if (isSuspended(user)) throw suspended();

      // Single use: both token forms are spent, and every old session is signed out.
      await client.query(`UPDATE invite_tokens SET used_at = now() WHERE token_hash = $1`, [
        tokenHash,
      ]);
      await client.query(
        `UPDATE users SET invite_hash = NULL, invite_expires = NULL, status = 'active' WHERE id = $1`,
        [user.id],
      );
      await this.setPassword(user.id, passwordHash);
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [user.id]);
      await this.audit.record({
        actorId: user.id,
        actorRole: user.role,
        action: 'invite.accepted',
        entityType: 'users',
        entityId: user.id,
        ipHash: sha256(ip),
      });

      return {
        token: await this.createSession(user.id),
        user: { ...toUser(user), status: 'active' as UserStatus },
      };
    });
  }

  /** Changes the password, signs out every session, and returns a fresh session for this device. */
  async changePassword(userId: string, currentPass: string, newPass: string): Promise<string> {
    const row = (
      await this.db.query(
        `SELECT u.role, coalesce(c.password_hash, u.pass_hash) AS hash
         FROM users u LEFT JOIN credentials c ON c.user_id = u.id WHERE u.id = $1`,
        [userId],
      )
    ).rows[0];
    if (!row?.hash || !(await PasswordHasher.verify(currentPass, row.hash)).valid) {
      throw new DomainException(
        'Current password incorrect.',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }
    const newHash = await PasswordHasher.hash(newPass);

    return this.db.run(async (client) => {
      await this.setPassword(userId, newHash);
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
      await this.audit.record({
        actorId: userId,
        actorRole: row.role,
        action: 'auth.password_changed',
        entityType: 'users',
        entityId: userId,
      });
      return this.createSession(userId);
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  }

  /** Google's callback URL. It must be identical when sending the user to Google and when redeeming the code. */
  get googleRedirectUri(): string {
    return (
      this.config.env.GOOGLE_REDIRECT_URI ||
      `${this.config.env.APP_PUBLIC_URL}/api/auth/google/callback`
    );
  }

  /**
   * Redeems a Google authorization code here, with the client secret, so the identity comes from Google
   * and never from the caller. Only an existing, active member may sign in this way.
   */
  async loginWithGoogle(code: string): Promise<AuthSessionResult> {
    const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = this.config.env;
    const refuse = (msg: string) =>
      new DomainException(msg, HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHENTICATED);
    if (!id || !secret) throw refuse('Google sign-in is not configured.');

    const tok = (await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: this.googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    })
      .then((r) => r.json())
      .catch(() => ({}))) as { access_token?: string };
    if (!tok.access_token) throw refuse('Google did not complete the sign-in.');

    const profile = (await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => r.json())
      .catch(() => ({}))) as { sub?: unknown; email?: unknown; email_verified?: unknown };
    if (
      typeof profile.sub !== 'string' ||
      typeof profile.email !== 'string' ||
      profile.email_verified !== true
    ) {
      throw refuse('Google did not confirm that email address.');
    }

    const row = (
      await this.db.query(
        `UPDATE users u SET google_sub = $1
         WHERE u.email = $2 AND (u.google_sub IS NULL OR u.google_sub = $1)
           AND u.status = 'active' AND NOT u.suspended AND NOT u.system
         RETURNING ${USER_COLS}`,
        [profile.sub, profile.email.trim().toLowerCase()],
      )
    ).rows[0];
    if (!row) {
      throw new DomainException(
        'No member account uses that Google address. Apply to join first, or sign in with your password.',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN_RESOURCE,
      );
    }
    return { token: await this.createSession(row.id), user: toUser(row) };
  }
}
