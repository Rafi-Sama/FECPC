'use client';
import { useState } from 'react';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Bars } from '@/components/app/Charts';
import { cols } from '@fecpc/content/training';
import { fmtDate } from '@fecpc/content/site';
import { can, canFully, isAdmin } from '@fecpc/contracts';
import { Avatar } from '@/components/pixel/Sprites';
import { DatePicker } from '@/components/app/shared/DatePicker';
import { PersonPicker } from '@/components/app/shared/PersonPicker';

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
    <PersonPicker
      people={members.filter((m) => !m.suspended)}
      value={value}
      onPick={onPick}
      label={label}
    />
  );
}
const tk = (n: number) => '৳' + n.toLocaleString('en');

export default function Ops() {
  const { s, me, act, office, who, members } = useStore();
  const [tab, setTab] = useState<(typeof allTabs)[number]>('Board');
  // Drag a card onto a column to move it; `moving` shows it there until the server confirms.
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: number; col: string } | null>(null);
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
            <PersonPicker name="who" people={people} label="Assign to" />
            <DatePicker name="due" label="Due" placeholder="Due date" />
            <button className="btn sm">Add</button>
          </form>
          <div className="kanban">
            {cols.map((c) => {
              const colOf = (t: (typeof tasks)[number]) =>
                moving?.id === t.id ? moving.col : t.col;
              const list = tasks.filter((t) => colOf(t) === c);
              const save = (t: (typeof tasks)[number], patch: Partial<(typeof tasks)[number]>) =>
                act('saveTask', { ...t, ...patch });
              return (
                <section
                  key={c}
                  className={over === c ? 'drop' : undefined}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(c);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setOver(null);
                    const t = tasks.find(
                      (x) => String(x.id) === e.dataTransfer.getData('text/plain'),
                    );
                    if (!t || t.col === c) return;
                    setMoving({ id: t.id, col: c });
                    await save(t, { col: c });
                    setMoving(null);
                  }}
                >
                  <p className="label">
                    {c} · {list.length}
                  </p>
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} people={people} />
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
            <DatePicker name="date" label="Date" required />
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
                  <PersonPicker name="who" people={people} label="Owner" />
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
                  <PersonPicker
                    label={`Mentor of ${m.name}`}
                    none="No mentor"
                    people={mentors.filter((x) => x.id !== m.id)}
                    value={m.mentorId ?? null}
                    onPick={(v) => act('assignMentor', { user: m.id, mentor: v })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Task = { id: number; title: string; who: string | null; due: string | null; col: string };

// Read-only until Edit; then one form saves every field at once. Delete asks inline, not with a browser dialog.
function TaskCard({
  task: t,
  people,
}: {
  task: Task;
  people: { id: string; name: string; handle: string }[];
}) {
  const { act, who } = useStore();
  const [draft, setDraft] = useState<Task | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const overdue = !!t.due && t.col !== 'Done' && t.due < new Date().toISOString().slice(0, 10);
  const close = () => {
    setDraft(null);
    setSure(false);
  };
  if (!draft)
    return (
      <article
        className="panel box task"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(t.id));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <span className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <strong>{t.title}</strong>
          <button
            className="btn xs line"
            aria-label={`Edit ${t.title}`}
            onClick={() => setDraft({ ...t })}
          >
            Edit
          </button>
        </span>
        <span className="row task__meta" style={{ '--g': '8px' } as React.CSSProperties}>
          {t.who ? (
            <>
              <Avatar name={who(t.who).name} size={22} fg="#0D0D0B" bg="#DAD6CB" />
              <span>{who(t.who).name}</span>
            </>
          ) : (
            <span className="dim">Unassigned</span>
          )}
          {t.due && (
            <span className={overdue ? 'task__due bad' : 'task__due'}>
              {overdue ? 'Overdue · ' : 'Due '}
              {fmtDate(t.due)}
            </span>
          )}
        </span>
      </article>
    );
  return (
    <form
      className="panel box task editing"
      onKeyDown={(e) => e.key === 'Escape' && close()}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await act('saveTask', draft);
        setBusy(false);
        if (ok) close();
      }}
    >
      <label className="field">
        <span className="label">Task</span>
        <input
          className="input sm"
          autoFocus
          required
          minLength={3}
          maxLength={140}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <span className="row" style={{ '--g': '8px' } as React.CSSProperties}>
        <PersonPicker
          people={people}
          label={`Assignee of ${t.title}`}
          value={draft.who}
          onPick={(v) => setDraft({ ...draft, who: v })}
        />
        <DatePicker
          label={`Due date of ${t.title}`}
          placeholder="Due date"
          value={draft.due}
          onChange={(v) => setDraft({ ...draft, due: v || null })}
        />
        <select
          className="input sm"
          aria-label={`Status of ${t.title}`}
          value={draft.col}
          onChange={(e) => setDraft({ ...draft, col: e.target.value })}
        >
          {cols.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </span>
      {sure ? (
        <span className="row between" role="alert">
          <span className="body">Delete this task?</span>
          <span className="row" style={{ '--g': '6px' } as React.CSSProperties}>
            <button type="button" className="btn xs line" onClick={() => setSure(false)}>
              Keep
            </button>
            <button
              type="button"
              className="btn xs danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await act('deleteTask', { id: t.id });
                setBusy(false);
              }}
            >
              Delete
            </button>
          </span>
        </span>
      ) : (
        <span className="row between">
          <button type="button" className="btn xs line danger" onClick={() => setSure(true)}>
            Delete
          </button>
          <span className="row" style={{ '--g': '6px' } as React.CSSProperties}>
            <button type="button" className="btn xs line" onClick={close}>
              Cancel
            </button>
            <button className="btn xs" disabled={busy || draft.title.trim().length < 3}>
              Save
            </button>
          </span>
        </span>
      )}
    </form>
  );
}
