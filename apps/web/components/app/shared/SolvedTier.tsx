'use client';
import { Avatar } from '@/components/pixel/Sprites';

export type TierInfo = {
  label: string;
  className: string;
  ringColor: string;
};

/** Maps a member's `problems_solved` count to a consistent visual tier + ring color. */
export function solvedTier(problemsSolved: number): TierInfo {
  const n = Number(problemsSolved) || 0;
  if (n >= 1200) return { label: 'Legend', className: 'cm-tier-legend', ringColor: '#b91c1c' };
  if (n >= 900) return { label: 'Master', className: 'cm-tier-master', ringColor: '#c2410c' };
  if (n >= 600) return { label: 'Candidate Master', className: 'cm-tier-cm', ringColor: '#7a2fd0' };
  if (n >= 400) return { label: 'Expert', className: 'cm-tier-expert', ringColor: '#1F3BFF' };
  if (n >= 250) return { label: 'Specialist', className: 'cm-tier-spec', ringColor: '#0e7490' };
  if (n >= 100) return { label: 'Pupil', className: 'cm-tier-pupil', ringColor: '#1a7f37' };
  return { label: 'Newbie', className: 'cm-tier-newbie', ringColor: 'var(--mut)' };
}

export function TierAvatar({
  name,
  solved,
  avatarUrl,
  size = 36,
}: {
  name: string;
  solved: number;
  avatarUrl?: string | null;
  size?: number;
}) {
  const tier = solvedTier(solved);
  return (
    <span className={`cm-avatar-ring ${tier.className}`} title={`${tier.label} · ${solved} solved`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'cover' }}
        />
      ) : (
        <Avatar name={name} size={size} fg="var(--tier-c, var(--acc))" bg="var(--panel)" />
      )}
    </span>
  );
}

export function TierName({ name, solved }: { name: string; solved: number }) {
  const tier = solvedTier(solved);
  return (
    <span
      className={tier.className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span className="cm-tier-name">{name}</span>
    </span>
  );
}

export default TierName;
