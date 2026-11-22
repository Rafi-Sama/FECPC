'use client';
import type { CSSProperties } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { formatMilestoneSubline, formatMilestoneTarget, rankFor } from '@fecpc/contracts';
import type { MilestoneDTO } from '@fecpc/contracts';

export function MilestoneRow({
  milestone,
  isOwner,
  isSystem,
  atDailyCap,
  pending = false,
  onGiveKudos,
  onOpenMember,
}: {
  milestone: MilestoneDTO;
  isOwner: boolean;
  isSystem: boolean;
  atDailyCap: boolean;
  pending?: boolean;
  onGiveKudos: (milestoneId: number) => void;
  onOpenMember: (userId: string, trigger?: HTMLElement | null) => void;
}) {
  const rank = rankFor(milestone.member_rating);
  const targetText = formatMilestoneTarget(milestone.type, milestone.to_value);
  const subline = formatMilestoneSubline(milestone);
  const givers = milestone.recent_givers ?? [];

  const ownerCongratsLine = (() => {
    if (!isOwner || milestone.kudos_count <= 0) return null;
    const base = `${milestone.kudos_count} ${milestone.kudos_count === 1 ? 'person' : 'people'} congratulated you`;
    if (givers.length === 0) return base;
    const shown = givers.slice(0, 2).join(', ');
    const extra = milestone.kudos_count - Math.min(2, givers.length);
    return extra > 0 ? `${base} · ${shown} +${extra}` : `${base} · ${shown}`;
  })();

  const renderButton = () => {
    if (isOwner) {
      return (
        <button
          type="button"
          className="btn xs ms-kudos-btn ms-kudos-btn--given"
          disabled
          title={
            milestone.kudos_count > 0
              ? `${milestone.kudos_count} ${milestone.kudos_count === 1 ? 'person' : 'people'} congratulated you`
              : 'Your milestone'
          }
          aria-label={`Kudos ${milestone.kudos_count} on your milestone`}
        >
          Kudos{milestone.kudos_count > 0 && ` ${milestone.kudos_count}`} ✓
        </button>
      );
    }

    if (milestone.has_kudos) {
      return (
        <button
          type="button"
          className="btn xs ms-kudos-btn ms-kudos-btn--given"
          disabled
          title={`You congratulated ${milestone.member_name} (${milestone.kudos_count} total)`}
          aria-label={`Congratulated ${milestone.member_name}`}
        >
          Kudos ✓
        </button>
      );
    }

    if (isSystem || atDailyCap) {
      return (
        <button
          type="button"
          className="btn xs line ms-kudos-btn"
          disabled
          title={isSystem ? 'Operator accounts cannot give kudos' : 'Daily limit reached'}
          aria-label={isSystem ? 'Cannot give kudos' : 'Daily limit reached'}
        >
          Kudos{milestone.kudos_count > 0 && ` ${milestone.kudos_count}`}
        </button>
      );
    }

    return (
      <button
        type="button"
        className="btn xs line ms-kudos-btn"
        disabled={pending}
        onClick={() => onGiveKudos(milestone.id)}
        aria-label={`Give kudos to ${milestone.member_name} for reaching ${targetText}`}
      >
        Kudos{milestone.kudos_count > 0 && ` ${milestone.kudos_count}`}
      </button>
    );
  };

  return (
    <div className="ms-row">
      <button
        type="button"
        className="ms-avatar-btn"
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

      <div className="ms-body">
        <div className="ms-headline">
          <button
            type="button"
            className="ms-name-btn"
            style={{ '--rank-text': rank.textColor, '--rank-color': rank.color } as CSSProperties}
            onClick={(e) => onOpenMember(milestone.user_id, e.currentTarget)}
          >
            {milestone.member_name}
          </button>{' '}
          reached <strong>{targetText}</strong>
        </div>
        <div className="ms-subline">{subline}</div>
        {ownerCongratsLine && <div className="ms-owner-signal">{ownerCongratsLine}</div>}
      </div>

      <div className="ms-action">{renderButton()}</div>
    </div>
  );
}

export default MilestoneRow;
