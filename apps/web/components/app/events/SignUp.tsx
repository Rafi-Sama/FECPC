'use client';
import { SaveForm } from '../SaveBar';
import { useState } from 'react';
import QR from '../QR';
import { useStore } from '../Store';
import type { EventEntry, EventField } from '@fecpc/contracts';

const STATUS: Record<EventEntry['status'], string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Declined',
  cancelled: 'Cancelled',
};

/**
 * Sign up for an event or one of its roles. A Google Forms one shows its link and QR code only (nothing is counted
 * here); a platform one asks for name, phone and the organisers' questions, then shows the entry's status.
 */
export function SignUp({
  eventId,
  roleId,
  mode,
  formUrl,
  fields,
  entry,
  open,
  locked,
  closedText,
  done,
}: {
  eventId: string;
  roleId?: number;
  mode: 'platform' | 'form';
  formUrl: string | null;
  fields: EventField[];
  entry?: EventEntry;
  open: boolean;
  /** The event is over: entries can no longer be withdrawn. */
  locked?: boolean;
  closedText: string;
  done: () => void;
}) {
  const { me, act } = useStore();
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  if (mode === 'form')
    return formUrl ? (
      <div className="stack" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
        <div
          style={{
            background: '#ffffff',
            padding: 8,
            border: '1px solid var(--line2)',
            display: 'inline-flex',
            boxShadow: '2px 2px 0 var(--line2)',
          }}
        >
          <QR text={formUrl} size={130} />
        </div>
        <div className="stack" style={{ gap: 6, width: '100%', alignItems: 'center' }}>
          <a
            className="eb"
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 14px',
              textAlign: 'center',
              textDecoration: 'none',
              background: 'var(--acc)',
              color: 'white',
              borderColor: 'var(--acc)',
              fontWeight: 700,
              fontSize: 13,
            }}
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the form ↗
          </a>
          <span className="mono text-dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Answers stay with Google Forms.
          </span>
        </div>
      </div>
    ) : null;

  const entryStatus =
    entry?.status === 'approved' ? 'completed' : entry?.status === 'rejected' ? 'cancelled' : 'draft';

  if (entry && entry.status !== 'cancelled')
    return (
      <div className="stack" style={{ gap: 12 }}>
        <div
          className="row"
          style={{
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
          }}
        >
          <span
            className="ev-status-dot"
            data-status={entryStatus}
          />
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--hi)' }}>
            {STATUS[entry.status]}
          </span>
        </div>
        {entry.status === 'rejected' && entry.reason && (
          <p className="mono text-dim" style={{ fontSize: 12, margin: 0 }}>
            <span style={{ color: 'var(--bad)', fontWeight: 600 }}>Reason: </span>
            {entry.reason}
          </p>
        )}
        {entry.status !== 'rejected' && !locked && (
          <button
            className="del"
            type="button"
            style={{ width: '100%', justifyContent: 'center', padding: '8px 12px' }}
            onClick={async () => (await act('unregister', { eventId, roleId })) && done()}
          >
            Withdraw application
          </button>
        )}
      </div>
    );
  if (!open) return <p className="mono text-dim" style={{ fontSize: 12, margin: 0 }}>{closedText}</p>;
  if (!editing)
    return (
      <button
        className="eb"
        style={{
          width: '100%',
          padding: '12px',
          background: 'var(--acc)',
          color: 'white',
          borderColor: 'var(--acc)',
          fontWeight: 700,
          fontSize: 13,
        }}
        type="button"
        disabled={me.system}
        onClick={() => setEditing(true)}
      >
        {roleId ? 'Apply for Role' : 'Register'}
      </button>
    );

  return (
    // Opening the form is the intent to register, so the bar shows right away.
    <SaveForm
      className="stack"
      style={{ gap: 12 }}
      label={roleId ? 'Application not sent' : 'Registration not sent'}
      saveLabel={roleId ? 'Send application' : 'Register'}
      extraDirty
      onDiscard={() => setEditing(false)}
      onSubmit={async () => {
        const ok = await act('register', {
          eventId,
          roleId,
          name: name.trim(),
          phone: phone.trim(),
          answers: Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, a.trim()])),
        });
        if (ok) {
          setEditing(false);
          done();
        }
        return ok;
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</span>
        <input
          className="ctl"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</span>
        <input
          className="ctl"
          type="tel"
          required
          minLength={6}
          maxLength={20}
          pattern="[0-9+ \-]{6,20}"
          title="Digits, spaces, + and - only"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {fields.map((f) => (
        <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {f.label}
            {f.required && ' *'}
          </span>
          {f.options ? (
            <select
              className="ctl"
              required={f.required}
              value={answers[f.label] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [f.label]: e.target.value })}
            >
              <option value="">Choose</option>
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              className="ctl"
              required={f.required}
              maxLength={1000}
              value={answers[f.label] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [f.label]: e.target.value })}
            />
          )}
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button
          className="eb"
          style={{
            flex: 1,
            padding: '10px 16px',
            background: 'var(--acc)',
            color: 'white',
            borderColor: 'var(--acc)',
            fontWeight: 700,
            fontSize: 13,
          }}
          type="submit"
        >
          {roleId ? 'Send Application' : 'Register'}
        </button>
        <button
          className="eb"
          style={{ padding: '10px 14px', fontSize: 13 }}
          type="button"
          data-close
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </SaveForm>
  );
}
