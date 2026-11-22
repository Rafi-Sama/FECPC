'use client';
import { usePrompt, useConfirm } from '@/components/app/shared/PromptDialog';
import { SaveForm } from '@/components/app/SaveBar';
import { useState } from 'react';
import { useStore } from '../Store';
import { Avatar } from '@/components/pixel/Sprites';
import {
  can,
  canFully,
  postName,
  postableRoles,
  posts,
  roleName,
  roles,
  type Post,
  type Role,
} from '@fecpc/contracts';

const statuses = ['All', 'Active', 'Invited', 'Suspended'] as const;

// Every account and what this officer may do to it. The same rank rules are enforced by the API.
function Accounts() {
  const sure = useConfirm();
  const { s, me, act, members, postRoles } = useStore();
  const ask = usePrompt();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<(typeof statuses)[number]>('All');
  const sa = s.role === 'super_admin',
    assign = canFully(s.roles, 'roles.assign'),
    approve = !!can(s.roles, 'application.approve');
  const status = (m: (typeof members)[number]) =>
    m.suspended ? 'Suspended' : m.pending ? 'Invited' : 'Active';
  const rows = members.filter(
    (m) =>
      (st === 'All' || status(m) === st) &&
      (m.name + m.handle + (m.email ?? '')).toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div className="stack">
      <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
        <input
          className="input"
          style={{ flex: '1 1 220px', maxWidth: 360 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, handle or email"
          aria-label="Search accounts"
        />
        {statuses.map((x) => (
          <button
            key={x}
            className={`tag tab ${x === st ? 'on' : ''}`}
            aria-pressed={x === st}
            onClick={() => setSt(x)}
          >
            {x} · {x === 'All' ? members.length : members.filter((m) => status(m) === x).length}
          </button>
        ))}
      </div>
      <div className="scroll-x">
        <table className="tbl cards accounts">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role · post</th>
              <th>Status</th>
              <th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const role = m.roleKey ?? 'member',
                top = role === 'president' || role === 'super_admin',
                self = m.id === me.id,
                eff: Role[] = [role, ...((m.post && postRoles[m.post]) || [])],
                link =
                  !self &&
                  !m.suspended &&
                  (eff.every((r) => r === 'member')
                    ? approve || assign
                    : role === 'super_admin'
                      ? sa
                      : assign),
                suspend = !self && assign && (!top || sa),
                stat = status(m);
              return (
                <tr key={m.id}>
                  <td>
                    <span
                      className="row"
                      style={{ '--g': '10px', flexWrap: 'nowrap' } as React.CSSProperties}
                    >
                      <Avatar name={m.name} size={28} />
                      <span>
                        <strong>{m.name}</strong>
                        <br />
                        <span className="label">
                          @{m.handle}
                          {m.email ? ` · ${m.email}` : ''}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="row" style={{ '--g': '6px' } as React.CSSProperties}>
                      {sa && !self ? (
                        <select
                          className="input sm"
                          aria-label={`Role of ${m.name}`}
                          value={role}
                          onChange={async (e) => {
                            const to = e.target.value as Role;
                            const reason = await ask({
                              title: `Make ${m.name} ${roleName[to]}`,
                              label: 'Why? This goes in the audit log.',
                              minLength: 3,
                              confirmLabel: 'Change role',
                            });
                            if (reason) act('role', { user: m.id, role: to, reason });
                          }}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {roleName[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="pill">{roleName[role]}</span>
                      )}
                      {assign && !self && !top ? (
                        <select
                          className="input sm"
                          aria-label={`Post of ${m.name}`}
                          value={m.post ?? ''}
                          onChange={(e) =>
                            act('post', { user: m.id, post: e.target.value || null })
                          }
                        >
                          <option value="">No post</option>
                          {posts.map((p) => (
                            <option key={p} value={p}>
                              {postName[p]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        m.post && <span className="label">{postName[m.post]}</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`pill ${stat === 'Active' ? 'ok' : stat === 'Suspended' ? 'bad' : 'warn'}`}
                    >
                      {stat}
                    </span>
                  </td>
                  <td className="r">
                    <span
                      className="row"
                      style={{ '--g': '6px', justifyContent: 'flex-end' } as React.CSSProperties}
                    >
                      {link && (
                        <button
                          className="btn xs line"
                          onClick={async () =>
                            (await sure(
                              `Create a new one-time ${m.pending ? 'invite' : 'password reset'} link for ${m.name}?`,
                            )) && act('invite', { user: m.id })
                          }
                        >
                          {m.pending ? 'Invite link' : 'Reset link'}
                        </button>
                      )}
                      {suspend && (
                        <button
                          className={`btn xs ${m.suspended ? '' : 'line danger'}`}
                          onClick={async () =>
                            (await sure(
                              m.suspended
                                ? `Reinstate ${m.name}?`
                                : `Suspend ${m.name}? They are signed out everywhere at once.`,
                            )) && act('suspend', { user: m.id, on: !m.suspended })
                          }
                        >
                          {m.suspended ? 'Reinstate' : 'Suspend'}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="body">Nobody matches.</p>}
    </div>
  );
}

export function AdminExtra({ tab }: { tab: string }) {
  if (tab === 'Members') return <Accounts />;
  return <Permissions tab={tab} />;
}

function Permissions({ tab }: { tab: string }) {
  const sure = useConfirm();
  const { s, act, members, postRoles } = useStore();
  const [email, setEmail] = useState('');
  const superAdmin = s.role === 'super_admin';
  const president = members.filter((m) => m.roleKey === 'president').map((m) => m.name),
    match = members.find((m) => m.email && m.email.toLowerCase() === email.trim().toLowerCase());
  if (tab === 'Permissions')
    return (
      <div className="stack">
        {superAdmin && (
          <SaveForm
            className="row"
            style={{ '--g': '10px', alignItems: 'flex-end' } as React.CSSProperties}
            label="President not appointed yet"
            saveLabel="Appoint"
            onDiscard={() => setEmail('')}
            onSubmit={async () => {
              if (!match) return false; // the status line already says no member has that email
              const ok =
                (await sure(
                  `Make ${match.name} (${match.email}) President?` +
                    (president.length ? ` ${president.join(', ')} becomes a Member.` : ''),
                )) && (await act('appointPresident', { user: match.id, email: match.email }));
              if (ok) setEmail('');
              return ok;
            }}
          >
            <label className="field" style={{ flex: '0 1 320px' }}>
              <span className="label">
                Appoint President · now {president.join(', ') || 'none'}
              </span>
              <input
                className="input"
                type="email"
                list="member-emails"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@email"
                required
              />
              <datalist id="member-emails">
                {members.map(
                  (m) => m.email && <option key={m.id} value={m.email} label={m.name} />,
                )}
              </datalist>
            </label>
            <span className="body" role="status">
              {match
                ? `${match.name} · ${roleName[match.roleKey ?? 'member']}`
                : email && 'No member with that email'}
            </span>
          </SaveForm>
        )}
        <h2 className="h3">Posts</h2>
        <p className="body" style={{ maxWidth: '70ch' }}>
          Each post grants the roles ticked here, on top of the member&apos;s own role.
          {superAdmin ? '' : ' Only the Super Admin changes this.'}
        </p>
        <div className="scroll-x">
          <table className="tbl matrix">
            <thead>
              <tr>
                <th>Post</th>
                {postableRoles.map((r) => (
                  <th key={r}>{roleName[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p: Post) => (
                <tr key={p}>
                  <td>{postName[p]}</td>
                  {postableRoles.map((r) => {
                    const on = !!postRoles[p]?.includes(r);
                    return (
                      <td key={r}>
                        <input
                          type="checkbox"
                          aria-label={`${postName[p]} grants ${roleName[r]}`}
                          checked={on}
                          disabled={!superAdmin}
                          onChange={() => act('postRole', { post: p, role: r, on: !on })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  return null;
}
