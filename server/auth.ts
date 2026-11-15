// Passwords (scrypt), sessions and invites. No framework imports, so every function is testable against a plain database.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Fail, type Db } from "./db.ts";

const SESSION_DAYS = 30;
const kdf = (pw: string, salt: Buffer) => new Promise<Buffer>((ok, no) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
export const sha = (v: string) => createHash("sha256").update(v).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export function checkPassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 10 || pw.length > 200) throw new Fail(400, "Use a password of 10 to 200 characters.");
  return pw;
}
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await kdf(pw, salt)).toString("base64url")}`;
}
const DUMMY = `scrypt$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;
/** Constant work whether or not the account exists, so response time does not reveal which emails are members. */
export async function verifyPassword(pw: string, stored: string | null) {
  const [, salt, key] = (stored ?? DUMMY).split("$");
  const want = Buffer.from(key, "base64url"), got = await kdf(pw, Buffer.from(salt, "base64url"));
  return timingSafeEqual(want, got) && stored !== null;
}

export async function createSession(db: Db, userId: string) {
  const token = newToken();
  await db.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`, [sha(token), userId, SESSION_DAYS]);
  return { token, maxAge: SESSION_DAYS * 86400 };
}
/** The signed-in, non-suspended user for a cookie value, or null. One indexed lookup. */
export async function sessionUser(db: Db, token: string | undefined): Promise<string | null> {
  if (!token || token.length > 100) return null;
  const r = await db.query(`select u.id from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now() and not u.suspended`, [sha(token)]);
  return r.rows[0]?.id ?? null;
}
export const endSession = (db: Db, token: string | undefined) => (token ? db.query(`delete from sessions where token_hash = $1`, [sha(token)]) : Promise.resolve());

const email = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 200) : "");
// shortcut: counters live in this process; move to the database or a shared cache when there is more than one server.
const tries = new Map<string, { n: number; until: number }>();
export function throttle(key: string, max = 8, windowMs = 10 * 60_000, now = Date.now()) {
  const t = tries.get(key);
  if (t && t.until > now && t.n >= max) throw new Fail(429, "Too many attempts. Wait ten minutes and try again.");
  tries.set(key, t && t.until > now ? { n: t.n + 1, until: t.until } : { n: 1, until: now + windowMs });
  if (tries.size > 10_000) for (const [k, v] of tries) if (v.until <= now) tries.delete(k);
}

export async function login(db: Db, rawEmail: unknown, password: unknown, ip = "") {
  const em = email(rawEmail);
  // Two independent limits: per account (cannot be dodged by changing address) and, when a trusted proxy reports one, per address.
  throttle(`login:${em}`, 10);
  if (ip) throttle(`login-ip:${ip}`, 30);
  const u = (await db.query(`select id, pass_hash, suspended from users where email = $1`, [em])).rows[0];
  const ok = await verifyPassword(typeof password === "string" ? password.slice(0, 200) : "", u?.pass_hash ?? null);
  if (!ok) throw new Fail(401, "That email and password do not match.");
  if (u.suspended) throw new Fail(403, "This account is suspended. Talk to the President.");
  tries.delete(`login:${em}`);
  return createSession(db, u.id);
}
/** An invite link sets the first password, once. */
export async function acceptInvite(db: Db, token: unknown, password: unknown) {
  const pw = checkPassword(password);
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw new Fail(400, "This invite link is not valid.");
  const r = await db.query(`update users set pass_hash = $2, invite_hash = null, invite_expires = null where invite_hash = $1 and not suspended and (invite_expires is null or invite_expires > now()) returning id, name`, [sha(token), await hashPassword(pw)]);
  if (!r.rows[0]) throw new Fail(400, "This link has already been used, has expired, or has been replaced. Ask an officer for a new one.");
  await db.query(`delete from sessions where user_id = $1`, [r.rows[0].id]); // a reset signs out whoever was in
  await db.query(`insert into audit (who, what) values ($1, 'set a password with a one-time link')`, [r.rows[0].name]);
  return createSession(db, r.rows[0].id);
}
export async function changePassword(db: Db, userId: string, current: unknown, next: unknown) {
  const pw = checkPassword(next);
  const u = (await db.query(`select pass_hash from users where id = $1`, [userId])).rows[0];
  if (!(await verifyPassword(typeof current === "string" ? current.slice(0, 200) : "", u?.pass_hash ?? null))) throw new Fail(401, "Your current password is not right.");
  await db.query(`update users set pass_hash = $2 where id = $1`, [userId, await hashPassword(pw)]);
  await db.query(`insert into audit (who, what) select name, 'changed their password' from users where id = $1`, [userId]);
  await db.query(`delete from sessions where user_id = $1`, [userId]); // every device signs in again
  return createSession(db, userId);
}
/** Google sign-in: only for an email that already belongs to a member, and only if Google says it is verified. */
export async function loginWithGoogle(db: Db, profile: { sub?: unknown; email?: unknown; email_verified?: unknown }) {
  if (typeof profile.sub !== "string" || !profile.email_verified) throw new Fail(401, "Google did not confirm that email address.");
  const r = await db.query(`update users set google_sub = $1 where email = $2 and (google_sub is null or google_sub = $1) and not suspended returning id`, [profile.sub, email(profile.email)]);
  if (!r.rows[0]) throw new Fail(403, "No member account uses that Google address. Apply to join first, or sign in with your password.");
  return createSession(db, r.rows[0].id);
}
