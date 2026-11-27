'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUSES,
  EVENT_TYPES,
  type EventDetail,
} from '@fecpc/contracts';
import { bannerStyle, clubNow, eventBadgeStatus, fmtWhen } from '@/lib/events';
import { DatePicker } from '../shared/DatePicker';
import { SaveForm } from '../SaveBar';
import { FieldsEditor, pickDraft, useSaveEvent, windowProblem, type Draft } from './EventForm';

const sectionPadOpenEnd =
  'pb-6 [.ev-detail_&]:pt-6 [.ev-detail_&]:px-8 max-[601px]:[.ev-detail_&]:pt-[18px] max-[601px]:[.ev-detail_&]:px-5 max-[641px]:[.ev-detail_&&]:pt-4 max-[641px]:[.ev-detail_&&]:px-4';

const sectionPad =
  '[.ev-detail_&]:p-[24px_32px] max-[601px]:[.ev-detail_&]:p-[18px_20px] max-[641px]:[.ev-detail_&&]:p-4';

const hasPattern =
  '[.ev-detail_.banner&]:[background-image:repeating-linear-gradient(_135deg,_rgba(255,_255,_255,_0.07)_0_14px,_transparent_14px_28px_)] [.ev-detail_.banner&]:[background-size:56px_56px] [.ev-detail_.banner&]:[animation:ev-drift_8s_linear_infinite]'; // was .has-pattern
const evMetaStatus =
  '[.ev-detail_.meta_&]:flex [.ev-detail_.meta_&]:items-center [.ev-detail_.meta_&]:gap-2 [.ev-detail_.meta_&]:font-semibold [.ev-detail_.meta_&]:text-[14px] [.ev-detail_.meta_&]:uppercase [.ev-detail_.meta_&]:tracking-[0.05em] [.ev-detail_.meta_&]:text-hi [.ev-detail_.meta_&]:cursor-pointer [.ev-detail_.meta_&]:w-full [.ev-detail_.meta_&]:min-w-0 [.ev-detail_.meta_&]:whitespace-nowrap [.ev-detail_.meta_&]:overflow-hidden [.ev-detail_.meta_&]:text-ellipsis'; // was .ev-meta-status
const evStatusDot = `[.ev-detail_.meta_&]:w-[8px] [.ev-detail_.meta_&]:h-[8px] [.ev-detail_.meta_&]:[border-radius:50%] [.ev-detail_.meta_&]:inline-block [.ev-detail_.meta_&]:flex-none [.ev-detail_.meta_&]:[background:var(--acc)] [.ev-detail_.meta_&[data-status='draft']]:[background:var(--mut)] [.ev-detail_.meta_&[data-status='published']]:[background:var(--hi)] [.ev-detail_.meta_&[data-status='open']]:[background:#10b981] [.ev-detail_.meta_&[data-status='ongoing']]:[background:var(--acc)] [.ev-detail_.meta_&[data-status='closed']]:[background:#f59e0b] [.ev-detail_.meta_&[data-status='completed']]:[background:var(--dim)] [.ev-detail_.meta_&[data-status='cancelled']]:[background:var(--bad)]`; // was .ev-status-dot
const edPreview =
  '[.ev-detail_&]:min-h-[140px] [.ev-detail_&]:[font-family:var(--f-body,_sans-serif)] [.ev-detail_&]:text-[15px] [.ev-detail_&]:leading-[1.7]'; // was .ed-preview

const FORM = 'ev-head-form';

export function MarkdownView({ text }: { text: string }) {
  if (!text || !text.trim()) {
    return <p className="mono text-dim text-[14px]">No description provided yet.</p>;
  }
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="pl-[1.5rem] mb-[1rem]">
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
          <h3 key={i} className="mb-[0.5rem] text-[1.2rem]">
            {trimmed.slice(4)}
          </h3>,
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="mb-[0.6rem] text-[1.4rem]">
            {trimmed.slice(3)}
          </h2>,
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="mb-[0.75rem] text-[1.6rem]">
            {trimmed.slice(2)}
          </h1>,
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <p
            key={i}
            className="mb-[1rem] leading-[1.6]"
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

  if (!editable) {
    return (
      <main className="flex flex-col gap-8">
        <div className="post">
          <div
            className={`banner${!e.banner ? ` ${hasPattern}` : ''}`}
            data-type={e.type}
            style={bannerStyle(e.banner)}
          />
          <div className={sectionPadOpenEnd}>
            <h1 className="title m-0 cursor-default">{e.title}</h1>
            <div className="meta">
              <span className="on">{e.type}</span>
              <span className={`${evMetaStatus}`}>
                <span className={`${evStatusDot}`} data-status={e.status} />
                {eventBadgeStatus(e)}
              </span>
              <span title="Event starts at">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 opacity-[0.75]"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {fmtWhen(e.startsAt)}
              </span>
              <span title="Venue">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 opacity-[0.75]"
                >
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {e.place || 'No venue specified'}
                </span>
              </span>
              <span title="Seat capacity">
                {e.seats !== null ? `${e.seats} seats` : 'No seat limit'}
              </span>
              <span title="Fee">{e.fee > 0 ? `৳${e.fee}` : 'Free'}</span>
            </div>
          </div>

          <div className="tabs">
            <button type="button" className="tab on">
              Overview
            </button>
            <span className="mono ml-auto self-center">EVENT DETAILS</span>
          </div>
          <div className={sectionPad}>
            <div className={`ed-preview ${edPreview}`}>
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
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Save lives in the pinned bar at the top; a refusal printed at the foot of a long form would go unseen.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [error]);

  return (
    <main className="flex flex-col gap-8">
      <div className="post">
        <div
          role="button"
          tabIndex={0}
          className={`banner${!v.banner ? ` ${hasPattern}` : ''}`}
          aria-label="Upload banner image"
          title="Click anywhere to choose or change banner image (1200 × 630)"
          style={bannerStyle(v.banner ?? null)}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onClick={(e) => {
              (e.target as HTMLInputElement).value = '';
            }}
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
            <div
              className="[.ev-detail_&]:top-2.5 [.ev-detail_&]:right-2.5 [.ev-detail_&]:absolute [.ev-detail_&]:flex [.ev-detail_&]:items-center [.ev-detail_&]:gap-1.5 [.ev-detail_&]:z-[3]"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="[.ev-detail_&]:py-1 [.ev-detail_&]:px-2 [.ev-detail_&]:[font-family:var(--f-mono,_monospace)] [.ev-detail_&]:text-[14px] [.ev-detail_&]:[background:rgba(0,_0,_0,_0.75)] [.ev-detail_&]:text-[#fff] [.ev-detail_&]:[border:1px_solid_rgba(255,_255,_255,_0.3)]">
                Click anywhere to change
              </span>
              <button
                type="button"
                className="banner-remove [.ev-detail_&]:py-1 [.ev-detail_&]:px-2 [.ev-detail_&]:[font-family:var(--f-mono,_monospace)] [.ev-detail_&]:text-[14px] [.ev-detail_&]:[background:var(--bad)] [.ev-detail_&]:text-[#fff] [.ev-detail_&]:cursor-pointer"
                onClick={() => set({ banner: null })}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div className={sectionPadOpenEnd}>
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
                form={FORM}
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
            <span className={`${evMetaStatus}`}>
              <span className={`${evStatusDot}`} data-status={v.status ?? 'draft'} />
              <select
                form={FORM}
                value={v.status ?? 'draft'}
                onChange={(x) => set({ status: x.target.value as any })}
                aria-label="Event status"
              >
                {EVENT_STATUSES.map((s) => (
                  <option
                    key={s}
                    value={s}
                    disabled={s === 'completed' && (!v.startsAt || v.startsAt > clubNow())}
                  >
                    {EVENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </span>
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
                className="w-full min-w-0"
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
                className="w-[96px]"
                value={v.seats ?? ''}
                onChange={(e) => set({ seats: e.target.value ? +e.target.value : null })}
              />
              <span className="mono text-[14px] text-dim uppercase">seats</span>
            </span>
            <span>
              <span className="mono text-[14px] text-dim">৳</span>
              <input
                form={FORM}
                type="number"
                min={0}
                placeholder="Free"
                className="w-[60px]"
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
          <span className="mono ml-auto self-center">Markdown supported</span>
        </div>

        <div className={sectionPad}>
          {descTab === 'write' ? (
            <textarea
              form={FORM}
              className="ed [.ev-detail_&]:p-0 [.ev-detail_&]:w-full [.ev-detail_&]:min-h-[140px] [.ev-detail_&]:[outline:none] [.ev-detail_&]:resize-y [.ev-detail_&]:[font-family:var(--f-body,_sans-serif)] [.ev-detail_&]:text-[15px] [.ev-detail_&]:leading-[1.7] [.ev-detail_&]:text-hi [.ev-detail_&]:box-border"
              aria-label="Event description"
              placeholder="What will happen, who it's for, what to bring."
              rows={8}
              maxLength={6000}
              value={v.about}
              onChange={(x) => set({ about: x.target.value })}
            />
          ) : (
            <div className={`ed-preview ${edPreview}`}>
              <MarkdownView text={v.about || ''} />
            </div>
          )}
        </div>
      </div>

      {/* In-place Sign-up Configuration & Questions on the canvas */}
      {isOrganizer && (
        <div className="[.ev-detail_&]:[border:1px_solid_var(--line2)] [.ev-detail_&]:[background:var(--panel)] [.ev-detail_&]:[box-shadow:none]">
          <div className="sec [border-top:0]">
            <h2>Registration &amp; sign-up</h2>
            <p className="[.ev-detail_.sec_&]:text-[14px] [.ev-detail_.sec_&]:[color:var(--dim)] [.ev-detail_.sec_&]:m-[0_0_20px]">
              Configure the sign-up method, window and custom questions.
            </p>
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
                <div className="col-span-full">
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
              <div className="row between mb-3 items-start">
                <div>
                  <h2 className="m-0 text-[16px]">Extra questions</h2>
                  <p className="[.ev-detail_.sec_&]:text-[14px] [.ev-detail_.sec_&]:[color:var(--dim)] mt-1 mx-0 mb-0">
                    We always ask for name and phone. Add anything else you need to know.
                  </p>
                </div>
                <button
                  className="eb"
                  type="button"
                  onClick={() =>
                    set({ fields: [...(v.fields ?? []), { label: '', required: false }] })
                  }
                >
                  + Add a question
                </button>
              </div>
              <FieldsEditor
                hideHeader
                hideAddButton
                value={v.fields ?? []}
                onChange={(fields) => set({ fields })}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p ref={errorRef} className="bad text-[14px]" role="alert">
          {error}
        </p>
      )}

      {aside}
    </main>
  );
}
