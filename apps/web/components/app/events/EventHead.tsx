'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EVENT_STATUS_LABEL, EVENT_TYPES, type EventDetail } from '@fecpc/contracts';
import { bannerStyle, clubNow, fmtWhen, liveStatus } from '@/lib/events';
import { DatePicker } from '../shared/DatePicker';
import { usePrompt } from '../shared/PromptDialog';
import { SaveForm } from '../SaveBar';
import { pickDraft, useSaveEvent, type Draft } from './EventForm';

const FORM = 'ev-head-form';

/**
 * The top of an event page: banner, tags, title and description, with `aside` beside them. Organisers edit these
 * in place (the save bar saves them); everything else is edited under Organise → Details.
 */
export function EventHead({
  e,
  reload,
  aside,
}: {
  e: EventDetail;
  reload: () => void;
  aside: ReactNode;
}) {
  const editable = !!e.admin && e.status !== 'completed';
  const start = useMemo(() => pickDraft(e), [e]);
  const [v, setV] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const saveEvent = useSaveEvent();
  // A reload (after this save, or an organiser action elsewhere on the page) takes the new values, unless the
  // organiser is mid-edit here.
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
      <span className="tag k">{liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]}</span>
      {e.fee > 0 && <span className="tag">৳{e.fee}</span>}
    </>
  );

  if (!editable)
    return (
      <>
        <div className="ban ev-hero" data-type={e.type} style={bannerStyle(e.banner)}>
          {!e.banner && <span>{e.title}</span>}
        </div>
        <div className="ev-split">
          <div className="stack">
            <div className="row">
              <span className="tag b">{e.type}</span>
              <span className="tag">{fmtWhen(e.startsAt)}</span>
              {e.place && <span className="tag">{e.place}</span>}
              {tags}
            </div>
            <h1 className="h2">{e.title}</h1>
            {e.about && (
              <section className="panel">
                <p className="body" style={{ whiteSpace: 'pre-line' }}>
                  {e.about}
                </p>
              </section>
            )}
          </div>
          {aside}
        </div>
      </>
    );

  return (
    <>
      {/* The fields below sit in the page layout and join this form through their `form` attribute. */}
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
      />
    </>
  );
}

/**
 * The event page's header as fields: banner, type, start, place, title and description, styled as the page.
 * They join the form `form` through their `form` attribute, so they can sit anywhere in the layout.
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
}: {
  form: string;
  v: Draft;
  set: (p: Draft) => void;
  error: string | null;
  setError: (e: string) => void;
  tags?: ReactNode;
  aside: ReactNode;
  /** A new event: its start cannot be in the past. */
  creating?: boolean;
}) {
  const ask = usePrompt();
  return (
    <>
      <div
        className="ban ev-hero ev-edit-ban"
        data-type={v.type}
        style={bannerStyle(v.banner ?? null)}
      >
        {!v.banner && <span>{v.title || 'Untitled event'}</span>}
        <div className="ev-ban-tools row">
          <label className="btn xs">
            Upload banner
            <input
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
          </label>
          <button
            type="button"
            className="btn xs"
            onClick={async () => {
              const url = await ask({
                title: 'Banner link',
                label: 'An image link (https://…)',
                placeholder: 'https://…',
                confirmLabel: 'Use it',
                initial: v.banner?.startsWith('http') ? v.banner : '',
                minLength: 8,
                maxLength: 2000,
              });
              if (url === null) return;
              if (!/^https?:\/\//.test(url.trim()))
                return setError('A banner link starts with http(s)://.');
              set({ banner: url.trim() });
            }}
          >
            Link…
          </button>
          {v.banner && (
            <button type="button" className="btn xs" onClick={() => set({ banner: null })}>
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="ev-split">
        <div className="stack">
          <div className="row ev-inline-tags">
            <select
              className="tag b"
              aria-label="Type"
              value={v.type}
              onChange={(x) => set({ type: x.target.value })}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <DatePicker
              time
              required
              label="Starts"
              className="ev-inline-date"
              placeholder="Pick a start"
              min={creating ? clubNow().slice(0, 10) : undefined}
              value={v.startsAt ?? ''}
              onChange={(x) => set({ startsAt: x })}
            />
            <input
              form={FORM}
              className="tag ev-inline-place"
              aria-label="Place"
              placeholder="Add a place"
              maxLength={140}
              size={Math.max(10, (v.place ?? '').length + 1)}
              value={v.place}
              onChange={(x) => set({ place: x.target.value })}
            />
            {tags}
          </div>
          {/* A textarea so long titles wrap like the heading; Enter never adds a line. */}
          <textarea
            form={FORM}
            className="h2 ev-inline ev-inline-title"
            aria-label="Title"
            placeholder="Event title"
            required
            rows={1}
            minLength={3}
            maxLength={140}
            value={v.title}
            onKeyDown={(x) => x.key === 'Enter' && x.preventDefault()}
            onChange={(x) => set({ title: x.target.value.replace(/\s*\n\s*/g, ' ') })}
          />
          <section className="panel">
            <textarea
              form={FORM}
              className="body ev-inline ev-inline-about"
              aria-label="Description"
              placeholder="What will happen, who it's for, what to bring."
              rows={4}
              maxLength={6000}
              value={v.about}
              onChange={(x) => set({ about: x.target.value })}
            />
          </section>
          {error && (
            <p className="bad" role="alert" style={{ fontSize: 14 }}>
              {error}
            </p>
          )}
        </div>
        {aside}
      </div>
    </>
  );
}
