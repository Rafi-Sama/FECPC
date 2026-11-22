'use client';
import { useMemo, useState } from 'react';
import { cfUrl, myInvoices, owes } from '@fecpc/content/member-area';
import { can, rankFor, type CfRound, type Roster } from '@fecpc/contracts';
import { toggle, useStore } from '../Store';
import { HandleBox, useJudge, useSolved } from '../Judge';
import { Avatar, Trophy } from '@/components/pixel/Sprites';
import { SolveCheck } from '../home/Daily';
import { useConfirm } from '../shared/PromptDialog';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;
const WEEK = 7 * 864e5;
// Week keys are Mondays in club time (Asia/Dhaka, UTC+6).
const start = (monday: string) => Date.parse(`${monday}T00:00:00+06:00`);
const shift = (monday: string, days: number) =>
  new Date(start(monday) + days * 864e5 + 6 * 36e5).toISOString().slice(0, 10);
const day = (monday: string) =>
  new Date(start(monday)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** A member's fantasy points for one week: rating change plus 5 per problem solved, in every rated round. */
const points = (m: Roster | undefined, monday: string) =>
  (m?.cf_contests ?? [])
    .filter((r: CfRound) => r.at >= start(monday) && r.at < start(monday) + WEEK)
    .reduce((a, r) => a + r.delta + 5 * r.solved, 0);

export function Fantasy() {
  const { s, me, act, members, fantasy } = useStore();
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const last = shift(fantasy.week, -7);
  const league = (monday: string) =>
    fantasy.teams
      .filter((t) => t.week === monday)
      .map((t) => {
        const picks = t.picks.split(',').filter(Boolean);
        return {
          by: t.by,
          picks,
          pts: picks.reduce((a, id) => a + points(byId.get(id), monday), 0),
        };
      })
      .sort((a, b) => b.pts - a.pts);
  const now = league(fantasy.week),
    before = league(last);
  const key = `fantasy:${fantasy.next}`;
  const mine = (s.kv[key] ?? '').split(',').filter(Boolean);
  const pool = members
    .filter((m) => m.cf_rating && !m.is_alumni && !m.suspended)
    .map((m) => ({
      m,
      form: (m.cf_contests ?? []).slice(0, 3).reduce((a, r) => a + r.delta + 5 * r.solved, 0),
    }))
    .sort((a, b) => b.form - a.form);
  const name = (id: string) => byId.get(id)?.name ?? id;
  return (
    <div className="stack">
      <p className="body">
        Pick three members each week. They score their Codeforces rating change plus 5 points per
        problem solved in every rated round that week. Picks for a week lock when it starts.
      </p>
      {before[0] && (
        <div className="panel" style={{ borderColor: '#FFD23F' }}>
          <div className="row">
            <Trophy size={44} />
            <div>
              <p className="label">Week of {day(last)} · winner</p>
              <p className="h3">
                {name(before[0].by)} · {before[0].pts} pts
              </p>
              <p className="label">{before[0].picks.map(name).join(' · ')}</p>
            </div>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="row between">
          <p className="label">This week&apos;s league · week of {day(fantasy.week)}</p>
          <span className="label">{now.length} teams · live</span>
        </div>
        {now.length === 0 ? (
          <p className="body">No teams this week. Pick yours for next week below.</p>
        ) : (
          <ol className="list">
            {now.map((t, i) => (
              <li key={t.by} className={t.by === me.id ? 'you' : ''}>
                <span className="arcade acc" style={{ width: 32 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="grow">
                  <strong>{name(t.by)}</strong>
                  <br />
                  <span className="label">
                    {t.picks
                      .map((id) => `${name(id)} ${points(byId.get(id), fantasy.week)}`)
                      .join(' · ')}
                  </span>
                </span>
                <span className={`arcade ${t.pts < 0 ? 'bad' : 'acc3'}`}>{t.pts}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="panel">
        <div className="row between">
          <p className="label">Your team for the week of {day(fantasy.next)}</p>
          <span className="arcade acc">{mine.length}/3</span>
        </div>
        <div className="row" style={css({ '--g': '10px', marginTop: 8 })}>
          {[0, 1, 2].map((i) =>
            mine[i] ? (
              <button
                key={i}
                className="tag on"
                style={{ fontSize: 14, padding: '10px 12px' }}
                onClick={() => act('kv', { key, value: toggle(mine, mine[i]!).join(',') })}
                title="Remove"
              >
                {name(mine[i]!)} ✕
              </button>
            ) : (
              <span
                key={i}
                className="tag"
                style={{ fontSize: 14, padding: '10px 12px', borderStyle: 'dashed' }}
              >
                empty slot
              </span>
            ),
          )}
        </div>
        {pool.length === 0 ? (
          <p className="body">No member has a synced Codeforces handle yet.</p>
        ) : (
          <div className="scroll-x" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="r">Rating</th>
                  <th className="r">Last round</th>
                  <th className="r">Form · last 3</th>
                  <th className="r">Pick</th>
                </tr>
              </thead>
              <tbody>
                {pool.map(({ m, form }) => {
                  const on = mine.includes(m.id),
                    r = m.cf_contests?.[0];
                  return (
                    <tr key={m.id} className={on ? 'you' : ''}>
                      <td>
                        <span className="row" style={css({ '--g': '10px', flexWrap: 'nowrap' })}>
                          <Avatar name={m.name} size={30} fg="#FFD23F" bg="#3A1D6E" />
                          <strong>{m.name}</strong>
                        </span>
                      </td>
                      <td
                        className="r mono"
                        style={{
                          color: `color-mix(in oklab, ${rankFor(m.cf_rating!).color}, #fff 40%)`,
                        }}
                      >
                        {m.cf_rating}
                      </td>
                      <td className={`r mono ${r && r.delta < 0 ? 'bad' : 'acc3'}`}>
                        {r ? `${r.delta > 0 ? '+' : ''}${r.delta}` : '—'}
                      </td>
                      <td className={`r mono ${form < 0 ? 'bad' : ''}`}>{form}</td>
                      <td className="r">
                        <button
                          className={`btn xs ${on ? '' : 'line'}`}
                          aria-pressed={on}
                          disabled={!on && mine.length >= 3}
                          onClick={() => act('kv', { key, value: toggle(mine, m.id).join(',') })}
                        >
                          {on ? 'PICKED ✓' : 'PICK'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const kudosOf = (counts: Record<string, number>, id: string) => counts[`member:${id}`] ?? 0;

export function Trophies() {
  const { s, me, members, counts, sheets } = useStore();
  const { data } = useJudge();
  const { isSolved } = useSolved();
  const people = members.filter((m) => !m.suspended);
  const top = <K,>(f: (m: Roster) => number, fmt: (n: number) => K) => {
    const m = [...people].sort((a, b) => f(b) - f(a))[0];
    return m && f(m) > 0 ? { m, v: fmt(f(m)) } : null;
  };
  const month = Date.now() - 30 * 864e5;
  const records = [
    ['Highest rating', top((m) => m.cf_rating ?? 0, String)],
    ['Most problems solved', top((m) => m.problems_solved, String)],
    [
      'Longest streak',
      top(
        (m) => m.current_streak ?? m.streak,
        (n) => `${n} days`,
      ),
    ],
    [
      'Most kudos',
      top(
        (m) => kudosOf(counts.kudos, m.id),
        (n) => `♥ ${n}`,
      ),
    ],
    [
      'Best round this month',
      top(
        (m) =>
          Math.max(0, ...(m.cf_contests ?? []).filter((r) => r.at > month).map((r) => r.delta)),
        (n) => `+${n}`,
      ),
    ],
  ] as const;
  const champ = [...people].sort((a, b) => b.xp - a.xp)[0];

  const solved = data?.solved.length ?? me.problems_solved;
  const rating = data?.rating ?? me.cf_rating ?? 0;
  const rounds = data?.history.length ?? me.cf_contests?.length ?? 0;
  const streak = me.current_streak ?? me.streak;
  const kudos = kudosOf(counts.kudos, me.id) + s.milestoneKudosReceived;
  const week = sheets.find((x) => x.kind === 'weekly');
  const weekDone = week?.problems.filter((p) => isSolved(p.id)).length ?? 0;
  // Every badge is checked against real records; progress shows how close the member is.
  const badges: [string, string, string, number, number][] = [
    ['AC', 'First AC', 'Your first accepted solution.', solved, 1],
    ['100', 'Century', 'One hundred problems solved.', solved, 100],
    ['500', '500 Club', 'Five hundred problems solved.', solved, 500],
    ['30D', 'On Fire', 'A 30-day solving streak.', streak, 30],
    ['10X', 'Regular', 'Ten rated Codeforces rounds.', rounds, 10],
    ['PU', 'Pupil', 'Reach a 1200 rating.', rating, 1200],
    ['SP', 'Specialist', 'Reach a 1400 rating.', rating, 1400],
    ['WK', 'Week Cleared', "Solve all of this week's sheet.", weekDone, week?.problems.length || 1],
    ['♥', 'Cheered', 'Receive 10 kudos.', kudos, 10],
    [
      '৳0',
      'Zero Dues',
      'Nothing owed to the club.',
      me.system || myInvoices(s.reg).some((i) => owes(s.pay, i.id)) ? 0 : 1,
      1,
    ],
  ];

  const year = String(new Date().getFullYear());
  const yearDays = data ? Object.entries(data.days).filter(([d]) => d.startsWith(year)) : [];
  const byMonth = new Map<string, number>();
  for (const [d, n] of yearDays) byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + n);
  const busiest = [...byMonth].sort((a, b) => b[1] - a[1])[0];
  const yearStart = Date.parse(`${year}-01-01T00:00:00Z`);
  const firstIn = data ? data.historyAt.findIndex((t) => t >= yearStart) : -1;
  const ratedThisYear = firstIn < 0 ? 0 : data!.historyAt.length - firstIn;
  const ratingChange =
    data && firstIn >= 0 ? data.rating - (firstIn > 0 ? data.history[firstIn - 1]! : 0) : 0;
  const topTag = data && Object.entries(data.tags).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="stack">
      {champ && (
        <div className="panel" style={{ borderColor: '#FFD23F' }}>
          <div className="row">
            <Trophy size={54} />
            <div>
              <p className="label">Club champion · most XP</p>
              <p className="big">{champ.name.toUpperCase()}</p>
              <p className="label">{champ.xp.toLocaleString('en')} XP</p>
            </div>
          </div>
        </div>
      )}
      <h2 className="h3 acc">RECORD HOLDERS</h2>
      <ol className="hof">
        {records.map(([title, r]) => (
          <li key={title}>
            <span className="arcade acc">{r?.v ?? '—'}</span>
            <div>
              <p className="arcade t">{title}</p>
              <p className="body">{r ? `${r.m.name} · @${r.m.handle}` : 'Up for grabs'}</p>
            </div>
            <Trophy size={27} />
          </li>
        ))}
      </ol>
      <h2 className="h3 acc">BADGES</h2>
      <ul className="arena-badges">
        {badges.map(([glyph, nm, desc, v, goal], i) => {
          const pct = Math.min(1, v / goal);
          return (
            <li
              key={nm}
              className={pct >= 1 ? 'got' : ''}
              style={css({ '--b': ['#FFD23F', '#3DE1FF', '#FF4D8D', '#9BFF6B'][i % 4]! })}
            >
              <span className="glyph">{glyph}</span>
              <div>
                <p className="arcade">{nm}</p>
                <p className="body">{desc}</p>
                <span className="meter" style={css({ '--v': `${pct * 100}%` })}>
                  <i />
                </span>
                <p className="label">
                  {Math.min(v, goal).toLocaleString('en')} / {goal.toLocaleString('en')}
                </p>
              </div>
              <span className="arcade">{pct >= 1 ? 'GOT' : `${Math.floor(pct * 100)}%`}</span>
            </li>
          );
        })}
      </ul>
      <h2 className="h3 acc">YOUR {year} ON CODEFORCES</h2>
      {data ? (
        <div className="bento">
          {(
            [
              ['Problems solved', yearDays.reduce((a, [, n]) => a + n, 0)],
              ['Active days', yearDays.length],
              ['Rated rounds', ratedThisYear],
              ['Rating change', `${ratingChange >= 0 ? '+' : ''}${ratingChange}`],
              [
                'Busiest month',
                busiest
                  ? new Date(`${busiest[0]}-01`).toLocaleDateString('en-GB', { month: 'long' })
                  : '—',
              ],
              ['Top tag', topTag?.[0] ?? '—'],
            ] as const
          ).map(([k, v]) => (
            <section key={k} className="panel c4">
              <p className="label">{k}</p>
              <p
                className="big"
                style={{
                  fontSize: typeof v === 'string' && v.length > 8 ? 24 : 'clamp(28px, 3vw, 40px)',
                  overflowWrap: 'anywhere',
                }}
              >
                {v}
              </p>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel">
          <p className="body">Link your Codeforces handle to see your year.</p>
          <HandleBox />
        </div>
      )}
    </div>
  );
}

const ago = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 6e4));
  return m < 60
    ? `${m}m`
    : m < 1440
      ? `${Math.floor(m / 60)}h ${m % 60}m`
      : `${Math.floor(m / 1440)}d`;
};
const MEDAL = ['#FFD23F', '#C9D1D9', '#D98E5A'];

/** Paste one Codeforces problem and challenge the club; solvers are ranked by their first accept after it. */
export function Challenges() {
  const { s, me, act, members, challenges } = useStore();
  const sure = useConfirm();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const name = (id: string) => byId.get(id)?.name ?? id;
  const curator = !!can(s.roles, 'sheet.curate');
  return (
    <div className="stack">
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await act('challenge', { link })) setLink('');
          setBusy(false);
        }}
      >
        <p className="label">Challenge the club · paste one Codeforces problem link</p>
        <div className="row" style={css({ '--g': '10px', flexWrap: 'nowrap', marginTop: 8 })}>
          <input
            className="input"
            style={{ flex: 1 }}
            aria-label="Codeforces problem link"
            placeholder="https://codeforces.com/problemset/problem/1352/C"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
          />
          <button className="btn sm" disabled={busy}>
            CHALLENGE
          </button>
        </div>
        <p className="label" style={{ marginTop: 8 }}>
          Everyone is notified. Solves come from Codeforces; first accept after the challenge wins.
        </p>
      </form>
      {challenges.length === 0 && <p className="body">No challenges yet. Post the first one.</p>}
      {challenges.map((ch) => {
        const t0 = Date.parse(ch.at);
        const race = ch.solvers.filter((x) => x.at && Date.parse(x.at) >= t0);
        const before = ch.solvers.filter((x) => !x.at || Date.parse(x.at) < t0);
        const color = ch.rating
          ? `color-mix(in oklab, ${rankFor(ch.rating).color}, #fff 40%)`
          : undefined;
        return (
          <div key={ch.id} className="panel" style={{ gap: 12 }}>
            <div className="row between" style={css({ '--g': '10px' })}>
              <div>
                <a className="h3 link" href={cfUrl(ch.problem)} target="_blank" rel="noreferrer">
                  {ch.problem} {ch.name}
                </a>
                <p className="label">
                  by {name(ch.by)} · {ago(Date.now() - t0)} ago · {race.length} solved since
                </p>
              </div>
              <div className="row" style={css({ '--g': '10px' })}>
                <span className="arcade" style={{ color }}>
                  {ch.rating ?? '?'}
                </span>
                {(ch.by === me.id || curator) && (
                  <button
                    className="btn xs line"
                    onClick={async () =>
                      (await sure(`Remove the challenge on ${ch.name}?`, '', 'Remove', true)) &&
                      act('challengeDelete', { id: ch.id })
                    }
                  >
                    REMOVE
                  </button>
                )}
              </div>
            </div>
            {race.length ? (
              <ol className="list">
                {race.map((x, i) => (
                  <li key={x.id} className={x.id === me.id ? 'you' : ''}>
                    <span className="arcade" style={{ width: 32, color: MEDAL[i] ?? undefined }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Avatar name={name(x.id)} size={28} fg={MEDAL[i] ?? '#8E84C9'} bg="#1D1145" />
                    <strong className="grow">{name(x.id)}</strong>
                    <span className="label">in {ago(Date.parse(x.at!) - t0)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="body">Nobody has solved it since. Be the first.</p>
            )}
            {before.length > 0 && (
              <p className="label">
                Already solved before: {before.map((x) => name(x.id)).join(', ')}
              </p>
            )}
            {!ch.solvers.some((x) => x.id === me.id) && <SolveCheck id={ch.problem} />}
          </div>
        );
      })}
    </div>
  );
}
