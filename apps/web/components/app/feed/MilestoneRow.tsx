'use client';
import type { CSSProperties } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { formatMilestoneSubline, formatMilestoneTarget, rankFor } from '@fecpc/contracts';
import type { MilestoneDTO } from '@fecpc/contracts';

const msKudosBtn = 'whitespace-nowrap'; // was .ms-kudos-btn
const msKudosBtnGiven = '[&[disabled]]:opacity-[0.6] [&[disabled]]:cursor-not-allowed'; // was .ms-kudos-btn--given

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
          className={`btn xs ${msKudosBtn} ${msKudosBtnGiven}`}
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
          className={`btn xs ${msKudosBtn} ${msKudosBtnGiven}`}
          disabled
          title={`You congratulated ${milestone.member_name} (${milestone.kudos_count} total)`}
          aria-label={`Congratulated ${milestone.member_name}`}
        >
          Kudos ✓
        </button>
      );
    }

    if (isSystem) {
      return (
        <button
          type="button"
          className={`btn xs line ${msKudosBtn}`}
          disabled
          title="Operator accounts cannot give kudos"
          aria-label="Cannot give kudos"
        >
          Kudos{milestone.kudos_count > 0 && ` ${milestone.kudos_count}`}
        </button>
      );
    }

    return (
      <button
        type="button"
        className={`btn xs line ${msKudosBtn}`}
        disabled={pending}
        onClick={() => onGiveKudos(milestone.id)}
        aria-label={`Give kudos to ${milestone.member_name} for reaching ${targetText}`}
      >
        Kudos{milestone.kudos_count > 0 && ` ${milestone.kudos_count}`}
      </button>
    );
  };

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
