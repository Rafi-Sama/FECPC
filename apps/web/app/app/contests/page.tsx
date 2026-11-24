import type { ClubRounds } from '@fecpc/contracts';
import { localTime, upcomingContests } from '@/lib/cf';
import { serverQuery } from '@/lib/api.ts';
import ContestsClient from './client';

export default async function Contests() {
  const [up, rounds] = await Promise.all([
    upcomingContests(8),
    serverQuery<ClubRounds[]>('members', { action: 'clubRounds' }),
  ]);
  return (
    <ContestsClient
      up={up.map((c) => ({ ...c, when: localTime(c.start) }))}
      members={rounds ?? []}
    />
  );
}
