'use client';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { templates } from '@fecpc/content/training';
import { canFully } from '@fecpc/contracts';

type Note = { user_id: string; topic: string; code: string; updated_at: string };
type TeamData = {
  team: {
    id: number;
    name: string;
    coach: string | null;
    coach_name: string | null;
    mine: boolean;
    size: number;
  } | null;
  members?: { id: string; name: string; handle: string }[];
  notes?: Note[];
  history?: { who: string; user_id: string; what: string; at: string }[];
  free?: { id: string; name: string }[];
  invites: { id: number; name: string; from: string }[];
  teams: { id: number; name: string; size: number }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  return m < 1
    ? 'just now'
    : m < 60
      ? `${m} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : `${Math.round(m / 1440)} d ago`;
};

export default function Teams() {
  const { s, me, act, who, members: roster } = useStore();
  const [d, setD] = useState<TeamData | null>(null);
  const [view, setView] = useState<number | null>(null); // a team a coach or the CP Head is looking at
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(me.id);
  const [draft, setDraft] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [invitee, setInvitee] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/community', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'getTeam', teamId: view ?? undefined }),
    });
    if (res.ok) setD(await res.json());
  }, [view]);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (type: string, args: Record<string, unknown> = {}) => {
    const ok = await act(type, args);
    if (ok) await load();
    return ok;
  };

  if (!d) return <Page title="ICPC teams">{null}</Page>;
  const t = d.team;
  const topics = [...new Set(d.notes?.map((n) => n.topic))].sort();
  const cur = topics.includes(topic) ? topic : (topics[0] ?? '');
  const members = d.members ?? [];
  const whose = members.some((m) => m.id === page) ? page : (members[0]?.id ?? me.id);
  const note = d.notes?.find((n) => n.topic === cur && n.user_id === whose);
  const editing = draft !== null && whose === me.id;

  const picker = d.teams.length > 0 && (
    <select
      className="input sm no-print"
      aria-label="Open a team"
      value={view ?? ''}
      onChange={(e) => setView(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">{t?.mine ? 'My team' : 'Open a team'}</option>
      {d.teams.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name} · {x.size}/3
        </option>
      ))}
    </select>
  );

  if (!t)
    return (
      <Page
        title={
          <>
            You are not on a team <span className="acc">yet.</span>
          </>
        }
        aside={picker}
      >
        {me.system ? (
          <p className="empty">The operator account does not join teams. Open one above.</p>
        ) : (
          <div className="bento">
            <form
              className="panel c6 tm-card"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run('teamCreate', { name })) setName(null);
              }}
            >
              <p className="label">Start a team</p>
              <div className="row">
                <input
                  className="input grow"
                  aria-label="Team name"
                  placeholder="FEC_Segfaults"
                  maxLength={40}
                  value={name ?? ''}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="btn sm" disabled={(name ?? '').trim().length < 2}>
                  Create
                </button>
              </div>
            </form>
            <section className="panel c6 tm-card">
              <p className="label">Invitations</p>
              {d.invites.length ? (
                <ul className="list">
                  {d.invites.map((x) => (
                    <li key={x.id}>
                      <span className="grow">
                        <strong>{x.name}</strong>
                        <br />
                        <span className="label">from {x.from}</span>
                      </span>
                      <button className="btn xs" onClick={() => run('teamJoin', { teamId: x.id })}>
                        Join
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">None yet. A team member invites you from their team page.</p>
              )}
            </section>
          </div>
        )}
      </Page>
    );

  const print = () => {
    const html = members
      .map(
        (m) =>
          `<h2>${esc(m.name)}</h2>` +
          topics
            .map((tp) => {
              const n = d.notes!.find((x) => x.topic === tp && x.user_id === m.id);
              return n ? `<h3>${esc(tp)}</h3><pre>${esc(n.code)}</pre>` : '';
            })
            .join(''),
      )
      .join('');
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument!.write(
      `<!doctype html><title>${esc(t.name)} notebook</title><style>body{font:10pt ui-monospace,monospace}h2{border-bottom:2px solid}pre{white-space:pre-wrap;border:1px solid #ccc;padding:8px;page-break-inside:avoid}</style><h1>${esc(t.name)} · team notebook</h1>${html}`,
    );
    f.contentDocument!.close();
    f.contentWindow!.print();
    setTimeout(() => f.remove(), 1000);
  };

  return (
    <Page
      title={
        name !== null ? (
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run('teamRename', { teamId: t.id, name })) setName(null);
            }}
          >
            <input
              className="input tm-rename"
              aria-label="Team name"
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn sm">Save</button>
            <button type="button" className="btn sm line" onClick={() => setName(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            {t.name}
            <span className="acc">.</span>{' '}
            <button
              className="btn xs line no-print"
              aria-label="Rename team"
              onClick={() => setName(t.name)}
            >
              Rename
            </button>
          </>
        )
      }
      aside={
        <div className="row no-print">
          {picker}
          <button className="btn sm line" onClick={print} disabled={!topics.length}>
            Print notebook
          </button>
          {t.mine && (
            <button
              className="btn sm line danger"
              onClick={() =>
                confirm('Leave the team? Your notebook pages go with you.') && run('teamLeave')
              }
            >
              Leave
            </button>
          )}
        </div>
      }
    >
      <div className="bento">
        <section className="panel c4 tm-card">
          <p className="label">
            Roster · {members.length}/{t.size}
            {t.coach_name && ` · coach ${t.coach_name}`}
          </p>
          {canFully(s.roles, 'mentees.view') && (
            <select
              className="input sm"
              aria-label="Coach"
              value={t.coach ?? ''}
              onChange={(e) => run('teamCoach', { teamId: t.id, user: e.target.value || null })}
            >
              <option value="">No coach</option>
              {roster
                .filter((m) => !m.suspended)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    Coach: {m.name}
                  </option>
                ))}
            </select>
          )}
          <ul className="list">
            {members.map((m) => (
              <li key={m.id}>
                <span className="grow">
                  <strong>{m.name}</strong>
                  <br />
                  <span className="label">
                    {who(m.id).rating || 'unrated'} · @{m.handle}
                  </span>
                </span>
                {m.id === me.id && <span className="pill ok">you</span>}
              </li>
            ))}
          </ul>
          {t.mine && members.length < t.size && (
            <div className="row">
              <select
                className="input grow"
                aria-label="Invite a member"
                value={invitee}
                onChange={(e) => setInvitee(e.target.value)}
              >
                <option value="">Invite a member…</option>
                {d.free!.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                className="btn sm"
                disabled={!invitee}
                onClick={async () => (await run('teamInvite', { user: invitee })) && setInvitee('')}
              >
                Invite
              </button>
            </div>
          )}
        </section>

        <section className="panel c8 tm-book">
          <div className="row between">
            <p className="label">Team notebook</p>
            <div className="row" role="tablist" aria-label="Whose page">
              {members.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={m.id === whose}
                  className={`tag tab ${m.id === whose ? 'on' : ''}`}
                  onClick={() => {
                    setPage(m.id);
                    setDraft(null);
                  }}
                >
                  {m.id === me.id ? 'You' : m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="row" role="tablist" aria-label="Topic">
            {topics.map((tp) => (
              <button
                key={tp}
                role="tab"
                aria-selected={tp === cur}
                className={`tag ${tp === cur ? 'on' : ''}`}
                onClick={() => {
                  setTopic(tp);
                  setDraft(null);
                }}
              >
                {tp}
              </button>
            ))}
            {t.mine && (
              <form
                className="row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run('teamTopic', { topic: newTopic.trim() })) {
                    setTopic(newTopic.trim());
                    setNewTopic('');
                  }
                }}
              >
                <input
                  className="input sm"
                  list="tm-templates"
                  aria-label="New topic"
                  placeholder="+ topic"
                  maxLength={40}
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                />
                <datalist id="tm-templates">
                  {templates.map((x) => (
                    <option key={x.name} value={x.name} />
                  ))}
                </datalist>
              </form>
            )}
          </div>
          {!cur ? (
            <p className="empty">No topics yet. Add DSU, Dijkstra or your own.</p>
          ) : editing ? (
            <textarea
              className="input tm-code"
              aria-label={`Your ${cur} page`}
              autoFocus
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <pre className="tm-code">{note?.code ?? '// No page on this topic yet.'}</pre>
          )}
          {cur && t.mine && whose === me.id && (
            <div className="row">
              {editing ? (
                <>
                  <button
                    className="btn sm"
                    onClick={async () =>
                      (await run('teamNote', { topic: cur, code: draft })) && setDraft(null)
                    }
                  >
                    Save
                  </button>
                  <button className="btn sm line" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn sm" onClick={() => setDraft(note?.code ?? '')}>
                  Edit your page
                </button>
              )}
              <span className="grow" />
              <button
                className="btn sm line danger"
                onClick={() =>
                  confirm(`Remove ${cur} from everyone's notebook?`) &&
                  run('teamTopic', { topic: cur, on: false })
                }
              >
                Remove topic
              </button>
            </div>
          )}
        </section>

        <section className="panel tm-card tm-full">
          <p className="label">History</p>
          <ol className="list tm-log">
            {d.history!.map((h, i) => (
              <li key={i}>
                <span className="grow">
                  <strong>{h.user_id === me.id ? 'You' : h.who}</strong> {h.what}
                </span>
                <span className="label">{ago(h.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Page>
  );
}
