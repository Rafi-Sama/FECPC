'use client';
import { SaveForm } from '../SaveBar';
import { useState } from 'react';
import QR from '../QR';
import { useStore } from '../Store';
import type { EventEntry, EventField } from '@fecpc/contracts';

import { fieldLabel, fieldStack } from './ui';

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
      <div className="stack gap-3.5 items-center text-center">
        <div className="p-2 [background:#ffffff] [border:1px_solid_var(--line2)] inline-flex [box-shadow:2px_2px_0_var(--line2)]">
          <QR text={formUrl} size={130} />
        </div>
        <div className="stack gap-1.5 w-full items-center">
          <a
            className="eb py-2.5 px-3.5 block w-full text-center [text-decoration:none] [background:var(--acc)] [color:white] border-acc font-bold text-[14px]"
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the form ↗
          </a>
          <span className="mono text-dim text-[14px] uppercase tracking-[0.06em]">
            Answers stay with Google Forms.
          </span>
        </div>
      </div>
    ) : null;

  const entryStatus =
    entry?.status === 'approved'
      ? 'completed'
      : entry?.status === 'rejected'
        ? 'cancelled'
        : 'draft';

  if (entry && entry.status !== 'cancelled')
    return (
      <div className="stack gap-3">
        <div className="row py-2 px-3 items-center gap-2 [background:var(--bg)] [border:1px_solid_var(--line)]">
          <span className="ev-status-dot" data-status={entryStatus} />
          <span className="mono text-[14px] font-semibold text-hi">{STATUS[entry.status]}</span>
        </div>
        {entry.status === 'rejected' && entry.reason && (
          <p className="mono text-dim m-0 text-[14px]">
            <span className="text-bad font-semibold">Reason: </span>
            {entry.reason}
          </p>
        )}
        {entry.status !== 'rejected' && !locked && (
          <button
            className="del [.ev-detail_&]:[font-family:var(--f-mono,monospace)] [.ev-detail_&]:[font-weight:700] [.ev-detail_&]:text-[14px] [.ev-detail_&]:uppercase [.ev-detail_&]:[background:none] [.ev-detail_&]:[border:0] [.ev-detail_&&]:[border-bottom:1px_solid_transparent] [.ev-detail_&]:text-bad [.ev-detail_&]:cursor-pointer [.ev-detail_&]:[transition:border-color_0.2s] [.ev-detail_&:hover]:[border-bottom-color:var(--bad)] py-2 px-3 w-full justify-center"
            type="button"
            onClick={async () => (await act('unregister', { eventId, roleId })) && done()}
          >
            Withdraw application
          </button>
        )}
      </div>
    );
  if (!open) return <p className="mono text-dim m-0 text-[14px]">{closedText}</p>;
  if (!editing)
    return (
      <button
        className="eb p-3 w-full [background:var(--acc)] [color:white] border-acc font-bold text-[14px]"
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
      className="stack gap-3"
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
      <div className={fieldStack}>
        <span className={fieldLabel}>Name</span>
        <input
          className="ctl"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className={fieldStack}>
        <span className={fieldLabel}>Phone</span>
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
        <div key={f.label} className={fieldStack}>
          <span className={fieldLabel}>
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
      <div className="row mt-2 gap-2">
        <button
          className="eb py-2.5 px-4 flex-1 [background:var(--acc)] [color:white] border-acc font-bold text-[14px]"
          type="submit"
        >
          {roleId ? 'Send Application' : 'Register'}
        </button>
        <button
          className="eb py-2.5 px-3.5 text-[14px]"
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
