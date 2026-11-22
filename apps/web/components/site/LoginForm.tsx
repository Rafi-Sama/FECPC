'use client';
import { useState } from 'react';

// One form for both doors: email + password, or an invite link that sets the first password.
export default function LoginForm({ invite, error }: { invite?: string; error?: string }) {
  const [err, setErr] = useState(error ?? '');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
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
      className="panel stack auth"
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
        <span className="pw">
          <input
            className="input"
            name="password"
            type={show ? 'text' : 'password'}
            required
            minLength={invite ? 10 : 1}
            maxLength={200}
            autoComplete={invite ? 'new-password' : 'current-password'}
            autoFocus={!!invite}
          />
          <button
            type="button"
            className="pw-eye"
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {show && <path d="M3 3l18 18" />}
            </svg>
          </button>
        </span>
      </label>
      {err && (
        <p className="body bad" role="alert">
          {err}
        </p>
      )}
      <button className="btn" disabled={busy}>
        {busy ? 'One moment…' : invite ? 'Set password and sign in' : 'Sign in'}
      </button>
      {!invite && (
        <>
          <p className="auth-or label">or</p>
          <div className="auth-alt">
            <a href="/api/auth/google">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
                />
              </svg>
              Google
            </a>
            <a href="/api/auth/github">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"
                />
              </svg>
              GitHub
            </a>
          </div>
          <p className="auth-foot body">
            Not a member yet? Apply through the recruitment link the committee shares each intake.
          </p>
        </>
      )}
    </form>
  );
}
