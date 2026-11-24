'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { can, eventSlug, type EventDetail } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { SaveForm } from '@/components/app/SaveBar';
import { HeadFields } from '@/components/app/events/EventHead';
import { BLANK, pickDraft, useSaveEvent, type Draft } from '@/components/app/events/EventForm';
import { useEventsQuery } from '@/lib/events';

const FORM = 'ev-new-form';

// No Suspense boundary: see components/app/alumni/AlumniPage.tsx.
export default function NewEventPage() {
  return <NewEvent />;
}

/** `?copy=<id>` starts from a past event: same details and roles, a new date, the past one unchanged. */
function NewEvent() {
  const copy = useSearchParams().get('copy');
  const { s } = useStore();
  if (!can(s.roles, 'event.publish'))
    return (
      <div className="page">
        <p className="empty">Only organisers can create events.</p>
      </div>
    );
  return copy ? <Copy id={copy} /> : <Editor from={null} />;
}

function Copy({ id }: { id: string }) {
  const { data } = useEventsQuery<EventDetail>({ action: 'event', id });
  if (data === undefined) return <div className="page" aria-busy="true" />;
  if (data === null)
    return (
      <div className="page">
        <p className="empty">That event could not be loaded.</p>
      </div>
    );
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
      <SaveForm
        id={FORM}
        hidden
        label={error ?? (from ? 'New event from a past one, not saved' : 'Unsaved new event')}
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
      />
      <HeadFields
        form={FORM}
        creating
        v={v}
        set={set}
        error={error}
        setError={setError}
        isOrganizer
      />
    </div>
  );
}
