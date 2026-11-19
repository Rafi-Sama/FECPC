"use client";
import { useState } from "react";
import { useStore } from "@/components/app/Store";
import { MilestoneRow } from "./MilestoneRow";

const DAILY_CAP = 20;

export function MilestonesCard({
  onOpenMember,
}: {
  onOpenMember: (userId: string, trigger?: HTMLElement | null) => void;
}) {
  const { me, kudosToday, recentMilestones, giveKudos } = useStore();
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());

  const atDailyCap = kudosToday >= DAILY_CAP;
  const rows = recentMilestones.slice(0, 5);

  const handleGiveKudos = async (milestoneId: number) => {
    if (pendingIds.has(milestoneId) || atDailyCap) return;
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
    <section className="panel ms-card" aria-label="Milestones">
      <p className="label">Milestones</p>

      {rows.length === 0 ? (
        <p className="ms-empty">Nothing new this week.</p>
      ) : (
        <div className="list ms-list">
          {rows.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              isOwner={m.user_id === me.id}
              isSystem={me.system}
              atDailyCap={atDailyCap}
              pending={pendingIds.has(m.id)}
              onGiveKudos={handleGiveKudos}
              onOpenMember={onOpenMember}
            />
          ))}
        </div>
      )}

      {!me.system && (
        <div className="ms-footer" aria-live="polite">
          <span>
            Your kudos today · {Math.min(DAILY_CAP, kudosToday)} / {DAILY_CAP}
          </span>
          {atDailyCap && <span className="ms-limit"> · LIMIT REACHED</span>}
          {atDailyCap && (
            <div className="ms-limit-msg" role="status">
              DAILY LIMIT REACHED. TRY AGAIN TOMORROW.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default MilestonesCard;
