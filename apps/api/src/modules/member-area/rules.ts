// What every member-area handler shares: who is acting, the raw input, and the checks and audit line around a write.
import type { Role } from '@fecpc/contracts';
import { Fail, type Db } from './db.ts';

/** The signed-in member running an action, as `act()` loaded them under a row lock. */
export type Actor = { id: string; role: Role; roles: Role[]; name: string; system: boolean };
/** A request body: untrusted until each field passes a check below or in the handler. */
export type In = Record<string, unknown>;
/**
 * One action. A string is a one-time notice for the member; an object is data for the caller (the `queries`
 * endpoints answer with it). `P` is the member's own progress, which `act()` saves when the handler changed it.
 */
export type Handler<P = unknown> = (c: Db, a: Actor, p: P, i: In) => Promise<unknown>;

/** A member's effective roles: their own role plus what their post grants. For queries on an unaliased `users`. */
export const ROLES = `array_prepend(role, coalesce((select pr.roles from post_roles pr where pr.post = users.post), '{}')) as roles`;

/** Refuses with 403 unless `ok`. */
export function need(ok: unknown, why = 'Your role cannot do that.'): asserts ok {
  if (!ok) throw new Fail(403, why);
}

/** One readable line in the admin panel's audit log, in the action's transaction. */
export const audit = (c: Db, a: Pick<Actor, 'name'>, what: string) =>
  c.query(`insert into audit (who, what) values ($1, $2)`, [a.name, what]);

/** A positive database id. */
export const posInt = (v: unknown, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) throw new Fail(400, `Invalid ${what}.`);
  return n;
};

/** One of a fixed set of values. */
export const pick = <T extends string>(v: unknown, from: readonly T[], what: string): T => {
  if (!from.includes(v as T)) throw new Fail(400, `Unknown ${what}.`);
  return v as T;
};

/** An account counts as joined once it can sign in: a password, or a linked Google or GitHub account. */
export const JOINED = () =>
  `(pass_hash is not null or google_sub is not null or github_id is not null)`;
