'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EVENT_STATUS_LABEL, EVENT_TYPES, type EventDetail } from '@fecpc/contracts';
import { bannerStyle, clubNow, fmtWhen, liveStatus } from '@/lib/events';
import { DatePicker } from '../shared/DatePicker';
import { SaveForm } from '../SaveBar';
import {
  FieldsEditor,
  pickDraft,
  useSaveEvent,
  windowProblem,
  type Draft,
} from './EventForm';

const FORM = 'ev-head-form';

export function MarkdownView({ text }: { text: string }) {
  if (!text || !text.trim()) {
    return (
      <p className="mono text-dim" style={{ fontSize: 13 }}>
        No description provided yet.
      </p>
    );
  }
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={i} style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>
            {trimmed.slice(4)}
          </h3>,
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={i} style={{ marginBottom: '0.6rem', fontSize: '1.4rem' }}>
            {trimmed.slice(3)}
          </h2>,
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={i} style={{ marginBottom: '0.75rem', fontSize: '1.6rem' }}>
            {trimmed.slice(2)}
          </h1>,
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <p
            key={i}
            style={{ marginBottom: '1rem', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
          />,
        );
      }
    }
  });
  flushList();
  return <>{elements}</>;
}

function formatInline(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="mono">$1</code>');
}

/**
 * The top of an event page: banner, tags, title and description.
 * Organisers edit these in place (the save bar saves them).
 */
export function EventHead({
  e,
  reload,
  aside,
}: {
  e: EventDetail;
  reload: () => void;
  aside?: ReactNode;
}) {
  const editable = !!e.admin && e.status !== 'completed';
  const start = useMemo(() => pickDraft(e), [e]);
  const [v, setV] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const saveEvent = useSaveEvent();
  const base = useRef(start);
  const justSaved = useRef(false);

  useEffect(() => {
    setV((cur) =>
      justSaved.current || JSON.stringify(cur) === JSON.stringify(base.current) ? start : cur,
    );
    base.current = start;
    justSaved.current = false;
  }, [start]);

  const set = (p: Draft) => {
    setError(null);
    setV((x) => ({ ...x, ...p }));
  };

  const tags = (
    <>
      <span className="tag dark">{liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]}</span>
      {e.fee > 0 && <span className="tag">৳{e.fee}</span>}
    </>
  );

  if (!editable) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="post">
          <div
            className={`banner${!e.banner ? ' has-pattern' : ''}`}
            data-type={e.type}
            style={bannerStyle(e.banner)}
          >
            {!e.banner && (
              <span className="mono" style={{ color: '#fff', fontSize: 13, zIndex: 1 }}>
                {e.title}
              </span>
            )}
          </div>
          <div className="pad" style={{ paddingBottom: 24 }}>
            <h1 className="title" style={{ cursor: 'default', margin: 0 }}>
              {e.title}
            </h1>
            <div className="meta">
              <span className="on">{e.type}</span>
              <span className="bl">● {liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]}</span>
              <span>{fmtWhen(e.startsAt)}</span>
              {e.place && <span>{e.place}</span>}
              {e.seats !== null && <span>{e.seats} seats</span>}
              <span>{e.fee > 0 ? `৳${e.fee}` : 'Free'}</span>
            </div>
          </div>

          <div className="tabs">
            <button type="button" className="tab on">
              Overview
            </button>
            <span className="mono" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
              EVENT DETAILS
            </span>
          </div>
          <div className="pad">
            <div className="ed-preview">
              <MarkdownView text={e.about || ''} />
            </div>
          </div>
        </div>

        {aside}
      </main>
    );
  }

  return (
    <>
      <SaveForm
        id={FORM}
        hidden
        label="Unsaved changes to this event"
        saveLabel="Save"
        trackFields={false}
        extraDirty={JSON.stringify(v) !== JSON.stringify(start)}
        onDiscard={() => {
          setV(start);
          setError(null);
        }}
        onSubmit={async () => {
          const ok = await saveEvent(v, start, { id: e.id }, setError);
          if (ok) {
            justSaved.current = true;
            reload();
          }
          return ok;
        }}
      />
      <HeadFields
        form={FORM}
        v={v}
        set={set}
        error={error}
        setError={setError}
        tags={tags}
        aside={aside}
        isOrganizer
      />
    </>
  );
}

/**
 * The event page's header as fields: banner, type, start, place, title and description, styled as the page.
 */
export function HeadFields({
  form: FORM,
  v,
  set,
  error,
  setError,
  tags,
  aside,
  creating,
  isOrganizer = true,
}: {
  form: string;
  v: Draft;
  set: (p: Draft) => void;
  error: string | null;
  setError: (e: string) => void;
  tags?: ReactNode;
  aside?: ReactNode;
  creating?: boolean;
  isOrganizer?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [descTab, setDescTab] = useState<'write' | 'preview'>('write');

  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="post">
        <button
          type="button"
          className={`banner${!v.banner ? ' has-pattern' : ''}`}
          aria-label="Upload banner image"
          title="Click anywhere to choose or change banner image"
          style={bannerStyle(v.banner ?? null)}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(x) => {
              const f = x.target.files?.[0];
              x.target.value = '';
              if (!f) return;
              if (f.size > 500_000)
                return setError('That image is over 500 KB. Pick a smaller one.');
              const r = new FileReader();
              r.onload = () => set({ banner: String(r.result) });
              r.readAsDataURL(f);
            }}
          />
          <span className="up">
            <svg
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            >
              <path d="M11 18V4M5 10l6-6 6 6" />
            </svg>
          </span>
          {v.banner && (
            <div className="banner-actions" onClick={(e) => e.stopPropagation()}>
              <span className="banner-badge">Click anywhere to change</span>
              <button
                type="button"
                className="banner-remove"
                onClick={() => set({ banner: null })}
              >
                Remove
              </button>
            </div>
          )}
        </button>

        <div className="pad" style={{ paddingBottom: 24 }}>
          <input
            form={FORM}
            className="title"
            value={v.title}
            placeholder="Event title"
            aria-label="Event title"
            required
            minLength={3}
            maxLength={140}
            onChange={(x) => set({ title: x.target.value.replace(/\s*\n\s*/g, ' ') })}
          />
          <div className="meta">
            <span className="on">
              <select
                value={v.type}
                onChange={(x) => set({ type: x.target.value })}
                aria-label="Event type"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </span>
            {tags ? (
              <span className="bl">{tags}</span>
            ) : (
              <span className="bl">● Sign-up open</span>
            )}
            <span>
              <DatePicker
                time
                required
                label="Starts"
                placeholder="Pick a start"
                min={creating ? clubNow().slice(0, 10) : undefined}
                value={v.startsAt ?? ''}
                onChange={(x) => set({ startsAt: x })}
              />
            </span>
            <span>
              <input
                form={FORM}
                aria-label="Place"
                placeholder="Add a place"
                maxLength={140}
                size={Math.max(8, (v.place ?? '').length + 1)}
                value={v.place}
                onChange={(x) => set({ place: x.target.value })}
              />
            </span>
            <span>
              <input
                form={FORM}
                type="number"
                min={1}
                placeholder="No limit"
                style={{ width: 56 }}
                value={v.seats ?? ''}
                onChange={(e) => set({ seats: e.target.value ? +e.target.value : null })}
              />
              <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                seats
              </span>
            </span>
            <span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                ৳
              </span>
              <input
                form={FORM}
                type="number"
                min={0}
                placeholder="Free"
                style={{ width: 44 }}
                value={v.fee || ''}
                onChange={(e) => set({ fee: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </span>
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${descTab === 'write' ? 'on' : ''}`}
            onClick={() => setDescTab('write')}
          >
            Write
          </button>
          <button
            type="button"
            className={`tab ${descTab === 'preview' ? 'on' : ''}`}
            onClick={() => setDescTab('preview')}
          >
            Preview
          </button>
          <span className="mono" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            Markdown supported
          </span>
        </div>

        <div className="pad">
          {descTab === 'write' ? (
            <textarea
              form={FORM}
              className="ed"
              aria-label="Event description"
              placeholder="What will happen, who it's for, what to bring."
              rows={8}
              maxLength={6000}
              value={v.about}
              onChange={(x) => set({ about: x.target.value })}
            />
          ) : (
            <div className="ed-preview">
              <MarkdownView text={v.about || ''} />
            </div>
          )}
        </div>
      </div>

      {/* In-place Sign-up Configuration & Questions on the canvas */}
      {!creating && isOrganizer && (
        <div className="sec-box">
          <div className="sec" style={{ borderTop: 0 }}>
            <h2>Registration &amp; sign-up</h2>
            <p className="sub">Configure the sign-up method, window and custom questions.</p>
            <div className="f">
              <div>
                <label className="mono" htmlFor="reg-how">
                  How do people sign up?
                </label>
                <select
                  id="reg-how"
                  className="ctl"
                  value={v.mode}
                  onChange={(x) => set({ mode: x.target.value as any })}
                >
                  <option value="platform">Here, on this site</option>
                  <option value="form">With a Google Form</option>
                </select>
              </div>
              <div>
                <label className="mono" htmlFor="reg-approval">
                  Who gets in?
                </label>
                <select
                  id="reg-approval"
                  className="ctl"
                  disabled={v.mode === 'form'}
                  value={v.approval}
                  onChange={(x) => set({ approval: x.target.value as any })}
                >
                  <option value="auto">Everyone, automatically</option>
                  <option value="manual">Only those I approve</option>
                </select>
              </div>
              {v.mode === 'form' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="mono" htmlFor="reg-form-url">
                    Google Form link
                  </label>
                  <input
                    id="reg-form-url"
                    className="ctl"
                    type="url"
                    placeholder="https://forms.gle/..."
                    value={v.formUrl ?? ''}
                    onChange={(x) => set({ formUrl: x.target.value || null })}
                  />
                </div>
              )}
              <div>
                <label className="mono">Sign-up opens · optional</label>
                <DatePicker
                  time
                  label="Sign-up opens"
                  className="ctl"
                  placeholder="Follows status"
                  max={v.regCloses || v.startsAt}
                  invalid={!!v.regOpens && !!windowProblem({ ...v, regCloses: null })}
                  value={v.regOpens ?? ''}
                  onChange={(x) => set({ regOpens: x || null })}
                />
              </div>
              <div>
                <label className="mono">Sign-up closes · optional</label>
                <DatePicker
                  time
                  label="Sign-up closes"
                  className="ctl"
                  placeholder="Until event starts"
                  min={v.regOpens}
                  max={v.startsAt}
                  invalid={!!v.regCloses && !!windowProblem({ ...v, regOpens: null })}
                  value={v.regCloses ?? ''}
                  onChange={(x) => set({ regCloses: x || null })}
                />
              </div>
            </div>
          </div>
          {v.mode !== 'form' && (
            <div className="sec">
              <h2 style={{ fontSize: 16 }}>Extra questions</h2>
              <p className="sub" style={{ marginBottom: 16 }}>
                We always ask for name and phone. Add anything else you need to know.
              </p>
              <FieldsEditor value={v.fields ?? []} onChange={(fields) => set({ fields })} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="bad" role="alert" style={{ fontSize: 14 }}>
          {error}
        </p>
      )}

      {aside}
    </main>
  );
}
