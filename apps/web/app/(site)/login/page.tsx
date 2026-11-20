import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import LoginForm from '@/components/site/LoginForm';
import { SESSION_COOKIES } from '@/lib/api.ts';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; error?: string }>;
}) {
  const { invite, error } = await searchParams;
  if (!invite) {
    const jar = await cookies();
    if (SESSION_COOKIES.some((c) => jar.has(c))) redirect('/app');
  }
  return (
    <main id="main" className="t-b" data-t="b">
      <section className="section page-head">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <h1 className="h2" style={{ marginBottom: 28 }}>
            {invite ? 'Set your password.' : 'Sign in.'}
          </h1>
          <LoginForm
            invite={invite?.slice(0, 100)}
            error={error?.slice(0, 200)}
            google={!!process.env.GOOGLE_CLIENT_ID}
          />
        </div>
      </section>
    </main>
  );
}
