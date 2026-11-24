import type { ClubEvent } from '@fecpc/contracts';
import { serverQuery } from '@/lib/api.ts';
import EventsPage from './client';

/** The events page, with the first 24 upcoming events (one screen of cards) rendered on the server. */
export default async function Events() {
  const upcoming = await serverQuery<ClubEvent[]>('events', {
    action: 'list',
    upcoming: true,
    limit: 24,
  });
  return <EventsPage upcoming={upcoming ?? undefined} />;
}
