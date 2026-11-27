'use client';
// Super Admin: how much XP everything is worth. Totals are recomputed with the new amounts for everyone at once,
// and each member's XP history shows the change as its own line.
import { useEffect, useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { useStore } from '@/components/app/Store';
import {
  cleanXpRates,
  XP_DEFAULTS,
  XP_LIMITS,
  XP_MAX,
  XP_RULES,
  xpRates,
  type XpRates as Rates,
} from '@fecpc/contracts';

const GROUPS = [...new Set(XP_RULES.map((r) => r.group))];

export function XpRates() {
  const { s, act } = useStore();
  const saved = xpRates(s.kv);
  const savedKey = JSON.stringify(saved);
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => setV({}), [savedKey]);
  const val = (k: keyof Rates) => v[k] ?? String(saved[k]);
  const field = (r: { key: keyof Rates; label: string; def: number }) => (
    <label key={r.key} className="xp-rate">
      <span>
        {r.label}
        {saved[r.key] !== r.def && <small> · default {r.def}</small>}
      </span>
      <input
        className="input mono"
        type="number"
        min={0}
        max={XP_MAX}
        step={1}
        required
        aria-label={r.label}
        value={val(r.key)}
        onChange={(e) => setV({ ...v, [r.key]: e.target.value })}
      />
    </label>
  );
  return (
    <SaveForm
      className="stack"
      label="Unsaved XP amounts"
      saveLabel="Save XP amounts"
      baselineKey={savedKey}
      onDiscard={() => setV({})}
      onSubmit={async () => {
        const next = cleanXpRates(
          Object.fromEntries(Object.keys(saved).map((k) => [k, Number(val(k as keyof Rates))])),
        );
        if (typeof next === 'string') return next;
        const ok = await act('setXpRates', { rates: next });
        if (ok) setV({});
        return ok;
      }}
    >
      <p className="body max-w-[70ch]">
        XP each action is worth. A change applies to everyone&apos;s total at once, and shows in
        each member&apos;s XP history.
      </p>
      <div className="xp-rate-groups">
        {GROUPS.map((g) => (
          <section key={g} className="panel">
            <p className="label">{g}</p>
            {XP_RULES.filter((r) => r.group === g).map(field)}
          </section>
        ))}
        <section className="panel">
          <p className="label">Limits</p>
          {XP_LIMITS.map(field)}
        </section>
      </div>
      <div className="row [--g:8px]">
        <button type="submit" className="btn sm">
          Save XP amounts
        </button>
        <button
          type="button"
          className="btn sm line"
          onClick={() =>
            setV(Object.fromEntries(Object.entries(XP_DEFAULTS).map(([k, n]) => [k, String(n)])))
          }
        >
          Use defaults
        </button>
      </div>
    </SaveForm>
  );
}
