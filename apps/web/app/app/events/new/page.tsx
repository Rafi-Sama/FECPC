'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type CSSProperties } from 'react';
import { can, eventSlug, type EventDetail } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { SaveForm } from '@/components/app/SaveBar';
import { HeadFields } from '@/components/app/events/EventHead';
import {
  BLANK,
  pickDraft,
  SignupEdit,
  StatusField,
  useSaveEvent,
  type Draft,
} from '@/components/app/events/EventForm';
import { useEventsQuery } from '@/lib/events';

const FORM = 'ev-new-form';

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="page" aria-busy="true" />}>
      <NewEvent />
    </Suspense>
  );
}

/** `?copy=<id>` starts from a past event: same details and roles, a new date, the past one unchanged. */
function NewEvent() {
  const copy = useSearchParams().get('copy');
  const { s } = useStore();
  if (!can(s.roles, 'event.publish'))
    return <p className="page empty">Only organisers can create events.</p>;
  return copy ? <Copy id={copy} /> : <Editor from={null} />;
}

function Copy({ id }: { id: string }) {
  const { data } = useEventsQuery<EventDetail>({ action: 'event', id });
  if (data === undefined) return <div className="page" aria-busy="true" />;
  if (data === null) return <p className="page empty">That event could not be loaded.</p>;
  return <Editor from={data} />;
}

function Editor({ from }: { from: EventDetail | null }) {
  const router = useRouter();
  const saveEvent = useSaveEvent();
  const start = useMemo<Draft>(
    () =>
      from
        ? { ...pickDraft(from), startsAt: '', regOpens: null, regCloses: null, status: 'draft' }
        : BLANK,
    [from],
  );
  const [v, setV] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Draft) => {
    setError(null);
    setV((x) => ({ ...x, ...p }));
  };

  return (
    <div className="page ev-detail">
      <p className="label">
        <Link href="/app/events">Events</Link> / New event
      </p>
      {from && (
        <p className="body">
          Copied from <Link href={`/app/events/${from.id}`}>{from.title}</Link>: pick a new date.
          Saving creates a new event with its roles; the past one is not changed.
        </p>
      )}
      <HeadFields
        form={FORM}
        creating
        v={v}
        set={set}
        error={error}
        setError={setError}
        aside={
          <aside className="stack ev-aside">
            <section className="panel stack ev-card" aria-label="Publishing">
              <StatusField v={v} set={set} copy={!!from} />
            </section>
          </aside>
        }
      />
      <SaveForm
        id={FORM}
        className="panel stack ev-card ev-org"
        style={{ '--g': '16px' } as CSSProperties}
        label={from ? 'New event from a past one, not saved' : 'Unsaved new event'}
        saveLabel={v.status === 'draft' ? 'Save draft' : 'Create event'}
        trackFields={false}
        // a copy counts as changed from the start, so its Discard (back to the past event) is offered
        extraDirty={!!from || JSON.stringify(v) !== JSON.stringify(start)}
        onDiscard={() => {
          if (from) return router.push(`/app/events/${from.id}`);
          setV(start);
          setError(null);
        }}
        onSubmit={async () => {
          if (!v.startsAt) {
            setError('Pick when it starts.');
            return false;
          }
          const hex = [...crypto.getRandomValues(new Uint8Array(2))]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          const newId = eventSlug(v.title?.trim() ?? '', hex);
          const ok = await saveEvent(v, start, { newId, copyOf: from?.id }, setError);
          if (ok) router.push(`/app/events/${newId}`);
          return ok;
        }}
      >
        <b>Sign-up</b>
        <SignupEdit v={v} set={set} setError={setError} />
      </SaveForm>
    </div>
  );
}
