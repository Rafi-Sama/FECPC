'use client';

import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { useSolved } from '@/components/app/Judge';
import { cfUrl, sheet } from '@fecpc/content/member-area';
import { can } from '@fecpc/contracts';
import { Verified } from '@/components/app/sheets/Verified';
import { CuratedTab, WeeklyTab } from '@/components/app/sheets/SheetBoard';
import { useState } from 'react';

const tabs = [
  ['week', 'This week'],
  ['curated', 'Curated'],
  ['core', 'Core'],
] as const;

const topics = [...new Set(sheet.map((p) => p.topic))];

export default function Sheets() {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('week');
  return (
    <Page title="Sheets">
      <div className="bento">
        <div
          role="tablist"
          aria-label="Sheet kinds"
          className="row col-span-full gap-2 flex-row justify-start"
        >
          {tabs.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={`tag tab ${tab === k ? 'on' : ''} py-2.5 px-4.5 text-[14px]`}

              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'week' ? <WeeklyTab /> : tab === 'curated' ? <CuratedTab /> : <Core />}
      </div>
    </Page>
  );
}

/** The fixed starter ladder by topic. Ticks here count for sheet XP once Codeforces confirms them. */
function Core() {
  const { s, act, counts } = useStore();
  const rate = (id: string) =>
    Math.round(((counts.solved[id] ?? 0) / Math.max(1, counts.peopleCount)) * 100); // share of members who marked it solved
  const { synced: auto, isSolved: isDone } = useSolved();
  const done = sheet.filter((p) => isDone(p.id)).length;

  // Pick up to 4 unsolved problems from distinct topics
  const nextUp = (() => {
    const seen = new Set<string>();
    const picks: typeof sheet = [];
    for (const p of sheet) {
      if (isDone(p.id)) continue;
      if (!seen.has(p.topic)) {
        seen.add(p.topic);
        picks.push(p);
      }
      if (picks.length === 4) break;
    }
    return picks;
  })();

  return (
    <>
      <section className="panel col-span-full">
        <div className="row between items-end">
          <div>
            <p className="label">overall</p>
            <p className="big">
              {done} / {sheet.length}
            </p>
          </div>
        </div>
        <div
          className="meter h-[20px]"
          style={{ '--v': `${(done / sheet.length) * 100}%` } as React.CSSProperties}
        >
          <i />
        </div>
        {nextUp.length > 0 && (
          <div className="flex flex-row flex-nowrap items-center gap-[0.5rem] mt-[0.5rem] overflow-x-auto text-[inherit]">
            <span className="dim whitespace-nowrap">next up:</span>
            {nextUp.map((p, i) => (
              <span className="whitespace-nowrap" key={p.id}>
                <a className="link acc" href={cfUrl(p.id)} target="_blank" rel="noreferrer">
                  {p.id} {p.name}
                </a>
                {i < nextUp.length - 1 && <span className="dim"> ·</span>}
              </span>
            ))}
          </div>
        )}
      </section>
      {topics.map((t) => {
        const ps = sheet.filter((p) => p.topic === t),
          d = ps.filter((p) => isDone(p.id)).length;
        return (
          <section key={t} className="panel c6 topic" data-topic={t}>
            <div className="row between">
              <h2 className="h3">{t.toLowerCase()}/</h2>
              <span className="acc num">
                {d}/{ps.length}
              </span>
            </div>
            <div
              className="meter"
              style={{ '--v': `${(d / ps.length) * 100}%` } as React.CSSProperties}
            >
              <i />
            </div>
            <div>
              {ps.map((p) => (
                <div
                  key={p.id}
                  className={`[&_a]:[text-decoration:none] [&_a]:text-hi [&_a:hover]:text-acc [&.done_a]:[color:var(--dim)] [&.done_a]:[text-decoration:line-through] [display:grid] grid-cols-[28px_minmax(0,1fr)_auto_auto] gap-3 items-center p-[9px_0] text-[15px] ${isDone(p.id) ? 'done' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="check"
                    aria-label={`${p.name} solved`}
                    checked={isDone(p.id)}
                    disabled={auto.has(p.id)}
                    onChange={() => act('toggle', { list: 'solved', id: p.id })}
                  />
                  <a href={cfUrl(p.id)} target="_blank" rel="noreferrer">
                    <span className="dim">{p.id}</span> {p.name}
                  </a>
                  <span className={`label ${p.must ? '' : 'dim'} inline-flex items-center gap-1.5`}>
                    {(s.solved.includes(p.id) || auto.has(p.id)) && (
                      <Verified on={auto.has(p.id) || s.verified.includes(p.id)} />
                    )}
                    {auto.has(p.id) ? 'synced' : p.must ? 'must' : 'optional'}
                  </span>
                  <span className="num acc2">{p.rating}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {can(s.roles, 'sheet.stats') ? (
        <section className="panel c8 col-span-full">
          <p className="label">where members get stuck · least-solved problems on the sheet</p>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>problem</th>
                  <th>topic</th>
                  <th className="r">rating</th>
                  <th className="r">club completion</th>
                </tr>
              </thead>
              <tbody>
                {[...sheet]
                  .sort((a, b) => rate(a.id) - rate(b.id))
                  .slice(0, 6)
                  .map((p) => (
                    <tr key={p.id}>
                      <td className="hi">
                        {p.id} {p.name}
                      </td>
                      <td>{p.topic}</td>
                      <td className="r">{p.rating}</td>
                      <td className="r">
                        <span className={rate(p.id) < 40 ? 'bad' : 'acc'}>{rate(p.id)}%</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
