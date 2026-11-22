'use client';
import { useRef, useState } from 'react';
import Script from 'next/script';
import { checkApplicant, RECRUIT, type RecruitPublic } from '@fecpc/contracts';
import { cropAvatarSquare } from '@/lib/image';

const required = [
  ['name', 'Full name', 'text', 'Nadia Rahman', 'name'],
  ['sid', 'Student ID', 'text', '2026-331-042', 'off'],
  ['dept', 'Department', 'text', 'CSE', 'off'],
  ['email', 'Email', 'email', 'you@example.com', 'email'],
  ['phone', 'Phone number', 'tel', '01712345678', 'tel'],
] as const;

/** Reads the form the way the API will: answers to the creator's questions go under `answers`. */
const read = (f: HTMLFormElement, photo: string) => {
  const d = Object.fromEntries(new FormData(f)) as Record<string, string>;
  const answers: Record<string, string> = {};
  for (const k of Object.keys(d)) if (k.startsWith('q:')) answers[k.slice(2)] = d[k]!;
  return { ...d, photo, answers };
};

// The same checks run here and in the API (`checkApplicant`), so what the form accepts the server accepts.
export default function ApplyForm({
  token,
  link,
  turnstile,
}: {
  token: string;
  link: RecruitPublic;
  turnstile?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [photo, setPhoto] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'closed'>('idle');
  const [err, setErr] = useState('');

  const recheck = (p = photo) =>
    form.current && setErrors(checkApplicant(read(form.current, p), link.form).errors);
  const touch = (k: string) => {
    setTouched((t) => new Set(t).add(k));
    recheck();
  };
  const shown = (k: string) => (touched.has(k) ? errors[k] : undefined);

  const pickPhoto = async (file?: File) => {
    setTouched((t) => new Set(t).add('photo'));
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setErrors((e) => ({ ...e, photo: 'Pick a PNG, JPEG or WebP image.' }));
      return;
    }
    try {
      const p = await cropAvatarSquare(file);
      if (p.length > RECRUIT.photoBytes) throw new Error();
      setPhoto(p);
      recheck(p);
    } catch {
      setErrors((e) => ({ ...e, photo: 'That image could not be used. Try another photo.' }));
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget,
      body = read(f, photo),
      found = checkApplicant(body, link.form).errors;
    setErrors(found);
    setTouched(new Set(['photo', ...Object.keys(found), ...required.map(([k]) => k)]));
    const first = Object.keys(found)[0];
    if (first) {
      f.querySelector<HTMLElement>(`[name="${first}"], #apply-photo`)?.focus();
      return;
    }
    setState('busy');
    setErr('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, token }),
      });
      if (res.ok) return setState('sent');
      if (res.status === 410) return setState('closed');
      setErr((await res.json()).error ?? 'That did not work. Try again.');
      (window as { turnstile?: { reset(): void } }).turnstile?.reset(); // its token is single-use
    } catch {
      setErr('You seem to be offline. Try again.');
    }
    setState('idle');
  };

  if (state === 'sent' || state === 'closed')
    return (
      <div className="panel" role="status">
        <h2 className={`h3 ${state === 'sent' ? 'ok' : ''}`}>
          {state === 'sent' ? 'Application received.' : 'This form just closed.'}
        </h2>
        <p className="body" style={{ marginTop: 10 }}>
          {state === 'sent'
            ? 'If you are accepted, you get an email with a link to set your password.'
            : 'Your application was not sent. Ask the club for the next link.'}
        </p>
      </div>
    );

  const field = (k: string, label: string, input: React.ReactNode, opt = false, wide = false) => (
    <label key={k} className={`field${wide ? ' wide' : ''}`}>
      <span className="label">
        {label}
        {opt && <span className="dim"> · optional</span>}
      </span>
      {input}
      {shown(k) && (
        <span className="apply-err" id={`e-${k}`} role="alert">
          {shown(k)}
        </span>
      )}
    </label>
  );
  const attrs = (k: string) => ({
    name: k,
    onBlur: () => touch(k),
    'aria-invalid': !!shown(k),
    'aria-describedby': shown(k) ? `e-${k}` : undefined,
  });
  const extras = link.form.cf || link.form.why || link.form.questions.length > 0;

  return (
    <form ref={form} className="panel flush" onSubmit={submit} noValidate>
      <div className="bar">
        <span>Application · Batch {link.batch}</span>
      </div>
      <div className="join-body">
        <div className="wide apply-photo-row">
          <label
            id="apply-photo"
            tabIndex={0}
            className={`apply-photo${shown('photo') ? ' bad' : ''}`}
            onKeyDown={(e) =>
              (e.key === 'Enter' || e.key === ' ') &&
              (e.preventDefault(), e.currentTarget.querySelector('input')?.click())
            }
            aria-describedby={shown('photo') ? 'e-photo' : undefined}
          >
            {photo ? <img src={photo} alt="Your photo" /> : <span aria-hidden>+</span>}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr"
              tabIndex={-1}
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </label>
          <div className="stack" style={{ '--g': '6px' } as React.CSSProperties}>
            <span className="label">Profile photo</span>
            <span className="body">A clear photo of your face. It becomes your member avatar.</span>
            {shown('photo') && (
              <span className="apply-err" id="e-photo" role="alert">
                {shown('photo')}
              </span>
            )}
          </div>
        </div>
        {required.map(([k, label, type, ph, ac]) =>
          field(
            k,
            label,
            <input
              className="input"
              type={type}
              placeholder={ph}
              autoComplete={ac}
              required
              {...attrs(k)}
            />,
          ),
        )}
        {field(
          'batch',
          'Batch',
          <input className="input" value={link.batch} readOnly aria-readonly tabIndex={-1} />,
        )}
        {extras && (
          <p className="wide label apply-split">
            Optional <span className="dim">· skip anything you like</span>
          </p>
        )}
        {link.form.cf &&
          field(
            'cf',
            'Codeforces handle',
            <input className="input" placeholder="tourist" autoComplete="off" {...attrs('cf')} />,
            true,
          )}
        {link.form.why &&
          field(
            'why',
            'What do you want to build or learn?',
            <textarea className="input" maxLength={1000} {...attrs('why')} />,
            true,
            true,
          )}
        {link.form.questions.map((q) =>
          field(
            `q:${q.id}`,
            q.label,
            q.long ? (
              <textarea className="input" maxLength={1000} {...attrs(`q:${q.id}`)} />
            ) : (
              <input className="input" maxLength={200} {...attrs(`q:${q.id}`)} />
            ),
            true,
            q.long,
          ),
        )}
        {/* Honeypot: off-screen and skipped by keyboard and screen readers; bots fill every field. */}
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          style={{ position: 'absolute', left: '-10000px' }}
        />
        {turnstile && (
          <>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
            <div className="cf-turnstile wide" data-sitekey={turnstile} />
          </>
        )}
        <div className="wide row" style={{ '--g': '20px' } as React.CSSProperties}>
          <button className="btn" disabled={state === 'busy'}>
            {state === 'busy' ? 'Sending…' : 'Submit application'}
          </button>
          {err && (
            <span className="body bad" role="alert">
              {err}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
