'use client';
// One form for profile data, two uses: an officer edits a member directly (`edit`), or a member asks for a
// change (`request`). The checks are the API's own (`checkProfile`), and only changed fields are sent.
import { useEffect, useRef, useState } from 'react';
import {
  checkProfile,
  PROFILE_FIELDS,
  profileDiff,
  type MemberProfile,
  type ProfileChanges,
  type ProfileField,
} from '@fecpc/contracts';
import { cropAvatarSquare } from '@/lib/image';
import { useStore } from '../Store';
import { MemberFace } from '../shared/MemberFace';
import { useConfirm } from '../shared/PromptDialog';

import { formFoot } from '@/components/app/shared/ui';

type Values = Record<ProfileField, string>;
const HANDLES: ProfileField[] = ['cf_handle', 'vjudge_handle'];
const INPUT: Partial<Record<ProfileField, { type?: string; ph: string; wide?: boolean }>> = {
  name: { ph: 'Nadia Rahman' },
  dept: { ph: 'CSE' },
  batch: { type: 'number', ph: '27' },
  student_id: { ph: '2027-331-042' },
  phone: { type: 'tel', ph: '01712345678' },
  location: { ph: 'Faridpur' },
  cf_handle: { ph: 'tourist' },
  vjudge_handle: { ph: 'username' },
  github_url: { type: 'url', ph: 'https://github.com/username', wide: true },
  linkedin_url: { type: 'url', ph: 'https://linkedin.com/in/username', wide: true },
  skills: { ph: 'DP, Graphs, React', wide: true },
};

/** The profile as form text. Skills are typed comma-separated. */
const toValues = (p: MemberProfile): Values => ({
  avatar_url: p.avatar_url ?? '',
  name: p.name,
  dept: p.dept,
  batch: String(p.batch),
  student_id: p.student_id ?? '',
  phone: p.phone ?? '',
  location: p.location ?? '',
  bio: p.bio ?? '',
  cf_handle: p.cf_handle ?? '',
  vjudge_handle: p.vjudge_handle ?? '',
  github_url: p.github_url ?? '',
  linkedin_url: p.linkedin_url ?? '',
  skills: p.skills.join(', '),
});
const toInput = (v: Partial<Values>) =>
  Object.fromEntries(
    Object.entries(v).map(([k, x]) => [
      k,
      k === 'skills'
        ? (x ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : x,
    ]),
  );

export function ProfileForm({
  profile,
  mode,
  onClose,
}: {
  profile: MemberProfile;
  mode: 'edit' | 'request';
  onClose: (saved: boolean) => void;
}) {
  const { act } = useStore();
  const sure = useConfirm();
  // A member links a judge handle themselves the first time; only a linked one is changed by request.
  const fields = PROFILE_FIELDS.filter(
    ([k]) => mode === 'edit' || !HANDLES.includes(k) || !!profile[k as 'cf_handle'],
  );
  const start = toValues(profile);
  const [v, setV] = useState<Values>(start);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const keys = fields.map(([k]) => k);
  const pick = (x: Values) => Object.fromEntries(keys.map((k) => [k, x[k]])) as Partial<Values>;
  const { value, errors } = checkProfile(toInput(pick(v)));
  const current = checkProfile(toInput(pick(start))).value;
  for (const k of HANDLES)
    if (current[k] && value[k] === null) errors[k] = 'A judge handle can be changed, not removed.';
  const changes: ProfileChanges = profileDiff(value, current);
  const n = Object.keys(changes).length;
  const shown = (k: ProfileField) => (tried || changes[k] !== undefined ? errors[k] : undefined);
  const set = (k: ProfileField) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  const leave = async () => {
    if (!n || (await sure('Discard your changes?', '', 'Discard', true))) onClose(false);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && void leave();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const photo = async (f?: File) => {
    setPhotoErr('');
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type))
      return setPhotoErr('Pick a PNG, JPEG or WebP image.');
    try {
      setV((x) => ({ ...x, avatar_url: '' }));
      const p = await cropAvatarSquare(f);
      setV((x) => ({ ...x, avatar_url: p }));
    } catch {
      setPhotoErr('That image could not be used. Try another one.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length || !n) return;
    setBusy(true);
    const ok =
      mode === 'edit'
        ? await act('updateProfile', { user: profile.id, ...changes })
        : await act('profileRequest', { changes, ...(note.trim() ? { note: note.trim() } : {}) });
    setBusy(false);
    if (ok) onClose(true);
  };

  const title =
    mode === 'edit' ? `Edit ${profile.name}'s profile` : 'Request a change to your profile';
  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && void leave()}
    >
      <form
        className="cm-modal [&_.input[aria-invalid='true']]:border-bad max-w-[760px]"
        onSubmit={submit}
        noValidate
      >
        <header className="cm-modal-head">
          <h2 className="h3">{title}</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={leave}>
            ×
          </button>
        </header>
        {mode === 'request' && (
          <p className="[color:var(--mut)]">
            Change what you need; the Secretary or President reviews it.
          </p>
        )}
        <div className="flex items-center gap-4">
          <MemberFace url={v.avatar_url || null} name={v.name || profile.name} size={88} />
          <div className="stack [--g:8px]">
            <span className="font-label text-[14px] [color:var(--mut)]">
              Photo
              {changes.avatar_url !== undefined && (
                <i className="not-italic text-acc"> · changed</i>
              )}
            </span>
            <div className="row [--g:8px]">
              <button type="button" className="btn xs line" onClick={() => file.current?.click()}>
                {v.avatar_url ? 'Replace photo' : 'Add a photo'}
              </button>
              {v.avatar_url && (
                <button
                  type="button"
                  className="btn xs line"
                  onClick={() => setV((x) => ({ ...x, avatar_url: '' }))}
                >
                  Remove
                </button>
              )}
            </div>
            {(photoErr || shown('avatar_url')) && (
              <span className="text-bad text-[14px]" role="alert">
                {photoErr || shown('avatar_url')}
              </span>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr"
            onChange={(e) => {
              void photo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="[&_.wide]:[grid-column:1_/_-1] [display:grid] grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-[14px_16px]">
          {fields
            .filter(([k]) => k !== 'avatar_url')
            .map(([k, label]) => (
              <label key={k} className={`field${k === 'bio' || INPUT[k]?.wide ? ' wide' : ''}`}>
                <span className="font-label text-[14px] [color:var(--mut)]">
                  {label}
                  {changes[k] !== undefined && <i className="not-italic text-acc"> · changed</i>}
                </span>
                {k === 'bio' ? (
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={400}
                    value={v.bio}
                    onChange={set('bio')}
                    aria-invalid={!!shown(k)}
                  />
                ) : (
                  <input
                    className="input"
                    type={INPUT[k]?.type ?? 'text'}
                    placeholder={INPUT[k]?.ph}
                    value={v[k]}
                    onChange={set(k)}
                    aria-invalid={!!shown(k)}
                  />
                )}
                {shown(k) && (
                  <span className="text-bad text-[14px]" role="alert">
                    {shown(k)}
                  </span>
                )}
              </label>
            ))}
          {mode === 'request' && (
            <label className="field wide">
              <span className="font-label text-[14px] [color:var(--mut)]">
                Note for the reviewer · optional
              </span>
              <input
                className="input"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. new phone number since November"
              />
            </label>
          )}
        </div>
        <footer className={formFoot}>
          <span className="font-label text-[14px] [color:var(--mut)]">
            {n ? `${n} change${n === 1 ? '' : 's'}` : 'Nothing changed yet'}
          </span>
          <button className="btn sm" disabled={busy || !n}>
            {busy ? 'Sending…' : mode === 'edit' ? 'Save changes' : 'Send request'}
          </button>
        </footer>
      </form>
    </div>
  );
}
