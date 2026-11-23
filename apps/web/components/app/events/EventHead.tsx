'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EVENT_STATUS_LABEL, EVENT_TYPES, type EventDetail } from '@fecpc/contracts';
import { bannerStyle, clubNow, fmtWhen, liveStatus } from '@/lib/events';
import { DatePicker } from '../shared/DatePicker';
import { SaveForm } from '../SaveBar';
import {
  FieldsEditor,
  Method,
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
      <div className="event-canvas">
        <div className="hero">
          <div className="hero-banner" data-type={e.type} style={bannerStyle(e.banner)}>
            {!e.banner && <span>{e.title}</span>}
          </div>
          <div className="hero-content">
            <div className="event-meta-tags">
              <span className="tag primary">{e.type}</span>
              <span className="tag dark">{liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]}</span>
              <span className="tag">{fmtWhen(e.startsAt)}</span>
              {e.place && <span className="tag">{e.place}</span>}
              {tags}
            </div>
            <h1 className="event-title">{e.title}</h1>
          </div>
        </div>

        <div className="markdown-section">
          <div className="editor-toolbar">
            <div className="editor-tabs">
              <button type="button" className="editor-tab active">
                Overview
              </button>
            </div>
            <span className="mono text-dim" style={{ fontSize: 11 }}>
              EVENT DETAILS
            </span>
          </div>
          <div className="markdown-body">
            <MarkdownView text={e.about || ''} />
          </div>
        </div>

        {aside}
      </div>
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
    <div className="event-canvas">
      {isOrganizer && !creating && (
        <div className="edit-banner">
          <span>ORGANIZER MODE: EDIT IN PLACE</span>
        </div>
      )}

      <div className="hero">
        <div
          className="hero-banner"
          data-type={v.type}
          style={{
            ...bannerStyle(v.banner ?? null),
            cursor: 'pointer',
            position: 'relative',
          }}
          title="Click anywhere to choose or change banner image"
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

          {!v.banner ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.3)',
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--panel)',
                  color: 'var(--hi)',
                  padding: '6px 14px',
                  border: '2px solid var(--line2)',
                  boxShadow: '3px 3px 0 var(--line2)',
                }}
              >
                📷 Click anywhere to upload a banner image
              </span>
            </div>
          ) : (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                display: 'flex',
                gap: 6,
                zIndex: 2,
              }}
            >
              <span
                className="tag dark"
                style={{
                  background: 'rgba(0,0,0,0.7)',
                  borderColor: 'rgba(255,255,255,0.4)',
                  color: '#fff',
                  fontSize: 11,
                }}
              >
                Click to change
              </span>
              <button
                type="button"
                className="btn xs danger"
                onClick={(e) => {
                  e.stopPropagation();
                  set({ banner: null });
                }}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div className="hero-content">
          <div className="event-meta-tags">
            <select
              className="tag primary"
              aria-label="Type"
              value={v.type}
              onChange={(x) => set({ type: x.target.value })}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {tags}
            <DatePicker
              time
              required
              label="Starts"
              className="tag"
              placeholder="Pick a start"
              min={creating ? clubNow().slice(0, 10) : undefined}
              value={v.startsAt ?? ''}
              onChange={(x) => set({ startsAt: x })}
            />
            <input
              form={FORM}
              className="tag"
              aria-label="Place"
              placeholder="Add a place"
              maxLength={140}
              size={Math.max(10, (v.place ?? '').length + 1)}
              value={v.place}
              onChange={(x) => set({ place: x.target.value })}
            />
            <label className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="mono text-dim">Seats:</span>
              <input
                form={FORM}
                type="number"
                min={1}
                placeholder="No limit"
                style={{
                  width: 64,
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  font: 'inherit',
                  padding: 0,
                  outline: 'none',
                }}
                value={v.seats ?? ''}
                onChange={(e) => set({ seats: e.target.value ? +e.target.value : null })}
              />
            </label>
            <label className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="mono text-dim">Fee: ৳</span>
              <input
                form={FORM}
                type="number"
                min={0}
                placeholder="Free"
                style={{
                  width: 52,
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  font: 'inherit',
                  padding: 0,
                  outline: 'none',
                }}
                value={v.fee || ''}
                onChange={(e) => set({ fee: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </label>
          </div>

          <h1 className="event-title">
            <textarea
              form={FORM}
              className="edit-input"
              aria-label="Title"
              placeholder="Event title"
              required
              rows={1}
              minLength={3}
              maxLength={140}
              value={v.title}
              onKeyDown={(x) => x.key === 'Enter' && x.preventDefault()}
              onChange={(x) => set({ title: x.target.value.replace(/\s*\n\s*/g, ' ') })}
              spellCheck={false}
            />
          </h1>
        </div>
      </div>

      <div className="markdown-section">
        <div className="editor-toolbar">
          <div className="editor-tabs">
            <button
              type="button"
              className={`editor-tab ${descTab === 'write' ? 'active' : ''}`}
              onClick={() => setDescTab('write')}
            >
              Write
            </button>
            <button
              type="button"
              className={`editor-tab ${descTab === 'preview' ? 'active' : ''}`}
              onClick={() => setDescTab('preview')}
            >
              Preview
            </button>
          </div>
          <span className="mono text-dim" style={{ fontSize: 11 }}>
            MARKDOWN SUPPORTED
          </span>
        </div>
        <div className="markdown-body">
          {descTab === 'write' ? (
            <textarea
              form={FORM}
              className="edit-input"
              aria-label="Description"
              placeholder="What will happen, who it's for, what to bring."
              rows={8}
              maxLength={6000}
              value={v.about}
              onChange={(x) => set({ about: x.target.value })}
            />
          ) : (
            <MarkdownView text={v.about || ''} />
          )}
        </div>
      </div>

      {/* In-place Sign-up Configuration & Questions on the canvas */}
      {!creating && isOrganizer && (
        <section
          className="panel stack"
          style={{
            border: '2px solid var(--line2)',
            background: 'var(--panel)',
            padding: '1.25rem',
            gap: '1rem',
          }}
        >
          <div
            className="row between"
            style={{
              borderBottom: '1px solid var(--line)',
              paddingBottom: '0.6rem',
            }}
          >
            <div>
              <h3 className="h3" style={{ fontSize: 16, margin: 0 }}>
                Registration &amp; Sign-up
              </h3>
              <span className="mono text-dim" style={{ fontSize: 11 }}>
                Configure sign-up method, window and custom questions
              </span>
            </div>
          </div>

          <Method v={v as any} set={set as any} />

          <div className="row ev-pair" style={{ gap: '1rem' }}>
            <label className="field grow">
              <span className="label">Sign-up opens (optional)</span>
              <DatePicker
                time
                label="Sign-up opens"
                placeholder="Follows status"
                max={v.regCloses || v.startsAt}
                invalid={!!v.regOpens && !!windowProblem({ ...v, regCloses: null })}
                value={v.regOpens ?? ''}
                onChange={(x) => set({ regOpens: x || null })}
              />
            </label>
            <label className="field grow">
              <span className="label">Sign-up closes (optional)</span>
              <DatePicker
                time
                label="Sign-up closes"
                placeholder="Until event starts"
                min={v.regOpens}
                max={v.startsAt}
                invalid={!!v.regCloses && !!windowProblem({ ...v, regOpens: null })}
                value={v.regCloses ?? ''}
                onChange={(x) => set({ regCloses: x || null })}
              />
            </label>
          </div>

          {v.mode !== 'form' && (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <FieldsEditor value={v.fields ?? []} onChange={(fields) => set({ fields })} />
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="bad" role="alert" style={{ fontSize: 14 }}>
          {error}
        </p>
      )}

      {aside}
    </div>
  );
}
