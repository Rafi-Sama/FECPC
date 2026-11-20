'use client';
import { useStore } from '../Store';
import { can, canFully, roleName, roles, type Role } from '@fecpc/contracts';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function AdminExtra({ tab }: { tab: string }) {
  const { s, me, act, members } = useStore();
  const assign = canFully(s.role, 'roles.assign');
  if (tab === 'Members')
    return (
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Batch</th>
              <th>Role</th>
              <th>Status</th>
              <th className="r">Account</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const off = !!m.suspended,
                r = m.roleKey ?? 'member';
              return (
                <tr key={m.id} style={{ opacity: off ? 0.5 : 1 }}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.handle && (
                      <>
                        <br />
                        <span className="label">@{m.handle}</span>
                      </>
                    )}
                  </td>
                  <td>{m.batch}</td>
                  <td>
                    {assign ? (
                      <select
                        className="input"
                        style={{ minHeight: 36, width: 'auto' }}
                        aria-label={`Role for ${m.name}`}
                        value={r}
                        disabled={
                          m.id === me.id ||
                          (m.roleKey === 'super_admin' && s.role !== 'super_admin')
                        }
                        onChange={(e) => {
                          const role = e.target.value,
                            why = prompt(
                              `Reason for making ${m.name} ${roleName[role as Role]}? (logged)`,
                            );
                          if (why) act('role', { user: m.id, role, reason: why });
                        }}
                      >
                        {roles
                          .filter((x) => x !== 'super_admin' || s.role === 'super_admin' || x === r)
                          .map((x) => (
                            <option key={x} value={x}>
                              {roleName[x]}
                            </option>
                          ))}
                      </select>
                    ) : (
                      roleName[r]
                    )}
                  </td>
                  <td>
                    <span className={`pill ${off ? 'bad' : m.pending ? 'warn' : 'ok'}`}>
                      {off ? 'suspended' : m.pending ? 'invited, not joined' : 'active'}
                    </span>
                  </td>
                  <td className="r">
                    <span
                      className="row"
                      style={css({ '--g': '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' })}
                    >
                      {m.id !== me.id &&
                        !off &&
                        (r === 'member'
                          ? can(s.role, 'application.approve') || assign
                          : r === 'super_admin'
                            ? s.role === 'super_admin'
                            : assign) && (
                          <button
                            className="btn xs line"
                            onClick={() =>
                              confirm(
                                `Create a one-time ${m.pending ? 'invite' : 'password reset'} link for ${m.name}?`,
                              ) && act('invite', { user: m.id })
                            }
                          >
                            {m.pending ? 'New invite link' : 'Reset link'}
                          </button>
                        )}
                      {assign &&
                        m.id !== me.id &&
                        (r !== 'super_admin' || s.role === 'super_admin') && (
                          <button
                            className="btn xs line"
                            onClick={() =>
                              confirm(
                                off
                                  ? `Reinstate ${m.name}?`
                                  : `Suspend ${m.name}? They are signed out everywhere immediately.`,
                              ) && act('suspend', { user: m.id, on: !off })
                            }
                          >
                            {off ? 'Reinstate' : 'Suspend'}
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
    );
  return null;
}
