"use client";
import { RANK_TITLES } from "@/lib/rank";

export type MemberTypeFilter = "all" | "current" | "alumni";

export type MemberFilterState = {
  q: string;
  rating: string;
  skill: string;
  batch: string;
  type: MemberTypeFilter;
};

const TYPE_OPTIONS: { value: MemberTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "current", label: "Current" },
  { value: "alumni", label: "Alumni" },
];

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
    <div className="member-filters" role="search" aria-label="Filter members">
      <div className="member-filters__search">
        <input
          type="search"
          className="member-filter-ctrl"
          value={value.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Name or handle"
          aria-label="Name or handle"
        />
      </div>

      <div className="member-filters__select">
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

      <div className="member-filters__select">
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

      <div className="member-filters__select">
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

      <div className="member-filters__type">
        <div className="member-type-group" role="group" aria-label="Member type">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`tag tab${value.type === opt.value ? " on" : ""}`}
              aria-pressed={value.type === opt.value}
              onClick={() => onChange({ type: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>

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
