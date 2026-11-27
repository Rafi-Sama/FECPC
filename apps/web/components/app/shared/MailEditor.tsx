'use client';
// Designs one club email (HTML + CSS) with a live preview. The checks and the filling are the API's own
// (`checkMailTemplate`, `renderMail`), so what the preview shows is what people receive.
import { useEffect, useRef, useState } from 'react';
import {
  checkMailTemplate,
  DEFAULT_MAIL,
  MAIL_MAX_HTML,
  MAIL_VARS,
  renderMail,
  type MailKind,
  type MailTemplate,
} from '@fecpc/contracts';
import { useStore } from '../Store';
import { useConfirm } from './PromptDialog';

import { previewCard, previewMeta, formFoot } from '@/components/app/shared/ui';

export function MailEditor({
  kind,
  title,
  current,
  sample,
  onSave,
  onClose,
}: {
  kind: MailKind;
  title: string;
  /** The saved design; null = the built-in one. */
  current: MailTemplate | null;
  sample: Record<string, string>;
  /** null resets to the built-in design. */
  onSave: (t: MailTemplate | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const { act, office } = useStore();
  const sure = useConfirm();
  const start = current ?? DEFAULT_MAIL[kind];
  const [subject, setSubject] = useState(start.subject);
  const [html, setHtml] = useState(start.html);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [busy, setBusy] = useState(false);
  const last = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const check = checkMailTemplate(kind, { subject, html });
  const view = renderMail(check.value, sample);
  const dirty = subject !== start.subject || html !== start.html;
  const isDefault = subject === DEFAULT_MAIL[kind].subject && html === DEFAULT_MAIL[kind].html;

  const leave = async () => {
    if (
      !dirty ||
      (await sure('Discard your changes?', 'The email stays as it was.', 'Discard', true))
    )
      onClose();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && void leave();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  // Puts `{{key}}` where the cursor was, in the subject or the body (whichever was used last).
  const insert = (key: string) => {
    const el = last.current ?? document.getElementById('mail-html');
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    const at = el.selectionStart ?? el.value.length,
      to = el.selectionEnd ?? at,
      tag = `{{${key}}}`,
      next = el.value.slice(0, at) + tag + el.value.slice(to);
    (el.id === 'mail-subject' ? setSubject : setHtml)(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + tag.length, at + tag.length);
    });
  };
  const save = async () => {
    setBusy(true);
    const ok = await onSave(isDefault ? null : check.value);
    setBusy(false);
    if (ok) onClose();
  };
  const test = async () => {
    setBusy(true);
    await act('mailTest', { kind, ...check.value });
    setBusy(false);
  };
  const kb = (html.length / 1000).toFixed(1);

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && void leave()}
    >
      <div className="cm-modal wide me">
        <header className="cm-modal-head">
          <h2 className="h3">{title}</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={leave}>
            ×
          </button>
        </header>
        <div className="[display:grid] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 min-h-0 max-[901px]:grid-cols-[1fr]">
          <div className="flex flex-col gap-3.5 min-w-0">
            <label className="field">
              <span className="label">Subject</span>
              <input
                id="mail-subject"
                className="input"
                value={subject}
                maxLength={150}
                onFocus={(e) => (last.current = e.target)}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <div className="field">
              <span className="label">Insert a placeholder</span>
              <div className="flex flex-wrap gap-1.5">
                {MAIL_VARS[kind].map(([k, d]) => (
                  <button
                    key={k}
                    type="button"
                    className="p-[5px_9px] [border:1px_solid_var(--line2)] [background:none] text-ink font-label text-[14px] cursor-pointer hover:border-acc hover:text-acc focus-visible:border-acc focus-visible:text-acc"
                    title={d}
                    onClick={() => insert(k)}
                  >
                    {`{{${k}}}`}
                  </button>
                ))}
              </div>
            </div>
            <label className="field [&_textarea]:min-h-[340px] [&_textarea]:font-label [&_textarea]:text-[14px] [&_textarea]:leading-[1.5] [&_textarea]:[tab-size:2] [&_textarea]:whitespace-pre [&_textarea]:[overflow-wrap:normal] max-[901px]:[&_textarea]:min-h-[240px]">
              <span className="label">
                Body · HTML and CSS <span className="dim">· {kb} KB of 100</span>
              </span>
              <textarea
                id="mail-html"
                className="input"
                spellCheck={false}
                value={html}
                maxLength={MAIL_MAX_HTML + 5000}
                onFocus={(e) => (last.current = e.target)}
                onChange={(e) => setHtml(e.target.value)}
              />
            </label>
            <p className="[color:var(--dim)] text-[14px]">
              Gmail keeps inline styles and a &lt;style&gt; block. Scripts, forms and custom fonts
              are removed. Images must be https links.
            </p>
          </div>
          <div className="flex flex-col gap-3.5 min-w-0">
            <div className="row between">
              <span className="label">Preview with sample details</span>
              <div className="rc-seg" role="tablist" aria-label="Preview size">
                {(['desktop', 'phone'] as const).map((d) => (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={device === d}
                    className={device === d ? 'on' : ''}
                    onClick={() => setDevice(d)}
                  >
                    {d === 'desktop' ? 'Desktop' : 'Phone'}
                  </button>
                ))}
              </div>
            </div>
            <div className={previewCard}>
              <p className={previewMeta}>
                <span className="dim">Subject</span> {view.subject || '—'}
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={view.html}
                className={`me-frame ${device}`}
              />
            </div>
          </div>
        </div>
        <footer className={formFoot}>
          <span className={check.error ? 'bad' : 'label'} role={check.error ? 'alert' : undefined}>
            {check.error ??
              (isDefault ? 'This is the built-in design.' : dirty ? 'Unsaved changes.' : 'Saved.')}
          </span>
          <div className="rc-row-actions">
            {!isDefault && (
              <button
                type="button"
                className="btn sm line"
                onClick={() => {
                  setSubject(DEFAULT_MAIL[kind].subject);
                  setHtml(DEFAULT_MAIL[kind].html);
                }}
              >
                Reset to built-in
              </button>
            )}
            <button
              type="button"
              className="btn sm line"
              disabled={busy || !!check.error || !office.mail?.ready}
              title={
                office.mail?.ready ? 'Sends this design to your own email' : 'Email is not set up'
              }
              onClick={test}
            >
              Send me a test
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={busy || !!check.error || !dirty}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** How email is doing: sent in the last 24 h against the daily limit, what waits, what failed and why. */
export function MailStatus() {
  const { office, act } = useStore();
  const m = office.mail;
  if (!m) return null;
  if (!m.ready)
    return (
      <div className="ms off">
        <b>Email is off.</b> The server has no SMTP_URL, so accepted applicants get a link you pass
        on yourself, and event approvals are not emailed.
      </div>
    );
  const pct = Math.min(100, Math.round((m.sent / m.limit) * 100));
  return (
    <div className={`ms${m.problem || m.failed.length || m.paused.length ? ' warn' : ''}`}>
      <div className="ms-line">
        <span>
          <b>Email</b> · {m.sent} of {m.limit} sent in the last 24 h
          {m.queued > 0 && ` · ${m.queued} waiting`}
        </span>
        <span className="ms-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>
      {m.problem && <p className="ms-problem">{m.problem}</p>}
      {m.paused.length > 0 && (
        <p className="ms-problem">
          {m.paused.map((p) => (
            <span key={p.account}>
              <b>{p.account}</b> rests until{' '}
              {new Date(p.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              .{' '}
            </span>
          ))}
          <button type="button" className="btn xs line" onClick={() => void act('mailRetry', {})}>
            Retry now
          </button>
        </p>
      )}
      {m.failed.length > 0 && (
        <details className="ms-failed">
          <summary>
            {m.failed.length} not sent
            <button
              type="button"
              className="btn xs line"
              onClick={(e) => {
                e.preventDefault();
                void act('mailRetry', {});
              }}
            >
              Retry
            </button>
          </summary>
          <ul>
            {m.failed.map((f) => (
              <li key={f.id}>
                <b>{f.to}</b> · {f.subject}
                <span>{f.error}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
