'use client';
import { toggle, useStore } from '../Store';
import { Avatar, Trophy } from '@/components/pixel/Sprites';
import { hallOfFame } from '@fecpc/content/site';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function ArenaExtra({ tab }: { tab: string }) {
  const { s, me, xp, act, members, who } = useStore();
  const picks = (s.kv.fantasy ?? '').split(',').filter(Boolean);
  if (tab === 'SEASON')
    return (
      <div className="stack">
        <div className="panel" style={{ borderColor: '#FFD23F' }}>
          <div className="row">
            <Trophy size={54} />
            <div>
              <p className="label">Season 05 leader · 38 days left</p>
              <p className="big">NADIA RAHMAN</p>
            </div>
          </div>
        </div>
        <h2 className="h3 acc">HALL OF FAME</h2>
        <ol className="hof">
          {hallOfFame.map((h) => (
            <li key={h.title + h.year}>
              <span className="arcade acc">{h.year}</span>
              <div>
                <p className="arcade t">{h.title}</p>
                <p className="body">
                  {h.who} · {h.detail}
                </p>
              </div>
              <Trophy size={27} />
            </li>
          ))}
        </ol>
      </div>
    );
  if (tab === 'FANTASY')
    return (
      <div className="stack">
        <div className="panel">
          <div className="row between">
            <p className="label">Your three for Weekly #42</p>
            <span className="arcade acc">{picks.length}/3</span>
          </div>
          <div className="row" style={css({ '--g': '12px', marginTop: 12 })}>
            {[0, 1, 2].map((i) =>
              picks[i] ? (
                <span key={i} className="tag on" style={{ fontSize: 14, padding: '10px 12px' }}>
                  {who(picks[i]).name}
                </span>
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
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th className="r">Rating</th>
                <th className="r">Last round</th>
                <th className="r">Pick</th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 10).map((m, i) => {
                const on = picks.includes(m.id),
                  d = [38, 21, 12, -6, 17, 9, -14, 25, 4, 31][i];
                return (
                  <tr key={m.id} className={on ? 'you' : ''}>
                    <td>
                      <span className="row" style={css({ '--g': '10px', flexWrap: 'nowrap' })}>
                        <Avatar name={m.name} size={30} fg="#FFD23F" bg="#3A1D6E" />
                        <strong>{m.name}</strong>
                      </span>
                    </td>
                    <td className="r mono">{m.rating}</td>
                    <td className={`r mono ${d < 0 ? 'bad' : 'acc3'}`}>
                      {d > 0 ? '+' : ''}
                      {d}
                    </td>
                    <td className="r">
                      <button
                        className={`btn xs ${on ? '' : 'line'}`}
                        aria-pressed={on}
                        disabled={!on && picks.length >= 3}
                        onClick={() =>
                          act('kv', { key: 'fantasy', value: toggle(picks, m.id).join(',') })
                        }
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
      </div>
    );
  if (tab === 'RECAP')
    return (
      <div className="stack">
        <p className="label">Your year in code · 2026</p>
        <div className="bento">
          {[
            ['PROBLEMS SOLVED', me.solved + s.solved.length - s.base.solved],
            ['LONGEST STREAK', `${me.streak + (s.checkin ? 1 : 0)}D`],
            ['TOTAL XP', xp.toLocaleString('en')],
            ['CONTESTS', 23],
            ['KUDOS EARNED', me.helper],
            ['RATING GAINED', `+${me.rating - 800}`],
          ].map(([k, v]) => (
            <section key={k} className="panel c4">
              <p className="label">{k}</p>
              <p className="big">{v}</p>
            </section>
          ))}
        </div>
        <p className="body">
          Top tag: implementation. Busiest month: October. You out-solved{' '}
          {Math.round(
            (1 - members.filter((m) => m.solved > me.solved).length / members.length) * 100,
          )}
          % of the club.
        </p>
      </div>
    );
  return null;
}
