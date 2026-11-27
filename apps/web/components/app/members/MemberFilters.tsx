'use client';
import { RANK_TITLES } from '@fecpc/contracts';

export type MemberFilterState = {
  q: string;
  rating: string;
  skill: string;
  batch: string;
};

export function MemberFilters({
  value,
  skills,
  batches,
  hasActive,
  onChange,
  onReset,
}: {
  value: MemberFilterState;
  skills: string[];
  batches: number[];
  hasActive: boolean;
  onChange: (patch: Partial<MemberFilterState>) => void;
  onReset: () => void;
}) {
  return (
    <div
      className="[display:grid] gap-3 grid-cols-[1fr] mb-6 items-center min-[760px]:grid-cols-2 min-[1100px]:flex min-[1100px]:flex-wrap min-[1100px]:gap-3 min-[1100px]:items-center"
      role="search"
      aria-label="Filter members"
    >
      <div className="min-[1100px]:flex-[0_1_250px] min-[1100px]:min-w-50">
        <input
          type="search"
          className="member-filter-ctrl"
          value={value.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Name or handle"
          aria-label="Name or handle"
        />
      </div>

      <div className="min-[1100px]:flex-[0_1_168px] min-[1100px]:min-w-37">
        <select
          className="member-filter-ctrl"
          aria-label="All ratings"
          value={value.rating}
          onChange={(e) => onChange({ rating: e.target.value })}
        >
          <option value="">All ratings</option>
          {RANK_TITLES.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>
      </div>

      <div className="min-[1100px]:flex-[0_1_168px] min-[1100px]:min-w-37">
        <select
          className="member-filter-ctrl"
          aria-label="Any skill"
          value={value.skill}
          onChange={(e) => onChange({ skill: e.target.value })}
        >
          <option value="">Any skill</option>
          {skills.map((sk) => (
            <option key={sk} value={sk}>
              {sk}
            </option>
          ))}
        </select>
      </div>

      <div className="min-[1100px]:flex-[0_1_168px] min-[1100px]:min-w-37">
        <select
          className="member-filter-ctrl"
          aria-label="All batches"
          value={value.batch}
          onChange={(e) => onChange({ batch: e.target.value })}
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b} value={String(b)}>
              Batch {b}
            </option>
          ))}
        </select>
      </div>

      <div className="min-[760px]:col-span-full min-[760px]:flex min-[760px]:items-center min-[760px]:justify-between min-[760px]:gap-3 min-[760px]:flex-wrap min-[1100px]:ml-auto min-[1100px]:flex min-[1100px]:items-center min-[1100px]:gap-2 min-[1100px]:flex-wrap">
        {hasActive && (
          <button type="button" className="btn xs line" onClick={onReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

export default MemberFilters;
