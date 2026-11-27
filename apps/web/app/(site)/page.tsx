import Link from 'next/link';
import Rain from '@/components/pixel/Rain';
import Sphere from '@/components/pixel/Sphere';
import Life from '@/components/pixel/Life';
import { Avatar, Bug, Heart, Ship, Starfield } from '@/components/pixel/Sprites';
import Roadmap from '@/components/site/Roadmap';
import EventRow from '@/components/site/EventRow';
import Faq from '@/components/site/Faq';
import { site } from '@/lib/site';
import { publicEvents } from '@/lib/api';
import { upcomingContests, localTime } from '@/lib/cf';
import { badges, cfTitle, lifecycle, loops, members, squads, tracks } from '@fecpc/content/site';

import {
  crtBlockLg,
  crtBlockSm,
  crtCaption,
  loopSteps,
  rainBackdrop,
  caret,
  badgeGlyph,
} from '@/components/site/ui';

const heroInner =
  'wrap inner flex-1 min-[1000px]:[.hero-d_&>.stack]:max-w-[54%] [.hero-d_&]:relative [.hero-d_&]:flex [.hero-d_&]:flex-col [.hero-d_&]:justify-between [.hero-d_&]:gap-14 [.hero-d_&]:[padding-block:clamp(56px,11vh,100px)_44px] [.hero-d_&]:pointer-events-none [.hero-d_&_a]:pointer-events-auto';

const cursorCls =
  'inline-block w-[0.42em] h-[0.8em] bg-acc align-baseline [.boot-body_&]:w-[9px] [.boot-body_&]:h-4.5';

const boot = [
  'mounting /dev/brain',
  'loading caffeine.service',
  'linking 0xC0DE modules',
  'starting workshops.target',
  'starting contests.target',
  'reached target: hack night',
];
const pillars = [
  {
    n: '01',
    t: 'Workshops',
    d: 'Weekly classes that start from zero. Slides and recordings stay online.',
  },
  {
    n: '02',
    t: 'Contests',
    d: 'A rated club round every week, and mock regionals for the ICPC teams.',
  },
  { n: '03', t: 'Hack nights', d: 'Twelve hours, one theme, a demo at sunrise.' },
  {
    n: '04',
    t: 'Open source',
    d: 'This platform is built by members. Your first pull request can be to your own club.',
  },
];
const sheet = [
  ['Implementation', 86],
  ['Greedy', 71],
  ['Binary search', 64],
  ['Number theory', 52],
  ['Graphs', 43],
  ['DP', 31],
] as const;

export default async function Home() {
  const events = await publicEvents();
  const contests = await upcomingContests(5);
  const top = [...members].sort((a, b) => b.rating - a.rating).slice(0, 6);
  const solved = members.reduce((s, x) => s + x.solved, 0);
  const maxPts = squads[0].pts;

  return (
    <>
      {/* ───── A · PHOSPHOR TERMINAL ───── */}
      <section
        className="hero [&_.inner]:[display:grid] [&_.inner]:grid-cols-[minmax(0,1fr)] [&_.inner]:gap-12 [&_.inner]:[align-items:start] [&_.inner]:[padding-block:clamp(48px,9vh,84px)_56px] min-[1100px]:[&_.inner]:grid-cols-[minmax(0,1fr)_452px] [&_.ind]:pl-[1em] t-a crt"
        data-t="a"
      >
        <div className={rainBackdrop}>
          <Rain />
        </div>
        <div className={heroInner}>
          <div className="stack [--g:30px]">
            <h1 className="disp">
              <span className="[.disp_&]:block">
                <span className="hi">while</span> <span className="dim">(</span>alive
                <span className="dim">) {'{'}</span>
              </span>
              <span className="[.disp_&]:block ind">
                build<span className="dim">();</span>
              </span>
              <span className="[.disp_&]:block">
                <span className="dim">{'}'}</span>
                <i aria-hidden className={caret} />
              </span>
            </h1>
            <p className="lede">
              {site.short} is where {site.uniShort} students write, ship and break real software
              together. Workshops, contests and hack nights, all semester.
            </p>
            <div className="row [--g:20px]">
              <Link href="/contact" className="btn">
                &gt; Join the club
              </Link>
              <Link href="/events" className="btn ghost">
                ls ./events
              </Link>
            </div>
          </div>
          <div className="panel flush boot">
            <div className="bar">
              <span>TTY1 — boot.log</span>
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="boot-body [&_.prompt]:mt-3.5 [&_.prompt]:flex [&_.prompt]:items-center [&_.prompt]:gap-2 [&_.prompt]:flex-wrap p-[20px_20px_24px] text-[14px] leading-[2] whitespace-pre-wrap text-ink [&>div]:opacity-[0] [&>div]:[animation:appear_0s_forwards] motion-reduce:[&>div]:opacity-[1] [&_a]:[text-decoration:none] [&_a:hover]:text-acc">
              {boot.map((l, i) => (
                <div key={l} style={{ animationDelay: `${0.3 + i * 0.28}s` }}>
                  <span className="acc">[ OK ]</span> {l}
                </div>
              ))}
              <div style={{ animationDelay: `${0.3 + boot.length * 0.28}s` }}>
                <span className="acc2">[WARN]</span> sleep.service not found
              </div>
              <div className="prompt" style={{ animationDelay: `${0.6 + boot.length * 0.28}s` }}>
                <span className="dim">guest@{site.short.toLowerCase()}:~$</span>{' '}
                <Link href="/contact" className="hi">
                  ./join.sh
                </Link>
                <i aria-hidden className={`blink ${cursorCls}`} />
              </div>
            </div>
          </div>
        </div>
        <div className="statusbar">
          <div>
            <b>-- INSERT --</b>
            <span>main</span>
            <span>hero.c</span>
          </div>
          <div>
            <span>UTF-8</span>
            <span>LF</span>
            <span>Ln 1, Col 1</span>
          </div>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">
              <span className="dim">$</span> ./{site.short.toLowerCase()} --status
            </h2>
          </div>
          <div className="grid stats [&_.stat]:block [--min:180px] [--g:32px]">
            <div className="kv">
              <span className="label">members.active</span>
              <span className="stat">{members.length * 9}</span>
            </div>
            <div className="kv">
              <span className="label">problems.solved</span>
              <span className="stat">{solved.toLocaleString('en')}</span>
            </div>
            <div className="kv">
              <span className="label">contests.run</span>
              <span className="stat">42</span>
            </div>
            <div className="kv">
              <span className="label">streak.longest</span>
              <span className="stat">{Math.max(...members.map((x) => x.streak))}d</span>
            </div>
          </div>
          <div className="split even mt-16">
            <div className="panel flush">
              <div className="bar">
                <span>TTY2 — ls ./contests --upcoming</span>
                <span>codeforces · live</span>
              </div>
              <div className="px-5 pt-4.5 pb-5.5 text-[14px]">
                {contests.length === 0 && (
                  <p className="body">
                    judge unreachable right now.{' '}
                    <Link className="link acc" href="/contests">
                      open the contest page
                    </Link>{' '}
                    to retry.
                  </p>
                )}
                {contests.map((c) => (
                  <a
                    key={c.id}
                    href={`https://codeforces.com/contests/${c.id}`}
                    rel="noreferrer"
                    className="py-[11px] px-0 [display:grid] grid-cols-[auto_minmax(0,1fr)_auto] gap-4 [border-bottom:1px_dashed_var(--line2)] no-underline items-baseline [&:hover_.hi]:text-acc max-[521px]:grid-cols-[1fr_auto] max-[521px]:[&_.acc]:col-[1/-1]"
                  >
                    <span className="acc">{localTime(c.start)}</span>
                    <span className="hi overflow-hidden text-ellipsis whitespace-nowrap">
                      {c.name}
                    </span>
                    <span className="dim">{c.durationH}h</span>
                  </a>
                ))}
                <p className="label pt-3.5">times in {site.tz}</p>
              </div>
            </div>
            <div className="panel flush">
              <div className="bar">
                <span>TTY3 — cat green-sheet.progress</span>
                <span>club average</span>
              </div>
              <div className="px-5 pt-4.5 pb-5.5 text-[14px]">
                {sheet.map(([t, v]) => (
                  <div
                    key={t}
                    className="py-[9px] px-0 [display:grid] grid-cols-[130px_minmax(0,1fr)_44px] gap-3.5 items-center [&_span:last-child]:text-right [&_span:last-child]:text-[18px] max-[521px]:grid-cols-[104px_minmax(0,1fr)_40px]"
                  >
                    <span>{t}</span>
                    <div className="meter" style={{ '--v': `${v}%` } as React.CSSProperties}>
                      <i />
                    </div>
                    <span className="acc num">{v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── B · MONOLITH DITHER ───── */}
      <section
        className="hero pb-9 [&_.inner]:[display:grid] [&_.inner]:grid-cols-[minmax(0,1fr)] [&_.inner]:gap-10 [&_.inner]:items-center [&_.inner]:[padding-block:clamp(48px,9vh,96px)_48px] min-[1000px]:[&_.inner]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] t-b paper"
        data-t="b"
      >
        <div className={heroInner}>
          <div className="stack [--g:28px]">
            <h2 className="disp">
              <span className="[.disp_&]:block">Ideas in.</span>
              <span className="[.disp_&]:block silk acc [.t-b_.disp_&]:text-[0.7em] [.t-b_.disp_&]:leading-[1.15] [.t-b_.disp_&]:tracking-[0] [.t-b_.disp_&]:font-normal [.t-b_.disp_&]:[margin-block:0.05em]">
                SOFTWARE
              </span>
              <span className="[.disp_&]:block">
                out.
                <i aria-hidden className={caret} />
              </span>
            </h2>
            <p className="lede">
              {site.short} is {site.uniShort}&apos;s home for people who think in logic and build in
              code. Learn it, ship it, show it.
            </p>
            <div className="row [--g:28px]">
              <Link href="/about" className="btn">
                About the club
              </Link>
              <Link href="/projects" className="btn ghost">
                See our projects →
              </Link>
            </div>
          </div>
          <figure className="relative w-[min(100%,640px)] [aspect-ratio:1] [justify-self:center]">
            <i
              aria-hidden
              className="absolute [background:var(--ink)] [left:-6%] [right:-50vw] top-[50%] h-[1px]"
            />
            <i
              aria-hidden
              className="absolute [background:var(--ink)] left-[50%] [top:-4%] [bottom:-6%] w-[1px]"
            />
            <Sphere className="sphere" />
            <i aria-hidden className={crtBlockLg} />
            <i aria-hidden className={crtBlockSm} />
            <i aria-hidden className="absolute left-[5%] bottom-[5%] w-[2.5%] aspect-[1] bg-ink" />
            <figcaption className={crtCaption}>FIG. 01</figcaption>
            <div className="py-1.5 px-2 absolute right-0 bottom-[-9%] text-[14px] leading-[1.5] text-mut bg-bg mono">
              <div>1-BIT · 8×8 BAYER · 128 PX</div>
              <div>
                LIGHT θ ={' '}
                <span className="acc" data-theta>
                  052°
                </span>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Four things happen here, every term.</h2>
          </div>
          <ol className={loopSteps}>
            {pillars.map((p) => (
              <li key={p.n} className="panel">
                <span className="silk acc big-n">{p.n}</span>
                <div className="stack [--g:10px]">
                  <h3 className="h3">{p.t}</h3>
                  <p className="body">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">Six reasons to open it every day.</h2>
            <p className="lede">Problems, contests, events and dues behind one login.</p>
          </div>
          <ol className="[display:grid] grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-[0_32px] [&_li]:py-5.5 [&_li]:px-0 [&_li]:[display:grid] [&_li]:grid-cols-[44px_minmax(0,1fr)] [&_li]:gap-[4px_12px] [&_li]:border-t-2 [&_li]:border-t-ink [&_strong]:text-[clamp(22px,2.2vw,30px)] [&_strong]:font-medium [&_strong]:tracking-[-0.03em] [&_p]:col-[2]">
            {loops.map((l, i) => (
              <li key={l.name}>
                <span className="silk acc">0{i + 1}</span>
                <strong>{l.name}</strong>
                <p className="body">{l.what}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── C · INSERT COIN ───── */}
      <section
        className="hero hero-c items-stretch text-center pb-0 [&_>_*]:relative [&_.inner]:flex [&_.inner]:flex-col [&_.inner]:items-center [&_.inner]:justify-center [&_.inner]:gap-[clamp(24px,4vh,40px)] [&_.inner]:[padding-block:40px_150px] [&_.disp]:flex [&_.disp]:flex-col [&_.disp]:gap-[0.22em] [&_.l1]:text-acc [&_.l1]:[text-shadow:0.055em_0.055em_0_var(--acc2),0.11em_0.11em_0_#3a1d6e] [&_.l2]:[text-shadow:0.055em_0.055em_0_var(--acc3),0.11em_0.11em_0_#3a1d6e] [&_.lede]:max-w-205 t-c"
        data-t="c"
      >
        <Starfield />
        <div className="wrap hud arcade">
          <div>
            <span className="acc2">1UP</span>
            <span>{String(top[0].xp).padStart(6, '0')}</span>
          </div>
          <div className="[.hud_&]:items-center max-[561px]:[.hud_&]:hidden">
            <span className="acc">HI-SCORE</span>
            <span>{top[0].name.split(' ')[0]}</span>
          </div>
          <div className="end">
            <span className="acc3">STAGE 03</span>
            <span>{site.uniShort}</span>
          </div>
        </div>
        <div
          aria-hidden
          className="flex justify-center gap-[clamp(14px,3vw,44px)] mt-[clamp(20px,4vh,40px)] [animation:march_8s_steps(24)_infinite] [&_svg]:w-[clamp(24px,4.6vw,66px)] [&_svg]:h-auto"
        >
          {Array.from({ length: 9 }, (_, i) => (
            <Bug key={i} i={i} />
          ))}
        </div>
        <div className={heroInner}>
          <h2 className="disp">
            <span className="l1">LEVEL UP</span>
            <span className="l2">YOUR CODE</span>
          </h2>
          <p className="lede">
            Streaks, squads, duels, and a leaderboard that resets every semester.
          </p>
          <div className="row [--g:28px] justify-center">
            <Link href="/contact" className="btn">
              PRESS START
            </Link>
            <Link href="/leaderboard" className="btn ghost">
              HIGH SCORES
            </Link>
          </div>
        </div>
        <div
          aria-hidden
          className="absolute! left-[18%] bottom-19 flex flex-col items-center gap-3.5"
        >
          <span className="text-[18px] text-acc [animation:shot_1.2s_steps(10)_infinite] arcade">
            ;
          </span>
          <Ship />
        </div>
        <div className="wrap hud foot arcade">
          <div className="row [--g:14px]">
            <span>LIVES</span>
            <Heart />
            <Heart />
            <Heart />
          </div>
          <div>
            <span>CREDIT&nbsp;</span>
            <span className="acc">01</span>
          </div>
        </div>
      </section>

      <section className="sec t-c" data-t="c">
        <div className="wrap split even">
          <div>
            <div className="head">
              <h2 className="h2">HIGH SCORES</h2>
            </div>
            <ol className="scores [&_.sc]:[font-size:clamp(14px,1.6vw,18px)] [&_li]:[display:grid] [&_li]:grid-cols-[44px_36px_minmax(0,1fr)_auto] [&_li]:gap-3.5 [&_li]:items-center [&_li]:p-[14px_0] [&_li]:[border-bottom:4px_dotted_var(--line)] [&_small]:[font:14px_var(--mono),monospace] [&_small]:normal-case [&_small]:[color:var(--mut)] [&_li:nth-child(1)]:text-acc [&_li:nth-child(2)]:text-acc3 [&_li:nth-child(3)]:text-acc2">
              {top.map((x, i) => (
                <li key={x.id}>
                  <span className="text-[14px] [color:var(--mut)] arcade">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Avatar
                    name={x.name}
                    size={36}
                    fg={['#FFD23F', '#3DE1FF', '#FF4D8D'][i] ?? '#8E84C9'}
                    bg="#1D1145"
                  />
                  <span className="nm">
                    {x.name}
                    <small>{cfTitle(x.rating)}</small>
                  </span>
                  <span className="arcade sc">{x.rating}</span>
                </li>
              ))}
            </ol>
            <p className="body mt-6">
              <Link href="/leaderboard" className="link acc3">
                View all ranks →
              </Link>
            </p>
          </div>
          <div>
            <div className="head">
              <h2 className="h2">SQUAD CUP</h2>
            </div>
            <div className="stack [--g:22px]">
              {squads.map((s) => (
                <div key={s.name} className="flex flex-col gap-2.5 text-[14px]">
                  <div className="row between">
                    <span className="arcade" style={{ color: s.color }}>
                      {s.name.toUpperCase()}
                    </span>
                    <span className="arcade">{s.pts}</span>
                  </div>
                  <div
                    className="meter"
                    style={{ '--v': `${(s.pts / maxPts) * 100}%` } as React.CSSProperties}
                  >
                    <i style={{ background: s.color }} />
                  </div>
                  <span className="label">{s.motto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sec t-c" data-t="c">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">SELECT YOUR CLASS</h2>
          </div>
          <div className="grid [--min:230px]">
            {tracks.map((t, i) => (
              <article
                key={t.id}
                className="panel flex flex-col gap-3.5 [transition:transform_0.12s,border-color_0.12s] hover:border-acc hover:[transform:translate(-4px,-4px)] [&_dl]:flex [&_dl]:flex-col [&_dl]:gap-2 [&_dl_div]:[display:grid] [&_dl_div]:grid-cols-[56px_1fr] [&_dl_div]:items-center [&_dl_div]:gap-2 [&_dd]:flex [&_dd]:gap-0.75 [&_dd_i]:flex-1 [&_dd_i]:h-[10px] [&_dd_i]:[background:var(--line)] [&_dd_i.on]:[background:var(--acc3)]"
              >
                <Bug i={i} size={55} />
                <h3 className="h3 acc">{t.cls}</h3>
                <p className="label text-[#fff]">{t.name}</p>
                <dl>
                  {['LOGIC', 'BUILD', 'GRIT'].map((k, j) => (
                    <div key={k}>
                      <dt className="label">{k}</dt>
                      <dd aria-label={`${t.stat[j]} of 10`}>
                        {Array.from({ length: 10 }, (_, n) => (
                          <i key={n} className={n < t.stat[j] ? 'on' : ''} />
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="body">{t.blurb}</p>
              </article>
            ))}
          </div>
          <div className="head mt-24">
            <h2 className="h2">ACHIEVEMENTS</h2>
          </div>
          <ul className="grid badges [&_.body]:text-[14px] [&_.xp]:text-[14px] [&_.xp]:text-acc [&_li]:[display:grid] [&_li]:grid-cols-[52px_minmax(0,1fr)_auto] [&_li]:gap-3.5 [&_li]:items-center [&_li]:p-3.5 [&_li]:[border:4px_solid_var(--line)] [&_li]:[background:var(--panel)] [--min:290px] [--g:16px]">
            {badges.map((b, i) => (
              <li key={b.id}>
                <span
                  className={badgeGlyph}
                  style={{ color: ['#FFD23F', '#3DE1FF', '#FF4D8D'][i % 3] }}
                >
                  {b.glyph}
                </span>
                <p className="silk nm">{b.name}</p>
                <span className="arcade xp">+{b.xp}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── D · SIGNAL / LIFE ───── */}
      <section className="hero hero-d min-[1000px]:[&_.head]:max-w-[54%] t-d" data-t="d">
        <div className="bgfx inset-[64px_0_0_auto] w-full opacity-[0.4] [-webkit-mask-image:linear-gradient(180deg,transparent_30%,#000)] [mask-image:linear-gradient(180deg,transparent_30%,#000)] pointer-events-auto min-[1000px]:w-[44%] min-[1000px]:opacity-[1] min-[1000px]:[-webkit-mask-image:linear-gradient(90deg,transparent_4%,#000_42%)] min-[1000px]:[mask-image:linear-gradient(90deg,transparent_4%,#000_42%)]">
          <Life />
        </div>
        <div className="wrap inner flex-1 min-[1000px]:[&>.stack]:max-w-[54%] relative flex flex-col justify-between gap-14 [padding-block:clamp(56px,11vh,100px)_44px] pointer-events-none [&_a]:pointer-events-auto">
          <div className="stack [--g:32px]">
            <h2 className="disp">
              <span className="[.disp_&]:block">Four rules.</span>
              <span className="[.disp_&]:block acc">Infinite</span>
              <span className="[.disp_&]:block acc">outcomes.</span>
            </h2>
            <p className="lede">
              Every program starts as a handful of simple rules. {site.short} is where{' '}
              {site.uniShort} students learn them, then build what nobody predicted.
            </p>
            <div className="row [--g:28px]">
              <Link href="/contact" className="btn">
                Join the club
              </Link>
              <Link href="/projects" className="btn ghost">
                See what we build →
              </Link>
            </div>
          </div>
          <div className="row gap-10 text-[14px] items-start [&_.kv]:w-30 [&_.hint]:w-auto max-[1000px]:[&_.hint]:hidden mono">
            <div className="kv">
              <span className="label">Generation</span>
              <span data-life="gen">000012</span>
            </div>
            <div className="kv">
              <span className="label">Cells alive</span>
              <span data-life="count">—</span>
            </div>
            <div className="kv">
              <span className="label">Try it</span>
              <span>drag on the grid</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">
              From <span className="acc">hello world</span> to a regional, one node at a time.
            </h2>
          </div>
          <Roadmap done={['cpp', 'stl']} />
          <ol className="grid life-steps [--min:200px] [--g:0px] mt-22">
            {lifecycle.map((l, i) => (
              <li key={l.step}>
                <span className="mono acc">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h3">{l.step}</h3>
                <p className="body">{l.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">
              Something is on <span className="acc">this week.</span>
            </h2>
            <p className="lede">One calendar. Register in two taps.</p>
            <p>
              <Link href="/events" className="btn">
                Full calendar
              </Link>
            </p>
          </div>
          <div>
            {events.slice(0, 4).map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        </div>
      </section>

      {/* ───── B · questions ───── */}
      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Asked every intake.</h2>
            <p className="lede">
              Not here? Write to{' '}
              <a className="link" href={`mailto:${site.email}`}>
                {site.email}
              </a>
              .
            </p>
          </div>
          <Faq />
        </div>
      </section>

      {/* ───── A · join ───── */}
      <section className="sec t-a crt" data-t="a">
        <div className="bgfx rain [-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.07)_0_46%,#000_80%)] [mask-image:linear-gradient(90deg,rgba(0,0,0,0.07)_0_46%,#000_80%)] [&.rain]:opacity-50">
          <Rain />
        </div>
        <div className="wrap">
          <div className="panel flush max-w-225">
            <div className="bar">
              <span>TTY1 — join.sh</span>
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="p-[clamp(22px,4vw,44px)] text-[15px] leading-[2]">
              <p className="mut">
                <span className="dim">guest@{site.short.toLowerCase()}:~$</span> ./join.sh --dry-run
              </p>
              <p>
                <span className="acc">[1/3]</span> fill in the form{' '}
                <span className="dim"># 4 minutes</span>
              </p>
              <p>
                <span className="acc">[2/3]</span> take the screening quiz{' '}
                <span className="dim"># no experience needed</span>
              </p>
              <p>
                <span className="acc">[3/3]</span> book an interview slot{' '}
                <span className="dim"># we mostly ask what you want to build</span>
              </p>
              <h2 className="h2 mt-7">
                Ready when you are
                <i aria-hidden className={`blink ${cursorCls} ml-3`} />
              </h2>
              <div className="row [--g:20px] mt-7">
                <Link href="/contact" className="btn">
                  &gt; Apply now
                </Link>
                <Link href="/about" className="btn ghost">
                  man {site.short.toLowerCase()}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
