import { notFound } from 'next/navigation';
import { serverState } from '@/lib/api.ts';
import { isCommittee } from '@fecpc/contracts';

// Hides the page from non-committee roles. The API enforces each action on its own.
export default async function Gate({ children }: { children: React.ReactNode }) {
  const state = await serverState();
  if (!state || !isCommittee(state.s.roles)) notFound();
  return children;
}
