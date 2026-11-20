'use client';
import Link from 'next/link';
import { useState } from 'react';

// One form for both doors: email + password, or an invite link that sets the first password.
export default function LoginForm({
  invite,
  error,
  google,
}: {
  invite?: string;
  error?: string;
  google: boolean;
}) {
  const [err, setErr] = useState(error ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(invite ? '/api/auth/invite' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(invite ? { token: invite, password: d.password } : d),
      });
      if (res.ok) return void (location.href = '/app');
      setErr((await res.json()).error ?? 'That did not work. Try again.');
    } catch {
      setErr('You seem to be offline. Try again.');
    }
    setBusy(false);
  };
  return (
    <form
      className="panel stack"
      style={{ '--g': '16px' } as React.CSSProperties}
      onSubmit={submit}
    >
      {!invite && (
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
          />
        </label>
      )}
      <label className="field">
        <span className="label">
          {invite ? 'New password · at least 10 characters' : 'Password'}
        </span>
        <input
          className="input"
          name="password"
          type="password"
          required
          minLength={invite ? 10 : 1}
          maxLength={200}
          autoComplete={invite ? 'new-password' : 'current-password'}
          autoFocus={!!invite}
        />
      </label>
      {err && (
        <p className="body bad" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ '--g': '12px' } as React.CSSProperties}>
        <button className="btn" disabled={busy}>
          {busy ? 'One moment…' : invite ? 'Set password and sign in' : 'Sign in'}
        </button>
        {google && !invite && (
          <a className="btn line" href="/api/auth/google">
            Sign in with Google
          </a>
        )}
      </div>
      {!invite && (
        <p className="body">
          Not a member yet?{' '}
          <Link className="link" href="/join">
            Apply to join
          </Link>
          . An officer sends you a link to set your password once you are accepted.
        </p>
      )}
    </form>
  );
}
