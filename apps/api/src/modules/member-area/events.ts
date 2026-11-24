// Events: what members register and apply for, and what the President and Secretary run (`event.publish`).
// Writes are `act` handlers (one transaction, actor row locked); reads are the `events` query area and the
// public list. Every handler checks its own permission. Google Forms answers are never stored here.
import { randomBytes } from 'node:crypto';
import {
  can,
  certHeadline,
  checkMailTemplate,
  DEFAULT_MAIL,
  MAIL_CLUB,
  renderMail,
  DEFAULT_CERT,
  EVENT_STATUSES,
  EVENT_ID,
  EVENT_TYPES,
  eventSlug,
  fillTemplate,
  photoOk,
  type ClubEvent,
  type EventDetail,
  type EventField,
  type PublicEvent,
  type Role,
} from '@fecpc/contracts';
import { Fail, type Db } from './db.ts';
import { audit, need, pick, posInt, ROLES, type Handler, type In } from './rules.ts';
import { enqueue, mailOutlook, mailReady } from './mail.ts';
import { TZ } from './state.ts';

const ORGANISERS = 'Only the President and Secretary run events.';
const organiser = (roles: Role[]) => !!can(roles, 'event.publish');
const str = (v: unknown, min: number, max: number, what: string, multiline = false) => {
  const t =
    typeof v === 'string'
      ? v
          .replace(
            multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g,
            ' ',
          )
          .trim()
      : '';
  if (t.length < min || t.length > max)
    throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const url = (v: unknown, what: string) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  if (t.length > 500 || !/^https:\/\/[^\s<>"']+$/i.test(t))
    throw new Fail(400, `${what} must be an https link.`);
  return t;
};
const banner = (v: unknown) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return null;
  if (t.startsWith('data:')) {
    // The bytes must really be the declared format, or the banner renders blank.
    if (!photoOk(t, 700_000))
      throw new Fail(400, 'The banner image is damaged or too large. Pick it again.');
    return t;
  }
  return url(t, 'The banner');
};
/** Club-local `YYYY-MM-DDTHH:MM` (what a datetime-local input sends), or null when empty and allowed. */
const when = (v: unknown, what: string, optional = true) => {
  if (optional && (v === null || v === undefined || v === '')) return null;
  // round-trip through UTC so 2026-02-31 is refused here rather than by Postgres
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ||
    new Date(v + 'Z').toISOString().slice(0, 16) !== v
  )
    throw new Fail(400, `${what} must be a date and time.`);
  return v;
};
const fields = (v: unknown): EventField[] => {
  if (!Array.isArray(v)) return [];
  if (v.length > 20) throw new Fail(400, 'At most 20 questions.');
  const out = v.map((f: In) => {
    const options = Array.isArray(f?.options)
      ? f.options.map((o) => str(o, 1, 80, 'An option')).slice(0, 20)
      : [];
    return {
      label: str(f?.label, 1, 80, 'A question'),
      required: f?.required === true,
      ...(options.length ? { options } : {}),
    };
  });
  const labels = out.map((f) => f.label.toLowerCase());
  if (new Set(labels).size !== labels.length || labels.some((l) => l === 'name' || l === 'phone'))
    throw new Fail(400, 'Questions need distinct labels other than Name and Phone.');
  return out;
};
/** The member's answers to exactly these questions. */
const answers = (qs: EventField[], v: unknown) => {
  const given = v && typeof v === 'object' && !Array.isArray(v) ? (v as In) : {};
  const out: Record<string, string> = {};
  for (const q of qs) {
    const a = str(given[q.label] ?? '', q.required ? 1 : 0, 1000, q.label, true);
    if (a && q.options) pick(a, q.options, `answer to "${q.label}"`);
    if (a) out[q.label] = a;
  }
  return out;
};
const phone = (v: unknown) => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!/^\+?[0-9][0-9 -]{5,18}$/.test(t)) throw new Fail(400, 'Enter a phone number.');
  return t;
};
/**
 * Whether sign-up is open now. "Registration open" follows the optional window; a merely "Published" event
 * opens by itself once it has an opening date and that date has come, so changing the dates always counts.
 */
const REG_OPEN = (e: string) =>
  `((${e}status = 'open' or (${e}status = 'published' and ${e}reg_opens is not null))
    and (${e}reg_opens is null or ${e}reg_opens <= now()) and (${e}reg_closes is null or ${e}reg_closes > now()))`;

async function eventRow(c: Db, id: unknown, lock = false) {
  const e = (
    await c.query(
      `select *, ${REG_OPEN('')} as reg_open
       from club_events where id = $1 ${lock ? 'for update' : ''}`,
      [typeof id === 'string' ? id : ''],
    )
  ).rows[0];
  if (!e) throw new Fail(404, 'That event does not exist.');
  return e;
}
/** A role of this event, or 404. */
async function roleRow(c: Db, eventId: string, id: unknown) {
  const r = (
    await c.query(`select * from event_roles where id = $1 and event_id = $2`, [
      posInt(id, 'role'),
      eventId,
    ])
  ).rows[0];
  if (!r) throw new Fail(404, 'That role does not exist.');
  return r;
}
/** Valid template kinds for this event: participant, winner1-3 and its roles. */
async function kindOk(c: Db, eventId: string, kind: unknown) {
  if (typeof kind === 'string' && /^(participant|winner[123])$/.test(kind)) return kind;
  if (typeof kind === 'string' && /^role:\d{1,12}$/.test(kind)) {
    await roleRow(c, eventId, kind.slice(5));
    return kind;
  }
  throw new Fail(400, 'Unknown certificate kind.');
}
const ordinal = (n: number | null) => (n ? ['1st', '2nd', '3rd'][n - 1]! : '');
const certCode = () => 'FEC-' + randomBytes(5).toString('hex').toUpperCase();

/** Fills and stores one certificate per (event, kind, email), keeping a code once issued. */
async function issue(
  c: Db,
  eventId: string,
  kind: string,
  html: string,
  rows: Record<string, string>[],
) {
  // emails are stored lower-case, so one person gets one certificate per kind; the last row for an email wins
  const byEmail = new Map(
    rows.map((r) => [r.email!.toLowerCase(), { ...r, email: r.email!.toLowerCase() }]),
  );
  const codes = new Map<string, string>(
    (
      await c.query(
        `select email, code from event_certificates where event_id = $1 and kind = $2`,
        [eventId, kind],
      )
    ).rows.map((r) => [r.email, r.code]),
  );
  const all = [...byEmail.values()].map((v) => ({ ...v, code: codes.get(v.email) ?? certCode() }));
  await c.query(
    `insert into event_certificates (code, event_id, kind, email, vars, html)
     select t.code, $2, $3, t.email, t.vars::jsonb, t.html from unnest($1::text[], $4::text[], $5::text[], $6::text[]) t(code, email, vars, html)
     on conflict (event_id, kind, email) do update set vars = excluded.vars, html = excluded.html, issued_at = now()`,
    [
      all.map((v) => v.code),
      eventId,
      kind,
      all.map((v) => v.email),
      all.map((v) => JSON.stringify(v)),
      all.map((v) => fillTemplate(html, v)),
    ],
  );
  return all.length;
}

/**
 * Queues the approval email for these entries. Returns how many were queued and how many would, at the
 * current daily email limit, only arrive after the event has started (the organiser should tell those
 * another way). Such late mail is dropped by the queue rather than sent after the event.
 */
async function approvalMails(
  c: Db,
  e: {
    id: string;
    title: string;
    place: string;
    starts_at: Date;
    mail_subject: string | null;
    mail_html: string | null;
  },
  entryIds: number[],
) {
  if (!mailReady() || !entryIds.length) return { queued: 0, late: 0 };
  const rows = (
    await c.query(
      `select x.name, u.email, r.title as role from event_entries x join users u on u.id = x.user_id
       left join event_roles r on r.id = x.role_id where x.id = any($1) order by x.id`,
      [entryIds],
    )
  ).rows as { name: string; email: string; role: string | null }[];
  const t = e.mail_html ? { subject: e.mail_subject!, html: e.mail_html } : DEFAULT_MAIL.event;
  const site = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
  const date = new Date(e.starts_at).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
  for (const r of rows)
    await enqueue(c, {
      to: r.email,
      kind: 'event',
      expires: e.starts_at,
      ...renderMail(t, {
        name: r.name,
        event: e.title,
        date,
        venue: e.place || 'to be announced',
        role: r.role ?? '',
        link: `${site}/app/events/${e.id}`,
        club: MAIL_CLUB,
      }),
    });
  const o = await mailOutlook(c);
  const hours = (new Date(e.starts_at).getTime() - Date.now()) / 36e5;
  let late = 0;
  for (let k = 0; k < rows.length; k++)
    if (o.waitHours(o.queued - rows.length + k) >= hours) late++;
  return { queued: rows.length, late };
}

export const eventHandlers: Record<string, Handler> = {
  /** Create (no `id`) or edit an event. Its type is `eventType`, since `type` names the action. */
  async eventSave(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const title = str(i.title, 3, 140, 'The title');
    const v = [
      title,
      pick(i.eventType, EVENT_TYPES, 'event type'),
      str(i.place ?? '', 0, 140, 'The place'),
      str(i.about ?? '', 0, 6000, 'The description', true),
      banner(i.banner),
      when(i.startsAt, 'The start', false),
      when(i.regOpens, 'Registration opening'),
      when(i.regCloses, 'Registration closing'),
      pick(i.status ?? 'draft', EVENT_STATUSES, 'status'),
      i.seats === null || i.seats === undefined || i.seats === ''
        ? null
        : Math.min(posInt(i.seats, 'seat count'), 100_000),
      i.fee ? posInt(i.fee, 'fee') : 0,
      pick(i.mode ?? 'platform', ['platform', 'form'] as const, 'registration method'),
      url(i.formUrl, 'The Google Form link'),
      pick(i.approval ?? 'auto', ['auto', 'manual'] as const, 'approval'),
      JSON.stringify(fields(i.fields)),
    ];
    if (v[11] === 'form') need(v[12], 'A Google Forms registration needs the form link.');
    if (v[6] && v[7] && v[6] >= v[7])
      throw new Fail(400, 'Registration must open before it closes.');
    if (v[6] && v[5] && v[6] >= v[5])
      throw new Fail(400, 'Registration must open before the event starts.');
    if (v[7] && v[5] && v[7] > v[5])
      throw new Fail(400, 'Registration must close by the time the event starts.');
    const set = `title = $2, type = $3, place = $4, about = $5, banner = $6, starts_at = $7::timestamp at time zone '${TZ}',
      reg_opens = $8::timestamp at time zone '${TZ}', reg_closes = $9::timestamp at time zone '${TZ}', status = $10, seats = $11,
      fee = $12, mode = $13, form_url = $14, approval = $15, fields = $16::jsonb`;
    // Completing is final and only makes sense once the event has begun (start time is club-local).
    if (
      v[8] === 'completed' &&
      (await c.query(`select $1::timestamp at time zone '${TZ}' > now() as future`, [v[5]])).rows[0]
        .future
    )
      throw new Fail(409, 'An event can be marked completed only after it has started.');
    if (i.id) {
      const prev = await eventRow(c, i.id, true);
      if (prev.status === 'completed' && v[8] !== 'completed')
        throw new Fail(409, 'A completed event cannot be reopened.');
      if (prev.status === 'completed')
        throw new Fail(409, 'A completed event is final. Run it again as a new event instead.');
      if (v[9] !== null) {
        const taken = (
          await c.query(
            `select count(*)::int n from event_entries where event_id = $1 and role_id is null and status in ('pending','approved')`,
            [prev.id],
          )
        ).rows[0].n;
        if (Number(v[9]) < taken)
          throw new Fail(
            409,
            `${taken} people already hold seats. Set at least ${taken}, or decline some first.`,
          );
      }
      const id = prev.id;
      await c.query(`update club_events set ${set} where id = $1`, [id, ...v]);
      await audit(c, a, `edited event ${id}`);
      return;
    }
    // The page may propose the id (so it can open the new event); it must look like one and be free.
    const id =
      i.newId === undefined ? eventSlug(title, randomBytes(2).toString('hex')) : String(i.newId);
    if (id.length > 60 || !EVENT_ID.test(id)) throw new Fail(400, 'That event id is not valid.');
    const made = await c.query(
      `insert into club_events (id, title, starts_at, created_by) values ($1, $2, now(), $3) on conflict (id) do nothing`,
      [id, title, a.id],
    );
    if (!made.rowCount) throw new Fail(409, 'That event id is taken. Save again.');
    await c.query(`update club_events set ${set} where id = $1`, [id, ...v]);
    // The approval email carries over from the copied event, or else from the latest designed one.
    await c.query(
      `update club_events set (mail_subject, mail_html) = (
         select mail_subject, mail_html from club_events
         where id <> $1 and mail_html is not null order by (id = $2) desc, created_at desc limit 1)
       where id = $1`,
      [id, typeof i.copyOf === 'string' ? i.copyOf : ''],
    );
    if (typeof i.copyOf === 'string' && i.copyOf) {
      const from = await eventRow(c, i.copyOf);
      await c.query(
        `insert into event_roles (event_id, title, about, mode, form_url, approval, fields)
         select $1, title, about, mode, form_url, approval, fields from event_roles where event_id = $2 order by id`,
        [id, from.id],
      );
      // Role templates point at the old role ids, so only the participant and winner designs carry over.
      await c.query(
        `insert into cert_templates (event_id, kind, html)
         select $1, kind, html from cert_templates where event_id = $2 and kind !~ '^role:'`,
        [id, from.id],
      );
      await audit(c, a, `created event ${id} as a copy of ${from.id}`);
      return;
    }
    await audit(c, a, `created event ${id}`);
  },
  async eventDelete(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.id, true);
    if (
      (await c.query(`select 1 from event_certificates where event_id = $1 limit 1`, [e.id]))
        .rowCount
    )
      throw new Fail(409, 'This event has issued certificates. Cancel it instead of deleting it.');
    await c.query(`delete from club_events where id = $1`, [e.id]);
    await audit(c, a, `deleted event ${e.id}: ${e.title}`);
  },
  /** Create (no `id`) or edit a role an event recruits for. */
  async roleSave(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.eventId, true);
    const mode = pick(i.mode ?? 'platform', ['platform', 'form'] as const, 'registration method');
    const v = [
      str(i.title, 2, 80, 'The role'),
      str(i.about ?? '', 0, 1000, 'The description', true),
      mode,
      url(i.formUrl, 'The Google Form link'),
      pick(i.approval ?? 'manual', ['auto', 'manual'] as const, 'approval'),
      JSON.stringify(fields(i.fields)),
    ];
    if (mode === 'form') need(v[3], 'A Google Forms role needs the form link.');
    if (i.id) {
      const r = await roleRow(c, e.id, i.id);
      await c.query(
        `update event_roles set title = $2, about = $3, mode = $4, form_url = $5, approval = $6, fields = $7::jsonb where id = $1`,
        [r.id, ...v],
      );
    } else
      await c.query(
        `insert into event_roles (event_id, title, about, mode, form_url, approval, fields) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [e.id, ...v],
      );
    await audit(c, a, `saved role "${v[0]}" on event ${e.id}`);
  },
  async roleDelete(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.eventId, true);
    const r = await roleRow(c, e.id, i.id);
    await c.query(`delete from event_roles where id = $1`, [r.id]);
    await c.query(`delete from cert_templates where event_id = $1 and kind = $2`, [
      e.id,
      `role:${r.id}`,
    ]);
    await audit(c, a, `removed role "${r.title}" from event ${e.id}`);
  },
  /** Register as a participant (no `roleId`) or apply for a role, through the platform form. */
  async register(c, a, _p, i) {
    need(!a.system, 'This is an operator account, not a member. It cannot do that.');
    const e = await eventRow(c, i.eventId, true); // the row lock makes the last seat go to one person
    const role = i.roleId ? await roleRow(c, e.id, i.roleId) : null;
    const how = role ?? e;
    if (how.mode !== 'platform') throw new Fail(409, 'This one registers through its Google Form.');
    if (role) {
      if (!['published', 'open', 'closed'].includes(e.status))
        throw new Fail(409, 'Applications for this event are closed.');
    } else if (!e.reg_open) throw new Fail(409, 'Registration is not open.');
    const prev = (
      await c.query(
        `select status from event_entries where event_id = $1 and coalesce(role_id, 0) = $2 and user_id = $3`,
        [e.id, role?.id ?? 0, a.id],
      )
    ).rows[0];
    if (prev?.status === 'rejected') throw new Fail(409, 'This was declined by the organisers.');
    if (prev && prev.status !== 'cancelled') throw new Fail(409, 'You have already signed up.');
    if (!role && e.seats !== null) {
      const n = (
        await c.query(
          `select count(*)::int n from event_entries where event_id = $1 and role_id is null and status in ('pending','approved')`,
          [e.id],
        )
      ).rows[0].n;
      if (n >= e.seats) throw new Fail(409, 'That event is full.');
    }
    const row = [
      e.id,
      role?.id ?? null,
      a.id,
      str(i.name ?? a.name, 2, 80, 'Your name'),
      phone(i.phone),
      JSON.stringify(answers(how.fields, i.answers)),
      how.approval === 'auto' ? 'approved' : 'pending',
    ];
    const saved = prev
      ? await c.query(
          `update event_entries set name = $4, phone = $5, answers = $6, status = $7, place = null, at = now()
           where event_id = $1 and coalesce(role_id, 0) = coalesce($2, 0) and user_id = $3 returning id`,
          row,
        )
      : await c.query(
          `insert into event_entries (event_id, role_id, user_id, name, phone, answers, status) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          row,
        );
    if (row[6] === 'approved') await approvalMails(c, e, [saved.rows[0].id]);
    return row[6] === 'pending' ? 'Sent. The organisers will review it.' : undefined;
  },
  /** Withdraw your own registration or application before the event completes. */
  async unregister(c, a, _p, i) {
    const e = await eventRow(c, i.eventId);
    if (['completed', 'cancelled'].includes(e.status)) throw new Fail(409, 'This event is over.');
    const r = await c.query(
      `update event_entries set status = 'cancelled', place = null
       where event_id = $1 and coalesce(role_id, 0) = $2 and user_id = $3 and status in ('pending','approved')`,
      [e.id, i.roleId ? posInt(i.roleId, 'role') : 0, a.id],
    );
    if (!r.rowCount) throw new Fail(409, 'There is nothing to cancel.');
  },
  /** Approve, reject or reopen entries (`ids`), all from one event. */
  async entryStatus(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const status = pick(i.status, ['pending', 'approved', 'rejected'] as const, 'status');
    const reason =
      status === 'rejected' ? str(i.reason ?? '', 3, 300, 'The reason for declining') : null;
    const ids = (Array.isArray(i.ids) ? i.ids : [i.id])
      .slice(0, 2000)
      .map((x) => posInt(x, 'entry'));
    const evs = (
      await c.query(`select distinct event_id from event_entries where id = any($1)`, [ids])
    ).rows;
    if (evs.length > 1) throw new Fail(400, 'Change entries of one event at a time.');
    if (!evs.length) throw new Fail(404, 'Nothing to change.');
    const e = await eventRow(c, evs[0].event_id, true); // same lock as register, so seats cannot be oversold
    const r = await c.query(
      `with old as (select id, status from event_entries where id = any($1) and status <> 'cancelled' for update)
       update event_entries x set status = $2, place = case when $2 = 'approved' then x.place end, reason = $3
       from old where x.id = old.id returning x.id, old.status as was`,
      [ids, status, reason],
    );
    if (!r.rowCount) throw new Fail(404, 'Nothing to change.');
    if (status !== 'rejected' && e.seats !== null) {
      const n = (
        await c.query(
          `select count(*)::int n from event_entries where event_id = $1 and role_id is null and status in ('pending','approved')`,
          [e.id],
        )
      ).rows[0].n;
      if (n > e.seats) throw new Fail(409, `That would fill ${n} of ${e.seats} seats.`);
    }
    const fresh = (r.rows as { id: string; was: string }[])
      .filter((x) => status === 'approved' && x.was !== 'approved')
      .map((x) => Number(x.id));
    const m = await approvalMails(c, e, fresh);
    await audit(
      c,
      a,
      `${status} ${r.rowCount} entr${r.rowCount === 1 ? 'y' : 'ies'} on event ${e.id}${m.queued ? `; ${m.queued} approval email${m.queued === 1 ? '' : 's'} queued` : ''}`,
    );
    if (!fresh.length) return;
    if (!mailReady()) return 'Approved. Email is not set up, so nobody was emailed.';
    return `Approved ${fresh.length}; ${fresh.length === 1 ? 'their email is' : 'emails are'} on the way.${m.late ? ` Because of the daily email limit, ${m.late} would only arrive after the event starts, so they will not be sent: tell them another way.` : ''}`;
  },
  /** Saves this event's approval email; an empty body goes back to the built-in design. */
  async eventMail(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.eventId, true);
    if (!i.html) {
      await c.query(`update club_events set mail_subject = null, mail_html = null where id = $1`, [
        e.id,
      ]);
      return void (await audit(
        c,
        a,
        `reset the approval email of event ${e.id} to the built-in design`,
      ));
    }
    const t = checkMailTemplate('event', { subject: i.subject, html: i.html });
    if (t.error) throw new Fail(400, t.error);
    await c.query(`update club_events set mail_subject = $2, mail_html = $3 where id = $1`, [
      e.id,
      t.value.subject,
      t.value.html,
    ]);
    await audit(c, a, `edited the approval email of event ${e.id}`);
  },
  /** Mark an approved participant 1st, 2nd or 3rd (`place` null clears it). */
  async entryPlace(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const place = i.place === null || i.place === undefined ? null : Number(i.place);
    if (place !== null && ![1, 2, 3].includes(place)) throw new Fail(400, 'Unknown place.');
    const r = await c.query(
      `update event_entries set place = $2 where id = $1 and role_id is null and status = 'approved' returning event_id, name`,
      [posInt(i.id, 'entry'), place],
    );
    if (!r.rowCount) throw new Fail(404, 'Only approved participants can be placed.');
    await audit(
      c,
      a,
      `placed ${r.rows[0].name} ${ordinal(place) || 'none'} at event ${r.rows[0].event_id}`,
    );
  },
  /** One rating per member per completed event they took part in. */
  async eventFeedback(c, a, _p, i) {
    const e = await eventRow(c, i.eventId);
    if (e.status !== 'completed')
      throw new Fail(409, 'Feedback opens when the event is completed.');
    need(
      (
        await c.query(
          `select 1 from event_entries where event_id = $1 and user_id = $2 and status = 'approved'`,
          [e.id, a.id],
        )
      ).rowCount,
      'Only people who took part can leave feedback.',
    );
    const rating = Number(i.rating);
    if (![1, 2, 3, 4, 5].includes(rating)) throw new Fail(400, 'Rate it 1 to 5.');
    const r = await c.query(
      `insert into event_feedback (event_id, user_id, rating, body) values ($1, $2, $3, $4) on conflict do nothing`,
      [e.id, a.id, rating, str(i.body ?? '', 0, 2000, 'Feedback', true)],
    );
    if (!r.rowCount) throw new Fail(409, 'You have already left feedback for this event.');
  },
  /** Save (or with empty `html`, remove) the raw HTML+CSS template for one certificate kind. */
  async certTemplate(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.eventId, true);
    const kind = await kindOk(c, e.id, i.kind);
    const html = typeof i.html === 'string' ? i.html.trim() : '';
    if (html.length > 300_000) throw new Fail(400, 'The template is too large.');
    if (!html)
      await c.query(`delete from cert_templates where event_id = $1 and kind = $2`, [e.id, kind]);
    else
      await c.query(
        `insert into cert_templates values ($1, $2, $3) on conflict (event_id, kind) do update set html = excluded.html`,
        [e.id, kind, html],
      );
    await audit(c, a, `saved the ${kind} certificate template for event ${e.id}`);
  },
  /**
   * Generate certificates for a completed event. Without `rows`: every approved entry, each with the template
   * for its kind (winner by place, participant, or its role). With `rows` (CSV, already mapped to variable
   * names, each with an `email`): those rows, with the `kind` template.
   */
  async certIssue(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.eventId, true);
    if (e.status !== 'completed')
      throw new Fail(409, 'Certificates are issued once the event is completed.');
    const templates = new Map<string, string>(
      (await c.query(`select kind, html from cert_templates where event_id = $1`, [e.id])).rows.map(
        (r) => [r.kind, r.html],
      ),
    );
    const base = {
      event: e.title,
      date: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, dateStyle: 'long' }).format(
        e.starts_at,
      ),
    };
    let n = 0;
    if (Array.isArray(i.rows)) {
      const kind = await kindOk(c, e.id, i.kind);
      const html = templates.get(kind) ?? DEFAULT_CERT;
      if (i.rows.length > 2000) throw new Fail(400, 'At most 2000 rows at a time.');
      const rows = i.rows.map((r: In) => {
        const out: Record<string, string> = { ...base };
        for (const [k, v] of Object.entries(r ?? {}).slice(0, 40))
          if (/^[\w.-]{1,40}$/.test(k) && k !== 'code') out[k] = str(String(v ?? ''), 0, 500, k);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email ?? ''))
          throw new Fail(400, `Every row needs an email (got "${out.email ?? ''}").`);
        out.headline ||= certHeadline(kind, out.role, out.place);
        return out;
      });
      n = await issue(c, e.id, kind, html, rows);
    } else {
      const entries = (
        await c.query(
          `select x.role_id, x.place, u.name, x.phone, u.email, u.batch, u.dept, r.title role
           from event_entries x join users u on u.id = x.user_id left join event_roles r on r.id = x.role_id
           where x.event_id = $1 and x.status = 'approved'`,
          [e.id],
        )
      ).rows;
      const byKind = new Map<string, Record<string, string>[]>();
      for (const x of entries) {
        const kind = x.role_id ? `role:${x.role_id}` : x.place ? `winner${x.place}` : 'participant';
        byKind.set(kind, [
          ...(byKind.get(kind) ?? []),
          {
            ...base,
            name: x.name,
            email: x.email,
            batch: String(x.batch ?? ''),
            dept: x.dept ?? '',
            phone: x.phone,
            role: x.role ?? 'Participant',
            place: ordinal(x.place),
            headline: certHeadline(kind, x.role ?? '', ordinal(x.place)),
          },
        ]);
      }
      if (!entries.length)
        throw new Fail(409, 'Nobody was approved for this event, so there is no one to certify.');
      for (const [kind, rows] of byKind)
        n += await issue(c, e.id, kind, templates.get(kind) ?? DEFAULT_CERT, rows);
      // an entrant whose entry was declined, un-placed or re-roled loses the certificate they no longer earn
      const keep = [...byKind].flatMap(([kind, rows]) =>
        rows.map((r) => `${kind} ${r.email!.toLowerCase()}`),
      );
      const gone = await c.query(
        `delete from event_certificates where event_id = $1 and kind ~ '^(participant|winner[123]|role:\\d+)$'
           and email in (select lower(u.email) from event_entries x join users u on u.id = x.user_id where x.event_id = $1)
           and kind || ' ' || email <> all($2::text[])`,
        [e.id, keep],
      );
      if (gone.rowCount)
        await audit(c, a, `revoked ${gone.rowCount} certificates for event ${e.id}`);
    }
    await audit(c, a, `issued ${n} certificates for event ${e.id}`);
    return `${n} certificate${n === 1 ? '' : 's'} generated.`;
  },
  /** Check in to an event you are approved for, with the room code its organisers show. */
  async attend(c, a, _p, i) {
    const e = await eventRow(c, i.eventId);
    if (!['open', 'closed', 'ongoing'].includes(e.status))
      throw new Fail(409, 'Check-in is not open for this event.');
    need(
      (
        await c.query(
          `select 1 from event_entries where event_id = $1 and user_id = $2 and role_id is null and status = 'approved'`,
          [e.id, a.id],
        )
      ).rowCount,
      'Only approved participants can check in.',
    );
    if (
      String(i.code ?? '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase() !== e.checkin
    )
      throw new Fail(400, 'That code is wrong. Read it off the projector again.');
    await c.query(`insert into attendance values ($1, $2) on conflict do nothing`, [a.id, e.id]);
  },
  /** Let members download their certificates (or stop it). */
  async certDistribute(c, a, _p, i) {
    need(organiser(a.roles), ORGANISERS);
    const e = await eventRow(c, i.eventId, true);
    const on = i.on === true;
    if (on && e.status !== 'completed') throw new Fail(409, 'Complete the event first.');
    await c.query(`update club_events set certs = $2 where id = $1`, [e.id, on]);
    await audit(c, a, `${on ? 'opened' : 'closed'} certificate downloads for event ${e.id}`);
  },
};

// ---- reads ----

const LOCAL = (col: string) => `to_char(${col} at time zone '${TZ}', 'YYYY-MM-DD"T"HH24:MI')`;
const ENTRY = (
  admin: boolean,
) => `json_build_object('id', x.id, 'roleId', x.role_id, 'status', x.status, 'place', x.place,
  'name', x.name, 'phone', x.phone, 'answers', x.answers, 'at', x.at, 'reason', x.reason${admin ? `, 'userId', x.user_id, 'email', u.email, 'batch', u.batch::text` : ''})`;
// Uploaded banners are data URLs of up to 700 KB; lists link to GET /v1/events/:id/banner?v=<banner_key> instead.
const BANNER = `case when e.banner_key is null then e.banner else '/api/events/' || e.id || '/banner?v=' || e.banner_key end`;
// `list`: the events page's cards, which need the first 200 characters of the description and no form questions.
const EVENT = (
  admin: boolean,
  list = false,
) => `select e.id, e.title, e.type, e.place, ${list ? 'left(e.about, 200)' : 'e.about'} about, ${list ? BANNER : 'e.banner'} banner, ${LOCAL('e.starts_at')} "startsAt",
  ${LOCAL('e.reg_opens')} "regOpens", ${LOCAL('e.reg_closes')} "regCloses", e.status, e.seats, e.fee, e.mode, e.form_url "formUrl",
  e.approval, ${list ? `'[]'::jsonb` : 'e.fields'} fields, e.certs,
  ${REG_OPEN('e.')} "regOpen",
  (select count(*)::int from event_entries x where x.event_id = e.id and x.role_id is null and x.status in ('pending','approved')) taken,
  (select coalesce(json_agg(json_build_object('id', r.id, 'title', r.title, 'about', ${list ? `''` : 'r.about'}, 'mode', r.mode, 'formUrl', r.form_url,
     'approval', r.approval, 'fields', ${list ? `'[]'::jsonb` : 'r.fields'}${admin ? `, 'counts', (select coalesce(json_object_agg(status, n), '{}') from (select status, count(*)::int n from event_entries x where x.role_id = r.id group by 1) s)` : ''}) order by r.id), '[]')
   from event_roles r where r.event_id = e.id) roles,
  (select coalesce(json_agg(${ENTRY(false)} order by x.id), '[]') from event_entries x where x.event_id = e.id and x.user_id = $1) mine
from club_events e`;

/** The member area's event reads, `{ action, ...args }`. */
export async function eventsQuery(db: Db, userId: string, b: In): Promise<unknown> {
  const u = (
    await db.query(
      `select email, ${ROLES}
       from users where id = $1 and not suspended`,
      [userId],
    )
  ).rows[0];
  if (!u) throw new Fail(401, 'Sign in again.');
  const admin = organiser(u.roles);
  const hidden = admin ? '' : `e.status <> 'draft'`;
  if (b.action === 'list') {
    // `upcoming`: only what can still happen (the events page's first tab); the rest loads when asked for.
    const where = [
      hidden,
      b.upcoming === true && `e.status <> 'completed' and e.starts_at > now() - interval '1 day'`,
    ].filter(Boolean);
    // `limit`: the first screen of upcoming events, rendered with the page; the rest follows from the browser.
    const limit =
      b.upcoming === true && Number.isInteger(b.limit)
        ? Math.min(200, Math.max(1, Number(b.limit)))
        : 0;
    return (
      await db.query(
        `${EVENT(admin, true)} ${where.length ? 'where ' + where.join(' and ') : ''} order by e.starts_at ${limit ? `limit ${limit}` : ''}`,
        [userId],
      )
    ).rows as ClubEvent[];
  }
  if (b.action !== 'event') throw new Fail(404, 'Not found.');
  const e = (
    await db.query(`${EVENT(admin)} where e.id = $2 ${hidden && 'and ' + hidden}`, [
      userId,
      String(b.id ?? ''),
    ])
  ).rows[0];
  if (!e) throw new Fail(404, 'That event does not exist.');
  const [fb, certs] = await Promise.all([
    db.query(`select rating, body from event_feedback where event_id = $1 and user_id = $2`, [
      e.id,
      userId,
    ]),
    e.certs
      ? db.query(
          `select code, kind, html from event_certificates where event_id = $1 and lower(email) = lower($2) order by kind`,
          [e.id, u.email ?? ''],
        )
      : { rows: [] },
  ]);
  const out: EventDetail = { ...e, feedback: fb.rows[0] ?? null, certificates: certs.rows };
  if (admin) {
    const [entries, feedback, templates, issued, checkin, mail] = await Promise.all([
      db.query(
        `select coalesce(json_agg(${ENTRY(true)} order by x.id), '[]') j from event_entries x join users u on u.id = x.user_id where x.event_id = $1`,
        [e.id],
      ),
      db.query(
        `select u.name, f.rating, f.body, f.at from event_feedback f join users u on u.id = f.user_id where f.event_id = $1 order by f.at desc`,
        [e.id],
      ),
      db.query(
        `select coalesce(json_object_agg(kind, html), '{}') j from cert_templates where event_id = $1`,
        [e.id],
      ),
      db.query(
        `select coalesce(json_object_agg(kind, n), '{}') j from (select kind, count(*)::int n from event_certificates where event_id = $1 group by 1) x`,
        [e.id],
      ),
      db.query(
        `select checkin code, (select count(*)::int from attendance where key = $1) arrived from club_events where id = $1`,
        [e.id],
      ),
      db.query(`select mail_subject subject, mail_html html from club_events where id = $1`, [
        e.id,
      ]),
    ]);
    out.admin = {
      entries: entries.rows[0].j,
      feedback: feedback.rows,
      templates: templates.rows[0].j,
      issued: issued.rows[0].j,
      checkin: checkin.rows[0],
      mail: mail.rows[0]?.html ? mail.rows[0] : null,
    };
  }
  return out;
}

/** Upcoming events for the public site and the member home. */
export async function publicEvents(db: Db): Promise<PublicEvent[]> {
  return (
    await db.query(
      `select e.id, e.title, e.type, e.place, e.about, ${BANNER} banner, ${LOCAL('e.starts_at')} "startsAt", e.seats, e.fee,
         (select count(*)::int from event_entries x where x.event_id = e.id and x.role_id is null and x.status in ('pending','approved')) taken
       from club_events e where e.status in ('published','open','closed','ongoing') and e.starts_at > now() - interval '1 day' order by e.starts_at limit 50`,
    )
  ).rows;
}

/** An event's uploaded banner. The link carries its version, so only someone shown the event can name it. */
export async function eventBanner(db: Db, id: string, v: string) {
  const b = (
    await db.query(`select banner from club_events where id = $1 and banner_key = $2`, [id, v])
  ).rows[0]?.banner;
  const m = typeof b === 'string' ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(b) : null;
  if (!m) throw new Fail(404, 'No banner.');
  return { type: m[1]!, body: Buffer.from(m[2]!, 'base64') };
}

/** A certificate by its code, for the public verify page; null when there is none. */
export async function verifyCertificate(db: Db, code: string) {
  return (
    (
      await db.query(
        `select c.code, c.kind, c.vars->>'name' "name", c.vars->>'role' "role", c.vars->>'place' "place", e.title "event",
           ${LOCAL('e.starts_at')} "date"
         from event_certificates c join club_events e on e.id = c.event_id where c.code = $1`,
        [code.trim().toUpperCase()],
      )
    ).rows[0] ?? null
  );
}
