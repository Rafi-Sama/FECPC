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
  if (n >= 1200)
    return {
      label: 'Legend',
      className: '[--tier-c:#b91c1c] t-d:[--tier-c:#f87171]',
      ringColor: '#b91c1c',
    };
  if (n >= 900)
    return {
      label: 'Master',
      className: '[--tier-c:#c2410c] t-d:[--tier-c:#fb923c]',
      ringColor: '#c2410c',
    };
  if (n >= 600)
    return {
      label: 'Candidate Master',
      className: '[--tier-c:#7a2fd0] t-d:[--tier-c:#c084fc]',
      ringColor: '#7a2fd0',
    };
  if (n >= 400)
    return {
      label: 'Expert',
      className: '[--tier-c:#1f3bff] t-d:[--tier-c:#60a5fa]',
      ringColor: '#1F3BFF',
    };
  if (n >= 250) return { label: 'Specialist', className: 'cm-tier-spec', ringColor: '#0e7490' };
  if (n >= 100)
    return {
      label: 'Pupil',
      className: '[--tier-c:#1a7f37] t-d:[--tier-c:#4ade80]',
      ringColor: '#1a7f37',
    };
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
    <span
      className={`inline-flex items-center justify-center rounded-[50%] p-0.5 [border:2px_solid_var(--tier-c,var(--line2))] flex-none overflow-hidden [&_img]:rounded-[50%] [&_img]:block [&_svg]:rounded-[50%] [&_svg]:block [.card-author_&]:shrink-0 [.card-author_&]:rounded-[50%] [.card-author_&]:[border:var(--ann-border-thin)] ${tier.className}`}
      title={`${tier.label} · ${solved} solved`}
    >
      {avatarUrl ? (
        <img
          className="object-cover"
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size }}
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
    <span className={`${tier.className ?? ''} inline-flex items-center gap-1.5`}>
      <span className="font-semibold [color:var(--tier-c,var(--hi))] [.cm-idea-author_&]:font-bold">
        {name}
      </span>
    </span>
  );
}

export default TierName;
