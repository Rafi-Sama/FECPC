import { localTime, upcomingContests } from '@/lib/cf';
import Today from './today';

export default async function TodayPage() {
  const up = (await upcomingContests(3)).map((c) => ({ ...c, when: localTime(c.start) }));
  return <Today up={up} />;
}
