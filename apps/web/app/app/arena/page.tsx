'use client';
import { useState } from 'react';
import Board from '@/components/site/Board';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Avatar, Bug } from '@/components/pixel/Sprites';
import { bounties, cfUrl, duels, myInvoices, owes, potd, shop } from '@fecpc/content/member-area';
import { badges, byId, squads } from '@fecpc/content/site';
import { LEVEL, level } from '@fecpc/contracts';
import { ArenaExtra } from '@/components/app/arena/ArenaExtra';
import { Verified } from '@/components/app/sheets/Verified';

const tabs = ['DAILY', 'RANKS', 'DUELS', 'SEASON'] as const;

export default function Arena() {
  const { s, me, xp, act, members } = useStore();
  const [tab, setTab] = useState<(typeof tabs)[number]>('DAILY');
  const lv = level(xp);
  const [rival, setRival] = useState('');
  const [prob, setProb] = useState(potd[1]?.id ?? potd[0]!.id);
  const solvedN = Math.max(me.problems_solved ?? 0, me.solved);
  // Badges follow the member's real record; the rest wait for data the club does not track yet.
  const got: Record<string, boolean> = {
    'first-ac': solvedN > 0,
    '100': solvedN >= 100,
    streak30: (me.current_streak ?? me.streak) >= 30,
    contests10: (me.contests_participated ?? 0) >= 10,
    'zero-dues': !me.system && !myInvoices(s.reg).some((i) => owes(s.pay, i.id)),
  };
  const sentKey = `${rival}:duel:${prob}`;
  return (
    <Page title="ARENA">
      <div className="strip">
        <div>
          <span className="label">Season rank</span>
          <strong>
            #{[...members].sort((x, y) => y.xp - x.xp).findIndex((m) => m.id === me.id) + 1}{' '}
            <small>of {members.length}</small>
          </strong>
        </div>
        <div>
          <span className="label">To next level</span>
          <strong>
            {LEVEL - lv.into} <small>XP</small>
          </strong>
        </div>
        <div>
          <span className="label">Squad {me.squad}</span>
          <strong>
            {['1st', '2nd', '3rd', '4th'][squads.findIndex((q) => q.name === me.squad)]}{' '}
            <small>in the cup</small>
          </strong>
        </div>
        <div>
          <span className="label">Daily cleared</span>
          <strong>
            {potd.filter((p) => s.solved.includes(p.id)).length}
            <small>/ {potd.length}</small>
          </strong>
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'DAILY' && (
        <div className="stack">
          <div className="tier3">
            {potd.map((p, i) => {
              const done = s.solved.includes(p.id);
              return (
                <div key={p.id} className="panel" style={{ gap: 14 }}>
                  <Bug i={i} size={44} />
                  <span className="label acc3">
                    {p.tier} · {p.rating}
                  </span>
                  <a className="h3 link" href={cfUrl(p.id)} target="_blank" rel="noreferrer">
                    {p.id} {p.name}
                  </a>
                  <button
                    className="btn sm"
                    onClick={() => act('toggle', { list: 'solved', id: p.id })}
                  >
                    {done ? 'CLEARED' : 'SOLVE'}
                    {done && <Verified on={s.verified.includes(p.id)} />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="panel">
            <p className="label">Bounties · first solver takes it</p>
            <div className="list">
              {bounties.map((b) => (
                <div key={b.id}>
                  <span className="grow">
                    <a className="link" href={cfUrl(b.id)} target="_blank" rel="noreferrer">
                      {b.id} {b.name}
                    </a>
                    <br />
                    <span className="label">{b.left} left</span>
                  </span>
                  <span className="arcade acc">+{b.prize}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === 'RANKS' && <Board list={members} />}
      {tab === 'DUELS' && (
        <div className="stack">
          {duels.map((d) => (
            <div key={d.a} className="panel">
              <div className="row between">
                <span className="row" style={{ '--g': '10px' } as React.CSSProperties}>
                  <Avatar name={byId(d.a).name} size={36} fg="#3DE1FF" bg="#1D1145" />
                  {byId(d.a).name} <span className="label">{d.elo[0]}</span>
                </span>
                <span className="arcade acc2">VS</span>
                <span className="row" style={{ '--g': '10px' } as React.CSSProperties}>
                  <span className="label">{d.elo[1]}</span> {byId(d.b).name}
                  <Avatar name={byId(d.b).name} size={36} fg="#FF4D8D" bg="#1D1145" />
                </span>
              </div>
              <p className="label" style={{ marginTop: 12 }}>
                PROBLEM {d.problem} ·{' '}
                {d.state === 'live' ? <span className="acc blink">LIVE</span> : d.state}
              </p>
            </div>
          ))}
          <div className="panel">
            <p className="label">CHALLENGE</p>
            <div className="row">
              <select
                className="input grow"
                aria-label="Rival"
                value={rival}
                onChange={(e) => setRival(e.target.value)}
              >
                <option value="">Pick a rival</option>
                {members
                  .filter((m) => m.id !== me.id && !m.suspended)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <select
                className="input"
                aria-label="Problem"
                value={prob}
                onChange={(e) => setProb(e.target.value)}
              >
                {potd.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.rating}
                  </option>
                ))}
              </select>
              <button
                className="btn sm"
                disabled={!rival || me.system || s.sent.includes(sentKey)}
                onClick={() => act('ping', { kind: 'duel', to: rival, ref: prob })}
              >
                {s.sent.includes(sentKey) ? 'SENT ✓' : 'CHALLENGE'}
              </button>
            </div>
          </div>
          <h2 className="h3 acc">FANTASY</h2>
          <ArenaExtra tab="FANTASY" />
        </div>
      )}
      {tab === 'SEASON' && (
        <div className="stack">
          <ArenaExtra tab="SEASON" />
          <h2 className="h3 acc">BADGES</h2>
          <ul
            className="grid badges"
            style={{ '--min': '300px', '--g': '16px' } as React.CSSProperties}
          >
            {badges.map((b, i) => {
              const has = !!got[b.id];
              return (
                <li key={b.id} className={has ? 'got' : ''} style={{ opacity: has ? 1 : 0.4 }}>
                  <span
                    className="glyph"
                    style={{ color: ['#FFD23F', '#3DE1FF', '#FF4D8D'][i % 3] }}
                  >
                    {b.glyph}
                  </span>
                  <div>
                    <p className="arcade nm">{b.name}</p>
                    <p className="body">{b.desc}</p>
                  </div>
                  <span className="arcade xp">{has ? 'GOT' : '+' + b.xp}</span>
                </li>
              );
            })}
          </ul>
          <h2 className="h3 acc">SHOP</h2>
          <div className="list">
            {shop.map(([n, cost]) => {
              const k = 'shop:' + n,
                got = s.kudos.includes(k);
              return (
                <div key={n}>
                  <span className="grow">{n}</span>
                  <span className="arcade acc">{cost} XP</span>
                  <button
                    className="btn xs"
                    disabled={got || xp < cost}
                    onClick={() => act('redeem', { item: n })}
                  >
                    {got ? 'REDEEMED' : xp < cost ? 'NEED XP' : 'REDEEM'}
                  </button>
                </div>
              );
            })}
          </div>
          <h2 className="h3 acc">RECAP</h2>
          <ArenaExtra tab="RECAP" />
        </div>
      )}
    </Page>
  );
}
