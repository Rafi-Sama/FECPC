// Outgoing email through a queue in PostgreSQL, so a free Gmail account's limits are never exceeded:
// - `enqueue` writes the message in the caller's transaction (no email for a decision that rolled back);
// - `drainMail` sends due messages while fewer than MAIL_DAILY_LIMIT went out in the last 24 hours (Gmail
//   counts a rolling 24 h), pauses for an hour on a quota answer, retries temporary failures with backoff,
//   and drops messages that would arrive too late. It runs on a timer, after every action and at startup,
//   so a host that sleeps when idle only delays mail, never loses it.
import nodemailer, { type Transporter } from 'nodemailer';
import { can, checkMailTemplate, MAIL_SAMPLE, renderMail, type Role } from '@fecpc/contracts';
import { Fail, pool, tx, type Db } from './db.ts';
import { audit, type Handler } from './rules.ts';

/** Gmail's free limit is about 500 a day; the default leaves room for the account's everyday mail. */
export const mailLimit = () => {
  const n = Number(process.env.MAIL_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 400;
};
export const mailReady = () => !!process.env.SMTP_URL;
const PER_RUN = 20; // at most this many a minute; Gmail flags fast bursts from new senders
const BACKOFF_MIN = [5, 30, 120, 360, 720];

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

let transport: Transporter | null = null;
type Send = (m: { to: string; subject: string; html: string; text: string }) => Promise<void>;
const smtp: Send = async (m) => {
  transport ??= nodemailer.createTransport({
    url: process.env.SMTP_URL,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  } as never);
  await transport.sendMail({ from: process.env.MAIL_FROM, ...m });
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

let running = false;
/** Sends what is due, within the limits. Safe to call often and from several instances (`skip locked`). */
export async function drainMail(send: Send | null = mailReady() ? smtp : null) {
  if (!send || running) return;
  running = true;
  try {
    const db = pool();
    await db.query(
      `update mail_queue set status = 'failed', html = null, text_body = null,
         error = 'Not sent: it would have arrived too late (the link expired or the event started).'
       where status = 'queued' and expires_at < now()`,
    );
    await db.query(
      `delete from mail_queue where status <> 'queued' and created_at < now() - interval '30 days'`,
    );
    for (let n = 0; n < PER_RUN; n++) {
      const { today, lastmin } = (
        await db.query(
          `select count(*)::int today, count(*) filter (where sent_at > now() - interval '1 minute')::int lastmin
           from mail_queue where status = 'sent' and sent_at > now() - interval '24 hours'`,
        )
      ).rows[0];
      if (today >= mailLimit() || lastmin >= PER_RUN) break;
      const more = await tx(async (c) => {
        const m = (
          await c.query(
            `select id, to_email, subject, html, text_body, attempts from mail_queue
             where status = 'queued' and next_at <= now()
             order by expires_at nulls last, id limit 1 for update skip locked`,
          )
        ).rows[0];
        if (!m) return false;
        try {
          await send({ to: m.to_email, subject: m.subject, html: m.html, text: m.text_body });
          await c.query(
            `update mail_queue set status = 'sent', sent_at = now(), html = null, text_body = null, error = null where id = $1`,
            [m.id],
          );
          return true;
        } catch (e) {
          const f = classify(e);
          // Quota and outages are not this message's fault: they wait without using up its retries.
          const own = f.kind === 'perm' || f.kind === 'temp';
          const giveUp = f.kind === 'perm' || (own && m.attempts + 1 >= 6);
          const wait =
            f.kind === 'quota'
              ? 60
              : f.kind === 'down'
                ? 10
                : BACKOFF_MIN[Math.min(m.attempts, 4)]!;
          await c.query(
            `update mail_queue set attempts = attempts + $5, error = $2, status = $3, next_at = now() + make_interval(mins => $4) where id = $1`,
            [m.id, f.error, giveUp ? 'failed' : 'queued', wait, own ? 1 : 0],
          );
          if (!own)
            await c.query(
              `update mail_queue set next_at = greatest(next_at, now() + make_interval(mins => $1)) where status = 'queued'`,
              [wait],
            );
          return f.kind === 'perm' || f.kind === 'temp'; // quota or server down: stop this run
        }
      });
      if (!more) break;
    }
  } finally {
    running = false;
  }
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
  return {
    ready: mailReady(),
    limit: o.limit,
    sent: o.sent,
    queued: o.queued,
    problem: problem ?? null,
    failed,
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
  /** Puts failed mail back in the queue, except mail that would now arrive too late. */
  async mailRetry(c, a) {
    if (!sender(a.roles)) throw new Fail(403, 'Your role does not send club email.');
    const r = await c.query(
      `update mail_queue set status = 'queued', attempts = 0, error = null, next_at = now()
       where status = 'failed' and html is not null and (expires_at is null or expires_at > now())`,
    );
    await audit(c, a, `retried ${r.rowCount} failed email${r.rowCount === 1 ? '' : 's'}`);
    return r.rowCount
      ? `${r.rowCount} email${r.rowCount === 1 ? '' : 's'} back in the queue.`
      : 'Nothing to retry: the rest would arrive too late. Send those people a new link instead.';
  },
};
