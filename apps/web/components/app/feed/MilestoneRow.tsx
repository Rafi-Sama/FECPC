'use client';
import type { CSSProperties } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { KudosButton } from '@/components/app/shared/Kudos';
import { formatMilestoneSubline, formatMilestoneTarget, rankFor } from '@fecpc/contracts';
import type { MilestoneDTO } from '@fecpc/contracts';

export function MilestoneRow({
  milestone,
  isOwner,
  isSystem,
  pending = false,
  onGiveKudos,
  onOpenMember,
}: {
  milestone: MilestoneDTO;
  isOwner: boolean;
  isSystem: boolean;
  pending?: boolean;
  onGiveKudos: (milestoneId: number) => Promise<void> | void;
  onOpenMember: (userId: string, trigger?: HTMLElement | null) => void;
}) {
  const rank = rankFor(milestone.member_rating);
  const targetText = formatMilestoneTarget(milestone.type, milestone.to_value);
  const subline = formatMilestoneSubline(milestone);
  const givers = milestone.recent_givers ?? [];

  // Who cheered the owner, by name; no counts (kudos are a gesture, not a score).
  const ownerCongratsLine = (() => {
    if (!isOwner || milestone.kudos_count <= 0) return null;
    const shown = givers.slice(0, 2);
    if (!shown.length) return 'Members congratulated you';
    return `${shown.join(' and ')}${milestone.kudos_count > shown.length ? ' and others' : ''} congratulated you`;
  })();

  const renderButton = () =>
    isOwner ? (
      <span className="pill">Your milestone</span>
    ) : (
      <KudosButton
        given={milestone.has_kudos}
        disabled={pending || isSystem}
        title={isSystem ? 'Operator accounts cannot give kudos' : undefined}
        label={`Give kudos to ${milestone.member_name} for reaching ${targetText}`}
        onGive={() => onGiveKudos(milestone.id)}
      />
    );

  return (
    <div className="ms-row w-full">
      <button
        type="button"
        className="ms-avatar-btn p-0 [background:none] cursor-pointer inline-flex flex-none leading-[0] focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]"
        onClick={(e) => onOpenMember(milestone.user_id, e.currentTarget)}
        aria-label={`Open ${milestone.member_name}'s profile`}
      >
        <AvatarRing
          name={milestone.member_name}
          avatarUrl={milestone.member_avatar}
          size={36}
          ringWidth={2}
          ringOffset={2}
          rank={rank}
        />
      </button>

      <div className="ms-body flex-1 flex-col">
        <div className="text-[14px] leading-[1.35] text-ink [overflow-wrap:anywhere]">
          <button
            type="button"
            className="ms-name-btn hover:[text-decoration:underline] hover:[text-underline-offset:3px] focus-visible:[outline:2px_solid_var(--acc)] focus-visible:[outline-offset:2px]"
            style={{ '--rank-text': rank.textColor, '--rank-color': rank.color } as CSSProperties}
            onClick={(e) => onOpenMember(milestone.user_id, e.currentTarget)}
          >
            {milestone.member_name}
          </button>{' '}
          reached <strong>{targetText}</strong>
        </div>
        <div className="font-label text-[11px] tracking-[0.05em] uppercase [color:var(--dim)] leading-[1.35]">
          {subline}
        </div>
        {ownerCongratsLine && (
          <div className="font-label text-[11px] tracking-[0.04em] [color:var(--mut)] leading-[1.35]">
            {ownerCongratsLine}
          </div>
        )}
      </div>

      <div className="ms-action flex-none">{renderButton()}</div>
    </div>
  );
}

export default MilestoneRow;
