import { redirect } from 'next/navigation';
import { StoreProvider } from '@/components/app/Store';
import Shell from '@/components/app/Shell';
import { serverState } from '@/lib/api.ts';
import '../(site)/site.layer.css';
import './app.layer.css';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await serverState();
  if (!state) redirect('/login');

  return (
    <StoreProvider initial={state}>
      <Shell>{children}</Shell>
    </StoreProvider>
  );
}
