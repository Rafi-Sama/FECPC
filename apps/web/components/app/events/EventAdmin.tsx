'use client';
import { SaveForm } from '../SaveBar';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '../Store';
import { cleanFields, FieldsEditor } from './EventForm';
import { downloadCsv, renderCertificate } from '@/lib/events';
import { useConfirm, usePrompt } from '../shared/PromptDialog';
import { MailEditor, MailStatus } from '../shared/MailEditor';
import { EventModal } from './EventModal';
import {
  CERT_VARS,
  certHeadline,
  DEFAULT_CERT,
  DEFAULT_MAIL,
  EVENT_STATUS_LABEL,
  MAIL_SAMPLE,
  renderMail,
  fillTemplate,
  parseCsv,
  type EventDetail,
  type EventEntry,
  type EventRole,
  type EventStatus,
} from '@fecpc/contracts';
import { liveStatus } from '@/lib/events';

/** Command sidebar for event organizers (Status, Responses, Roles, Certificates, Email, Feedback, Settings) */
export function EventAdmin({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const router = useRouter();
  const confirmIt = useConfirm();
  const [editStatus, setEditStatus] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certKind, setCertKind] = useState('participant');
  const [modal, setModal] = useState<'responses' | 'roles' | 'certs' | 'email' | 'feedback' | null>(
    null,
  );

  const del = async () => {
    if (
      !(await confirmIt(
        'Delete this event?',
        `“${e.title}” goes with all its registrations, feedback and certificates. This cannot be undone.`,
        'Delete event',
        true,
      ))
    )
      return;
    if (await act('eventDelete', { id: e.id })) router.push('/app/events');
  };

  const kinds: [string, string][] = [
    ['participant', 'Participants'],
    ['winner1', '1st place'],
    ['winner2', '2nd place'],
    ['winner3', '3rd place'],
    ...e.roles.map((r): [string, string] => [`role:${r.id}`, r.title]),
  ];

  const roleTitle = certKind.startsWith('role:')
    ? (e.roles.find((r) => `role:${r.id}` === certKind)?.title ?? '')
    : SAMPLE.role!;
  const certPlace = certKind.startsWith('winner')
    ? ['1st', '2nd', '3rd'][+certKind.slice(6) - 1]!
    : '';

  const totalEntries = e.admin!.entries.length;
  const approvedCount = e.admin!.entries.filter((x) => x.status === 'approved').length;
  const pendingCount = e.admin!.entries.filter((x) => x.status === 'pending').length;
  const placedCount = e.admin!.entries.filter((x) => x.place !== null).length;
  const rolesCount = e.roles.length;
  const certsIssued = Object.values(e.admin!.issued).reduce((a, b) => a + b, 0);
  const fb = e.admin!.feedback;
  const avgFb = fb.length ? (fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1) : null;
  const hasCustomMail = !!e.admin!.mail;

  return (
    <>
      {/* Panel 1: Event Status */}
      <div className="panel">
        <div className="ph">
          <span className="mono" style={{ color: 'var(--hi)' }}>
            Status
          </span>
          <button
            type="button"
            className="eb"
            onClick={() => setEditStatus(!editStatus)}
          >
            {editStatus ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <div className="st">
          <span className="state">
            <i />
            {liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]}
          </span>
          <div className="big" style={{ marginTop: 14 }}>
            {e.seats !== null ? (
              <>
                {Math.max(0, e.seats - e.taken)}
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: 'var(--dim)',
                    letterSpacing: 0,
                  }}
                >
                  {' '}
                  / {e.seats} seats left
                </span>
              </>
            ) : (
              <>
                {e.taken}
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: 'var(--dim)',
                    letterSpacing: 0,
                  }}
                >
                  {' '}
                  registered
                </span>
              </>
            )}
          </div>
          <div className="bar">
            <i
              style={{
                width: `${
                  e.seats && e.seats > 0
                    ? Math.min(100, Math.round((e.taken / e.seats) * 100))
                    : e.taken > 0
                      ? 100
                      : 0
                }%`,
              }}
            />
          </div>

          {editStatus && (
            <div style={{ marginTop: 14 }}>
              <select
                className="ctl"
                style={{ height: 38, fontSize: 13 }}
                value={e.status}
                onChange={async (x) => {
                  const s = x.target.value as EventStatus;
                  if (await act('eventStatus', { id: e.id, status: s })) {
                    setEditStatus(false);
                    reload();
                  }
                }}
              >
                {(
                  [
                    'draft',
                    'published',
                    'open',
                    'closed',
                    'ongoing',
                    'completed',
                    'cancelled',
                  ] as const
                ).map((st) => (
                  <option key={st} value={st}>
                    {EVENT_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Panel 2: Launchpad Rail */}
      <div className="panel">
        <button
          type="button"
          className="item"
          onClick={() => setModal('responses')}
        >
          <span className="tx">
            <b>Responses &amp; awards</b>
            <span>
              {totalEntries} registered · {approvedCount} approved · {pendingCount} pending
              {placedCount > 0 ? ` · ${placedCount} placed` : ''}
            </span>
          </span>
          <span className="ar">↗</span>
        </button>

        <button
          type="button"
          className="item"
          onClick={() => setModal('roles')}
        >
          <span className="tx">
            <b>Event roles</b>
            <span>
              {rolesCount} configured · volunteer or TA roles
            </span>
          </span>
          <span className="ar">↗</span>
        </button>

        <button
          type="button"
          className="item"
          onClick={() => setModal('certs')}
        >
          <span className="tx">
            <b>Certificates studio</b>
            <span>
              {e.certs ? 'Downloads on' : 'Downloads off'} · {certsIssued > 0 ? `${certsIssued} issued` : 'template editor'}
            </span>
          </span>
          <span className="ar">↗</span>
        </button>

        <button
          type="button"
          className="item"
          onClick={() => setModal('feedback')}
        >
          <span className="tx">
            <b>Attendee feedback</b>
            <span>
              {fb.length > 0 ? `★ ${avgFb} / 5 (${fb.length} reviews)` : 'No reviews yet'}
            </span>
          </span>
          <span className="ar">↗</span>
        </button>

        <button
          type="button"
          className="item"
          onClick={() => setModal('email')}
        >
          <span className="tx">
            <b>Approval email</b>
            <span>
              {hasCustomMail ? 'Custom design' : 'Built-in design'} · preview &amp; styling
            </span>
          </span>
          <span className="ar">↗</span>
        </button>
      </div>

      {/* Run again button for past events */}
      {(e.status === 'completed' || e.status === 'cancelled') && (
        <Link
          className="eb"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          href={`/app/events/new?copy=${e.id}`}
        >
          Run again as a new event
        </Link>
      )}

      {/* Delete Event */}
      <button type="button" className="del" onClick={del}>
        Delete event
      </button>

      {/* MODALS */}
      {modal === 'responses' && (
        <EventModal
          wide
          title={`Responses & Place Awards (${totalEntries})`}
          onClose={() => setModal(null)}
        >
          <Responses e={e} reload={reload} />
        </EventModal>
      )}

      {modal === 'roles' && (
        <EventModal title={`Event Roles (${rolesCount})`} onClose={() => setModal(null)}>
          <Roles e={e} reload={reload} />
        </EventModal>
      )}

      {modal === 'certs' && (
        <EventModal wide title="Certificates Studio" onClose={() => setModal(null)}>
          <Certificates
            e={e}
            reload={reload}
            kind={certKind}
            setKind={setCertKind}
            kinds={kinds}
            onOpenPreview={() => setCertModalOpen(true)}
          />
        </EventModal>
      )}

      {modal === 'feedback' && (
        <EventModal title={`Attendee Feedback (${fb.length})`} onClose={() => setModal(null)}>
          <Feedback e={e} />
        </EventModal>
      )}

      {modal === 'email' && (
        <EventModal wide title={`Approval Email · ${e.title}`} onClose={() => setModal(null)}>
          <Email e={e} reload={reload} />
        </EventModal>
      )}

      {/* CERTIFICATE PREVIEW MODAL */}
      {certModalOpen && (
        <CertificateModal
          e={e}
          reload={reload}
          kind={certKind}
          roleTitle={roleTitle}
          certPlace={certPlace}
          onClose={() => setCertModalOpen(false)}
        />
      )}
    </>
  );
}

function RoleForm({
  eventId,
  role,
  done,
}: {
  eventId: string;
  role?: EventRole;
  done: () => void;
}) {
  const { act } = useStore();
  const [v, setV] = useState({
    title: role?.title ?? '',
    about: role?.about ?? '',
    mode: role?.mode ?? 'platform',
    formUrl: role?.formUrl ?? null,
    approval: role?.approval ?? 'manual',
  });
  const [fields, setFields] = useState(role?.fields ?? []);
  const [start] = useState(() => JSON.stringify([v, fields]));
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  return (
    <SaveForm
      className="stack"
      style={{
        padding: '12px',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        marginTop: 8,
      }}
      label={role ? `Unsaved changes to “${role.title}”` : 'Unsaved new role'}
      saveLabel={role ? 'Save role' : 'Add role'}
      extraDirty={JSON.stringify([v, fields]) !== start}
      onDiscard={done}
      onSubmit={async () => {
        const ok = await act('roleSave', {
          eventId,
          id: role?.id,
          ...v,
          title: v.title.trim(),
          about: v.about.trim(),
          fields: cleanFields(fields),
        });
        if (ok) done();
        return ok;
      }}
    >
      <div className="form-group">
        <label>Role</label>
        <input
          className="form-control"
          required
          maxLength={80}
          placeholder="Volunteer, Teaching Assistant…"
          value={v.title}
          onChange={(x) => set({ title: x.target.value })}
        />
      </div>
      <div className="form-group">
        <label>What they do</label>
        <input
          className="form-control"
          maxLength={1000}
          placeholder="Brief description"
          value={v.about}
          onChange={(x) => set({ about: x.target.value })}
        />
      </div>
      <div className="form-group">
        <label>Sign up method</label>
        <select
          className="form-control"
          value={v.mode}
          onChange={(x) => set({ mode: x.target.value as any })}
        >
          <option value="platform">Here, on this site</option>
          <option value="form">Google Forms</option>
        </select>
      </div>
      {v.mode === 'form' && (
        <div className="form-group">
          <label>Google Forms URL</label>
          <input
            className="form-control"
            placeholder="https://forms.gle/..."
            value={v.formUrl ?? ''}
            onChange={(x) => set({ formUrl: x.target.value })}
          />
        </div>
      )}
      <div className="form-group">
        <label>Who gets in?</label>
        <select
          className="form-control"
          value={v.approval}
          onChange={(x) => set({ approval: x.target.value as any })}
        >
          <option value="manual">Only those I approve</option>
          <option value="auto">Everyone automatically</option>
        </select>
      </div>
      {v.mode === 'platform' && <FieldsEditor value={fields} onChange={setFields} />}
    </SaveForm>
  );
}

function Roles({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const confirmIt = useConfirm();
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const done = () => {
    setOpen(null);
    reload();
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      {e.roles.map((r) => (
        <div key={r.id} className="panel" style={{ padding: '14px 18px' }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <b style={{ fontSize: 15, display: 'block' }}>{r.title}</b>
              <span
                className="mono text-dim"
                style={{ fontSize: 11, marginTop: 4, display: 'block' }}
              >
                {r.mode === 'form'
                  ? 'Google Forms link'
                  : `${r.approval === 'auto' ? 'Auto approval' : 'Manual approval'} · ${r.counts?.approved ?? 0} approved · ${r.counts?.pending ?? 0} pending`}
              </span>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <button
                className="eb"
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                {open === r.id ? 'Close' : 'Edit'}
              </button>
              <button
                className="del"
                type="button"
                onClick={async () =>
                  (await confirmIt(
                    `Remove ${r.title}?`,
                    'The role goes with all its applications.',
                    'Remove role',
                    true,
                  )) &&
                  (await act('roleDelete', { eventId: e.id, id: r.id })) &&
                  reload()
                }
              >
                Remove
              </button>
            </div>
          </div>
          {open === r.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <RoleForm eventId={e.id} role={r} done={done} />
            </div>
          )}
        </div>
      ))}
      {open === 'new' ? (
        <div className="panel" style={{ padding: '16px' }}>
          <div
            className="row between"
            style={{
              marginBottom: 12,
              borderBottom: '1px solid var(--line)',
              paddingBottom: 8,
            }}
          >
            <span className="mono" style={{ fontWeight: 700 }}>
              New Event Role
            </span>
            <button className="del" type="button" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
          <RoleForm eventId={e.id} done={done} />
        </div>
      ) : (
        <button
          className="add"
          type="button"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => setOpen('new')}
        >
          + Add a role
        </button>
      )}
    </div>
  );
}

const PLACES = ['', '1st', '2nd', '3rd'];

function Responses({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const ask = usePrompt();
  const entries = e.admin!.entries;
  const [who, setWho] = useState('all'); // all | participants | role id
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const roleName = (x: EventEntry) =>
    e.roles.find((r) => r.id === x.roleId)?.title ?? 'Participant';
  const query = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      entries.filter(
        (x) =>
          (who === 'all' ||
            (who === 'participants' ? x.roleId === null : String(x.roleId) === who)) &&
          (status === 'all' || x.status === status) &&
          (!query ||
            [x.name, x.email, x.phone, x.batch, ...Object.values(x.answers)]
              .join(' ')
              .toLowerCase()
              .includes(query)),
      ),
    [entries, who, status, query],
  );
  const decide = async (ids: number[], s: string) => {
    let reason: string | null = null;
    if (s === 'rejected') {
      reason = await ask({
        title: ids.length > 1 ? `Decline ${ids.length} entries` : 'Decline this entry',
        label: 'Why? The member sees this.',
        placeholder: 'e.g. Seats went to final-year students first.',
        minLength: 3,
        confirmLabel: 'Decline',
        danger: true,
      });
      if (!reason) return;
    }
    if (!(await act('entryStatus', { ids, status: s, reason }))) return;
    setPicked([]);
    reload();
  };
  const questions = [...new Set(rows.flatMap((x) => Object.keys(x.answers)))];

  return (
    <div className="stack" style={{ gap: 14 }}>
      {e.mode === 'form' && (
        <p className="mono text-dim" style={{ fontSize: 11 }}>
          Participants register on Google Forms; their answers are in the form, not here.{' '}
          {e.formUrl && (
            <a className="link" href={e.formUrl} target="_blank" rel="noopener noreferrer">
              Open the form
            </a>
          )}
        </p>
      )}

      {/* Search Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <input
          type="search"
          className="ctl"
          style={{ flex: 1, height: 40 }}
          placeholder="Search name, email, phone, answers..."
          value={q}
          onChange={(x) => setQ(x.target.value)}
        />
        <button
          className="eb"
          type="button"
          style={{ whiteSpace: 'nowrap', height: 40, padding: '0 16px' }}
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(`${e.id}-responses.csv`, [
              ['Kind', 'Name', 'Email', 'Batch', 'Phone', 'Status', 'Place', 'At', ...questions],
              ...rows.map((x) => [
                roleName(x),
                x.name,
                x.email,
                x.batch,
                x.phone,
                x.status,
                PLACES[x.place ?? 0],
                x.at,
                ...questions.map((k) => x.answers[k] ?? ''),
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>

      {/* Filters row */}
      <div className="row between" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: '0.75rem', flex: '1 1 auto', flexWrap: 'wrap' }}>
          <select
            className="ctl"
            aria-label="Who"
            value={who}
            onChange={(x) => setWho(x.target.value)}
            style={{ width: 'auto', height: 38, fontSize: 13, flex: '1 1 120px' }}
          >
            <option value="all">Everyone</option>
            <option value="participants">Participants</option>
            {e.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <select
            className="ctl"
            aria-label="Status"
            value={status}
            onChange={(x) => setStatus(x.target.value)}
            style={{ width: 'auto', height: 38, fontSize: 13, flex: '1 1 120px' }}
          >
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {picked.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <button
              className="eb"
              style={{ background: 'var(--acc)', color: 'white', borderColor: 'var(--acc)' }}
              type="button"
              onClick={() => decide(picked, 'approved')}
            >
              Approve ({picked.length})
            </button>
            <button
              className="del"
              type="button"
              onClick={() => decide(picked, 'rejected')}
            >
              Decline ({picked.length})
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--line2)', background: 'var(--panel)' }}>
        <table className="mini-table">
          <thead>
            <tr>
              <th style={{ width: 32, paddingLeft: 12 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={!!rows.length && rows.every((x) => picked.includes(x.id))}
                  onChange={(x) => setPicked(x.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th>NAME &amp; CONTACT</th>
              <th>STATUS / PLACE</th>
              <th style={{ textAlign: 'right', paddingRight: 12 }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <Fragment key={x.id}>
                <tr>
                  <td style={{ paddingLeft: 12 }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${x.name}`}
                      checked={picked.includes(x.id)}
                      onChange={(c) =>
                        setPicked(
                          c.target.checked ? [...picked, x.id] : picked.filter((p) => p !== x.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--hi)' }}>
                      {x.name}
                    </strong>
                    <span className="mono text-dim" style={{ fontSize: 11 }}>
                      {roleName(x)} {x.batch ? `· b${x.batch}` : ''} · {x.email}
                      {x.phone ? ` · ${x.phone}` : ''}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <span
                        className={`tag xs ${x.status === 'approved' ? 'primary' : x.status === 'rejected' ? 'danger' : 'dark'}`}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                      >
                        {x.status === 'rejected' ? 'declined' : x.status}
                      </span>
                      {x.roleId === null && x.status === 'approved' && (
                        <select
                          className="ctl"
                          aria-label={`Place for ${x.name}`}
                          value={x.place ?? ''}
                          style={{
                            width: 'auto',
                            padding: '1px 6px',
                            fontSize: 11,
                            height: 24,
                          }}
                          onChange={async (c) => {
                            const val = c.target.value ? +c.target.value : null;
                            if (await act('entryPlace', { id: x.id, place: val })) reload();
                          }}
                        >
                          <option value="">No place</option>
                          <option value="1">1st place</option>
                          <option value="2">2nd place</option>
                          <option value="3">3rd place</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td style={{ paddingRight: 12 }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {x.status !== 'approved' && x.status !== 'cancelled' && (
                        <button
                          className="eb"
                          type="button"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => decide([x.id], 'approved')}
                        >
                          Approve
                        </button>
                      )}
                      {x.status !== 'rejected' && x.status !== 'cancelled' && (
                        <button
                          className="del"
                          type="button"
                          style={{ fontSize: 10 }}
                          onClick={() => decide([x.id], 'rejected')}
                        >
                          Decline
                        </button>
                      )}
                      {Object.keys(x.answers).length > 0 && (
                        <button
                          className="eb"
                          type="button"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => setShown(shown === x.id ? null : x.id)}
                        >
                          {shown === x.id ? 'Hide' : `Ans (${Object.keys(x.answers).length})`}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {shown === x.id && (
                  <tr>
                    <td colSpan={4} style={{ background: 'var(--bg)', padding: '12px 16px' }}>
                      <dl className="stack" style={{ gap: 6, margin: 0 }}>
                        {Object.entries(x.answers).map(([k, v]) => (
                          <div key={k} style={{ fontSize: 12 }}>
                            <dt className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
                              {k}:
                            </dt>
                            <dd style={{ margin: '2px 0 0 10px', color: 'var(--hi)' }}>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: 'center', color: 'var(--dim)', padding: '2rem 1rem' }}
                >
                  No responses match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Feedback({ e }: { e: EventDetail }) {
  const fb = e.admin!.feedback;
  if (!fb.length)
    return (
      <div className="pad" style={{ textAlign: 'center', padding: '32px 16px' }}>
        <p className="mono text-dim" style={{ fontSize: 13, margin: 0 }}>
          {e.status === 'completed'
            ? 'No feedback submitted yet.'
            : 'Attendee feedback opens when the event is marked completed.'}
        </p>
      </div>
    );
  const avg = (fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="panel" style={{ padding: '16px 20px', background: 'var(--bg)' }}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
              OVERALL RATING
            </span>
            <div className="big" style={{ fontSize: 28, marginTop: 4 }}>
              ★ {avg} <span style={{ fontSize: 16, color: 'var(--dim)', fontWeight: 500 }}>/ 5</span>
            </div>
          </div>
          <span className="mono" style={{ fontSize: 12 }}>
            {fb.length} {fb.length === 1 ? 'response' : 'responses'}
          </span>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {fb.map((f, i) => (
          <div key={i} className="panel" style={{ padding: '14px 18px' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>
                {f.name}
              </span>
              <span className="tag dark" style={{ fontSize: 11, background: 'var(--ink)' }}>
                {'★'.repeat(f.rating)}
                {'☆'.repeat(5 - f.rating)}
              </span>
            </div>
            {f.body && (
              <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5, color: 'var(--hi)' }}>
                “{f.body}”
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SAMPLE: Record<string, string> = {
  name: 'Ayesha Rahman',
  email: 'ayesha@example.com',
  batch: '24',
  dept: 'CSE',
  phone: '01700000000',
  role: 'Volunteer',
  place: '1st',
  code: 'FEC-0A1B2C3D4E',
};

function CertificateModal({
  e,
  reload,
  kind,
  roleTitle,
  certPlace,
  onClose,
}: {
  e: EventDetail;
  reload: () => void;
  kind: string;
  roleTitle: string;
  certPlace: string;
  onClose: () => void;
}) {
  const { act } = useStore();
  const { templates } = e.admin!;
  const saved = templates[kind] ?? '';
  const [html, setHtml] = useState(saved || DEFAULT_CERT);
  const [editHtml, setEditHtml] = useState(false);

  const sample = {
    ...SAMPLE,
    role: roleTitle,
    place: certPlace,
    event: e.title,
    date: new Date(`${e.startsAt.slice(0, 10)}T00:00`).toLocaleDateString('en-GB', {
      dateStyle: 'long',
    }),
    headline: certHeadline(kind, roleTitle, certPlace),
  };

  const custom = html.trim() !== DEFAULT_CERT.trim();
  const unsaved = html.trim() !== (saved || DEFAULT_CERT).trim();

  return (
    <EventModal
      wide
      title={`Certificate Preview · ${sample.headline || 'Participation'}`}
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 16 }}>
        {/* Brutalist Certificate Preview */}
        <div className="cert-preview">
          <div className="mono" style={{ fontSize: 10, letterSpacing: 2, marginBottom: '2rem' }}>
            FECPC · PROGRAMMING CLUB
          </div>
          <h2
            className="mono"
            style={{
              fontSize: 14,
              color: 'var(--acc)',
              letterSpacing: 1,
              marginBottom: '1rem',
              textTransform: 'uppercase',
            }}
          >
            {sample.headline || 'CERTIFICATE OF PARTICIPATION'}
          </h2>
          <div
            style={{
              fontFamily: 'serif',
              fontStyle: 'italic',
              color: 'var(--dim)',
              marginBottom: '0.5rem',
            }}
          >
            This is presented to
          </div>
          <h1
            style={{
              fontFamily: 'serif',
              fontSize: '3rem',
              marginBottom: '0.5rem',
              lineHeight: 1.1,
            }}
          >
            {SAMPLE.name}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: '3rem' }}>
            for participating in the {e.title} held on {sample.date}.
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '3rem',
              fontSize: 12,
            }}
          >
            <div
              style={{
                borderTop: '1px solid var(--ink)',
                paddingTop: '0.5rem',
                width: '30%',
                textAlign: 'left',
              }}
            >
              President
            </div>
            <div
              style={{
                textAlign: 'center',
                fontFamily: 'var(--f-label, var(--mono, monospace))',
                fontSize: 10,
              }}
            >
              Certificate ID
              <br />
              <strong style={{ color: 'var(--ink)' }}>{SAMPLE.code}</strong>
            </div>
            <div
              style={{
                borderTop: '1px solid var(--ink)',
                paddingTop: '0.5rem',
                width: '30%',
                textAlign: 'right',
              }}
            >
              Event lead
            </div>
          </div>
        </div>

        {/* HTML/CSS Template Editor */}
        {editHtml && (
          <div
            className="stack"
            style={{
              background: 'var(--bg)',
              padding: '1rem',
              border: '1px solid var(--line)',
            }}
          >
            <span className="mono text-dim" style={{ fontSize: 11 }}>
              PLACEHOLDERS: {CERT_VARS.map((v) => `{{${v}}}`).join(' ')}
            </span>
            <textarea
              className="ctl mono"
              style={{ height: 'auto', minHeight: 180, resize: 'vertical' }}
              rows={10}
              value={html}
              onChange={(x) => setHtml(x.target.value)}
            />
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button
                className="eb"
                style={{ background: 'var(--acc)', color: 'white', borderColor: 'var(--acc)' }}
                type="button"
                disabled={!unsaved}
                onClick={async () => {
                  const ok = await act('certTemplate', {
                    eventId: e.id,
                    kind,
                    html: custom ? html : '',
                  });
                  if (ok) reload();
                }}
              >
                Save design
              </button>
              <button
                className="del"
                type="button"
                disabled={!custom}
                onClick={() => setHtml(DEFAULT_CERT)}
              >
                Use built-in design
              </button>
            </div>
          </div>
        )}

        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <button type="button" className="eb" onClick={() => setEditHtml(!editHtml)}>
            {editHtml ? 'Hide HTML/CSS' : 'Edit HTML/CSS'}
          </button>
          <button
            type="button"
            className="add"
            onClick={() =>
              renderCertificate(fillTemplate(html, sample), 'png', `${e.id}-preview`)
            }
          >
            Download Sample PNG
          </button>
        </div>
      </div>
    </EventModal>
  );
}

function Certificates({
  e,
  reload,
  kind,
  setKind,
  kinds,
  onOpenPreview,
}: {
  e: EventDetail;
  reload: () => void;
  kind: string;
  setKind: (k: string) => void;
  kinds: [string, string][];
  onOpenPreview: () => void;
}) {
  const { act } = useStore();
  const { templates, issued } = e.admin!;
  const [csv, setCsv] = useState<string[][] | null>(null);
  const [map, setMap] = useState<string[]>([]);
  const done = e.status === 'completed';

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Top Banner / Distribution State */}
      <div className="panel" style={{ padding: '14px 18px', background: 'var(--bg)' }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', display: 'block' }}>
              ATTENDEE DOWNLOADS
            </span>
            <span
              className="mono"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: e.certs ? 'var(--acc)' : 'var(--dim)',
              }}
            >
              {e.certs
                ? '● Active — Attendees can download certificates'
                : '○ Disabled — Attendees cannot download yet'}
            </span>
          </div>
          <button
            className="eb"
            type="button"
            disabled={!done && !e.certs}
            title={!done && !e.certs ? 'Mark event completed to enable downloads' : ''}
            onClick={async () =>
              (await act('certDistribute', { eventId: e.id, on: !e.certs })) && reload()
            }
          >
            {e.certs ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </div>

      {/* Kind Selector & Template Preview */}
      <div className="panel" style={{ padding: '16px' }}>
        <div className="stack" style={{ gap: 12 }}>
          <div>
            <label className="mono" style={{ display: 'block', marginBottom: 6 }}>
              Select Certificate Type
            </label>
            <select
              className="ctl"
              value={kind}
              onChange={(x) => setKind(x.target.value)}
            >
              {kinds.map(([k, t]) => (
                <option key={k} value={k}>
                  {t} {templates[k] ? '(custom template)' : '(built-in template)'}
                  {issued[k] ? ` · ${issued[k]} issued` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="eb"
              style={{ flex: 1, padding: '10px 14px', textAlign: 'center' }}
              onClick={onOpenPreview}
            >
              Edit Template &amp; Live Preview ↗
            </button>
            <button
              type="button"
              className="add"
              style={{ flex: 1, padding: '10px 14px', justifyContent: 'center' }}
              disabled={!done}
              title={!done ? 'Event must be completed to issue certificates' : ''}
              onClick={async () => {
                if (await act('certIssue', { eventId: e.id })) reload();
              }}
            >
              Generate All ({kinds.find(([k]) => k === kind)?.[1] ?? kind})
            </button>
          </div>
        </div>
      </div>

      {/* CSV Import Section */}
      <div className="panel" style={{ padding: '16px' }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', display: 'block' }}>
              BATCH ISSUANCE VIA CSV
            </span>
            <span style={{ fontSize: 13, color: 'var(--hi)' }}>
              Issue certificates to a list of external recipients
            </span>
          </div>
          <label className="eb" style={{ cursor: 'pointer', margin: 0 }}>
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={async (x) => {
                const f = x.target.files?.[0];
                if (!f) return;
                const rows = parseCsv(await f.text());
                setCsv(rows);
                setMap(
                  rows[0]!.map((h) =>
                    h
                      .trim()
                      .toLowerCase()
                      .replace(/[^\w.-]+/g, '_'),
                  ),
                );
                x.target.value = '';
              }}
            />
          </label>
        </div>

        {csv && (
          <div
            className="stack"
            style={{
              marginTop: 14,
              background: 'var(--bg)',
              padding: 12,
              border: '1px solid var(--line)',
            }}
          >
            <p className="mono text-dim" style={{ fontSize: 11, margin: 0 }}>
              {csv.length - 1} rows detected. Map columns to certificate variables:
            </p>
            <div className="stack" style={{ gap: 6, marginTop: 8 }}>
              {csv[0]!.map((h, i) => (
                <label key={i} className="row between" style={{ fontSize: 12, alignItems: 'center' }}>
                  <span className="mono">{h}</span>
                  <input
                    className="ctl"
                    style={{ width: 160, height: 32, padding: '2px 8px', fontSize: 12 }}
                    list="cert-vars"
                    value={map[i] ?? ''}
                    onChange={(x) => setMap(map.map((m, j) => (j === i ? x.target.value : m)))}
                  />
                </label>
              ))}
              <datalist id="cert-vars">
                {CERT_VARS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <button
                className="add"
                type="button"
                disabled={!done || !map.includes('email')}
                onClick={async () => {
                  const rows = csv
                    .slice(1)
                    .map((r) =>
                      Object.fromEntries(map.flatMap((m, i) => (m ? [[m, r[i] ?? '']] : []))),
                    );
                  if (!(await act('certIssue', { eventId: e.id, kind, rows }))) return;
                  setCsv(null);
                  reload();
                }}
              >
                Generate {csv.length - 1} Certificates
              </button>
              <button className="del" type="button" onClick={() => setCsv(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The email an approved member gets (manual approvals and auto-approved sign-ups alike). */
function Email({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const [editing, setEditing] = useState(false);
  const t = e.admin!.mail ?? DEFAULT_MAIL.event;
  const sample = {
    ...MAIL_SAMPLE.event,
    event: e.title,
    venue: e.place || 'to be announced',
    date: new Date(e.startsAt).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
  const view = renderMail(t, sample);
  return (
    <div className="stack">
      <MailStatus />
      <div className="row between" style={{ alignItems: 'center' }}>
        <p className="body" style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>
          Sent when someone is approved, by you or automatically.{' '}
          {e.admin!.mail ? 'Custom design active.' : 'Built-in design active.'}
        </p>
        <button className="eb" onClick={() => setEditing(true)}>
          Edit email
        </button>
      </div>
      <div className="me-inbox">
        <p className="me-subject">
          <span className="dim">Subject</span> {view.subject}
        </p>
        <iframe title="Approval email" sandbox="" srcDoc={view.html} className="me-frame desktop" />
      </div>
      {editing && (
        <MailEditor
          kind="event"
          title={`Approval email · ${e.title}`}
          current={e.admin!.mail}
          sample={sample}
          onSave={async (next) => {
            const ok = await act('eventMail', {
              eventId: e.id,
              ...(next ?? { subject: '', html: '' }),
            });
            if (ok) reload();
            return ok;
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
