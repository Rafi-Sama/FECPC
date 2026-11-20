// Token and password helpers for member-area actions and the seed. Sign-in and sessions live in modules/auth.
import { createHash, randomBytes } from 'node:crypto';
import { PasswordHasher } from '../auth/password.ts';

export const sha = (v: string) => createHash('sha256').update(v).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const hashPassword = (pw: string) => PasswordHasher.hash(pw);
