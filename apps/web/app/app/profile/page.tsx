'use client';
import { useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { HandleBox, useJudge, VjudgeBox } from '@/components/app/Judge';
import { Heatmap, Line, Radar } from '@/components/app/Charts';
import { cfTitle } from '@fecpc/content/site';
import { sheet } from '@fecpc/content/member-area';
import { roleName } from '@fecpc/contracts';
import QR from '@/components/app/QR';

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
    <form className="panel c6 no-print" onSubmit={submit}>
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
  const { s, me, act } = useStore();
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
    : [...new Set(sheet.map((x) => x.topic))].map((t) => [
        t.toLowerCase(),
        sheet.filter((x) => x.topic === t && s.solved.includes(x.id)).length,
      ]);
  const rating = data?.rating ?? me.rating,
    solved = data?.solved.length ?? me.solved;
  return (
    <Page
      title={me.name}
      aside={
        <button className="btn sm line no-print" onClick={() => print()}>
          Export CV as PDF
        </button>
      }
    >
      <div className="bento">
        <section className="c6" style={{ gap: 16 }}>
          <div className="idcard">
            <QR text={`FECPC member ${me.id}`} size={96} fg="#0D0D0B" bg="#ECE9E1" />
            <div>
              <p className="label" style={{ opacity: 0.7 }}>
                FECPC · Member card
              </p>
              <strong>{me.name}</strong>
              <p className="mono" style={{ fontSize: 14, marginTop: 6 }}>
                {me.dept} · Batch {me.batch} · FEC-{String(me.no).padStart(4, '0')}
              </p>
              <p className="mono" style={{ fontSize: 14, opacity: 0.7, marginTop: 10 }}>
                fecpc.example/u/{me.handle}
              </p>
            </div>
          </div>
          <div className="panel">
            <p className="label">Judge handles</p>
            <HandleBox />
            <VjudgeBox />
          </div>
        </section>
        <section className="panel c6">
          <div className="grid" style={{ '--min': '110px', '--g': '16px' } as React.CSSProperties}>
            <div className="kv">
              <span className="label">Rating</span>
              <span className="stat">{rating}</span>
              <span className="label">{data?.rank ?? cfTitle(rating)}</span>
            </div>
            <div className="kv">
              <span className="label">Solved</span>
              <span className="stat">{solved}</span>
              <span className="label">problems</span>
            </div>
            <div className="kv">
              <span className="label">Streak</span>
              <span className="stat">{me.streak + (s.checkin ? 1 : 0)}</span>
              <span className="label">days</span>
            </div>
          </div>
          <p className="label" style={{ marginTop: 12 }}>
            Rating history{data ? ` · ${data.handle}` : ''}
          </p>
          {data ? (
            <>
              <Line pts={hist} />
              <div className="bars-x">
                <span>first contest · {hist[0]}</span>
                <span>now · {hist.at(-1)}</span>
              </div>
            </>
          ) : (
            <p className="body empty">Link a Codeforces handle to draw your rating history.</p>
          )}
        </section>
        <section className="panel c8">
          <div className="row between">
            <p className="label">Solves, last 52 weeks</p>
            {data && <span className="label">{days.reduce((a, b) => a + b, 0)} total</span>}
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
            <p className="body empty">Link a handle to fill this in from the judge.</p>
          )}
        </section>
        <section className="panel c4" style={{ alignItems: 'center' }}>
          <p className="label" style={{ alignSelf: 'flex-start' }}>
            Solved by tag{data ? '' : ' · club record'}
          </p>
          <Radar data={tags} />
        </section>
        <form
          className="panel c6"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            act('profile', {
              name: d.get('name'),
              dept: d.get('dept'),
              batch: Number(d.get('batch')),
            });
          }}
        >
          <p className="label">Your details</p>
          <label className="field">
            <span className="label">Name</span>
            <input
              name="name"
              className="input"
              defaultValue={me.name}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </label>
          <div className="grid" style={{ '--min': '120px', '--g': '12px' } as React.CSSProperties}>
            <label className="field">
              <span className="label">Department</span>
              <input
                name="dept"
                className="input"
                defaultValue={me.dept}
                required
                minLength={2}
                maxLength={20}
              />
            </label>
            <label className="field">
              <span className="label">Batch</span>
              <input
                name="batch"
                className="input"
                type="number"
                defaultValue={me.batch}
                required
                min={0}
                max={99}
              />
            </label>
          </div>
          <p className="label">
            {me.email} · {me.role || roleName[s.role]}
          </p>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }}>
            Save details
          </button>
        </form>
        <Password />
      </div>
    </Page>
  );
}
