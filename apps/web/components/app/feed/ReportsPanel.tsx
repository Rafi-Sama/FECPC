'use client';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/components/app/Store';

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
    if (decision === 'remove' && !confirm('Remove this post for everyone?')) return;
    if (await act('moderateFeedPost', { postId, decision })) {
      setItems((x) => x?.filter((r) => r.id !== postId) ?? null);
      onChange();
    }
  };

  if (!items) return null;
  return (
    <section className="panel cm-reports">
      <p className="label">
        Reported posts{items.length > 0 && <span className="cm-reports-n">{items.length}</span>}
      </p>
      {items.length === 0 ? (
        <p className="empty">Nothing reported. Quiet feed.</p>
      ) : (
        <ul className="list">
          {items.map((r) => (
            <li key={r.id} className="cm-report">
              <button type="button" className="cm-title" onClick={() => onOpen(r.id)}>
                {r.title}
              </button>
              <span className="cm-meta">
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
