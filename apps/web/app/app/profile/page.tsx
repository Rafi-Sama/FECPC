'use client';
import { useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { HandleBox, useJudge, VjudgeBox } from '@/components/app/Judge';
import { Heatmap, Line, Radar } from '@/components/app/Charts';
import { cfTitle } from '@fecpc/content/site';
import { sheet } from '@fecpc/content/member-area';
import { level, rankFor, roleName } from '@fecpc/contracts';

function Password() {
  const [msg, setMsg] = useState<[boolean, string] | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget,
      d = Object.fromEntries(new FormData(f));
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      setMsg(
        res.ok
          ? [true, 'Password changed. Your other devices have been signed out.']
          : [false, (await res.json()).error ?? 'That did not work.'],
      );
      if (res.ok) f.reset();
    } catch {
      setMsg([false, 'You seem to be offline. Nothing was changed.']);
    }
  };
  return (
    <form className="panel c4 no-print" onSubmit={submit}>
      <p className="label">Change password</p>
      <label className="field">
        <span className="label">Current password</span>
        <input
          name="currentPassword"
          type="password"
          className="input"
          required
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span className="label">New password · at least 10 characters</span>
        <input
          name="newPassword"
          type="password"
          className="input"
          required
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
        />
      </label>
      {msg && (
        <p className={`body ${msg[0] ? 'ok' : 'bad'}`} role="status">
          {msg[1]}
        </p>
      )}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }}>
        Change password
      </button>
    </form>
  );
}

export default function Profile() {
  const { s, me, counts, xp } = useStore();
  // kudos on the profile itself, plus kudos on the member's milestones in the feed
  const profileKudos = counts.kudos?.[`member:${me.id}`] ?? 0;
  const kudos = profileKudos + s.milestoneKudosReceived;
  const { data } = useJudge();
  const days = data
    ? Array.from(
        { length: 364 },
        (_, i) =>
          data.days[new Date(Date.now() - (363 - i) * 864e5).toISOString().slice(0, 10)] ?? 0,
      )
    : [];
  const hist = data?.history ?? [];
  // Without a judge handle the radar shows what the member cleared on the club sheet, never made-up numbers.
  const tags: [string, number][] = data
    ? Object.entries(data.tags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t, n]): [string, number] => [t.length > 14 ? t.split(' ')[0]! : t, n])
    : [...new Set(sheet.map((x) => x.topic))].map((t) => [
        t.toLowerCase(),
        sheet.filter((x) => x.topic === t && s.solved.includes(x.id)).length,
      ]);
  const rating = data?.rating ?? me.rating,
    peak = data?.maxRating ?? me.peak,
    solved = data?.solved.length ?? me.solved,
    tier = rankFor(rating),
    lv = level(xp),
    active = days.filter(Boolean).length;
  const stats: [string, React.ReactNode, string, string?][] = [
    ['Rating', rating || '—', data?.rank ?? cfTitle(rating), rating ? tier.color : undefined],
    [
      'Peak',
      peak || '—',
      peak ? rankFor(peak).title : 'unrated',
      peak ? rankFor(peak).color : undefined,
    ],
    ['Solved', solved, 'problems'],
    ['Rated rounds', hist.length, data ? 'on Codeforces' : 'link a handle'],
    ['Streak', me.streak + (s.checkin ? 1 : 0), 'days'],
    ['Level', lv.lv, `${lv.title} · ${xp} XP`],
  ];
  return (
    <Page
      title={me.name}
      aside={
        <button className="btn sm line no-print" onClick={() => print()}>
          Export CV as PDF
        </button>
      }
    >
      <div className="bento fill profile">
        <section className="c5 idcard" style={{ '--r': tier.color } as React.CSSProperties}>
          <div>
            <p className="label" style={{ opacity: 0.7 }}>
              FECPC · Member card
            </p>
            <strong>{me.name}</strong>
            <p className="mono" style={{ fontSize: 14, marginTop: 6 }}>
              {me.role || roleName[s.role]} · {me.dept} · Batch {me.batch}
            </p>
            <p className="mono" style={{ fontSize: 14, marginTop: 4, opacity: 0.8 }}>
              FEC-{String(me.no).padStart(4, '0')}
            </p>
            <p className="idcard-cf">
              {data ? (
                <a
                  href={`https://codeforces.com/profile/${data.handle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.handle} · {data.rank}
                </a>
              ) : (
                'Codeforces not linked'
              )}
            </p>
            <p
              className="idcard-kudos"
              title={`${profileKudos} on profile · ${s.milestoneKudosReceived} on milestones`}
            >
              ♥ {kudos} kudos
            </p>
          </div>
        </section>
        <section className="panel c7">
          <div className="pstats">
            {stats.map(([k, v, sub, c]) => (
              <div key={k} style={c ? ({ '--r': c } as React.CSSProperties) : undefined}>
                <span className="label">{k}</span>
                <span className="stat">{v}</span>
                <span className="label">{sub}</span>
              </div>
            ))}
          </div>
          <p className="label">Rating history{data ? ` · ${data.handle}` : ''}</p>
          {data && hist.length > 1 ? (
            <>
              <Line pts={hist} />
              <div className="bars-x">
                <span>first contest · {hist[0]}</span>
                <span>now · {hist.at(-1)}</span>
              </div>
            </>
          ) : (
            <p className="body dim">
              {data
                ? 'Rated rounds will draw a line here.'
                : 'Link a Codeforces handle to draw your rating history.'}
            </p>
          )}
        </section>
        <section className="panel c8">
          <div className="row between">
            <p className="label">Solves, last 52 weeks</p>
            {data && (
              <span className="label">
                {days.reduce((a, b) => a + b, 0)} accepted · {active} active days
              </span>
            )}
          </div>
          {data ? (
            <>
              <Heatmap days={days} />
              <div className="bars-x">
                <span>a year ago</span>
                <span>less ▫ ▪ ■ more</span>
                <span>today</span>
              </div>
            </>
          ) : (
            <p className="body dim">Link a handle to fill this in from the judge.</p>
          )}
        </section>
        <section className="panel c4" style={{ alignItems: 'center' }}>
          <p className="label" style={{ alignSelf: 'flex-start' }}>
            Strongest topics{data ? '' : ' · club sheet'}
          </p>
          <Radar data={tags} />
        </section>
        {data && data.contests.length > 0 && (
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <p className="label">Recent rated rounds</p>
            <ul className="list">
              {data.contests.map((c) => (
                <li key={c.id}>
                  <span className="grow">
                    <strong>{c.name}</strong>
                    <br />
                    <span className="label">
                      {new Date(c.at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                  <span className="num">#{c.rank.toLocaleString()}</span>
                  <b
                    className={`num ${c.delta >= 0 ? 'ok' : 'bad'}`}
                    style={{ width: 56, textAlign: 'right' }}
                  >
                    {c.delta >= 0 ? '+' : ''}
                    {c.delta}
                  </b>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="panel c8 no-print">
          <p className="label">Judge handles</p>
          <HandleBox />
          <VjudgeBox />
        </div>
        <Password />
      </div>
    </Page>
  );
}
