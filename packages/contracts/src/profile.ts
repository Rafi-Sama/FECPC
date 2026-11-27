// Member profile data. Members do not edit it themselves: they request a change, and the Secretary or
// President approves it (or edits directly). Both paths check values here, in the browser and in the API.
import { cleanPhone, oneLine, photoOk, RULE_TEXT, RULES } from './recruit.ts';

/** Every field a profile change can touch, in the order forms show them. */
export const PROFILE_FIELDS = [
  ['avatar_url', 'Photo'],
  ['name', 'Full name'],
  ['dept', 'Department'],
  ['batch', 'Batch'],
  ['student_id', 'Student ID'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['bio', 'Bio'],
  ['cf_handle', 'Codeforces handle'],
  ['vjudge_handle', 'VJudge username'],
  ['github_url', 'GitHub'],
  ['linkedin_url', 'LinkedIn'],
  ['skills', 'Skills'],
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number][0];
export type ProfileValue = string | number | string[] | null;
export type ProfileChanges = Partial<Record<ProfileField, ProfileValue>>;
export const PROFILE_LABEL = Object.fromEntries(PROFILE_FIELDS) as Record<ProfileField, string>;

/** A member's latest change request, as they see it. */
export type ProfileRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  changes: ProfileChanges;
  note: string | null;
  reason: string | null;
  at: string;
};
/** One past or open change request, as its owner sees it in their history. */
export type ProfileHistoryItem = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  changes: ProfileChanges;
  note: string | null;
  reason: string | null;
  at: string;
  decidedAt: string | null;
  decidedBy: string | null;
};
/** A pending request as officers review it. A photo is `true` here; it is fetched separately. */
export type ProfileRequestReview = {
  id: string;
  user: string;
  name: string;
  changes: ProfileChanges;
  current: ProfileChanges;
  note: string | null;
  at: string;
};

const url = (v: string, host: RegExp) => /^https:\/\/[^\s<>"']{4,290}$/i.test(v) && host.test(v);

/**
 * Cleans the fields present in `i` and lists what is wrong with each. Absent fields are left alone;
 * an empty optional field becomes null (removed). Name, department and batch cannot be emptied.
 */
export function checkProfile(i: Record<string, unknown>): {
  value: ProfileChanges;
  errors: Partial<Record<ProfileField, string>>;
} {
  const value: ProfileChanges = {},
    errors: Partial<Record<ProfileField, string>> = {};
  const has = (k: ProfileField) => Object.hasOwn(i, k);
  const opt = (k: ProfileField, v: string, ok: boolean, msg: string) => {
    if (v && !ok) errors[k] = msg;
    value[k] = v || null;
  };
  if (has('avatar_url')) {
    const v = typeof i.avatar_url === 'string' ? i.avatar_url : '';
    opt('avatar_url', v, photoOk(v), RULE_TEXT.photo);
  }
  if (has('name')) {
    value.name = oneLine(i.name);
    if (!RULES.name.test(value.name)) errors.name = RULE_TEXT.name;
  }
  if (has('dept')) {
    value.dept = oneLine(i.dept).toUpperCase();
    if (!RULES.dept.test(value.dept)) errors.dept = RULE_TEXT.dept;
  }
  if (has('batch')) {
    const n = Number(i.batch);
    value.batch = n;
    if (i.batch === '' || !Number.isInteger(n) || n < 0 || n > 99)
      errors.batch = 'Batch is a number from 0 to 99.';
  }
  if (has('student_id')) {
    const v = oneLine(i.student_id).toUpperCase();
    opt('student_id', v, RULES.sid.test(v), RULE_TEXT.sid);
  }
  if (has('phone')) {
    const v = cleanPhone(i.phone);
    opt('phone', v, RULES.phone.test(v), RULE_TEXT.phone);
  }
  if (has('location')) {
    const v = oneLine(i.location);
    opt('location', v, v.length <= 80, 'Keep it under 80 characters.');
  }
  if (has('bio')) {
    const v =
      typeof i.bio === 'string'
        ? i.bio
            .replace(/\r\n?/g, '\n')
            .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
            .trim()
        : '';
    opt('bio', v, v.length <= 400, 'Keep the bio under 400 characters.');
  }
  if (has('cf_handle')) {
    const v = oneLine(i.cf_handle).replace(/^@/, '');
    opt('cf_handle', v, RULES.cf.test(v), RULE_TEXT.cf);
  }
  if (has('vjudge_handle')) {
    const v = oneLine(i.vjudge_handle).replace(/^@/, '');
    opt(
      'vjudge_handle',
      v,
      /^[\w.-]{2,30}$/.test(v),
      'A VJudge username is 2 to 30 letters, digits, _ . or -.',
    );
  }
  if (has('github_url')) {
    const v = oneLine(i.github_url);
    opt(
      'github_url',
      v,
      url(v, /^https:\/\/(www\.)?github\.com\//i),
      'Use a link like https://github.com/username.',
    );
  }
  if (has('linkedin_url')) {
    const v = oneLine(i.linkedin_url);
    opt(
      'linkedin_url',
      v,
      url(v, /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i),
      'Use a link like https://linkedin.com/in/username.',
    );
  }
  if (has('skills')) {
    const list = Array.isArray(i.skills) ? i.skills : [];
    const v = [...new Set(list.map(oneLine).filter(Boolean))];
    value.skills = v;
    if (!Array.isArray(i.skills) || v.length > 15 || v.some((x) => x.length > 40))
      errors.skills = 'Up to 15 skills, each under 40 characters.';
  }
  return { value, errors };
}

/** Only the fields whose value differs from `current` (skills compared as sets). */
export function profileDiff(next: ProfileChanges, current: ProfileChanges): ProfileChanges {
  const out: ProfileChanges = {};
  for (const [k, v] of Object.entries(next) as [ProfileField, ProfileValue][]) {
    const was = current[k] ?? null;
    const same = Array.isArray(v)
      ? [...v].sort().join('\n') === [...((was as string[] | null) ?? [])].sort().join('\n')
      : (v ?? null) === was || String(v ?? '') === String(was ?? '');
    if (!same) out[k] = v;
  }
  return out;
}
