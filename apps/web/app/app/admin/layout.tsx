import { notFound } from 'next/navigation';
import { serverState } from '@/lib/api.ts';
import { isAdmin } from '@fecpc/contracts';

// Hides the page from roles without an admin capability. The API enforces each action on its own.
export default async function Gate({ children }: { children: React.ReactNode }) {
  const state = await serverState();
  if (!state || !isAdmin(state.s.role)) notFound();
  return children;
}
