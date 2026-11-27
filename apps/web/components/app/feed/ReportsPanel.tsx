'use client';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/components/app/Store';
import { useConfirm } from '@/components/app/shared/PromptDialog';
import { cmMeta } from '@/components/app/feed/ui';

type Report = {
  id: number;
  title: string;
  author_name: string;
  reports: number;
  reasons: string[];
};

/** Reported feed posts for moderators (`feed.moderate`): remove the post or clear the reports. */
export function ReportsPanel({
  onOpen,
  onChange,
}: {
  onOpen: (id: number) => void;
  onChange: () => void;
}) {
  const sure = useConfirm();
  const { act } = useStore();
  const [items, setItems] = useState<Report[] | null>(null);
  const load = useCallback(async () => {
    const res = await fetch('/api/community', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'listFeedReports' }),
    });
    if (res.ok) setItems(((await res.json()) as { items: Report[] }).items);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (postId: number, decision: 'remove' | 'dismiss') => {
    if (decision === 'remove' && !(await sure('Remove this post for everyone?'))) return;
    if (await act('moderateFeedPost', { postId, decision })) {
      setItems((x) => x?.filter((r) => r.id !== postId) ?? null);
      onChange();
    }
  };

  if (!items) return null;
  return (
    <section className="panel cm-reports">
      <p className="label">
        Reported posts
        {items.length > 0 && (
          <span className="py-0 px-[7px] ml-2 [background:var(--bad)] text-[#fff] [animation:badge-in_0.3s_ease-out]">
            {items.length}
          </span>
        )}
      </p>
      {items.length === 0 ? (
        <p className="empty">Nothing reported. Quiet feed.</p>
      ) : (
        <ul className="list">
          {items.map((r) => (
            <li key={r.id} className="cm-report flex-col">
              <button
                type="button"
                className="[border:0] p-0 block text-[16px] font-semibold text-hi text-left [background:none] cursor-pointer hover:text-acc focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]"
                onClick={() => onOpen(r.id)}
              >
                {r.title}
              </button>
              <span
                className={`cm-meta flex flex-wrap items-center gap-1.5 tracking-[0.05em] ${cmMeta}`}
              >
                {r.author_name} · {r.reports} report{r.reports > 1 ? 's' : ''} · “{r.reasons[0]}”
              </span>
              <span className="row">
                <button type="button" className="btn xs" onClick={() => decide(r.id, 'remove')}>
                  Remove
                </button>
                <button
                  type="button"
                  className="btn xs line"
                  onClick={() => decide(r.id, 'dismiss')}
                >
                  Keep
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
