'use client';
import { useState } from 'react';
import Board from '@/components/site/Board';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { useSolved } from '@/components/app/Judge';
import { Bug } from '@/components/pixel/Sprites';
import { cfUrl } from '@fecpc/content/member-area';
import { LEVEL, level, rankFor } from '@fecpc/contracts';
import { Challenges, Fantasy, Trophies } from '@/components/app/arena/ArenaExtra';
import { SolveCheck, useDaily } from '@/components/app/home/Daily';

const tabs = ['DAILY', 'CHALLENGES', 'RANKS', 'FANTASY', 'TROPHIES'] as const;

export default function Arena() {
  const { me, xp, members, sheets } = useStore();
  const { isSolved } = useSolved();
  const potd = useDaily();
  const [tab, setTab] = useState<(typeof tabs)[number]>('DAILY');
  const lv = level(xp);
  const week = sheets.find((x) => x.kind === 'weekly');
  const weekDone = week?.problems.filter((p) => isSolved(p.id)).length ?? 0;
  const rank = [...members].sort((x, y) => y.xp - x.xp).findIndex((m) => m.id === me.id) + 1;
  // Bounties: this week's problems no member has solved yet, hardest first. The first solver claims it.
  const bounties = [...(week?.problems ?? [])]
    .sort((a, b) => +(a.club > 0) - +(b.club > 0) || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);
  return (
    <Page title="ARENA">
      <div className="strip">
        <div>
          <span className="label">Club rank</span>
          <strong>
            #{rank || '—'} <small>of {members.length}</small>
          </strong>
        </div>
        <div>
          <span className="label">Level {lv.lv}</span>
          <strong>
            {LEVEL - lv.into} <small>XP to go</small>
          </strong>
        </div>
        <div>
          <span className="label">Daily cleared</span>
          <strong>
            {potd.filter((p) => isSolved(p.id)).length}
            <small>/ {potd.length}</small>
          </strong>
        </div>
        <div>
          <span className="label">Weekly sheet</span>
          <strong>
            {weekDone}
            <small>/ {week?.problems.length ?? 0}</small>
          </strong>
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'DAILY' && (
        <div className="stack">
          {potd.length ? (
            <div className="tier3">
              {potd.map((p, i) => (
                <div
                  key={p.id}
                  className="panel"
                  style={{ gap: 14, opacity: isSolved(p.id) ? 0.6 : 1 }}
                >
                  <Bug i={i} size={44} />
                  <span className="label acc3">
                    {p.tier} · {p.rating}
                  </span>
                  <a className="h3 link" href={cfUrl(p.id)} target="_blank" rel="noreferrer">
                    {p.id} {p.name}
                  </a>
                  <SolveCheck id={p.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="body">This week&apos;s problems are being picked.</p>
          )}
          <div className="panel">
            <div className="row between">
              <p className="label">Bounties · be the first in the club to solve it</p>
              <span className="label">from this week&apos;s sheet</span>
            </div>
            <div className="list">
              {bounties.map((b) => (
                <div key={b.id} style={{ opacity: b.club > 0 ? 0.55 : 1 }}>
                  <span className="grow">
                    <a className="link" href={cfUrl(b.id)} target="_blank" rel="noreferrer">
                      {b.id} {b.name}
                    </a>
                    <br />
                    <span className="label">
                      {b.club > 0
                        ? `claimed · ${b.club} solved it`
                        : isSolved(b.id)
                          ? 'you solved it · claim shows after the next sync'
                          : 'unclaimed'}
                    </span>
                  </span>
                  <span
                    className="arcade"
                    style={{
                      color: b.rating
                        ? `color-mix(in oklab, ${rankFor(b.rating).color}, #fff 40%)`
                        : undefined,
                    }}
                  >
                    {b.rating ?? '—'}
                  </span>
                </div>
              ))}
              {bounties.length === 0 && <p className="body">No sheet this week yet.</p>}
            </div>
          </div>
        </div>
      )}
      {tab === 'RANKS' && <Board list={members.filter((m) => !m.suspended)} me={me.id} />}
      {tab === 'CHALLENGES' && <Challenges />}
      {tab === 'FANTASY' && <Fantasy />}
      {tab === 'TROPHIES' && <Trophies />}
    </Page>
  );
}
