'use client';
import { useState } from 'react';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Bars } from '@/components/app/Charts';
import { cols } from '@fecpc/content/training';
import { byId } from '@fecpc/content/site';
import { isAdmin } from '@fecpc/contracts';
import { Avatar } from '@/components/pixel/Sprites';

const allTabs = ['Board', 'Meetings', 'Documents', 'Inventory', 'Sponsors', 'Reports'] as const;
const tk = (n: number) => '৳' + n.toLocaleString('en');

export default function Ops() {
  const { s, me, act, office, who } = useStore();
  const [tab, setTab] = useState<(typeof allTabs)[number]>('Board');
  if (!office.ops)
    return (
      <Page title="Executive workspace">
        <Denied need="a committee role" />
      </Page>
    );
  const { inventory, meetings, reports, sponsors, tasks, vault } = office.ops;
  const tabs = allTabs.filter((t) => t !== 'Sponsors' || sponsors); // the sponsor ledger is for roles with a finance capability
  const col = (t: (typeof tasks)[number]) => s.kv['task:' + t.id] ?? t.col;
  return (
    <Page
      title={
        tab === 'Board' ? (
          <>
            {tasks.filter((t) => col(t) !== 'Done').length} tasks <span className="acc">open.</span>
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
        <div className="kanban">
          {cols.map((c) => {
            const list = tasks.filter((t) => col(t) === c);
            return (
              <section key={c}>
                <p className="label">
                  {c} · {list.length}
                </p>
                {list.map((t) => (
                  <article key={t.id} className="panel box">
                    <strong>{t.title}</strong>
                    <span className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                      <Avatar name={byId(t.who).name} size={22} fg="#0D0D0B" bg="#DAD6CB" />
                      <span className="label">
                        {byId(t.who).name.split(' ')[0]} · due {t.due}
                      </span>
                    </span>
                    <select
                      className="input"
                      style={{ minHeight: 36, fontSize: 14 }}
                      aria-label={`Status of ${t.title}`}
                      value={c}
                      onChange={(e) => act('kv', { key: 'task:' + t.id, value: e.target.value })}
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
      )}
      {tab === 'Meetings' && (
        <div className="bento">
          {meetings.map((m) => (
            <section key={m.id} className="panel c6">
              <p className="label">{m.date}</p>
              <h2 className="h3">{m.title}</h2>
              <p className="label">Agenda</p>
              <ol className="prose">
                {m.agenda.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
              <p className="label">Action items</p>
              <div className="list">
                {m.actions.map(([a, who]) => {
                  const k = 'act:' + a;
                  return (
                    <label
                      key={a}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <input
                        type="checkbox"
                        className="check"
                        checked={!!s.flags[k]}
                        onChange={() => act('flag', { key: k, on: !s.flags[k] })}
                      />
                      <span
                        className="grow"
                        style={{ textDecoration: s.flags[k] ? 'line-through' : 'none' }}
                      >
                        {a}
                      </span>
                      <span className="label">{byId(who).name.split(' ')[0]}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
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
        <div className="list">
          {inventory.map(([n, id, holder]) => {
            const h = s.kv['inv:' + id] ?? holder;
            return (
              <div key={id}>
                <span className="grow">
                  <strong>{n}</strong>
                  <br />
                  <span className="label">{h ? `with ${who(h).name}` : 'in the cupboard'}</span>
                </span>
                <span className={`pill ${h ? 'warn' : 'ok'}`}>{h ? 'out' : 'available'}</span>
                {(!h || h === me.id || isAdmin(s.role)) && (
                  <button
                    className="btn xs line"
                    onClick={() => act('kv', { key: 'inv:' + id, value: h ? '' : 'me' })}
                  >
                    {h ? 'Return' : 'Check out'}
                  </button>
                )}
              </div>
            );
          })}
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
