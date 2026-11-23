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

  const statusColor =
    e.status === 'ongoing'
      ? '#1a7f37'
      : e.status === 'open'
        ? 'var(--acc)'
        : e.status === 'completed'
          ? 'var(--ink)'
          : e.status === 'cancelled'
            ? 'var(--bad)'
            : 'var(--dim)';

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
      {/* Panel: Event Status */}
      <div className="sidebar-panel">
        <div className="sidebar-header">
          <span>Status</span>
          <button type="button" className="btn xs" onClick={() => setEditStatus(!editStatus)}>
            {editStatus ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <div className="sidebar-content">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
              CURRENT STATE
            </span>
            <span
              className="tag dark"
              style={{ background: statusColor, borderColor: statusColor, color: 'white' }}
            >
              {(liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]).toUpperCase()}
            </span>
          </div>

          {editStatus ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Change Status</label>
              <select
                className="form-control"
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
          ) : (
            <div className="mono" style={{ fontSize: 12, color: 'var(--mut)' }}>
              {e.status === 'open'
                ? 'Sign-up is currently open.'
                : e.status === 'completed'
                  ? 'Event is completed.'
                  : e.status === 'ongoing'
                    ? 'Event is ongoing.'
                    : 'Sign-up is currently closed.'}
              {e.seats !== null && ` · ${Math.max(0, e.seats - e.taken)} of ${e.seats} seats left`}
            </div>
          )}
        </div>
      </div>

      {/* Launchpad Cards: Compact overview & modal openers */}
      <div className="stack" style={{ gap: 10 }}>
        {/* Responses & Awards Card */}
        <button
          type="button"
          className="interactive-launchpad"
          onClick={() => setModal('responses')}
        >
          <div
            className="sidebar-header"
            style={{ borderBottom: '1px solid var(--line)', padding: '0.65rem 1rem' }}
          >
            <span>Responses &amp; Awards</span>
            <span className="tag xs primary">Open ↗</span>
          </div>
          <div className="sidebar-content" style={{ padding: '0.85rem 1rem' }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
              {totalEntries} registered
            </div>
            <div className="mono text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              {approvedCount} approved · {pendingCount} pending{' '}
              {placedCount > 0 && `· ${placedCount} placed`}
            </div>
          </div>
        </button>

        {/* Roles Card */}
        <button type="button" className="interactive-launchpad" onClick={() => setModal('roles')}>
          <div
            className="sidebar-header"
            style={{ borderBottom: '1px solid var(--line)', padding: '0.65rem 1rem' }}
          >
            <span>Event Roles</span>
            <span className="tag xs">Open ↗</span>
          </div>
          <div className="sidebar-content" style={{ padding: '0.85rem 1rem' }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
              {rolesCount} {rolesCount === 1 ? 'role' : 'roles'} configured
            </div>
            <div className="mono text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              {rolesCount > 0
                ? e.roles.map((r) => r.title).join(', ')
                : 'Add volunteer or TA roles'}
            </div>
          </div>
        </button>

        {/* Certificates Studio Card */}
        <button type="button" className="interactive-launchpad" onClick={() => setModal('certs')}>
          <div
            className="sidebar-header"
            style={{ borderBottom: '1px solid var(--line)', padding: '0.65rem 1rem' }}
          >
            <span>Certificates Studio</span>
            <span className="tag xs">Open ↗</span>
          </div>
          <div className="sidebar-content" style={{ padding: '0.85rem 1rem' }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
              {e.certs ? 'Downloads Active' : 'Downloads Off'}
            </div>
            <div className="mono text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              {certsIssued > 0
                ? `${certsIssued} certificates issued`
                : 'Template editor & batch generation'}
            </div>
          </div>
        </button>

        {/* Attendee Feedback Card */}
        <button
          type="button"
          className="interactive-launchpad"
          onClick={() => setModal('feedback')}
        >
          <div
            className="sidebar-header"
            style={{ borderBottom: '1px solid var(--line)', padding: '0.65rem 1rem' }}
          >
            <span>Attendee Feedback</span>
            <span className="tag xs">Open ↗</span>
          </div>
          <div className="sidebar-content" style={{ padding: '0.85rem 1rem' }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
              {avgFb ? `★ ${avgFb} / 5` : 'No reviews yet'}
            </div>
            <div className="mono text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              {fb.length} {fb.length === 1 ? 'response' : 'responses'}
            </div>
          </div>
        </button>

        {/* Approval Email Card */}
        <button type="button" className="interactive-launchpad" onClick={() => setModal('email')}>
          <div
            className="sidebar-header"
            style={{ borderBottom: '1px solid var(--line)', padding: '0.65rem 1rem' }}
          >
            <span>Approval Email</span>
            <span className="tag xs">Open ↗</span>
          </div>
          <div className="sidebar-content" style={{ padding: '0.85rem 1rem' }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
              {hasCustomMail ? 'Custom design' : 'Built-in design'}
            </div>
            <div className="mono text-dim" style={{ fontSize: 11, marginTop: 4 }}>
              Template preview &amp; custom styling
            </div>
          </div>
        </button>
      </div>

      {/* Run again button for past events */}
      {(e.status === 'completed' || e.status === 'cancelled') && (
        <div style={{ marginTop: '0.75rem' }}>
          <Link
            className="btn sm line"
            style={{ width: '100%', textAlign: 'center' }}
            href={`/app/events/new?copy=${e.id}`}
          >
            Run again as a new event
          </Link>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
        <button
          type="button"
          className="btn danger"
          style={{ width: '100%', fontSize: 12, padding: '0.5rem' }}
          onClick={del}
        >
          Delete Event
        </button>
      </div>

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
    <div className="stack" style={{ gap: 12 }}>
      {e.roles.map((r) => (
        <div
          key={r.id}
          className="stack"
          style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}
        >
          <div className="row between">
            <div>
              <b style={{ fontSize: 14 }}>{r.title}</b>
              <br />
              <span className="mono text-dim" style={{ fontSize: 11 }}>
                {r.mode === 'form'
                  ? 'Google Forms'
                  : `${r.approval} approval · ${r.counts?.approved ?? 0} approved · ${r.counts?.pending ?? 0} pending`}
              </span>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button
                className="btn xs line"
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                {open === r.id ? 'Close' : 'Edit'}
              </button>
              <button
                className="btn xs line danger"
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
          {open === r.id && <RoleForm eventId={e.id} role={r} done={done} />}
        </div>
      ))}
      {open === 'new' ? (
        <RoleForm eventId={e.id} done={done} />
      ) : (
        <button
          className="btn outline xs"
          type="button"
          style={{ width: '100%', marginTop: '0.25rem' }}
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
    <div className="stack" style={{ gap: 12 }}>
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
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="search"
          className="form-control"
          placeholder="Search name, email, phone..."
          value={q}
          onChange={(x) => setQ(x.target.value)}
        />
        <button
          className="btn solid xs"
          type="button"
          style={{ whiteSpace: 'nowrap' }}
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
          Export
        </button>
      </div>

      {/* Filters row */}
      <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <select
          className="form-control"
          aria-label="Who"
          value={who}
          onChange={(x) => setWho(x.target.value)}
          style={{ width: 'auto', flex: '1 1 110px' }}
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
          className="form-control"
          aria-label="Status"
          value={status}
          onChange={(x) => setStatus(x.target.value)}
          style={{ width: 'auto', flex: '1 1 110px' }}
        >
          {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {picked.length > 0 && (
          <div className="row" style={{ gap: 4 }}>
            <button className="btn xs acc" type="button" onClick={() => decide(picked, 'approved')}>
              Approve ({picked.length})
            </button>
            <button
              className="btn xs line danger"
              type="button"
              onClick={() => decide(picked, 'rejected')}
            >
              Decline ({picked.length})
            </button>
          </div>
        )}
      </div>

      {/* Mini Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="mini-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={!!rows.length && rows.every((x) => picked.includes(x.id))}
                  onChange={(x) => setPicked(x.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th>NAME</th>
              <th>STATUS</th>
              <th style={{ textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <Fragment key={x.id}>
                <tr>
                  <td>
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
                    <strong style={{ display: 'block', fontSize: 13 }}>{x.name}</strong>
                    <span className="mono text-dim" style={{ fontSize: 11 }}>
                      {roleName(x)} · {x.batch ? `b${x.batch} · ` : ''}
                      {x.email}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                      <span
                        className={`tag xs ${x.status === 'approved' ? 'primary' : x.status === 'rejected' ? 'danger' : 'dark'}`}
                        style={{ fontSize: 10, padding: '2px 5px' }}
                      >
                        {x.status === 'rejected' ? 'declined' : x.status}
                      </span>
                      {x.roleId === null && x.status === 'approved' && (
                        <select
                          className="form-control"
                          aria-label={`Place for ${x.name}`}
                          value={x.place ?? ''}
                          style={{
                            width: 'auto',
                            padding: '1px 4px',
                            fontSize: 10,
                            height: 22,
                            marginLeft: 4,
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
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      {x.status !== 'approved' && x.status !== 'cancelled' && (
                        <button
                          className="btn xs solid"
                          type="button"
                          onClick={() => decide([x.id], 'approved')}
                        >
                          Approve
                        </button>
                      )}
                      {x.status !== 'rejected' && x.status !== 'cancelled' && (
                        <button
                          className="btn xs line"
                          type="button"
                          onClick={() => decide([x.id], 'rejected')}
                        >
                          Decline
                        </button>
                      )}
                      {Object.keys(x.answers).length > 0 && (
                        <button
                          className="btn xs line"
                          type="button"
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
                    <td colSpan={4} style={{ background: 'var(--bg)', padding: '8px 12px' }}>
                      <dl className="stack" style={{ gap: 4, margin: 0 }}>
                        {Object.entries(x.answers).map(([k, v]) => (
                          <div key={k} style={{ fontSize: 12 }}>
                            <dt className="mono text-dim" style={{ fontSize: 11 }}>
                              {k}:
                            </dt>
                            <dd style={{ marginLeft: 8 }}>{v}</dd>
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
                  style={{ textAlign: 'center', color: 'var(--dim)', padding: '1rem' }}
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
      <p className="empty">
        {e.status === 'completed'
          ? 'No feedback yet.'
          : 'Feedback opens when the event is completed.'}
      </p>
    );
  return (
    <div className="stack">
      <p className="label">
        {fb.length} responses · average{' '}
        {(fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1)} / 5
      </p>
      <ol className="list">
        {fb.map((f, i) => (
          <li key={i} className="ev-fb">
            <span className="mono acc">{f.rating}/5</span>
            <span className="grow">
              <b>{f.name}</b>
              {f.body && (
                <>
                  <br />
                  {f.body}
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
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
    <div
      className="cm-backdrop"
      data-modal
      role="dialog"
      aria-modal="true"
      aria-label="Certificate Preview"
      onClick={(evt) => evt.target === evt.currentTarget && onClose()}
    >
      <div className="cert-dialog">
        <div className="modal-header">
          <h2 className="mono" style={{ fontSize: 14, textTransform: 'uppercase' }}>
            Certificate Preview
          </h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {/* Brutalist Certificate Card from deepseek_html_20261122_3c6079.html */}
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
                marginBottom: '1.5rem',
                background: 'var(--bg)',
                padding: '1rem',
                border: '1px solid var(--line)',
              }}
            >
              <span className="mono text-dim" style={{ fontSize: 11 }}>
                PLACEHOLDERS: {CERT_VARS.map((v) => `{{${v}}}`).join(' ')}
              </span>
              <textarea
                className="form-control mono"
                rows={10}
                value={html}
                onChange={(x) => setHtml(x.target.value)}
              />
              <div className="row">
                <button
                  className="btn xs solid"
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
                  className="btn xs line"
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
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}
          >
            <button type="button" className="btn line" onClick={() => setEditHtml(!editHtml)}>
              {editHtml ? 'Hide HTML/CSS' : 'Edit HTML/CSS'}
            </button>
            <button
              type="button"
              className="btn solid"
              onClick={() =>
                renderCertificate(fillTemplate(html, sample), 'png', `${e.id}-preview`)
              }
            >
              Download Sample PNG
            </button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="stack" style={{ gap: 14 }}>
      <p className="mono text-dim" style={{ fontSize: 11, lineHeight: 1.4 }}>
        Certificates are generated once the event is marked completed.
      </p>

      <button type="button" className="btn acc" style={{ width: '100%' }} onClick={onOpenPreview}>
        Preview Design
      </button>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Generate For</label>
        <select className="form-control" value={kind} onChange={(x) => setKind(x.target.value)}>
          {kinds.map(([k, t]) => (
            <option key={k} value={k}>
              {t} {templates[k] ? '(custom)' : '(built-in)'}
              {issued[k] ? ` · ${issued[k]} issued` : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn solid"
        style={{ width: '100%' }}
        disabled={!done}
        title={!done ? 'Event must be completed to issue certificates' : ''}
        onClick={async () => {
          if (await act('certIssue', { eventId: e.id })) reload();
        }}
      >
        Generate All
      </button>

      {/* Distribution & Import */}
      <div
        className="stack"
        style={{ gap: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}
      >
        <div className="row between">
          <span className={e.certs ? 'ok' : 'text-dim'} style={{ fontSize: 12 }}>
            {e.certs ? 'Downloads are ON.' : 'Downloads are OFF.'}
          </span>
          <button
            className="btn xs line"
            type="button"
            disabled={!done && !e.certs}
            onClick={async () =>
              (await act('certDistribute', { eventId: e.id, on: !e.certs })) && reload()
            }
          >
            {e.certs ? 'Turn off' : 'Turn on'}
          </button>
        </div>

        <label className="btn xs line" style={{ textAlign: 'center', cursor: 'pointer' }}>
          Import CSV for this kind
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
          style={{ background: 'var(--bg)', padding: 10, border: '1px solid var(--line)' }}
        >
          <p className="mono text-dim" style={{ fontSize: 11 }}>
            {csv.length - 1} rows. Map columns:
          </p>
          <div className="stack" style={{ gap: 6 }}>
            {csv[0]!.map((h, i) => (
              <label key={i} className="row between" style={{ fontSize: 12 }}>
                <span>{h}</span>
                <input
                  className="form-control"
                  style={{ width: 140, padding: '2px 6px', fontSize: 12 }}
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
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn xs solid"
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
              Generate {csv.length - 1}
            </button>
            <button className="btn xs line" type="button" onClick={() => setCsv(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
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
      <div className="row between" style={{ '--g': '12px' } as React.CSSProperties}>
        <p className="body">
          Sent when someone is approved, by you or automatically.{' '}
          {e.admin!.mail ? 'Your design.' : 'The built-in design.'}
        </p>
        <button className="btn sm" onClick={() => setEditing(true)}>
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
