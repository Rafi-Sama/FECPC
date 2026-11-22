// Events: shapes shared by the API and the web app, plus the certificate template filler and CSV reader.
import type { MailTemplate } from './mail.ts';

export const EVENT_STATUSES = [
  'draft',
  'published',
  'open',
  'closed',
  'ongoing',
  'completed',
  'cancelled',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  open: 'Registration open',
  closed: 'Registration closed',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const EVENT_TYPES = [
  'Workshop',
  'Class',
  'Contest',
  'Seminar',
  'Hackathon',
  'ICPC prep',
  'Social',
] as const;
/** A new event's id: its title as a slug plus a random suffix, e.g. `intro-to-dp-3f9a`. */
export const eventSlug = (title: string, suffix: string) =>
  (title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '') || 'event') +
  '-' +
  suffix;
export const EVENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type EntryStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** A custom question on a registration form. With `options` it is a choice. */
export type EventField = { label: string; required: boolean; options?: string[] };

/** A volunteer, TA or other role the event recruits for. `counts` only for organisers and platform roles. */
export type EventRole = {
  id: number;
  title: string;
  about: string;
  mode: 'platform' | 'form';
  formUrl: string | null;
  approval: 'auto' | 'manual';
  fields: EventField[];
  counts?: Partial<Record<EntryStatus, number>>;
};

/** One platform registration (roleId null) or role application. User fields only for organisers. */
export type EventEntry = {
  id: number;
  roleId: number | null;
  status: EntryStatus;
  place: number | null;
  name: string;
  phone: string;
  answers: Record<string, string>;
  at: string;
  /** Why the organisers declined it, shown to the member. */
  reason?: string | null;
  userId?: string;
  email?: string;
  batch?: string;
};

/** Times are club-local `YYYY-MM-DDTHH:MM`. `taken` counts pending and approved platform registrations. */
export type ClubEvent = {
  id: string;
  title: string;
  type: string;
  place: string;
  about: string;
  banner: string | null;
  startsAt: string;
  regOpens: string | null;
  regCloses: string | null;
  status: EventStatus;
  seats: number | null;
  fee: number;
  mode: 'platform' | 'form';
  formUrl: string | null;
  approval: 'auto' | 'manual';
  fields: EventField[];
  certs: boolean;
  taken: number;
  /** Platform registration is accepted right now: status open and inside the window. */
  regOpen: boolean;
  roles: EventRole[];
  mine: EventEntry[];
};

/** The public site's view of an upcoming event. */
export type PublicEvent = Pick<
  ClubEvent,
  'id' | 'title' | 'type' | 'place' | 'about' | 'banner' | 'startsAt' | 'seats' | 'fee' | 'taken'
>;

export type EventDetail = ClubEvent & {
  feedback: { rating: number; body: string } | null;
  certificates: { code: string; kind: string; html: string }[];
  /** Organisers only. */
  admin?: {
    entries: EventEntry[];
    feedback: { name: string; rating: number; body: string; at: string }[];
    templates: Record<string, string>;
    issued: Record<string, number>;
    /** The room code members type to check in, and how many have. */
    checkin: { code: string; arrived: number };
    /** The approval email; null = the built-in design. */
    mail: MailTemplate | null;
  };
};

/** What the public verify page shows for a certificate code. */
export type VerifiedCertificate = {
  code: string;
  kind: string;
  name: string;
  role: string | null;
  place: string | null;
  event: string;
  date: string;
};

/** Placeholders filled from the database. CSV imports map their columns onto any names. */
export const CERT_VARS = [
  'name',
  'email',
  'batch',
  'dept',
  'phone',
  'event',
  'date',
  'role',
  'place',
  'code',
  'headline',
] as const;

/** The headline each certificate kind gets, as `{{headline}}`. */
export const certHeadline = (kind: string, role = '', place = '') =>
  kind.startsWith('winner')
    ? `Certificate of Achievement · ${place} place`
    : kind.startsWith('role:')
      ? `Certificate of Appreciation · ${role}`
      : 'Certificate of Participation';

/**
 * The built-in design, used for any kind without a saved template. A4 landscape (1123×794), inline CSS and
 * system fonts only, so it renders the same in the preview, the PNG/JPG export and the print.
 */
export const DEFAULT_CERT = `<style>
*{box-sizing:border-box;margin:0}
body{width:1123px;height:794px;background:#f6f4ee;font-family:Georgia,'Times New Roman',serif;color:#0d0d0b}
.f{position:absolute;inset:28px;border:3px solid #0d0d0b;padding:56px 72px 150px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.f:before{content:'';position:absolute;inset:10px;border:1px solid #0d0d0b}
.club{position:absolute;top:56px;left:0;right:0;font:600 18px/1 'Courier New',monospace;letter-spacing:.3em;text-transform:uppercase}
.h{margin-top:0;font:700 22px/1.2 'Courier New',monospace;letter-spacing:.12em;text-transform:uppercase;color:#1f3bff}
.to{margin-top:44px;font-size:22px;font-style:italic}
.n{margin-top:14px;font-size:64px;font-weight:700;line-height:1.1;border-bottom:2px solid #0d0d0b;padding:0 40px 12px}
.for{margin-top:28px;font-size:22px;line-height:1.5;max-width:760px}
.ev{font-weight:700}
.foot{position:absolute;left:72px;right:72px;bottom:56px;display:flex;justify-content:space-between;align-items:flex-end;font:15px/1.4 'Courier New',monospace}
.sig{border-top:1px solid #0d0d0b;padding-top:8px;width:220px}
</style>
<div class="f">
<div class="club">FECPC · Programming Club</div>
<div class="h">{{headline}}</div>
<div class="to">This is presented to</div>
<div class="n">{{name}}</div>
<div class="for">for taking part in <span class="ev">{{event}}</span>, held on {{date}}.</div>
<div class="foot"><div class="sig">President</div><div>Certificate ID<br><b>{{code}}</b></div><div class="sig">Event lead</div></div>
</div>`;

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
/** Replaces `{{ key }}` with the HTML-escaped value; unknown keys become empty. */
export const fillTemplate = (html: string, vars: Record<string, string>) =>
  html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) =>
    (vars[k] ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]!),
  );

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. Blank lines dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') endCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else cell += ch;
  }
  endRow();
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** One CSV field: quoted when it holds a comma, quote or newline; a leading =+-@ is defused for spreadsheets. */
export const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
