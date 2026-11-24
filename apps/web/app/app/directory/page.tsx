import { serverQuery } from '@/lib/api.ts';
import MembersPage, { type MembersInitial } from './client';

const PAGE_SIZE = 16; // as in client.tsx

/** The members directory, with its first list rendered on the server for the filters in the URL. */
export default async function Directory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? sp[k] : '');
  const page = Number(one('page'));
  const initial = await serverQuery<MembersInitial>('members', {
    action: 'listMembers',
    q: one('q').trim() || undefined,
    rating: one('rating') || undefined,
    skill: one('skill') || undefined,
    batch: one('batch') ? Number(one('batch')) : undefined,
    page: 0,
    pageSize: ((Number.isInteger(page) && page > 0 ? page : 0) + 1) * PAGE_SIZE,
  });
  return <MembersPage initial={initial} />;
}
