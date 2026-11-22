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
    if (!hasKudos) setPopKey((k) => k + 1);
    void act('toggle', { list: 'kudos', id: kudosId });
  };

  return (
    <li
      className="panel box pcard c4 member-card"
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
      <i className="member-card__accent" aria-hidden />

      <div className="member-card__top">
        <AvatarRing
          name={member.name}
          avatarUrl={member.avatar_url}
          size={40}
          ringWidth={2}
          ringOffset={2}
          rank={rank}
        />

        <div className="member-card__ident">
          <strong className="member-card__name">
            <HighlightMatch text={member.name} query={highlightQuery} />
          </strong>
          <div className="member-card__meta-row">
            <span className="member-card__meta">
              <HighlightMatch
                text={`${roleLabel} · ${member.dept} · Batch ${member.batch}`}
                query={highlightQuery}
              />
            </span>
            {member.is_alumni && <span className="alumni-tag">ALUMNI</span>}
          </div>
        </div>

        <div className="member-card__actions">
          {isSelf ? (
            <span
              className="pill"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              YOU
            </span>
          ) : (
            <span className="member-card__kudos-wrap">
              <button
                type="button"
                className={`btn xs ${hasKudos ? '' : 'line'}`}
                aria-pressed={hasKudos}
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

      <div className="member-card__stats">
        <TierBadge rating={member.cf_rating} size="sm" rank={rank} />
        <span className="member-card__stat-text">
          {!rank.unrated ? '· ' : ''}
          {member.problems_solved} solved · {member.current_streak}d streak
        </span>
      </div>

      {member.skills.length > 0 && (
        <div className="member-card__tags">
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
