'use client';
import { useState } from 'react';
import { useStore } from '@/components/app/Store';
import { MilestoneRow } from './MilestoneRow';

export function MilestonesCard({
  onOpenMember,
}: {
  onOpenMember: (userId: string, trigger?: HTMLElement | null) => void;
}) {
  const { me, recentMilestones, giveKudos } = useStore();
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());

  const rows = recentMilestones.slice(0, 5);

  const handleGiveKudos = async (milestoneId: number) => {
    if (pendingIds.has(milestoneId)) return;
    setPendingIds((prev) => new Set(prev).add(milestoneId));
    try {
      await giveKudos(milestoneId);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(milestoneId);
        return next;
      });
    }
  };

  return (
    <section className="panel flex flex-col gap-3" aria-label="Milestones">
      <p className="label">Milestones</p>

      {rows.length === 0 ? (
        <p className="ms-empty font-label text-[12px] tracking-[0.05em] [color:var(--dim)]">
          Nothing new this week.
        </p>
      ) : (
        <div className="list mt-0.5">
          {rows.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              isOwner={m.user_id === me.id}
              isSystem={me.system}
              pending={pendingIds.has(m.id)}
              onGiveKudos={handleGiveKudos}
              onOpenMember={onOpenMember}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default MilestonesCard;
