'use client';
import { useState } from 'react';
import Script from 'next/script';
import { tracks } from '@fecpc/content/site';

const fields = [
  ['name', 'Full name', 'text', 'Nadia Rahman', true],
  ['sid', 'Student ID', 'text', '2021-331-042', true],
  ['dept', 'Department', 'text', 'CSE', true],
  ['batch', 'Batch', 'number', '24', true],
  ['email', 'Email', 'email', 'you@university.edu', true],
  ['cf', 'Codeforces handle', 'text', 'optional', false],
] as const;

// Applications go to the database; the President and Secretary review them in the admin panel.
export default function JoinForm({ turnstile }: { turnstile?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState('busy');
    setErr('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      if (res.ok) return setState('sent');
      setErr((await res.json()).error ?? 'That did not work. Try again.');
      (window as { turnstile?: { reset(): void } }).turnstile?.reset(); // its token is single-use
    } catch {
      setErr('You seem to be offline. Try again.');
    }
    setState('idle');
  };
  if (state === 'sent')
    return (
      <div className="panel">
        <h2 className="h3 ok">Application received.</h2>
        <p className="body" style={{ marginTop: 10 }}>
          The President and Secretary review applications. If you are accepted you get an email with
          a link to set your password.
        </p>
      </div>
    );
  return (
    <form className="panel flush" onSubmit={submit}>
      <div className="bar">
        <span>Membership application</span>
      </div>
      <div className="join-body">
        {fields.map(([n, label, type, ph, req]) => (
          <label key={n} className="field">
            <span className="label">
              {label}
              {req ? '' : ' (optional)'}
            </span>
            <input
              className="input"
              name={n}
              type={type}
              placeholder={ph}
              required={req}
              autoComplete={n === 'email' ? 'email' : n === 'name' ? 'name' : 'off'}
            />
          </label>
        ))}
        <label className="field">
          <span className="label">First track</span>
          <select className="input" name="track" defaultValue="cp">
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span className="label">What do you want to build?</span>
          <textarea
            className="input"
            name="why"
            required
            minLength={10}
            maxLength={1000}
            placeholder="Two or three sentences. There is no wrong answer."
          />
        </label>
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
          {err ? (
            <span className="body bad" role="alert">
              {err}
            </span>
          ) : (
            <span className="label">goes to the President and Secretary</span>
          )}
        </div>
      </div>
    </form>
  );
}
