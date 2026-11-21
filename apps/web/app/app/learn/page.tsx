'use client';
import { SaveForm } from '@/components/app/SaveBar';
import { useState } from 'react';
import Roadmap from '@/components/site/Roadmap';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Avatar } from '@/components/pixel/Sprites';
import { doubts, resources, sheet } from '@fecpc/content/member-area';
import { roadmap } from '@fecpc/content/site';
import { byId } from '@fecpc/content/site';
import { can } from '@fecpc/contracts';

const tabs = ['Roadmap', 'Resources', 'Doubts', 'Mentorship'] as const;
const levels = ['All', 'Beginner', 'Intermediate', 'Advanced'] as const;
// A roadmap node is done when its green-sheet topic is cleared (every must-solve), or, with no sheet topic, its library shelf is read.
const nodeSheet: Record<string, string> = {
  cpp: 'Implementation',
  stl: 'Strings',
  math: 'Math',
  graphs: 'Graphs',
  dp: 'DP',
};
const nodeShelf: Record<string, string> = { ds: 'Data structures', icpc: 'ICPC' };

export default function Learn() {
  const { s, me, act, office, who } = useStore();
  const mentees = office.mentees ?? [];
  const [tab, setTab] = useState<(typeof tabs)[number]>('Roadmap');
  const [lvl, setLvl] = useState<(typeof levels)[number]>('All');
  const [q, setQ] = useState('');
  const list = resources.filter(
    (r) =>
      (lvl === 'All' || r.level === lvl) &&
      (r.title + r.topic).toLowerCase().includes(q.toLowerCase()),
  );
  const scope = can(s.roles, 'mentees.view');
  const done = roadmap
    .filter((n) =>
      nodeSheet[n.id]
        ? sheet
            .filter((x) => x.topic === nodeSheet[n.id] && x.must)
            .every((x) => s.solved.includes(x.id))
        : resources.filter((r) => r.topic === nodeShelf[n.id]).every((r) => s.done.includes(r.id)),
    )
    .map((n) => n.id);
  const [sent, setSent] = useState(false);
  return (
    <Page
      title={
        tab === 'Roadmap' ? (
          <>
            {done.length} of {roadmap.length} nodes <span className="acc">done.</span>
          </>
        ) : (
          <>
            {tab}
            <span className="acc">.</span>
          </>
        )
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'Roadmap' && (
        <>
          <Roadmap done={done} />
        </>
      )}
      {tab === 'Resources' && (
        <div className="stack">
          <div className="row">
            <input
              className="input"
              style={{ maxWidth: 320 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the library"
              aria-label="Search resources"
            />
            <Tabs tabs={levels} value={lvl} onChange={setLvl} />
          </div>
          <div className="list">
            {list.length === 0 && (
              <p className="body">Nothing matches. Clear the search or pick another level.</p>
            )}
            {list.map((r) => {
              const done = s.done.includes(r.id);
              return (
                <div key={r.id}>
                  <span className="grow">
                    <strong style={{ opacity: done ? 0.55 : 1 }}>{r.title}</strong>
                    <br />
                    <span className="label">
                      {r.type} · {r.topic} · {r.level} · ▲ {r.up}
                    </span>
                  </span>
                  <button
                    className={`btn xs ${done ? '' : 'line'}`}
                    aria-pressed={done}
                    onClick={() => act('toggle', { list: 'done', id: r.id })}
                  >
                    {done ? 'Done ✓' : 'Mark done'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'Doubts' && (
        <div className="list">
          {doubts.map((d) => (
            <div key={d.id}>
              <Avatar name={byId(d.by).name} size={36} />
              <span className="grow">
                <strong>{d.q}</strong>
                <br />
                <span className="label">
                  {byId(d.by).name} · problem {d.problem} · {d.answers} answers · ▲ {d.up}
                </span>
              </span>
              <span className={`pill ${d.solved ? 'ok' : 'warn'}`}>
                {d.solved ? 'answered' : 'open'}
              </span>
              <button
                className="btn xs line"
                aria-pressed={s.kudos.includes(d.id)}
                disabled={d.by === me.id}
                onClick={() => act('toggle', { list: 'kudos', id: d.id })}
              >
                {s.kudos.includes(d.id) ? 'Kudos sent' : 'Kudos'}
              </button>
            </div>
          ))}
        </div>
      )}
      {tab === 'Mentorship' &&
        (scope ? (
          <div className="stack">
            <p className="label">
              {scope === 'scope' ? 'Your mentees' : 'All mentees'} · {mentees.length}
            </p>
            {mentees.length === 0 && (
              <p className="body">Nobody is assigned to you yet. The CP Head assigns mentees.</p>
            )}
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Mentee</th>
                    <th>Weekly target</th>
                    <th>Last active</th>
                    <th>Flag</th>
                    <th>Latest check-in</th>
                    <th className="r">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mentees.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{who(m.id).name}</strong>
                      </td>
                      <td>
                        {m.week[1]}/{m.week[0]} DP problems
                      </td>
                      <td>{m.last}</td>
                      <td className={m.flag ? 'bad' : 'dim'}>{m.flag || '—'}</td>
                      <td style={{ maxWidth: 320 }}>
                        {m.checkin ? (
                          <>
                            {m.checkin.body}
                            <br />
                            <span className="label">
                              {new Date(m.checkin.at).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </>
                        ) : (
                          <span className="dim">none yet</span>
                        )}
                      </td>
                      <td className="r">
                        <button
                          className="btn xs line"
                          disabled={s.sent.includes(m.id + ':nudge:')}
                          onClick={() => act('ping', { kind: 'nudge', to: m.id })}
                        >
                          {s.sent.includes(m.id + ':nudge:') ? 'Nudged' : 'Nudge'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : me.mentor ? (
          <div className="bento">
            <section className="panel c6">
              <p className="label">Your mentor</p>
              <div className="row">
                <Avatar name={me.mentor} size={56} />
                <strong className="h3">{me.mentor}</strong>
              </div>
            </section>
            <SaveForm
              className="panel c6"
              label="Check-in not sent"
              saveLabel="Send check-in"
              onSubmit={async (e) => {
                const f = e.currentTarget;
                const ok = await act('send', {
                  kind: 'checkin',
                  body: String(new FormData(f).get('body')).trim(),
                });
                if (ok) {
                  f.reset();
                  setSent(true);
                }
                return ok;
              }}
            >
              <p className="label">Weekly check-in</p>
              {sent && (
                <p className="body ok" role="status">
                  Sent to {me.mentor}.
                </p>
              )}
              <label className="field">
                <span className="label">What blocked you this week?</span>
                <textarea
                  name="body"
                  className="input"
                  required
                  minLength={3}
                  maxLength={1000}
                  placeholder="One or two sentences"
                  style={{ minHeight: 88 }}
                />
              </label>
            </SaveForm>
          </div>
        ) : (
          <div className="panel">
            <p className="h3">No mentor assigned yet.</p>
            <p className="body">
              The CP Head pairs new members with a mentor. Until then, ask in Doubts.
            </p>
          </div>
        ))}
    </Page>
  );
}
