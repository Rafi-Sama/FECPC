// Token and password helpers for member-area actions and the seed. Sign-in and sessions live in modules/auth.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from '../auth/password.ts';

export const sha = (v: string) => createHash('sha256').update(v).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const hashPassword = (pw: string) => PasswordHasher.hash(pw);

/** Constant-time comparison of a request header with a secret. */
export function sameSecret(got: unknown, secret: string): boolean {
  if (typeof got !== 'string') return false;
  const [a, b] = [Buffer.from(got), Buffer.from(secret)];
  return a.length === b.length && timingSafeEqual(a, b);
}
