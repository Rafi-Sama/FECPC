import Link from 'next/link';
import Board from '@/components/site/Board';
import { Avatar, Bug, Starfield, Trophy } from '@/components/pixel/Sprites';
import { badges, cfTitle, hallOfFame, members, squads } from '@fecpc/content/site';

export const metadata = { title: 'Leaderboard' };
const rules = [
  ['SOLVE', '+12 XP', 'Any accepted problem on a linked judge.'],
  ['STREAK', '+30 XP / DAY', 'Solve the Problem of the Day. Freeze tokens save one missed day.'],
  ['HELP', '+8 XP', 'A kudos from a member.'],
  ['ATTEND', '+20 XP', 'Check in to a class or event with the room code.'],
];

export default function Leaderboard() {
  const top = [...members].sort((a, b) => b.rating - a.rating).slice(0, 3);
  const order = [top[1], top[0], top[2]];
  return (
    <>
      <section className="page-head t-c" data-t="c" style={{ textAlign: 'center' }}>
        <Starfield seed={99} />
        <div className="wrap" style={{ position: 'relative' }}>
          <div aria-hidden className="march" style={{ marginBottom: 40 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <Bug key={i} i={i} />
            ))}
          </div>
          <h1 className="disp" style={{ marginBlock: 28 }}>
            <span
              style={{
                color: 'var(--acc)',
                textShadow: '.055em .055em 0 var(--acc2),.11em .11em 0 #3A1D6E',
              }}
            >
              HIGH SCORES
            </span>
          </h1>
          <ol className="podium">
            {order.map((p, i) => {
              const place = [2, 1, 3][i];
              return (
                <li key={p.id} className={`p${place}`}>
                  {place === 1 && <Trophy size={45} />}
                  <Avatar
                    name={p.name}
                    size={place === 1 ? 84 : 63}
                    fg={['#3DE1FF', '#FFD23F', '#FF4D8D'][i]}
                    bg="#1D1145"
                  />
                  <strong>{p.name}</strong>
                  <span className="label">{cfTitle(p.rating)}</span>
                  <div className="plinth arcade">
                    <span>{place}</span>
                    <small>{p.rating}</small>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="sec t-c" data-t="c">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">ALL PLAYERS</h2>
          </div>
          <div className="split flip">
            <Board />
            <aside>
              <div>
                <ul className="stack" style={{ '--g': '16px' } as React.CSSProperties}>
                  {rules.map(([t, x, d]) => (
                    <li key={t} className="rule-row">
                      <span className="arcade acc3">{t}</span>
                      <span className="arcade acc">{x}</span>
                      <p className="body">{d}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="sec t-c" data-t="c">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">SQUADS</h2>
          </div>
          <div className="grid" style={{ '--min': '240px' } as React.CSSProperties}>
            {squads.map((s, i) => (
              <article key={s.name} className="panel class-card" style={{ borderColor: s.color }}>
                <div className="row between">
                  <Bug i={i} size={55} color={s.color} />
                  <span className="arcade dim">#{i + 1}</span>
                </div>
                <h3 className="h3" style={{ color: s.color }}>
                  {s.name.toUpperCase()}
                </h3>
                <p className="stat">{s.pts}</p>
                <p className="body">{s.motto}</p>
                <p className="label">
                  {members
                    .filter((m) => m.squad === s.name)
                    .map((m) => m.name.split(' ')[0])
                    .join(', ')}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec t-c" data-t="c">
        <div className="wrap">
          <div>
            <div className="head">
              <h2 className="h2">BADGES</h2>
            </div>
            <ul
              className="grid badges"
              style={{ '--g': '12px', '--min': '340px' } as React.CSSProperties}
            >
              {badges.map((b, i) => (
                <li key={b.id}>
                  <span
                    className="glyph"
                    style={{ color: ['#FFD23F', '#3DE1FF', '#FF4D8D'][i % 3] }}
                  >
                    {b.glyph}
                  </span>
                  <div>
                    <p className="silk nm">{b.name}</p>
                    <p className="body">{b.desc}</p>
                  </div>
                  <span className="arcade xp">+{b.xp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="sec t-c" data-t="c" id="hall">
        <Starfield seed={31} />
        <div className="wrap" style={{ paddingBottom: 80 }}>
          <div className="head">
            <h2 className="h2">HALL OF FAME</h2>
          </div>
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
                <Trophy size={27} color="#FFD23F" />
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 48 }}>
            <Link href="/join" className="btn">
              <span aria-hidden className="blink">
                &gt;
              </span>
              ENTER YOUR NAME
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
