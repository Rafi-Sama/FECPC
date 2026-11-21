'use client';
import { DatePicker } from '@/components/app/shared/DatePicker';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../Store';
import { clubNow } from '@/lib/events';
import { useConfirm } from '../shared/PromptDialog';
import { SaveForm } from '../SaveBar';
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUSES,
  EVENT_TYPES,
  type ClubEvent,
  type EventField,
  type EventStatus,
} from '@fecpc/contracts';

/** The organisers' custom questions. Options, comma-separated, make a question a choice. */
export function FieldsEditor({
  value,
  onChange,
}: {
  value: EventField[];
  onChange: (f: EventField[]) => void;
}) {
  const set = (i: number, f: Partial<EventField>) =>
    onChange(value.map((x, j) => (j === i ? { ...x, ...f } : x)));
  return (
    <div className="stack" style={{ '--g': '12px' } as CSSProperties}>
      <span className="label">Extra questions</span>
      <Hint>We always ask for name and phone. Add anything else you need to know.</Hint>
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
      <button
        className="btn xs line"
        type="button"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...value, { label: '', required: false }])}
      >
        + Add a question
      </button>
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
  <span className="dim" style={{ fontSize: 14 }}>
    {children}
  </span>
);

const Section = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <section className="stack" style={{ '--g': '16px' } as CSSProperties}>
    <h3 className="h3">
      <span className="dim">{n}.</span> {title}
    </h3>
    {children}
  </section>
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

const BLANK = {
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

/** The sign-up window's first problem, if any. Club-local `YYYY-MM-DDTHH:MM` times compare as text. */
function windowProblem(v: Partial<ClubEvent>): string | null {
  const { startsAt, regOpens, regCloses } = v;
  if (regOpens && regCloses && regOpens >= regCloses) return 'Sign-up must open before it closes.';
  if (regOpens && startsAt && regOpens >= startsAt)
    return 'Sign-up must open before the event starts.';
  if (regCloses && startsAt && regCloses > startsAt)
    return 'Sign-up must close by the time the event starts.';
  return null;
}

/** What members will see about sign-up, in one line. */
function windowSummary(v: Partial<ClubEvent>): string {
  const at = (t: string) => `${t.slice(0, 10)} ${t.slice(11, 16)}`;
  if (v.status === 'draft') return 'Hidden from members until you publish it.';
  if (v.status === 'closed') return 'Visible; sign-up is closed.';
  if (v.status === 'ongoing' || v.status === 'completed' || v.status === 'cancelled')
    return 'Sign-up is closed.';
  if (v.status === 'published' && !v.regOpens)
    return 'Visible; sign-up stays closed until you open it or set an opening date.';
  return (
    [
      v.regOpens ? `Sign-up opens ${at(v.regOpens)}` : 'Sign-up is open now',
      v.regCloses ? `closes ${at(v.regCloses)}` : 'until the event starts',
    ].join(', ') + '.'
  );
}

/**
 * Create (no `event`) or edit an event. With `copyOf`, a past event's details start a new event: saving
 * creates it (with the same roles) and leaves the past one as it was.
 */
export function EventForm({
  event,
  copyOf,
  saved,
  onCancel,
}: {
  event?: ClubEvent;
  copyOf?: ClubEvent;
  saved: () => void;
  /** Closes the form; a copy's Discard uses it, since a copy is "unsaved" from the start. */
  onCancel?: () => void;
}) {
  const { act } = useStore();
  const confirmIt = useConfirm();
  const [error, setError] = useState<string | null>(null);
  // Only the editable fields: the admin detail also carries entries and templates, too big to send back.
  // Follows the saved event, so the save bar clears once a save reloads it.
  const start = useMemo<Partial<ClubEvent>>(() => {
    const from = event ?? copyOf;
    if (!from) return BLANK;
    const picked = Object.fromEntries(
      Object.keys(BLANK).map((k) => [k, from[k as keyof ClubEvent]]),
    ) as Partial<ClubEvent>;
    return copyOf
      ? { ...picked, startsAt: '', regOpens: null, regCloses: null, status: 'draft' }
      : picked;
  }, [event, copyOf]);
  const [v, setV] = useState(start);
  const set = (p: Partial<ClubEvent>) => {
    setError(null);
    setV((x) => ({ ...x, ...p }));
  };
  const startFields = (event ?? copyOf)?.fields ?? [];
  const [fields, setFields] = useState<EventField[]>(startFields);
  const changed =
    !!copyOf ||
    JSON.stringify(v) !== JSON.stringify(start) ||
    JSON.stringify(fields) !== JSON.stringify(startFields);
  const today = clubNow().slice(0, 10);
  // Completing is final and only allowed once the event has begun (the API checks too).
  const notStarted = !v.startsAt || v.startsAt > clubNow();
  const creating = !event;

  return (
    <SaveForm
      className="ev-form"
      label={
        copyOf
          ? 'New event from a past one, not saved'
          : event
            ? 'Unsaved changes to this event'
            : 'Unsaved new event'
      }
      saveLabel={event ? 'Save changes' : v.status === 'draft' ? 'Save draft' : 'Create event'}
      extraDirty={changed}
      onDiscard={() => {
        setV(start);
        setFields(startFields);
        setError(null);
        onCancel?.();
      }}
      onSubmit={async () => {
        const bad = windowProblem(v);
        if (bad) {
          setError(bad);
          return false;
        }
        if (
          v.status === 'completed' &&
          start.status !== 'completed' &&
          !(await confirmIt(
            'Mark this event completed?',
            'This is final: sign-up and check-in close, feedback and certificates open, and the details can no longer be edited.',
            'Mark completed',
          ))
        )
          return false;
        const { type, ...rest } = v;
        const ok = await act('eventSave', {
          ...rest,
          title: rest.title?.trim(),
          place: rest.place?.trim(),
          about: rest.about?.trim(),
          eventType: type,
          id: event?.id,
          copyOf: copyOf?.id,
          fields: cleanFields(fields),
        });
        if (ok) saved();
        return ok;
      }}
    >
      <div className="stack" style={{ '--g': '40px' } as CSSProperties}>
        <Section n={1} title="What is it?">
          <div className="row">
            <label className="field grow">
              <span className="label">Title</span>
              <input
                className="input"
                required
                minLength={3}
                maxLength={140}
                placeholder="e.g. Intro to Dynamic Programming"
                value={v.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="label">Type</span>
              <select
                className="input"
                value={v.type}
                onChange={(e) => set({ type: e.target.value })}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="label">Description</span>
            <textarea
              className="input"
              rows={5}
              maxLength={6000}
              placeholder="What will happen, who it's for, what to bring."
              value={v.about}
              onChange={(e) => set({ about: e.target.value })}
            />
          </label>
        </Section>

        <Section n={2} title="When and where?">
          <div className="row ev-pair">
            <label className="field grow">
              <span className="label">Starts</span>
              <DatePicker
                time
                required
                label="Starts"
                min={creating ? today : undefined}
                value={v.startsAt ?? ''}
                onChange={(x) => set({ startsAt: x })}
              />
            </label>
            <label className="field grow">
              <span className="label">Place</span>
              <input
                className="input"
                maxLength={140}
                placeholder="e.g. Room 402 or Online"
                value={v.place}
                onChange={(e) => set({ place: e.target.value })}
              />
            </label>
          </div>
        </Section>

        <Section n={3} title="Sign-up">
          <Method
            v={{
              mode: v.mode ?? 'platform',
              formUrl: v.formUrl ?? null,
              approval: v.approval ?? 'auto',
            }}
            set={set}
          />
          <div className="row ev-pair">
            <label className="field grow">
              <span className="label">Seats</span>
              <input
                className="input"
                type="number"
                min={1}
                max={100000}
                placeholder="No limit"
                value={v.seats ?? ''}
                onChange={(e) => set({ seats: e.target.value ? +e.target.value : null })}
              />
            </label>
            <label className="field grow">
              <span className="label">Fee (৳)</span>
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={v.fee}
                onChange={(e) => set({ fee: +e.target.value })}
              />
              <Hint>0 means free.</Hint>
            </label>
          </div>
          <div className="row ev-pair">
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
          {v.mode !== 'form' && <FieldsEditor value={fields} onChange={setFields} />}
        </Section>

        <Section n={4} title="Banner (optional)">
          <Hint>Without one, the event gets the pixel banner.</Hint>
          {v.banner ? (
            <div className="row">
              <img
                src={v.banner}
                alt="Banner preview"
                style={{ maxHeight: 120, maxWidth: '100%' }}
              />
              <button className="btn xs line" type="button" onClick={() => set({ banner: null })}>
                Remove
              </button>
            </div>
          ) : (
            <div className="row ev-pair">
              <div className="field">
                <span className="label">Upload an image (under 500 KB)</span>
                <label className="btn sm line" style={{ alignSelf: 'flex-start' }}>
                  Choose image…
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 500_000)
                        return setError('That image is over 500 KB. Pick a smaller one.');
                      const r = new FileReader();
                      r.onload = () => set({ banner: String(r.result) });
                      r.readAsDataURL(f);
                    }}
                  />
                </label>
              </div>
              <label className="field grow">
                <span className="label">or paste a link</span>
                <input
                  className="input"
                  type="url"
                  placeholder="https://…"
                  data-save-ignore
                  onBlur={(e) => e.target.value && set({ banner: e.target.value })}
                />
              </label>
            </div>
          )}
        </Section>
      </div>

      <aside className="panel stack ev-form-side" aria-label="Publishing">
        {copyOf && (
          <p className="body">
            <span>
              Copied from <b>{copyOf.title}</b>. Saving creates a new event with its roles; the past
              one is not changed.
            </span>
          </p>
        )}
        <label className="field">
          <span className="label">Status</span>
          <select
            className="input"
            value={v.status}
            onChange={(e) => set({ status: e.target.value as ClubEvent['status'] })}
          >
            {EVENT_STATUSES.filter((s) => !copyOf || s !== 'completed').map((s) => (
              <option key={s} value={s} disabled={s === 'completed' && notStarted}>
                {`${EVENT_STATUS_LABEL[s]}${s === 'completed' && notStarted ? ' (after it starts)' : ''}`}
              </option>
            ))}
          </select>
          <Hint>{STATUS_HINT[v.status ?? 'draft']}</Hint>
        </label>
        <p className="label">Members see</p>
        <p className="body">{windowSummary(v)}</p>
        {error && (
          <p className="bad" role="alert" style={{ fontSize: 14 }}>
            {error}
          </p>
        )}
      </aside>
    </SaveForm>
  );
}
