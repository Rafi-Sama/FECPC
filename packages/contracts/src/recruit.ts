// Recruitment: one shareable form per intake. These rules run in the browser (instant feedback) and again in
// the API (the only check that counts), so both always accept and refuse exactly the same input.
import { parseCsv } from './events.ts';
import type { MailTemplate } from './mail.ts';

export type RecruitQuestion = { id: string; label: string; long: boolean };
/** What the creator may change. The required fields are fixed and cannot be turned off. */
export type RecruitForm = { cf: boolean; why: boolean; questions: RecruitQuestion[] };
export type RecruitPublic = {
  title: string;
  batch: number;
  closes: string;
  open: boolean;
  form: RecruitForm;
};
export type RecruitLink = RecruitPublic & {
  id: number;
  token: string;
  by: string;
  at: string;
  pending: number;
  accepted: number;
  declined: number;
  /** The acceptance email; null = the built-in design. */
  mail: MailTemplate | null;
};
export type Applicant = {
  id: string;
  link: number | null;
  name: string;
  sid: string;
  dept: string;
  batch: number;
  email: string;
  phone: string;
  cf: string;
  why: string;
  answers: { q: string; a: string }[];
  src: string;
  status: 'pending' | 'accepted' | 'declined';
  reason: string | null;
  decidedBy: string | null;
  photo: boolean;
  at: string;
};

export const RECRUIT = {
  maxQuestions: 8,
  maxDays: 90,
  importRows: 500,
  photoBytes: 450_000,
} as const;
export const DEFAULT_FORM: RecruitForm = { cf: true, why: true, questions: [] };

/** The fields every applicant fills in. Batch is not here: it comes from the link, never from the applicant. */
export const REQUIRED = [
  ['name', 'Full name'],
  ['sid', 'Student ID'],
  ['dept', 'Department'],
  ['email', 'Email'],
  ['phone', 'Phone number'],
] as const;

const line = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
const block = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : '';

/** Field rules shared by the recruitment form and member profiles, so both accept the same values. */
export const RULES = {
  name: /^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,79}$/u,
  sid: /^[A-Z0-9][A-Z0-9/-]{2,29}$/,
  dept: /^[\p{L}0-9][\p{L}0-9 &.-]{1,29}$/u,
  phone: /^\+?\d{10,15}$/,
  cf: /^[\w.-]{3,24}$/,
  photo: /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
};
/**
 * A photo upload: a data URL of at most `max` characters whose bytes really are the declared format, so a renamed
 * HTML or script file is never stored and served back as an image.
 */
export function photoOk(v: string, max: number = RECRUIT.photoBytes): boolean {
  const m =
    v.length <= max ? /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v) : null;
  if (!m) return false;
  let head: string;
  try {
    head = (globalThis as unknown as { atob(s: string): string }).atob(m[2]!.slice(0, 24));
  } catch {
    return false;
  }
  if (m[1] === 'png') return head.startsWith('\x89PNG');
  if (m[1] === 'jpeg') return head.startsWith('\xff\xd8\xff');
  return head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
}
export const RULE_TEXT = {
  name: 'Use 2 to 80 letters (spaces, dots, hyphens and apostrophes are fine).',
  sid: 'Use 3 to 30 letters, digits, hyphens or slashes.',
  dept: 'Use 2 to 30 letters, like CSE.',
  phone: 'Enter 10 to 15 digits, like 01712345678.',
  cf: 'A Codeforces handle is 3 to 24 letters, digits, _ . or -.',
  photo: 'The photo must be a PNG, JPEG or WebP under 300 KB.',
};
/** How the forms tidy a value before checking it: one line, no control characters, single spaces. */
export const oneLine = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
export const cleanPhone = (v: unknown) => oneLine(v).replace(/[\s().-]/g, '');

export type ApplicantInput = {
  name: string;
  sid: string;
  dept: string;
  email: string;
  phone: string;
  photo: string;
  cf: string;
  why: string;
  answers: { q: string; a: string }[];
};

/**
 * Cleans one applicant and lists what is wrong, field by field (empty `errors` = valid).
 * `photo: false` is for CSV rows, which cannot carry an image.
 */
export function checkApplicant(
  i: Record<string, unknown>,
  form: RecruitForm,
  { photo: needPhoto = true } = {},
): { value: ApplicantInput; errors: Record<string, string> } {
  const e: Record<string, string> = {};
  const name = line(i.name),
    sid = line(i.sid).toUpperCase(),
    dept = line(i.dept).toUpperCase(),
    email = line(i.email).toLowerCase(),
    phone = line(i.phone).replace(/[\s().-]/g, ''),
    cf = line(i.cf).replace(/^@/, ''),
    why = form.why ? block(i.why) : '',
    photo = needPhoto && typeof i.photo === 'string' ? i.photo : '';
  if (!RULES.name.test(name)) e.name = RULE_TEXT.name;
  if (!RULES.sid.test(sid)) e.sid = RULE_TEXT.sid;
  if (!RULES.dept.test(dept)) e.dept = RULE_TEXT.dept;
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    e.email = 'Enter a valid email address.';
  if (!RULES.phone.test(phone)) e.phone = RULE_TEXT.phone;
  if (needPhoto) {
    if (!photo) e.photo = 'Add a photo of your face.';
    else if (!photoOk(photo)) e.photo = RULE_TEXT.photo;
  }
  if (form.cf && cf && !RULES.cf.test(cf)) e.cf = RULE_TEXT.cf;
  if (why.length > 1000) e.why = 'Keep it under 1000 characters.';
  const raw = (i.answers && typeof i.answers === 'object' ? i.answers : {}) as Record<
    string,
    unknown
  >;
  const answers: ApplicantInput['answers'] = [];
  for (const q of form.questions) {
    const a = q.long ? block(raw[q.id]) : line(raw[q.id]);
    if (a.length > (q.long ? 1000 : 200))
      e[`q:${q.id}`] = `Keep it under ${q.long ? 1000 : 200} characters.`;
    if (a) answers.push({ q: q.label, a });
  }
  return {
    value: { name, sid, dept, email, phone, photo, cf: form.cf ? cf : '', why, answers },
    errors: e,
  };
}

/** Cleans the creator's form settings. Returns an error message instead of throwing, for both sides. */
export function checkForm(i: unknown): { value: RecruitForm; error?: string } {
  const f = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
  const list = Array.isArray(f.questions) ? f.questions : [];
  const value: RecruitForm = { cf: f.cf !== false, why: f.why !== false, questions: [] };
  if (list.length > RECRUIT.maxQuestions)
    return { value, error: `At most ${RECRUIT.maxQuestions} extra questions.` };
  const seen = new Set<string>();
  for (const q of list as Record<string, unknown>[]) {
    const label = line(q?.label);
    if (label.length < 3 || label.length > 120)
      return { value, error: 'Each question needs 3 to 120 characters.' };
    if (seen.has(label.toLowerCase())) return { value, error: `"${label}" is asked twice.` };
    seen.add(label.toLowerCase());
    const id =
      typeof q.id === 'string' && /^q[a-z0-9]{1,10}$/.test(q.id)
        ? q.id
        : `q${Math.random().toString(36).slice(2, 10)}`;
    value.questions.push({ id, label, long: q.long === true });
  }
  if (new Set(value.questions.map((q) => q.id)).size !== value.questions.length)
    return { value, error: 'Two questions share an id.' };
  return { value };
}

const HEADERS: Record<string, keyof ApplicantInput> = {
  name: 'name',
  fullname: 'name',
  studentid: 'sid',
  sid: 'sid',
  id: 'sid',
  department: 'dept',
  dept: 'dept',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  codeforces: 'cf',
  codeforceshandle: 'cf',
  cf: 'cf',
};
export const CSV_TEMPLATE =
  'Full name,Student ID,Department,Email,Phone number,Codeforces handle\nNadia Rahman,2026-331-042,CSE,nadia@example.com,01712345678,\n';

/**
 * Reads an applicant CSV (header row first; column order and case do not matter).
 * Every row comes back cleaned, with its own errors; duplicate emails in the file are flagged.
 */
export function readApplicantCsv(text: string): {
  missing: string[];
  rows: { row: number; value: ApplicantInput; errors: Record<string, string> }[];
} {
  const [head = [], ...body] = parseCsv(text.replace(/^﻿/, ''));
  const cols = head.map((h) => HEADERS[h.toLowerCase().replace(/[^a-z]/g, '')]);
  const missing = REQUIRED.filter(([k]) => !cols.includes(k)).map(([, l]) => l);
  const seen = new Set<string>();
  const rows = body
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells, n) => {
      const raw: Record<string, string> = {};
      cols.forEach((k, j) => k && (raw[k] = cells[j] ?? ''));
      const r = checkApplicant(raw, { cf: true, why: false, questions: [] }, { photo: false });
      if (seen.has(r.value.email)) r.errors.email = 'This email is already earlier in the file.';
      seen.add(r.value.email);
      return { row: n + 1, ...r };
    });
  return { missing, rows };
}
