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
      <div className="dash" style={{ flexWrap: 'wrap' }}>
        <QR text={formUrl} size={160} />
        <span className="grow">
          <a className="btn sm b" href={formUrl} target="_blank" rel="noopener noreferrer">
            Open the form
          </a>
          <br />
          <span className="label">Answers stay with Google Forms.</span>
        </span>
      </div>
    ) : null;

  if (entry && entry.status !== 'cancelled')
    return (
      <div className="stack">
        <p
          className={entry.status === 'approved' ? 'ok' : entry.status === 'rejected' ? 'bad' : ''}
        >
          {STATUS[entry.status]}
        </p>
        {entry.status === 'rejected' && entry.reason && (
          <p className="body">
            <span className="label">Reason</span>
            <br />
            {entry.reason}
          </p>
        )}
        {entry.status !== 'rejected' && (
          <button
            className="btn sm line"
            type="button"
            onClick={async () => (await act('unregister', { eventId, roleId })) && done()}
          >
            Withdraw
          </button>
        )}
      </div>
    );
  if (!open) return <p className="label">{closedText}</p>;
  if (!editing)
    return (
      <button
        className="btn sm b"
        type="button"
        disabled={me.system}
        onClick={() => setEditing(true)}
      >
        {roleId ? 'Apply' : 'Register'}
      </button>
    );

  return (
    // Opening the form is the intent to register, so the bar shows right away.
    <SaveForm
      className="stack"
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
      <label className="field">
        <span className="label">Name</span>
        <input
          className="input"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="label">Phone</span>
        <input
          className="input"
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
      </label>
      {fields.map((f) => (
        <label key={f.label} className="field">
          <span className="label">
            {f.label}
            {f.required && ' *'}
          </span>
          {f.options ? (
            <select
              className="input"
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
              className="input"
              required={f.required}
              maxLength={1000}
              value={answers[f.label] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [f.label]: e.target.value })}
            />
          )}
        </label>
      ))}
      <div className="row">
        <button className="btn sm line" type="button" data-close onClick={() => setEditing(false)}>
          Back
        </button>
      </div>
    </SaveForm>
  );
}
