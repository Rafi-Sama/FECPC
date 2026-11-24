// Outgoing email through a queue in PostgreSQL, so free mail accounts' limits are never exceeded:
// - `enqueue` writes the message in the caller's transaction (no email for a decision that rolled back);
// - `drainMail` sends due messages through one or more accounts (SMTP_URL lists them), each within its own
//   daily limit (a rolling 24 h, the way Gmail counts) and per-minute pace, pauses an account on a quota or login
//   answer, retries temporary failures with backoff and drops messages that would arrive too late;
// - `mailInBackground` runs it after an action or a cron call. On a serverless host one run keeps sending for up
//   to four minutes, then hands over to a fresh run while mail is due, so a large mailing needs no server.
import nodemailer, { type Transporter } from 'nodemailer';
import { can, checkMailTemplate, MAIL_SAMPLE, renderMail, type Role } from '@fecpc/contracts';
import { Fail, pool, tx, type Db } from './db.ts';
import { audit, type Handler } from './rules.ts';
import { waitUntil } from '@vercel/functions';

/** Gmail's free limit is about 500 a day; the default leaves room for the account's everyday mail. */
const defaultDaily = () => {
  const n = Number(process.env.MAIL_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 400;
};
const BACKOFF_MIN = [5, 30, 120, 360, 720];
const RUN_MS = 240_000; // one serverless run; the function may live 300 s

/**
 * A sending account. SMTP_URL holds one or more URLs separated by spaces, each with optional query parameters
 * `daily` (limit per rolling 24 h; default MAIL_DAILY_LIMIT), `per_minute` (default 20: Gmail flags fast bursts
 * from new senders) and `from` (default MAIL_FROM). Several free accounts add up their limits.
 */
export type Account = { key: string; url: string; from?: string; daily: number; perMinute: number };
export function mailAccounts(list = process.env.SMTP_URL ?? ''): Account[] {
  return list
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const u = new URL(raw);
      const take = (k: string) => {
        const v = u.searchParams.get(k);
        u.searchParams.delete(k);
        return v;
      };
      const num = (k: string, d: number) => {
        const n = Number(take(k));
        return Number.isInteger(n) && n > 0 ? n : d;
      };
      const daily = num('daily', defaultDaily()),
        perMinute = num('per_minute', 20),
        from = take('from') ?? process.env.MAIL_FROM;
      return {
        key: `${decodeURIComponent(u.username)}@${u.host}`,
        url: u.toString(),
        from,
        daily,
        perMinute,
      };
    });
}
/** Everything all accounts may send in 24 hours. */
export const mailLimit = () => mailAccounts().reduce((n, a) => n + a.daily, 0) || defaultDaily();
export const mailReady = () => mailAccounts().length > 0;

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  expires?: Date | string | null;
};

export async function enqueue(c: Db, m: Mail) {
  await c.query(
    `insert into mail_queue (to_email, subject, html, text_body, kind, expires_at) values ($1, $2, $3, $4, $5, $6)`,
    [m.to, m.subject, m.html, m.text, m.kind, m.expires ?? null],
  );
}

/** How the queue stands, and roughly when a message added now would go out (hours; 0 = within minutes). */
export async function mailOutlook(c: Db) {
  const r = (
    await c.query(
      `select (select count(*)::int from mail_queue where status = 'sent' and sent_at > now() - interval '24 hours') sent,
              (select count(*)::int from mail_queue where status = 'queued') queued`,
    )
  ).rows[0] as { sent: number; queued: number };
  const free = mailLimit() - r.sent;
  // Queued mail goes first; whatever does not fit today waits for the window to roll over, a day per limit.
  const waitHours = (ahead: number) =>
    ahead < free ? 0 : 24 * Math.ceil((ahead - free + 1) / mailLimit());
  return { ...r, limit: mailLimit(), waitHours };
}

const transports = new Map<string, Transporter>();
type Send = (
  m: { to: string; subject: string; html: string; text: string },
  account: Account,
) => Promise<void>;
const smtp: Send = async (m, account) => {
  let t = transports.get(account.key);
  if (!t)
    transports.set(
      account.key,
      (t = nodemailer.createTransport({
        url: account.url,
        pool: true, // one connection for a whole run instead of a TLS handshake per message
        maxConnections: 1,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      } as never)),
    );
  await t.sendMail({ from: account.from, ...m });
};

/** What to do after a failed send: wait out the quota, retry later, or give up on this one message. */
export function classify(e: unknown): { kind: 'quota' | 'down' | 'temp' | 'perm'; error: string } {
  const err = e as { responseCode?: number; code?: string; message?: string };
  const msg = String(err?.message ?? e).slice(0, 300);
  if (/5\.4\.5|4\.7\.28|quota|limit exceeded|too many (messages|emails)|rate limit/i.test(msg))
    return { kind: 'quota', error: `The mail account's sending limit was reached: ${msg}` };
  // A rejected login fails every message the same way: stop and keep them all queued, not failed.
  if (err?.code === 'EAUTH' || err?.responseCode === 534 || err?.responseCode === 535)
    return {
      kind: 'down',
      error: `The mail server rejected the login. For Gmail, SMTP_URL needs an app password: ${msg}`,
    };
  if (!err?.responseCode)
    return {
      kind: 'down',
      error: `Could not reach the mail server (${err?.code ?? 'no answer'}). Check SMTP_URL; some hosts block SMTP ports.`,
    };
  if (err.responseCode >= 500) return { kind: 'perm', error: msg };
  return { kind: 'temp', error: msg };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends what is due, within every account's limits. Only one run sends at a time, across all instances (a lease
 * row); a second caller returns at once. With `budgetMs`, it keeps going until then, waiting out the per-minute
 * pace between batches. Returns true when due mail is left that only the pace held back (worth another run).
 */
export async function drainMail(send: Send | null = mailReady() ? smtp : null, budgetMs = 0) {
  const accounts = mailAccounts();
  if (!send || !accounts.length) return false;
  const db = pool();
  const lease = await db.query(
    `insert into mail_runner (id, until) values (1, now() + make_interval(secs => $1))
     on conflict (id) do update set until = excluded.until where mail_runner.until < now() returning id`,
    [budgetMs / 1000 + 120],
  );
  if (!lease.rowCount) return false;
  const end = Date.now() + budgetMs;
  try {
    await db.query(
      `update mail_queue set status = 'failed', html = null, text_body = null,
         error = 'Not sent: it would have arrived too late (the link expired or the event started).'
       where status = 'queued' and expires_at < now()`,
    );
    await db.query(
      `delete from mail_queue where status <> 'queued' and created_at < now() - interval '30 days'`,
    );
    for (;;) {
      if (budgetMs && Date.now() > end) return dueNow(db);
      // Each account's use: sent in 24 h and in the last minute (mail from before accounts were tracked counts
      // for the first one), when its oldest send of the last minute leaves the window, and any pause.
      const use = new Map(
        (
          await db.query(
            `select a.key, coalesce(s.today, 0) today, coalesce(s.lastmin, 0) lastmin, coalesce(s.free_in, 0) free_in,
                    p.until > now() paused
             from unnest($1::text[]) a(key)
             left join (
               select coalesce(via, $2) via, count(*)::int today,
                      count(*) filter (where sent_at > now() - interval '1 minute')::int lastmin,
                      extract(epoch from min(sent_at) filter (where sent_at > now() - interval '1 minute')
                        + interval '61 seconds' - now())::float free_in
               from mail_queue where status = 'sent' and sent_at > now() - interval '24 hours'
               group by 1) s on s.via = a.key
             left join mail_pause p on p.via = a.key`,
            [accounts.map((a) => a.key), accounts[0]!.key],
          )
        ).rows.map((r) => [r.key as string, r]),
      );
      const open = accounts.filter((a) => {
        const u = use.get(a.key)!;
        return !u.paused && u.today < a.daily;
      });
      // The account with the most room this minute sends next, so a mailing is spread across all of them.
      const room = (a: Account) => a.perMinute - use.get(a.key)!.lastmin;
      const next = open.filter((a) => room(a) > 0).sort((x, y) => room(y) - room(x))[0];
      if (!next) {
        if (!open.length) return false; // every account is paused or used up for today
        const wait = Math.max(1, Math.min(...open.map((a) => use.get(a.key)!.free_in))) * 1000;
        if (Date.now() + wait > end) return dueNow(db);
        await sleep(wait);
        continue;
      }
      const sent = await sendOne(send, next, accounts.length);
      if (sent === 'empty') return false;
    }
  } finally {
    await db.query(`update mail_runner set until = now() - interval '1 second'`);
  }
}

const dueNow = async (db: Db) =>
  !!(
    await db.query(`select 1 from mail_queue where status = 'queued' and next_at <= now() limit 1`)
  ).rowCount;

/** Sends the next due message through `account`. A quota or login answer pauses that account, not the message. */
async function sendOne(send: Send, account: Account, accounts: number) {
  return tx(async (c) => {
    const m = (
      await c.query(
        `select id, to_email, subject, html, text_body, attempts from mail_queue
         where status = 'queued' and next_at <= now()
         order by expires_at nulls last, id limit 1 for update skip locked`,
      )
    ).rows[0];
    if (!m) return 'empty' as const;
    try {
      await send({ to: m.to_email, subject: m.subject, html: m.html, text: m.text_body }, account);
      await c.query(
        `update mail_queue set status = 'sent', sent_at = now(), via = $2, html = null, text_body = null, error = null where id = $1`,
        [m.id, account.key],
      );
      return 'sent' as const;
    } catch (e) {
      const f = classify(e);
      // Quota and outages are not this message's fault: it waits without using up its retries.
      const own = f.kind === 'perm' || f.kind === 'temp';
      const giveUp = f.kind === 'perm' || (own && m.attempts + 1 >= 6);
      const wait =
        f.kind === 'quota' ? 60 : f.kind === 'down' ? 10 : BACKOFF_MIN[Math.min(m.attempts, 4)]!;
      await c.query(
        `update mail_queue set attempts = attempts + $5, error = $2, status = $3,
           next_at = case when $5 = 1 then now() + make_interval(mins => $4) else next_at end where id = $1`,
        [m.id, f.error, giveUp ? 'failed' : 'queued', wait, own ? 1 : 0],
      );
      if (!own) {
        await c.query(
          `insert into mail_pause (via, until, error) values ($1, now() + make_interval(mins => $2), $3)
           on conflict (via) do update set until = excluded.until, error = excluded.error`,
          [account.key, wait, f.error],
        );
        // With every account paused, the whole queue waits for the first to come back.
        const paused = (
          await c.query(
            `select min(until) until, count(*)::int n from mail_pause where until > now()`,
          )
        ).rows[0];
        if (paused.n >= accounts)
          await c.query(
            `update mail_queue set next_at = greatest(next_at, $1) where status = 'queued'`,
            [paused.until],
          );
      }
      return 'failed' as const;
    }
  });
}

/**
 * Sends after the response. On a long-running server one pass is enough (a timer runs every minute). On Vercel
 * the function stays alive for one run (`waitUntil`), and while due mail is left it asks GET /api/cron for the next
 * run, so a mailing of any size goes out at the accounts' pace until their daily limits are reached.
 */
export function mailInBackground() {
  const serverless = !!process.env.VERCEL;
  waitUntil(
    drainMail(undefined, serverless ? RUN_MS : 0)
      .then(async (more) => {
        const site = process.env.APP_PUBLIC_URL,
          secret = process.env.CRON_SECRET;
        if (more && serverless && site && secret)
          await fetch(`${site}/api/cron`, {
            headers: { authorization: `Bearer ${secret}` },
            signal: AbortSignal.timeout(10_000),
          });
      })
      .catch(() => {}),
  );
}

/** For officers: how much was sent, what waits, what failed (and why). */
export async function mailStatus(db: Db) {
  const o = await mailOutlook(db);
  const failed = (
    await db.query(
      `select id::text, to_email "to", subject, error, created_at at from mail_queue where status = 'failed' order by id desc limit 20`,
    )
  ).rows;
  const problem = (
    await db.query(
      `select error from mail_queue where status = 'queued' and error is not null order by id desc limit 1`,
    )
  ).rows[0]?.error as string | undefined;
  const paused = (
    await db.query(
      `select via account, until, error from mail_pause where until > now() order by until`,
    )
  ).rows;
  return {
    ready: mailReady(),
    limit: o.limit,
    sent: o.sent,
    queued: o.queued,
    problem: problem ?? null,
    failed,
    paused,
  };
}

const sender = (roles: Role[]) => can(roles, 'application.approve') || can(roles, 'event.publish');

export const mailHandlers: Record<string, Handler> = {
  /** Sends the template being edited, filled with sample values, to the officer's own address. */
  async mailTest(c, a, _p, i) {
    if (!sender(a.roles)) throw new Fail(403, 'Your role does not send club email.');
    if (!mailReady()) throw new Fail(409, 'Email is not set up on the server (SMTP_URL).');
    const kind = i.kind === 'event' ? 'event' : 'recruit';
    const t = checkMailTemplate(kind, { subject: i.subject, html: i.html });
    if (t.error) throw new Fail(400, t.error);
    const me = (await c.query(`select email from users where id = $1`, [a.id])).rows[0].email;
    const m = renderMail(t.value, MAIL_SAMPLE[kind]);
    await enqueue(c, { to: me, kind: 'test', ...m, subject: `[Test] ${m.subject}` });
    const o = await mailOutlook(c);
    const wait = o.waitHours(o.queued - 1);
    return wait
      ? `Test queued for ${me}, but today's email limit is used up: it goes out in about ${wait} h.`
      : `Test sent to ${me}. It counts toward the daily limit of ${o.limit}.`;
  },
  /**
   * Sends again now: wakes accounts paused by a quota or login answer (the officer may have fixed them), makes
   * waiting mail due, and puts failed mail back in the queue, except mail that would now arrive too late.
   */
  async mailRetry(c, a) {
    if (!sender(a.roles)) throw new Fail(403, 'Your role does not send club email.');
    const woke = (await c.query(`delete from mail_pause where until > now()`)).rowCount ?? 0;
    await c.query(
      `update mail_queue set next_at = now() where status = 'queued' and next_at > now()`,
    );
    const r = await c.query(
      `update mail_queue set status = 'queued', attempts = 0, error = null, next_at = now()
       where status = 'failed' and html is not null and (expires_at is null or expires_at > now())`,
    );
    await audit(
      c,
      a,
      `retried email: ${r.rowCount} failed, ${woke} paused account${woke === 1 ? '' : 's'}`,
    );
    if (r.rowCount) return `${r.rowCount} email${r.rowCount === 1 ? '' : 's'} back in the queue.`;
    if (woke) return 'Sending again now.';
    return 'Nothing to retry: the rest would arrive too late. Send those people a new link instead.';
  },
};
