import { serverQuery } from '@/lib/api.ts';
import Teams, { type TeamData } from './client';

/** ICPC teams, with the member's team rendered on the server. */
export default async function TeamsPage() {
  return <Teams initial={await serverQuery<TeamData>('community', { action: 'getTeam' })} />;
}
