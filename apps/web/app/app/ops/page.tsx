'use client';
import { useState } from 'react';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Bars } from '@/components/app/Charts';
import { cols } from '@fecpc/content/training';
import { fmtDate } from '@fecpc/content/site';
import { can, canFully, isAdmin } from '@fecpc/contracts';
import { Avatar } from '@/components/pixel/Sprites';

const allTabs = [
  'Board',
  'Meetings',
  'Mentors',
  'Documents',
  'Inventory',
  'Sponsors',
  'Reports',
] as const;
// Assignee picker shared by tasks, action items and equipment; '' means nobody.
function Who({
  value,
  onPick,
  label,
}: {
  value: string | null;
  onPick: (v: string | null) => void;
  label: string;
}) {
  const { members } = useStore();
  return (
    <select
      className="input sm"
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onPick(e.target.value || null)}
    >
      <option value="">Nobody</option>
      {members
        .filter((m) => !m.suspended)
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
    </select>
  );
}
const tk = (n: number) => '৳' + n.toLocaleString('en');

export default function Ops() {
  const { s, me, act, office, who, members } = useStore();
  const [tab, setTab] = useState<(typeof allTabs)[number]>('Board');
  if (!office.ops)
    return (
      <Page title="Executive workspace">
        <Denied need="a committee role" />
      </Page>
    );
  const { inventory, meetings, reports, sponsors, tasks, vault } = office.ops;
  // The sponsor ledger is for finance roles; mentor pairing for whoever holds the full mentoring grant.
  const tabs = allTabs.filter(
    (t) => (t !== 'Sponsors' || sponsors) && (t !== 'Mentors' || canFully(s.roles, 'mentees.view')),
  );
  const people = members.filter((m) => !m.suspended);
  const admin = isAdmin(s.roles);
  const day = (d: string | null) => (d ? fmtDate(d) : 'no date');
  return (
    <Page
      title={
        tab === 'Board' ? (
          <>
            {tasks.filter((t) => t.col !== 'Done').length} tasks <span className="acc">open.</span>
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
      {tab === 'Board' && (
        <>
          <form
            className="row ops-add"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = new FormData(f);
              if (
                await act('saveTask', {
                  title: d.get('title'),
                  who: d.get('who') || null,
                  due: d.get('due') || null,
                })
              )
                f.reset();
            }}
          >
            <input
              name="title"
              className="input"
              placeholder="New task"
              aria-label="New task"
              required
              minLength={3}
            />
            <select name="who" className="input sm" aria-label="Assign to" defaultValue="">
              <option value="">Nobody</option>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input name="due" type="date" className="input sm" aria-label="Due" />
            <button className="btn sm">Add</button>
          </form>
          <div className="kanban">
            {cols.map((c) => {
              const list = tasks.filter((t) => t.col === c);
              const save = (t: (typeof tasks)[number], patch: Partial<(typeof tasks)[number]>) =>
                act('saveTask', { ...t, ...patch });
              return (
                <section key={c}>
                  <p className="label">
                    {c} · {list.length}
                  </p>
                  {list.map((t) => (
                    <article key={t.id} className="panel box">
                      <span className="row between" style={{ flexWrap: 'nowrap' }}>
                        <strong>{t.title}</strong>
                        <span
                          className="row"
                          style={{ '--g': '4px', flexWrap: 'nowrap' } as React.CSSProperties}
                        >
                          <button
                            className="btn xs line"
                            aria-label={`Rename ${t.title}`}
                            onClick={() => {
                              const title = prompt('Task', t.title);
                              if (title && title !== t.title) save(t, { title });
                            }}
                          >
                            ✎
                          </button>
                          <button
                            className="btn xs line danger"
                            aria-label={`Delete ${t.title}`}
                            onClick={() =>
                              confirm(`Delete “${t.title}”?`) && act('deleteTask', { id: t.id })
                            }
                          >
                            ×
                          </button>
                        </span>
                      </span>
                      <span className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                        {t.who && (
                          <Avatar name={who(t.who).name} size={22} fg="#0D0D0B" bg="#DAD6CB" />
                        )}
                        <Who
                          label={`Assignee of ${t.title}`}
                          value={t.who}
                          onPick={(v) => save(t, { who: v })}
                        />
                        <input
                          type="date"
                          className="input sm"
                          aria-label={`Due date of ${t.title}`}
                          value={t.due ?? ''}
                          onChange={(e) => save(t, { due: e.target.value || null })}
                        />
                      </span>
                      <select
                        className="input sm"
                        aria-label={`Status of ${t.title}`}
                        value={c}
                        onChange={(e) => save(t, { col: e.target.value })}
                      >
                        {cols.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </article>
                  ))}
                  {list.length === 0 && <p className="body dim">Nothing here.</p>}
                </section>
              );
            })}
          </div>
        </>
      )}
      {tab === 'Meetings' && (
        <div className="stack">
          <form
            className="row ops-add"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = new FormData(f);
              const agenda = String(d.get('agenda'))
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean);
              if (await act('saveMeeting', { date: d.get('date'), title: d.get('title'), agenda }))
                f.reset();
            }}
          >
            <input name="date" type="date" className="input sm" aria-label="Date" required />
            <input
              name="title"
              className="input"
              placeholder="New meeting"
              aria-label="Meeting title"
              required
              minLength={3}
            />
            <textarea
              name="agenda"
              className="input"
              rows={1}
              placeholder="Agenda, one item per line"
              aria-label="Agenda"
            />
            <button className="btn sm">Add</button>
          </form>
          {meetings.length === 0 && <p className="body">No meetings yet.</p>}
          <div className="bento">
            {meetings.map((m) => (
              <section key={m.id} className="panel c6 meeting">
                <span className="row between">
                  <p className="label">{day(m.date)}</p>
                  <button
                    className="btn xs line danger"
                    aria-label={`Delete ${m.title}`}
                    onClick={() =>
                      confirm(`Delete “${m.title}” and its action items?`) &&
                      act('deleteMeeting', { id: m.id })
                    }
                  >
                    ×
                  </button>
                </span>
                <h2 className="h3">{m.title}</h2>
                {m.agenda.length > 0 && (
                  <>
                    <p className="label">Agenda</p>
                    <ol className="prose">
                      {m.agenda.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ol>
                  </>
                )}
                <p className="label">Action items</p>
                <div className="list">
                  {m.actions.map((x) => (
                    <div key={x.id} style={{ alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        className="check"
                        aria-label={`Done: ${x.what}`}
                        checked={x.done}
                        onChange={() => act('saveMeetingAction', { ...x, done: !x.done })}
                      />
                      <span
                        className="grow"
                        style={{ textDecoration: x.done ? 'line-through' : 'none' }}
                      >
                        {x.what}
                      </span>
                      <Who
                        label={`Owner of ${x.what}`}
                        value={x.who}
                        onPick={(v) => act('saveMeetingAction', { ...x, who: v })}
                      />
                      <button
                        className="btn xs line"
                        aria-label={`Remove ${x.what}`}
                        onClick={() => act('deleteMeetingAction', { id: x.id })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  className="row"
                  style={{ '--g': '8px' } as React.CSSProperties}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = e.currentTarget,
                      d = new FormData(f);
                    if (
                      await act('saveMeetingAction', {
                        meeting: m.id,
                        what: d.get('what'),
                        who: d.get('who') || null,
                      })
                    )
                      f.reset();
                  }}
                >
                  <input
                    name="what"
                    className="input"
                    style={{ flex: '1 1 160px' }}
                    placeholder="New action item"
                    aria-label="New action item"
                    required
                    minLength={3}
                  />
                  <select name="who" className="input sm" aria-label="Owner" defaultValue="">
                    <option value="">Nobody</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn xs">Add</button>
                </form>
              </section>
            ))}
          </div>
        </div>
      )}
      {tab === 'Mentors' && <Mentors />}
      {tab === 'Documents' && (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {vault.map(([n, t, d]) => (
                <tr key={n}>
                  <td>
                    <strong>{n}</strong>
                  </td>
                  <td>{t}</td>
                  <td className="mut">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'Inventory' && (
        <div className="stack">
          <form
            className="row ops-add"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (await act('saveItem', { name: new FormData(f).get('name') })) f.reset();
            }}
          >
            <input
              name="name"
              className="input"
              placeholder="New item"
              aria-label="New item"
              required
              minLength={2}
            />
            <button className="btn sm">Add</button>
          </form>
          <div className="list">
            {inventory.map((it) => (
              <div key={it.id}>
                <span className="grow">
                  <strong>{it.name}</strong>
                  <br />
                  <span className="label">
                    {it.holder ? `with ${who(it.holder).name}` : 'in the cupboard'}
                  </span>
                </span>
                <span className={`pill ${it.holder ? 'warn' : 'ok'}`}>
                  {it.holder ? 'out' : 'available'}
                </span>
                {admin ? (
                  <Who
                    label={`Holder of ${it.name}`}
                    value={it.holder}
                    onPick={(v) => act('holdItem', { id: it.id, to: v })}
                  />
                ) : (
                  (!it.holder || it.holder === me.id) && (
                    <button
                      className="btn xs line"
                      onClick={() => act('holdItem', { id: it.id, to: it.holder ? null : me.id })}
                    >
                      {it.holder ? 'Return' : 'Check out'}
                    </button>
                  )
                )}
                <button
                  className="btn xs line danger"
                  aria-label={`Delete ${it.name}`}
                  onClick={() => confirm(`Delete ${it.name}?`) && act('deleteItem', { id: it.id })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'Sponsors' && (
        <div className="bento">
          {(sponsors ?? []).map((sp) => (
            <section key={sp.name} className="panel c4">
              <h2 className="h3">{sp.name}</h2>
              <p className="big" style={{ fontSize: 36 }}>
                {tk(sp.got)}
                <span className="mut" style={{ fontSize: '.45em' }}>
                  {' '}
                  / {tk(sp.promised)}
                </span>
              </p>
              <div
                className="meter"
                style={{ '--v': `${(sp.got / sp.promised) * 100}%` } as React.CSSProperties}
              >
                <i />
              </div>
              <p className="label">We owe</p>
              <p className="body">{sp.owe}</p>
              <p className="label">{sp.last}</p>
            </section>
          ))}
        </div>
      )}
      {tab === 'Reports' && (
        <div className="bento">
          {(
            [
              ['Members', reports.growth, ''],
              ['Weekly retention', reports.retention, '%'],
              ['Problems solved per month', reports.solves, ''],
            ] as const
          ).map(([n, d, u]) => (
            <section key={n} className="panel c4">
              <p className="label">{n}</p>
              <p className="big">
                {d.at(-1)}
                {u}
              </p>
              <Bars data={[...d]} unit={u} />
              <p className="label">8 months</p>
            </section>
          ))}
          <section className="panel no-print" style={{ gridColumn: '1 / -1' }}>
            <div className="row between">
              <p className="h3">Annual report 2026</p>
              <button className="btn sm" onClick={() => print()}>
                Print or save as PDF
              </button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

// Pairs members with mentors (users.mentor_id). The API checks the same grant and that the mentor can mentor.
function Mentors() {
  const { act, members } = useStore();
  const mentors = members.filter((m) => m.roleKey && can(m.roleKey, 'mentees.view'));
  const mentees = members.filter((m) => m.roleKey !== 'alumni' && !m.suspended);
  return (
    <div className="stack">
      <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
        {mentors.map((m) => (
          <span key={m.id} className="tag">
            {m.name.split(' ')[0]} · {members.filter((x) => x.mentorId === m.id).length}
          </span>
        ))}
      </div>
      <div className="scroll-x">
        <table className="tbl cards">
          <thead>
            <tr>
              <th>Member</th>
              <th>Batch</th>
              <th className="r">Mentor</th>
            </tr>
          </thead>
          <tbody>
            {mentees.map((m) => (
              <tr key={m.id}>
                <td>
                  <span
                    className="row"
                    style={{ '--g': '10px', flexWrap: 'nowrap' } as React.CSSProperties}
                  >
                    <Avatar name={m.name} size={24} />
                    <strong>{m.name}</strong>
                  </span>
                </td>
                <td className="mono">{m.batch || '—'}</td>
                <td className="r">
                  <select
                    className="input sm"
                    aria-label={`Mentor of ${m.name}`}
                    value={m.mentorId ?? ''}
                    onChange={(e) =>
                      act('assignMentor', { user: m.id, mentor: e.target.value || null })
                    }
                  >
                    <option value="">No mentor</option>
                    {mentors
                      .filter((x) => x.id !== m.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
