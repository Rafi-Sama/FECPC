'use client';
import { DatePicker } from '@/components/app/shared/DatePicker';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../Store';
import { clubNow, fmtWhen } from '@/lib/events';
import { useConfirm } from '../shared/PromptDialog';
import { SaveForm } from '../SaveBar';
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUSES,
  type ClubEvent,
  type EventField,
  type EventStatus,
} from '@fecpc/contracts';

/** The organisers' custom questions. Options, comma-separated, make a question a choice. */
export function FieldsEditor({
  value,
  onChange,
  hideHeader,
  hideAddButton,
}: {
  value: EventField[];
  onChange: (f: EventField[]) => void;
  hideHeader?: boolean;
  hideAddButton?: boolean;
}) {
  const set = (i: number, f: Partial<EventField>) =>
    onChange(value.map((x, j) => (j === i ? { ...x, ...f } : x)));
  return (
    <div className="stack" style={{ '--g': '12px' } as CSSProperties}>
      {!hideHeader && (
        <>
          <span className="label">Extra questions</span>
          <Hint>We always ask for name and phone. Add anything else you need to know.</Hint>
        </>
      )}
      {value.map((f, i) => (
        <div key={i} className="row">
          <input
            className="input grow"
            aria-label="Question"
            placeholder="e.g. Your Codeforces handle"
            maxLength={80}
            value={f.label}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            className="input grow"
            aria-label="Options"
            placeholder="Choices, comma-separated (empty: free text)"
            value={f.options?.join(', ') ?? ''}
            onChange={(e) => {
              const options = e.target.value.split(',').map((o) => o.trimStart());
              set(i, { options: options.some((o) => o) ? options : undefined });
            }}
          />
          <label className="row label">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) => set(i, { required: e.target.checked })}
            />
            Required
          </label>
          <button
            className="btn xs line"
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      {!hideAddButton && (
        <button
          className="add self-start"
          type="button"
          onClick={() => onChange([...value, { label: '', required: false }])}
        >
          + Add a question
        </button>
      )}
    </div>
  );
}
/** Trim options before sending; empty ones go. */
export const cleanFields = (f: EventField[]) =>
  f.map((x) => ({ ...x, options: x.options?.map((o) => o.trim()).filter(Boolean) }));

/** Registration method, link and approval: the same three choices for an event and each of its roles. */
export function Method({
  v,
  set,
}: {
  v: { mode: 'platform' | 'form'; formUrl: string | null; approval: 'auto' | 'manual' };
  set: (p: Partial<typeof v>) => void;
}) {
  return (
    <div className="row">
      <label className="field grow">
        <span className="label">How do people sign up?</span>
        <select
          className="input"
          value={v.mode}
          onChange={(e) => set({ mode: e.target.value as 'platform' })}
        >
          <option value="platform">Here, on this site</option>
          <option value="form">With a Google Form</option>
        </select>
      </label>
      {v.mode === 'form' ? (
        <label className="field grow">
          <span className="label">Google Form link</span>
          <input
            className="input"
            type="url"
            required
            placeholder="https://forms.gle/…"
            value={v.formUrl ?? ''}
            onChange={(e) => set({ formUrl: e.target.value })}
          />
        </label>
      ) : (
        <label className="field grow">
          <span className="label">Who gets in?</span>
          <select
            className="input"
            value={v.approval}
            onChange={(e) => set({ approval: e.target.value as 'auto' })}
          >
            <option value="auto">Everyone, automatically</option>
            <option value="manual">Only those I approve</option>
          </select>
        </label>
      )}
    </div>
  );
}

const Hint = ({ children }: { children: ReactNode }) => (
  <span className="dim text-[14px]">{children}</span>
);
const Unset = ({ children = 'Not set' }: { children?: ReactNode }) => (
  <span className="dim">{children}</span>
);

const STATUS_HINT: Record<EventStatus, string> = {
  draft: 'Only organisers can see it. Publish when ready.',
  published: 'Everyone can see it. Sign-up opens by itself at the opening date, if you set one.',
  open: 'Everyone can see it and sign up.',
  closed: 'Still visible; no new sign-ups.',
  ongoing: 'Happening now.',
  completed: 'Finished. This is final and lets you issue certificates.',
  cancelled: 'Called off. Shown as cancelled.',
};

export const BLANK = {
  title: '',
  type: 'Workshop',
  place: '',
  about: '',
  banner: null,
  startsAt: '',
  regOpens: null,
  regCloses: null,
  status: 'draft',
  seats: null,
  fee: 0,
  mode: 'platform',
  formUrl: null,
  approval: 'auto',
  fields: [],
} satisfies Partial<ClubEvent>;
export type Draft = Partial<ClubEvent>;

/** Only the editable fields: the admin detail also carries entries and templates, too big to send back. */
export const pickDraft = (from: ClubEvent): Draft =>
  Object.fromEntries(Object.keys(BLANK).map((k) => [k, from[k as keyof ClubEvent]])) as Draft;

/** The sign-up window's first problem, if any. Club-local `YYYY-MM-DDTHH:MM` times compare as text. */
export function windowProblem(v: Draft): string | null {
  const { startsAt, regOpens, regCloses } = v;
  if (regOpens && regCloses && regOpens >= regCloses) return 'Sign-up must open before it closes.';
  if (regOpens && startsAt && regOpens >= startsAt)
    return 'Sign-up must open before the event starts.';
  if (regCloses && startsAt && regCloses > startsAt)
    return 'Sign-up must close by the time the event starts.';
  return null;
}

/** What members will see about sign-up, in one line. */
function windowSummary(v: Draft): string {
  if (v.status === 'draft') return 'Hidden from members until you publish it.';
  if (v.status === 'closed') return 'Visible; sign-up is closed.';
  if (v.status === 'ongoing' || v.status === 'completed' || v.status === 'cancelled')
    return 'Sign-up is closed.';
  if (v.status === 'published' && !v.regOpens)
    return 'Visible; sign-up stays closed until you open it or set an opening date.';
  return (
    [
      v.regOpens ? `Sign-up opens ${fmtWhen(v.regOpens)}` : 'Sign-up is open now',
      v.regCloses ? `closes ${fmtWhen(v.regCloses)}` : 'until the event starts',
    ].join(', ') + '.'
  );
}

/** One section's inputs. `v` is the whole draft; a section only shows and changes its own part. */
type EditProps = {
  v: Draft;
  set: (p: Draft) => void;
  setError: (e: string) => void;
};

/**
 * The settings the event page does not show, as cards: `view` is how a part reads once saved, `edit` its inputs.
 * Title, type, start, place, description and banner are edited in place on the page (EventHead.tsx).
 */
const SECTIONS: {
  title: string;
  view: (v: Draft) => ReactNode;
  edit: (p: EditProps) => ReactNode;
}[] = [
  {
    title: 'Sign-up',
    view: (v) => (
      <dl className="[&_dd]:m-0 [display:grid] grid-cols-[max-content_1fr] gap-[8px_20px] m-0">
        <dt className="label">Method</dt>
        <dd>
          {v.mode === 'form' ? (
            <>
              Google Form ·{' '}
              {v.formUrl ? (
                <a href={v.formUrl} target="_blank" rel="noopener noreferrer">
                  {v.formUrl}
                </a>
              ) : (
                <Unset>no link</Unset>
              )}
            </>
          ) : (
            `On this site · ${v.approval === 'manual' ? 'I approve each one' : 'everyone gets in'}`
          )}
        </dd>
        <dt className="label">Window</dt>
        <dd>
          {v.regOpens ? fmtWhen(v.regOpens) : 'Follows the status'}
          {v.regCloses && ` → ${fmtWhen(v.regCloses)}`}
        </dd>
        {v.mode !== 'form' && (
          <>
            <dt className="label">Questions</dt>
            <dd>
              {v.fields?.length ? (
                v.fields.map((f) => (
                  <span key={f.label} className="block">
                    {f.label}
                    {f.required && ' *'}
                    {f.options && <span className="dim"> ({f.options.join(', ')})</span>}
                  </span>
                ))
              ) : (
                <Unset>Name and phone only</Unset>
              )}
            </dd>
          </>
        )}
      </dl>
    ),
    edit: ({ v, set }) => (
      <>
        <Method
          v={{
            mode: v.mode ?? 'platform',
            formUrl: v.formUrl ?? null,
            approval: v.approval ?? 'auto',
          }}
          set={set}
        />
        <div className="row items-start">
          <label className="field grow">
            <span className="label">Sign-up opens (optional)</span>
            <DatePicker
              time
              label="Sign-up opens"
              placeholder="Not set"
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
              placeholder="Not set"
              min={v.regOpens}
              max={v.startsAt}
              invalid={!!v.regCloses && !!windowProblem({ ...v, regOpens: null })}
              value={v.regCloses ?? ''}
              onChange={(x) => set({ regCloses: x || null })}
            />
          </label>
        </div>
        <Hint>Both must fall before the start. Leave them empty to follow the status.</Hint>
        {v.mode !== 'form' && (
          <FieldsEditor value={v.fields ?? []} onChange={(fields) => set({ fields })} />
        )}
      </>
    ),
  },
  {
    title: 'Status',
    view: (v) => (
      <>
        <span className="tag k self-start">{EVENT_STATUS_LABEL[v.status ?? 'draft']}</span>
        <p className="body">{windowSummary(v)}</p>
      </>
    ),
    edit: ({ v, set }) => <StatusField v={v} set={set} />,
  },
];
const SIGNUP_SECTION = 0,
  STATUS_SECTION = 1;
/** The sign-up card's inputs, also used on the new-event page. */
export const SignupEdit = SECTIONS[SIGNUP_SECTION]!.edit;

export function StatusField({
  v,
  set,
  copy,
}: {
  v: Draft;
  set: (p: Draft) => void;
  copy?: boolean;
}) {
  // Completing is final and only allowed once the event has begun (the API checks too).
  const notStarted = !v.startsAt || v.startsAt > clubNow();
  return (
    <>
      <label className="field">
        <span className="label">Status</span>
        <select
          className="input"
          value={v.status}
          onChange={(e) => set({ status: e.target.value as ClubEvent['status'] })}
        >
          {EVENT_STATUSES.filter((s) => !copy || s !== 'completed').map((s) => (
            <option key={s} value={s} disabled={s === 'completed' && notStarted}>
              {`${EVENT_STATUS_LABEL[s]}${s === 'completed' && notStarted ? ' (after it starts)' : ''}`}
            </option>
          ))}
        </select>
        <Hint>{STATUS_HINT[v.status ?? 'draft']}</Hint>
      </label>
      <p className="label">Members see</p>
      <p className="body">{windowSummary(v)}</p>
    </>
  );
}

/** Validates, confirms completing, and sends the whole draft. False when it did not save. */
export function useSaveEvent() {
  const { act } = useStore();
  const confirmIt = useConfirm();
  return async (
    v: Draft,
    was: Draft,
    ids: { id?: string; newId?: string; copyOf?: string },
    setError: (e: string) => void,
  ) => {
    const bad = windowProblem(v);
    if (bad) {
      setError(bad);
      return false;
    }
    if (
      v.status === 'completed' &&
      was.status !== 'completed' &&
      !(await confirmIt(
        'Mark this event completed?',
        'This is final: sign-up and check-in close, feedback and certificates open, and the details can no longer be edited.',
        'Mark completed',
      ))
    )
      return false;
    const { type, ...rest } = v;
    return act('eventSave', {
      ...rest,
      title: rest.title?.trim(),
      place: rest.place?.trim(),
      about: rest.about?.trim(),
      eventType: type,
      ...ids,
      fields: cleanFields(rest.fields ?? []),
    });
  };
}

/**
 * A saved event's settings that are not on the page itself (sign-up and status), one card each. Edit opens that
 * card alone; Save sends the saved event with only that part changed, so the API still checks the whole event.
 * `readOnly` (a completed event) hides the Edit buttons.
 */
export function EventSections({
  event,
  saved,
  readOnly,
  includeStatus = false,
}: {
  event: ClubEvent;
  saved: () => void;
  readOnly?: boolean;
  includeStatus?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const start = useMemo(() => pickDraft(event), [event]);
  const card = (i: number) => {
    const s = SECTIONS[i]!;
    return (
      <section
        key={s.title}
        className="flex flex-col gap-4 p-5 [border:1px_solid_var(--line)] [&&]:[border-left:4px_solid_var(--line)] [background:var(--panel)] [&[data-open]]:[border-left-color:var(--acc)]"
        data-open={open === i || undefined}
      >
        <div className="row between">
          <h3 className="h3">{s.title}</h3>
          {!readOnly && open !== i && (
            // data-nav: the save bar refuses the switch while another section has unsaved changes
            <button className="btn xs line" type="button" data-nav onClick={() => setOpen(i)}>
              Edit
            </button>
          )}
        </div>
        {open === i ? (
          <SectionEditor
            i={i}
            event={event}
            start={start}
            close={() => setOpen(null)}
            saved={saved}
          />
        ) : (
          <div className="stack" style={{ '--g': '12px' } as CSSProperties}>
            {s.view(start)}
          </div>
        )}
      </section>
    );
  };
  return (
    <div className="[display:grid] grid-cols-[minmax(0,1fr)_280px] gap-8 [align-items:start] max-[1101px]:grid-cols-[minmax(0,1fr)]">
      {/* Title, type, date, place, description and banner are edited in place at the top of the page. */}
      {card(SIGNUP_SECTION)}
      {includeStatus && (
        <aside
          className="top-20 [position:sticky] [@media(max-width:1100px)]:static [@media(max-width:1100px)]:order-[-1]"
          aria-label="Publishing"
        >
          {card(STATUS_SECTION)}
        </aside>
      )}
    </div>
  );
}

function SectionEditor({
  i,
  event,
  start,
  close,
  saved,
}: {
  i: number;
  event: ClubEvent;
  start: Draft;
  close: () => void;
  saved: () => void;
}) {
  const saveEvent = useSaveEvent();
  const [v, setV] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const set = (p: Draft) => {
    setError(null);
    setV((x) => ({ ...x, ...p }));
  };
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input:not([hidden]), select, textarea')?.focus();
  }, []);
  const s = SECTIONS[i]!;
  return (
    <SaveForm
      className="stack"
      style={{ '--g': '16px' } as CSSProperties}
      label={`Unsaved changes to ${s.title.replace('?', '').toLowerCase()}`}
      saveLabel="Save section"
      extraDirty={JSON.stringify(v) !== JSON.stringify(start)}
      onDiscard={close}
      onSubmit={async () => {
        const ok = await saveEvent(v, start, { id: event.id }, setError);
        if (ok) {
          close();
          saved();
        }
        return ok;
      }}
    >
      <div ref={ref} className="stack" style={{ '--g': '16px' } as CSSProperties}>
        {s.edit({ v, set, setError })}
      </div>
      {error && (
        <p className="bad text-[14px]" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button className="btn sm" type="submit">
          Save
        </button>
        <button className="btn sm line" type="button" onClick={close}>
          Cancel
        </button>
      </div>
    </SaveForm>
  );
}
