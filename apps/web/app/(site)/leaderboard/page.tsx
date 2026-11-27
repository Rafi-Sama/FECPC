import Link from 'next/link';
import Board from '@/components/site/Board';
import { Avatar, Bug, Starfield, Trophy } from '@/components/pixel/Sprites';
import { badges, cfTitle, hallOfFame, members, squads } from '@fecpc/content/site';

import { badgeGlyph, recordList } from '@/components/site/ui';

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
      <section className="page-head t-c text-center" data-t="c">
        <Starfield seed={99} />
        <div className="wrap relative">
          <div
            aria-hidden
            className="flex justify-center gap-[clamp(14px,3vw,44px)] mt-[clamp(20px,4vh,40px)] [animation:march_8s_steps(24)_infinite] [&_svg]:w-[clamp(24px,4.6vw,66px)] [&_svg]:h-auto mb-10"
          >
            {Array.from({ length: 7 }, (_, i) => (
              <Bug key={i} i={i} />
            ))}
          </div>
          <h1 className="disp my-7">
            <span className="text-acc [text-shadow:.055em_.055em_0_var(--acc2),.11em_.11em_0_#3A1D6E]">
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
                  <div className="w-full flex flex-col items-center justify-center gap-2.5 [border:4px_solid_#fff] [background:var(--panel)] [font-size:clamp(20px,3vw,36px)] [&_small]:text-[14px] [&_small]:text-acc [.p1_&]:h-[150px] [.p1_&]:border-acc [.p2_&]:h-[110px] [.p2_&]:border-acc3 [.p3_&]:h-[84px] [.p3_&]:border-acc2 arcade">
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
                <ul className="stack [--g:16px]">
                  {rules.map(([t, x, d]) => (
                    <li
                      key={t}
                      className="[display:grid] grid-cols-[90px_auto] gap-[6px_16px] p-4 border-4 border-line text-[14px] [&_p]:col-[1/-1] [&_.acc]:[justify-self:end]"
                    >
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
          <div className="grid [--min:240px]">
            {squads.map((s, i) => (
              <article
                key={s.name}
                className="panel flex flex-col gap-3.5 [transition:transform_0.12s,border-color_0.12s] hover:[transform:translate(-4px,-4px)] [&_dl]:flex [&_dl]:flex-col [&_dl]:gap-2 [&_dl_div]:[display:grid] [&_dl_div]:grid-cols-[56px_1fr] [&_dl_div]:items-center [&_dl_div]:gap-2 [&_dd]:flex [&_dd]:gap-0.75 [&_dd_i]:flex-1 [&_dd_i]:h-[10px] [&_dd_i]:[background:var(--line)] [&_dd_i.on]:[background:var(--acc3)]"
                style={{ borderColor: s.color }}
              >
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
            <ul className="grid badges [&_.body]:text-[14px] [&_.xp]:text-[14px] [&_.xp]:text-acc [&_li]:[display:grid] [&_li]:grid-cols-[52px_minmax(0,1fr)_auto] [&_li]:gap-3.5 [&_li]:items-center [&_li]:p-3.5 [&_li]:[border:4px_solid_var(--line)] [&_li]:[background:var(--panel)] [--g:12px] [--min:340px]">
              {badges.map((b, i) => (
                <li key={b.id}>
                  <span
                    className={badgeGlyph}
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
        <div className="wrap pb-20">
          <div className="head">
            <h2 className="h2">HALL OF FAME</h2>
          </div>
          <ol className={recordList}>
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
          <p className="mt-12">
            <Link href="/contact" className="btn">
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
