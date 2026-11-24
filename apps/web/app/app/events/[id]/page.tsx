import type { EventDetail } from '@fecpc/contracts';
import { serverQuery } from '@/lib/api.ts';
import EventDetailPage from './client';

/** One event, rendered with its data on the server; the client takes over for every change. */
export default async function Event({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await serverQuery<EventDetail>('events', { action: 'event', id });
  return <EventDetailPage initial={e ?? undefined} />;
}
