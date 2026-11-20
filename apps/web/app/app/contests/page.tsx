import { upcomingContests, localTime } from '@/lib/cf';
import ContestsClient from './client';

export default async function Contests() {
  const up = (await upcomingContests(8)).map((c) => ({ ...c, when: c.when ?? localTime(c.start) }));
  return <ContestsClient up={up} />;
}
