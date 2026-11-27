'use client';
import { useState, type CSSProperties } from 'react';
import { AvatarRing, TierBadge } from '@/components/app/shared/RatingBadge';
import { useStore } from '@/components/app/Store';
import { rankFor } from '@fecpc/contracts';
import type { MemberSummary } from '@fecpc/contracts';
import { AdminMenu } from './AdminMenu';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';

export function MemberCard({
  member,
  onOpen,
  onMutated,
  highlightQuery,
}: {
  member: MemberSummary;
  onOpen: (id: string, trigger?: HTMLElement | null) => void;
  onMutated?: () => void;
  highlightQuery?: string;
}) {
  const { s, me, act } = useStore();
  const [popKey, setPopKey] = useState(0);

  const isSelf = member.id === me.id;
  const kudosId = `member:${member.id}`;
  const hasKudos = s.kudos.includes(kudosId);
  const rank = rankFor(member.cf_rating || member.rating);
  const roleLabel = member.role || (member.is_alumni ? 'Alumni' : 'Member');

  const handleKudos = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (hasKudos) return; // kudos are permanent
    setPopKey((k) => k + 1);
    void act('toggle', { list: 'kudos', id: kudosId, on: true });
  };

  return (
    <li
      className="panel box flex flex-col gap-2.5 p-4! [&_.one]:whitespace-nowrap [&_.one]:overflow-hidden [&_.one]:text-ellipsis [&_.one]:block [&_.row]:flex-nowrap [&_.row]:overflow-hidden c4 member-card"
      role="button"
      tabIndex={0}
      aria-label={`${member.name}, ${roleLabel}, ${rank.title}, ${member.problems_solved} problems solved. Open profile.`}
      style={
        {
          '--rank-color': rank.color,
          '--rank-hover-color': rank.hoverColor,
        } as CSSProperties
      }
      onClick={(e) => onOpen(member.id, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(member.id, e.currentTarget);
        }
      }}
    >
      <i
        className="absolute left-0 top-0 bottom-0 w-1 [background:var(--rank-color,#b0b0b0)] [transition:background_120ms_ease] pointer-events-none [.member-card:hover_&]:[background:var(--rank-hover-color,var(--rank-color,#949494))]"
        aria-hidden
      />

      <div className="[display:grid] grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
        <AvatarRing
          name={member.name}
          avatarUrl={member.avatar_url}
          size={40}
          ringWidth={2}
          ringOffset={2}
          rank={rank}
        />

        <div className="min-w-0">
          <strong className="block text-[17px] font-medium text-hi whitespace-nowrap overflow-hidden text-ellipsis">
            <HighlightMatch text={member.name} query={highlightQuery} />
          </strong>
          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
            <span className="font-label text-[12px] tracking-[0.05em] uppercase text-dim whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
              <HighlightMatch
                text={`${roleLabel} · ${member.dept} · Batch ${member.batch}`}
                query={highlightQuery}
              />
            </span>
            {member.is_alumni && <span className="alumni-tag">ALUMNI</span>}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 flex-none">
          {isSelf ? (
            <span
              className="pill"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              YOU
            </span>
          ) : (
            <span className="relative inline-flex [&_.btn:focus-visible]:[outline:2px_solid_var(--acc)] [&_.btn:focus-visible]:outline-offset-[2px]">
              <button
                type="button"
                className={`btn xs ${hasKudos ? '' : 'line'}`}
                aria-pressed={hasKudos}
                disabled={hasKudos}
                onClick={handleKudos}
              >
                {hasKudos ? 'Kudos ✓' : 'Kudos'}
              </button>
              {popKey > 0 && (
                <span key={popKey} className="member-card__plus1" aria-hidden>
                  +1
                </span>
              )}
            </span>
          )}
          <AdminMenu
            userId={member.id}
            memberName={member.name}
            isAlumni={member.is_alumni}
            onDone={onMutated}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap min-h-6">
        <TierBadge rating={member.cf_rating} size="sm" rank={rank} />
        <span className="[font:13px_var(--mono),monospace] text-mut whitespace-nowrap">
          {!rank.unrated ? '· ' : ''}
          {member.problems_solved} solved · {member.current_streak}d streak
        </span>
      </div>

      {member.skills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap overflow-hidden [&_.tag]:py-[3px] [&_.tag]:px-[7px] [&_.tag]:cursor-default [&_.tag]:text-[12px]">
          {member.skills.map((skill) => (
            <span key={skill} className="tag">
              <HighlightMatch text={skill} query={highlightQuery} />
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export default MemberCard;
