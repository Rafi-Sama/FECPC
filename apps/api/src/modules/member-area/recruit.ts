// Recruitment: officers with `application.approve` open a link per intake (`recruit*` actions); anyone with the
// link applies while it is open (`apply`, public). Every field is checked with the same rules the form uses.
import { randomBytes } from 'node:crypto';
import {
  can,
  checkApplicant,
  checkForm,
  checkMailTemplate,
  DEFAULT_MAIL,
  MAIL_CLUB,
  RECRUIT,
  renderMail,
  type RecruitForm,
  type RecruitPublic,
} from '@fecpc/contracts';
import { Fail, tx, type Db } from './db.ts';
import { audit, need, ROLES, type Actor, type Handler, type In } from './rules.ts';
import { TZ } from './state.ts';
import { enqueue, mailOutlook, mailReady } from './mail.ts';
import { newToken, sha } from './tokens.ts';

const TOKEN = /^[A-Za-z0-9_-]{16}$/;
const CSV_FORM: RecruitForm = { cf: true, why: false, questions: [] };

const RECRUITERS = 'Only the President and Secretary run recruitment.';
const firstError = (e: Record<string, string>) => Object.values(e)[0];
const day = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });

const title = (v: unknown) => {
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (t.length < 3 || t.length > 80) throw new Fail(400, 'The title must be 3 to 80 characters.');
  return t;
};
const reasonOf = (v: unknown) => {
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (t && (t.length < 3 || t.length > 200))
    throw new Fail(400, 'The reason must be 3 to 200 characters.');
  return t || null;
};
const batchOf = (v: unknown) => {
  const n = Number(v);
  if (v === '' || !Number.isInteger(n) || n < 0 || n > 99)
    throw new Fail(400, 'Batch is a number from 0 to 99, like 27.');
  return n;
};
/** A closing time in the future, at most RECRUIT.maxDays away. ISO with a zone, so the server never guesses one. */
const closesAt = (v: unknown) => {
  const s = String(v ?? '');
  const t = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s)
    ? Date.parse(s)
    : NaN;
  if (!Number.isFinite(t)) throw new Fail(400, 'Pick when the link closes.');
  if (t < Date.now() + 60_000) throw new Fail(400, 'The closing time must be in the future.');
  if (t > Date.now() + RECRUIT.maxDays * 864e5)
    throw new Fail(400, `A link can stay open for at most ${RECRUIT.maxDays} days.`);
  return new Date(t).toISOString();
};
const form = (v: unknown) => {
  const f = checkForm(v);
  if (f.error) throw new Fail(400, f.error);
  return f.value;
};
const linkFor = async (c: Db, id: unknown) => {
  const n = Number(id);
  const l = Number.isInteger(n)
    ? (
        await c.query(
          `select id, title, batch, closes_at, (select count(*)::int from applications where link_id = l.id) as n
           from recruit_links l where id = $1 for update`,
          [n],
        )
      ).rows[0]
    : null;
  if (!l) throw new Fail(404, 'That recruitment link does not exist.');
  return l as { id: number; title: string; batch: number; closes_at: Date; n: number };
};

type Decided = { name: string; email: string; token?: string; mailed?: boolean };

/**
 * Decides one pending application and writes a full audit line. Returns null, changing nothing, when it is no
 * longer pending or (to accept) a member already uses its email, so bulk decisions can skip those.
 * Accepting creates the account with the applicant's photo and emails the one-time set-password link.
 */
export async function decideApplication(
  c: Db,
  a: Actor,
  id: number,
  to: 'accepted' | 'declined',
  reason: string | null,
): Promise<Decided | null> {
  const app = (
    await c.query(
      `select x.name, x.email, x.dept, x.batch, x.cf, x.sid, x.phone, x.photo, l.title as via, l.mail_subject, l.mail_html
       from applications x left join recruit_links l on l.id = x.link_id
       where x.id = $1 and x.status = 'pending' for update of x`,
      [id],
    )
  ).rows[0];
  if (!app) return null;
  if (
    to === 'accepted' &&
    (await c.query(`select 1 from users where email = $1`, [app.email])).rowCount
  )
    return null;
  await c.query(
    `update applications set status = $2, decline_reason = $3, decided_by = $4, decided_at = now() where id = $1`,
    [id, to, reason, a.id],
  );
  const who = `${app.name} (ID ${app.sid}, ${app.dept} batch ${app.batch}${app.via ? `, from "${app.via}"` : ''})`;
  if (to === 'declined') {
    await audit(
      c,
      a,
      `rejected applicant ${who}${reason ? `. Reason: ${reason}` : '. No reason given'}`,
    );
    return { name: app.name, email: app.email };
  }
  const slug =
      app.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30) || 'member',
    token = newToken();
  await c.query(
    `insert into users (id, email, invite_hash, invite_expires, name, handle, batch, dept, avatar_url, student_id, phone)
     select $1 || case when exists (select 1 from users where id = $1) then '_' || $2 else '' end, $3, $4, now() + interval '7 days', $5, $6, $7, $8, $9, $10, $11`,
    [
      slug,
      String(id),
      app.email,
      sha(token),
      app.name,
      app.cf,
      app.batch,
      app.dept,
      app.photo,
      app.sid,
      app.phone || null,
    ],
  );
  const mailed = mailReady();
  if (mailed) {
    const site = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    const t = app.mail_html
      ? { subject: app.mail_subject, html: app.mail_html }
      : DEFAULT_MAIL.recruit;
    await enqueue(c, {
      to: app.email,
      kind: 'recruit',
      expires: new Date(Date.now() + 7 * 864e5), // the link inside dies then
      ...renderMail(t, {
        name: app.name,
        link: `${site}/login?invite=${token}`,
        email: app.email,
        batch: String(app.batch),
        dept: app.dept,
        sid: app.sid,
        recruitment: app.via ?? 'membership',
        club: MAIL_CLUB,
      }),
    });
  }
  await audit(
    c,
    a,
    `accepted applicant ${who}; account created, set-password ${mailed ? 'email queued' : 'link shown to the officer (email not set up)'}`,
  );
  return { name: app.name, email: app.email, token, mailed };
}

/**
 * What the officer is told after accepting: who gets an email and when, and any links they must pass on by
 * hand (email not set up, or today's sending limit already used so the email waits).
 */
export async function inviteNotice(c: Db, done: Decided[]): Promise<string> {
  const o = await mailOutlook(c);
  const wait = o.waitHours(o.queued - 1); // the last of these is the last in the queue
  const late = wait > 0;
  const mailed = done.filter((d) => d.mailed),
    manual = done.filter((d) => !d.mailed || late);
  const one = done.length === 1 ? done[0]! : null;
  const lines = [
    one ? `Account created for ${one.name}.` : `${done.length} accounts created.`,
    mailed.length && !late
      ? one
        ? `Their set-password email is on its way to ${one.email}.`
        : 'Set-password emails are on their way.'
      : '',
    mailed.length && late
      ? `Today's email limit (${o.limit} a day) is used up, so ${one ? 'their email waits' : 'the emails wait'} in the queue, about ${wait} h. If it is urgent, send ${one ? 'this link' : 'these links'} yourself; each works once and expires in 7 days:`
      : '',
    !mailed.length
      ? `Email is not set up, so send ${one ? 'them this link' : 'these links'} to set a password. Each works once and expires in 7 days:`
      : '',
    ...manual.map((d) =>
      manual.length === 1 ? `/login?invite=${d.token}` : `${d.name}: /login?invite=${d.token}`,
    ),
  ];
  return lines.filter(Boolean).join(manual.length > 1 ? '\n' : ' ');
}

export const recruitHandlers: Record<string, Handler> = {
  async recruitCreate(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const t = title(i.title),
      b = batchOf(i.batch),
      closes = closesAt(i.closes);
    await c.query(
      // A new recruitment starts with the latest designed email, so the club designs it once.
      `insert into recruit_links (token, title, batch, form, closes_at, by, mail_subject, mail_html)
       select $1, $2, $3, $4, $5, $6, m.mail_subject, m.mail_html
       from (select null) x left join lateral (select mail_subject, mail_html from recruit_links where mail_html is not null order by id desc limit 1) m on true`,
      [randomBytes(12).toString('base64url'), t, b, JSON.stringify(form(i.form)), closes, a.id],
    );
    await audit(c, a, `opened recruitment link "${t}" for batch ${b}, closing ${day(closes)}`);
  },

  async recruitUpdate(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const l = await linkFor(c, i.id),
      t = title(i.title),
      b = batchOf(i.batch),
      closes = closesAt(i.closes);
    if (b !== l.batch && l.n)
      throw new Fail(
        409,
        'The batch is locked once people have applied. Open a new link for another batch.',
      );
    await c.query(
      `update recruit_links set title = $2, batch = $3, form = $4, closes_at = $5 where id = $1`,
      [l.id, t, b, JSON.stringify(form(i.form)), closes],
    );
    await audit(
      c,
      a,
      `edited recruitment link "${t}" (batch ${b}), ${l.closes_at < new Date() ? 'reopened' : 'open'} until ${day(closes)}`,
    );
  },

  async recruitClose(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const l = await linkFor(c, i.id);
    if (l.closes_at <= new Date()) throw new Fail(409, 'That link is already closed.');
    await c.query(`update recruit_links set closes_at = now() where id = $1`, [l.id]);
    await audit(c, a, `closed recruitment link "${l.title}" early`);
  },

  /** Accept or reject up to 100 pending applicants at once. Already-decided ones are skipped, never re-decided. */
  async recruitDecide(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const to = i.to === 'accepted' || i.to === 'declined' ? i.to : null;
    if (!to) throw new Fail(400, 'Unknown decision.');
    const ids = [...new Set(Array.isArray(i.ids) ? i.ids.map(String) : [])];
    if (!ids.length || ids.length > 100 || !ids.every((x) => /^\d{1,9}$/.test(x)))
      throw new Fail(400, 'Pick 1 to 100 applicants.');
    const reason = to === 'declined' ? reasonOf(i.reason) : null;
    const done: Decided[] = [];
    for (const id of ids) {
      const d = await decideApplication(c, a, +id, to, reason);
      if (d) done.push(d);
    }
    const skipped = ids.length - done.length;
    const tail = skipped
      ? ` ${skipped} skipped: already decided${to === 'accepted' ? ' or their email is already a member' : ''}.`
      : '';
    if (!done.length) throw new Fail(409, `Nothing changed.${tail}`);
    return to === 'accepted'
      ? (await inviteNotice(c, done)) + tail
      : `Rejected ${done.length} applicant${done.length === 1 ? '' : 's'}.${tail}`;
  },

  /** Deletes a link. Its pending and rejected applicants go with it; accepted ones stay as the members' record. */
  async recruitDelete(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const l = await linkFor(c, i.id);
    const gone = (
      await c.query(
        `delete from applications where link_id = $1 and status <> 'accepted' returning status`,
        [l.id],
      )
    ).rows as { status: string }[];
    const kept = (
      await c.query(`update applications set link_id = null where link_id = $1`, [l.id])
    ).rowCount!;
    await c.query(`delete from recruit_links where id = $1`, [l.id]);
    const n = (s: string) => gone.filter((g) => g.status === s).length;
    await audit(
      c,
      a,
      `deleted recruitment link "${l.title}" (batch ${l.batch}) with ${n('pending')} pending and ${n('declined')} rejected applicants${kept ? `; ${kept} accepted kept under earlier applications` : ''}`,
    );
  },

  /** Saves this recruitment's acceptance email; an empty body goes back to the built-in design. */
  async recruitMail(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const l = await linkFor(c, i.id);
    if (!i.html) {
      await c.query(
        `update recruit_links set mail_subject = null, mail_html = null where id = $1`,
        [l.id],
      );
      return void (await audit(
        c,
        a,
        `reset the acceptance email of "${l.title}" to the built-in design`,
      ));
    }
    const t = checkMailTemplate('recruit', { subject: i.subject, html: i.html });
    if (t.error) throw new Fail(400, t.error);
    await c.query(`update recruit_links set mail_subject = $2, mail_html = $3 where id = $1`, [
      l.id,
      t.value.subject,
      t.value.html,
    ]);
    await audit(c, a, `edited the acceptance email of "${l.title}"`);
  },

  /** Rows from an officer's CSV become pending applicants, reviewed like any other. One insert, deduplicated. */
  async recruitImport(c, a, _p, i) {
    need(can(a.roles, 'application.approve'), RECRUITERS);
    const l = await linkFor(c, i.id),
      rows = Array.isArray(i.rows) ? i.rows : [];
    if (!rows.length || rows.length > RECRUIT.importRows)
      throw new Fail(400, `Import 1 to ${RECRUIT.importRows} rows at a time.`);
    const byEmail = new Map<string, ReturnType<typeof checkApplicant>['value']>();
    rows.forEach((r, n) => {
      const x = checkApplicant((r ?? {}) as In, CSV_FORM, { photo: false }),
        err = firstError(x.errors);
      if (err) throw new Fail(400, `Row ${n + 1}: ${err}`);
      if (!byEmail.has(x.value.email)) byEmail.set(x.value.email, x.value);
    });
    const v = [...byEmail.values()];
    const added = (
      await c.query(
        `insert into applications (name, sid, dept, batch, email, phone, cf, track, why, src, link_id)
         select r.name, r.sid, r.dept, $7, r.email, r.phone, r.cf, '', '', 'CSV import', $8
         from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) as r(name, sid, dept, email, phone, cf)
         where not exists (select 1 from users u where u.email = r.email)
         on conflict do nothing returning id`,
        [
          v.map((x) => x.name),
          v.map((x) => x.sid),
          v.map((x) => x.dept),
          v.map((x) => x.email),
          v.map((x) => x.phone),
          v.map((x) => x.cf),
          l.batch,
          l.id,
        ],
      )
    ).rowCount!;
    const skipped = rows.length - added;
    await audit(
      c,
      a,
      `imported ${added} applicant${added === 1 ? '' : 's'} from a CSV into "${l.title}" (batch ${l.batch}), pending review${skipped ? `; skipped ${skipped} (repeated, already applied or already members)` : ''}`,
    );
    return `${added} applicant${added === 1 ? '' : 's'} added for review.${skipped ? ` ${skipped} skipped: repeated in the file, already applied or already members.` : ''}`;
  },
};

/** The public view of an open or closed link; null for an unknown token. */
export async function recruitPublic(db: Db, token: string): Promise<RecruitPublic | null> {
  if (!TOKEN.test(token)) return null;
  const r = (
    await db.query(
      `select title, batch, form, closes_at as closes, closes_at > now() as open from recruit_links where token = $1`,
      [token],
    )
  ).rows[0];
  return r ? { ...r, form: checkForm(r.form).value } : null;
}

/** The applicant's photo, for officers who review applications. */
export async function applicantPhoto(db: Db, userId: string, id: string) {
  const u = (
    await db.query(
      `select ${ROLES}
       from users where id = $1 and not suspended`,
      [userId],
    )
  ).rows[0];
  need(u && can(u.roles, 'application.approve'), 'Your role cannot review applications.');
  const p = /^\d{1,9}$/.test(id)
    ? (await db.query(`select photo from applications where id = $1`, [+id])).rows[0]?.photo
    : null;
  const m = typeof p === 'string' ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(p) : null;
  if (!m) throw new Fail(404, 'No photo.');
  return { type: m[1]!, body: Buffer.from(m[2]!, 'base64') };
}

// A whole lab on one campus address may apply together, so this is a ceiling for bots, not for people.
const APPLY_PER_IP_PER_HOUR = 10;

/** Cloudflare Turnstile: the token the widget put in the form must verify with our secret. */
async function humanCheck(token: unknown, ip: string): Promise<boolean> {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const r = (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      ...(ip && { remoteip: ip }),
    }),
  })
    .then((res) => res.json())
    .catch(() => ({}))) as { success?: boolean };
  return r.success === true;
}

/** The public form behind a recruitment link. Anyone can call it, so it is strict about what it accepts. */
export async function apply(db: Db, i: In, ip = '') {
  if (i.website) return; // honeypot: hidden from people, so only bots fill it; they get a fake success
  const token = typeof i.token === 'string' && TOKEN.test(i.token) ? i.token : '';
  const l = token
    ? (
        await db.query(
          `select id, batch, form, closes_at > now() as open from recruit_links where token = $1`,
          [token],
        )
      ).rows[0]
    : null;
  if (!l) throw new Fail(404, 'This recruitment link does not exist.');
  if (!l.open) throw new Fail(410, 'This recruitment form has closed.');
  const { value: v, errors } = checkApplicant(i, checkForm(l.form).value);
  const err = firstError(errors);
  if (err) throw new Fail(400, err);
  if (process.env.TURNSTILE_SECRET_KEY && !(await humanCheck(i['cf-turnstile-response'], ip)))
    throw new Fail(400, 'The human check failed. Complete it and submit again.');
  const ipHash = sha(ip);
  // One network's applications are counted and written one at a time, so parallel posts cannot all pass the count.
  await tx(async (db) => {
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`, [ipHash]);
    const recent = (
      await db.query(
        `select count(*)::int as n from applications where ip_hash = $1 and created_at > now() - interval '1 hour'`,
        [ipHash],
      )
    ).rows[0].n;
    if (recent >= APPLY_PER_IP_PER_HOUR)
      throw new Fail(429, 'Too many applications from this network. Try again in an hour.');
    const r = await db.query(
      `insert into applications (name, sid, dept, batch, email, phone, photo, cf, track, why, answers, link_id, src, ip_hash)
     select $1, $2, $3, $4, $5, $6, $7, $8, '', $9, $10, $11, 'Recruitment link', $12
     where not exists (select 1 from users where email = $5)
     on conflict do nothing`,
      [
        v.name,
        v.sid,
        v.dept,
        l.batch,
        v.email,
        v.phone,
        v.photo,
        v.cf,
        v.why,
        JSON.stringify(v.answers),
        l.id,
        ipHash,
      ],
    );
    if (!r.rowCount)
      throw new Fail(409, 'An application or an account already exists for that email address.');
  });
}
