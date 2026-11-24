import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import dotenv from 'dotenv';

// Real environment variables win; then apps/api/.env.local, then the repo-root .env.local (scripts run in apps/api).
dotenv.config({ path: ['.env.local', '../../.env.local'], quiet: true });

export const EnvSchema = z.object({
  /** local | ci | staging | production. Anything but local gets Secure, `__Host-` cookies. */
  APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().int().default(3001),
  HOST: z.string().default('0.0.0.0'),
  /** The web app's public origin; Google's default redirect URI is built from it. */
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  /** Origins allowed by CORS and by the CSRF check (comma-separated). */
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  /** Proxy hops in front of the API whose X-Forwarded-For is trusted. */
  TRUST_PROXY: z.string().default('1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().positive().default(300),

  DATABASE_URL: z.string().min(1).default('postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'),
  // Each serverless instance has its own pool, so a free database's connection limit is shared among many.
  DB_POOL_MAX: z.coerce
    .number()
    .int()
    .positive()
    .default(process.env.VERCEL ? 5 : 20),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  DB_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_IDLE_TX_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  SESSION_IDLE_DAYS: z.coerce.number().int().positive().default(14),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().positive().default(60),
  SESSION_MAX_PER_USER: z.coerce.number().int().positive().default(10),
  SESSION_COOKIE_NAME: z.string().default('__Host-fecpc_session'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  /** Optional GitHub sign-in (OAuth app; callback APP_PUBLIC_URL/api/auth/github/callback). */
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  /** Optional SMTP for acceptance emails, e.g. smtps://user:app-password@smtp.gmail.com:465. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  /**
   * Set where the API has a public address (Vercel): every request except health and cron must carry it in
   * X-Proxy-Secret, which only the web app knows (its API_PROXY_SECRET). At least 32 characters.
   */
  API_PROXY_SECRET: z.string().min(32).optional(),
  /** Bearer token for GET /v1/cron (weekly sheet, mail queue). Vercel Cron sends it as CRON_SECRET. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Optional Cloudflare Turnstile secret; when set, the join form must pass the human check. */
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

@Injectable()
export class ConfigService {
  readonly env: EnvConfig;

  constructor() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('Invalid environment configuration:\n', parsed.error.format());
      process.exit(1);
    }
    this.env = parsed.data;
  }

  /** Fastify's trustProxy as a hop count: only that many proxies may set the client address. */
  get trustProxy(): (address: string, hop: number) => boolean {
    const hops = /^\d+$/.test(this.env.TRUST_PROXY.trim()) ? Number(this.env.TRUST_PROXY) : 0;
    return (_address, hop) => hop < hops;
  }

  /** `__Host-` needs HTTPS, so local development uses a plain name. */
  get sessionCookieName(): string {
    return this.env.APP_ENV === 'local' ? 'fecpc_session' : this.env.SESSION_COOKIE_NAME;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS.split(',').map((o) => o.trim());
  }
}
