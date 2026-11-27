'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '../Store';
import { cleanFields, FieldsEditor } from './EventForm';
import { downloadCsv, renderCertificate } from '@/lib/events';
import { useConfirm, usePrompt } from '../shared/PromptDialog';
import { MailEditor, MailStatus } from '../shared/MailEditor';
import { EventModal } from './EventModal';
import { CertPreview } from './CertPreview';
import {
  CERT_VARS,
  certHeadline,
  DEFAULT_CERT,
  DEFAULT_MAIL,
  MAIL_SAMPLE,
  renderMail,
  fillTemplate,
  parseCsv,
  type EventDetail,
  type EventEntry,
  type EventRole,
} from '@fecpc/contracts';

import { fieldLabel, fieldStack } from './ui';

import { previewCard, previewMeta } from '@/components/app/shared/ui';

const itemText =
  '[.ev-detail_.item_&_b]:block [.ev-detail_.item_&_b]:text-[16px] [.ev-detail_.item_&_b]:[font-weight:600] [.ev-detail_.item_&_b]:[letter-spacing:-0.01em] [.ev-detail_.item_&_b]:text-hi [.ev-detail_.item_&_span]:text-[14px] [.ev-detail_.item_&_span]:[color:var(--dim)]';

const itemArrow =
  'ar [.ev-detail_.item_&]:text-[15px] [.ev-detail_.item_&]:text-dim [.ev-detail_.item:hover_&]:text-acc';

const itemDelete =
  'del [.ev-detail_&]:[font-family:var(--f-mono,monospace)] [.ev-detail_&]:[font-weight:700] [.ev-detail_&]:text-[14px] [.ev-detail_&]:uppercase [.ev-detail_&]:[background:none] [.ev-detail_&]:[border:0] [.ev-detail_&&]:[border-bottom:1px_solid_transparent] [.ev-detail_&]:text-bad [.ev-detail_&]:p-[4px_0] [.ev-detail_&]:cursor-pointer [.ev-detail_&]:[transition:border-color_0.2s] [.ev-detail_&:hover]:[border-bottom-color:var(--bad)]';

const txCls = '[.ev-detail_.item_&]:flex-1'; // was .tx
const arCls =
  '[.ev-detail_.item_&]:[font-family:var(--f-mono,_monospace)] [.ev-detail_.item_&]:[transition:transform_0.2s,_color_0.2s] [.ev-detail_.item:hover_&]:[transform:translate(2px,_-2px)]'; // was .ar
const delCls = '[.ev-detail_&]:self-start [.ev-detail_&]:tracking-[0.06em]'; // was .del

/** Command sidebar for event organizers (Status, Responses, Roles, Certificates, Email, Feedback, Settings) */
export function EventAdmin({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const router = useRouter();
  const confirmIt = useConfirm();
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
      {/* Launchpad Rail */}
      <div className="panel">
        <button type="button" className="item" onClick={() => setModal('responses')}>
          <span className={`${itemText} ${txCls}`}>
            <b>Responses &amp; awards</b>
            <span>
              {totalEntries} registered · {approvedCount} approved · {pendingCount} pending
              {placedCount > 0 ? ` · ${placedCount} placed` : ''}
            </span>
          </span>
          <span className={`${itemArrow} ${arCls}`}>↗</span>
        </button>

        <button type="button" className="item" onClick={() => setModal('roles')}>
          <span className={`${itemText} ${txCls}`}>
            <b>Event roles</b>
            <span>{rolesCount} configured · volunteer or TA roles</span>
          </span>
          <span className={`${itemArrow} ${arCls}`}>↗</span>
        </button>

        <button type="button" className="item" onClick={() => setModal('certs')}>
          <span className={`${itemText} ${txCls}`}>
            <b>Certificates studio</b>
            <span>
              {e.certs ? 'Downloads on' : 'Downloads off'} ·{' '}
              {certsIssued > 0 ? `${certsIssued} issued` : 'template editor'}
            </span>
          </span>
          <span className={`${itemArrow} ${arCls}`}>↗</span>
        </button>

        <button type="button" className="item" onClick={() => setModal('feedback')}>
          <span className={`${itemText} ${txCls}`}>
            <b>Attendee feedback</b>
            <span>
              {fb.length > 0 ? `★ ${avgFb} / 5 (${fb.length} reviews)` : 'No reviews yet'}
            </span>
          </span>
          <span className={`${itemArrow} ${arCls}`}>↗</span>
        </button>

        <button type="button" className="item" onClick={() => setModal('email')}>
          <span className={`${itemText} ${txCls}`}>
            <b>Approval email</b>
            <span>
              {hasCustomMail ? 'Custom design' : 'Built-in design'} · preview &amp; styling
            </span>
          </span>
          <span className={`${itemArrow} ${arCls}`}>↗</span>
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
      <button type="button" className={`${itemDelete} ${delCls}`} onClick={del}>
        Delete event
      </button>

      {/* MODALS */}
      {modal === 'responses' && <Responses e={e} reload={reload} onClose={() => setModal(null)} />}

      {modal === 'roles' && (
        <EventModal title={`Event Roles (${rolesCount})`} onClose={() => setModal(null)}>
          <Roles e={e} reload={reload} />
        </EventModal>
      )}

      {modal === 'certs' && (
        <EventModal wide noShadow title="Certificates Studio" onClose={() => setModal(null)}>
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
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.title.trim()) return;
    setSaving(true);
    const ok = await act('roleSave', {
      eventId,
      id: role?.id,
      ...v,
      title: v.title.trim(),
      about: v.about.trim(),
      fields: cleanFields(fields),
    });
    setSaving(false);
    if (ok) done();
  };

  return (
    <form
      className="stack p-4 mt-2 [background:var(--bg)] [border:1px_solid_var(--line2)] gap-3.5"
      onSubmit={handleSubmit}
    >
      <div className={`form-group ${fieldStack}`}>
        <label className={fieldLabel}>Role</label>
        <input
          className="ctl"
          required
          maxLength={80}
          placeholder="Volunteer, Teaching Assistant…"
          value={v.title}
          onChange={(x) => set({ title: x.target.value })}
        />
      </div>
      <div className={`form-group ${fieldStack}`}>
        <label className={fieldLabel}>What they do</label>
        <input
          className="ctl"
          maxLength={1000}
          placeholder="Brief description"
          value={v.about}
          onChange={(x) => set({ about: x.target.value })}
        />
      </div>
      <div className={`form-group ${fieldStack}`}>
        <label className={fieldLabel}>Sign up method</label>
        <select
          className="ctl"
          value={v.mode}
          onChange={(x) => set({ mode: x.target.value as any })}
        >
          <option value="platform">Here, on this site</option>
          <option value="form">Google Forms</option>
        </select>
      </div>
      {v.mode === 'form' && (
        <div className={`form-group ${fieldStack}`}>
          <label className={fieldLabel}>Google Forms URL</label>
          <input
            className="ctl"
            placeholder="https://forms.gle/..."
            value={v.formUrl ?? ''}
            onChange={(x) => set({ formUrl: x.target.value })}
          />
        </div>
      )}
      <div className={`form-group ${fieldStack}`}>
        <label className={fieldLabel}>Who gets in?</label>
        <select
          className="ctl"
          value={v.approval}
          onChange={(x) => set({ approval: x.target.value as any })}
        >
          <option value="manual">Only those I approve</option>
          <option value="auto">Everyone automatically</option>
        </select>
      </div>
      {v.mode === 'platform' && <FieldsEditor value={fields} onChange={setFields} />}

      <div className="row mt-2 gap-2">
        <button
          className="eb py-2.5 px-4 flex-1 [background:var(--acc)] [color:white] border-acc font-bold text-[14px] cursor-pointer"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving...' : role ? 'Save role' : 'Add role'}
        </button>
        <button className="eb py-2.5 px-4 text-[14px] cursor-pointer" type="button" onClick={done}>
          Cancel
        </button>
      </div>
    </form>
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
    <div className="stack gap-3.5">
      {e.roles.map((r) => (
        <div key={r.id} className="panel py-3.5 px-4.5">
          <div className="row between items-start">
            <div>
              <b className="text-[15px] block">{r.title}</b>
              <span className="mono text-dim mt-1 text-[14px] block">
                {r.mode === 'form'
                  ? 'Google Forms link'
                  : `${r.approval === 'auto' ? 'Auto approval' : 'Manual approval'} · ${r.counts?.approved ?? 0} approved · ${r.counts?.pending ?? 0} pending`}
              </span>
            </div>
            <div className="row gap-2 items-center">
              <button
                className="eb"
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                {open === r.id ? 'Close' : 'Edit'}
              </button>
              <button
                className={`${itemDelete} ${delCls}`}
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
            <div className="pt-3.5 mt-3.5 [border-top:1px_solid_var(--line)]">
              <RoleForm eventId={e.id} role={r} done={done} />
            </div>
          )}
        </div>
      ))}
      {open === 'new' ? (
        <div className="panel p-4">
          <div className="row between pb-2 mb-3 [border-bottom:1px_solid_var(--line)]">
            <span className="mono font-bold">New Event Role</span>
            <button
              className={`${itemDelete} ${delCls}`}
              type="button"
              onClick={() => setOpen(null)}
            >
              Cancel
            </button>
          </div>
          <RoleForm eventId={e.id} done={done} />
        </div>
      ) : (
        <button className="add w-full justify-center" type="button" onClick={() => setOpen('new')}>
          + Add a role
        </button>
      )}
    </div>
  );
}

const PLACES = ['', '1st', '2nd', '3rd'];

function Responses({
  e,
  reload,
  onClose,
}: {
  e: EventDetail;
  reload: () => void;
  onClose: () => void;
}) {
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
    <EventModal
      wide
      title={`Responses & Place Awards (${entries.length})`}
      onClose={onClose}
      headerActions={
        <button
          className="eb py-0 px-3 whitespace-nowrap h-[34px] text-[14px] font-bold"
          type="button"
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
      }
    >
      <div className="stack gap-3.5">
        {e.mode === 'form' && (
          <div className="row between py-2 px-3 [background:var(--bg)] [border:1px_solid_var(--line)] items-center gap-2 flex-wrap">
            <span className="mono text-dim text-[14px]">
              Participants register on Google Forms; their answers are in the form, not here.
            </span>
            {e.formUrl && (
              <a
                className="eb py-1 px-2.5 text-[14px] [text-decoration:none] whitespace-nowrap"
                href={e.formUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Google Form ↗
              </a>
            )}
          </div>
        )}

        {/* Search Toolbar & Filters in SAME row */}
        <div className="row gap-[0.75rem] flex-wrap items-center">
          <input
            type="search"
            className="ctl flex-[1_1_200px] h-[40px]"
            placeholder="Search name, email, phone, answers..."
            value={q}
            onChange={(x) => setQ(x.target.value)}
          />
          <select
            className="ctl w-auto h-[40px] text-[14px] flex-[0_1_140px]"
            aria-label="Who"
            value={who}
            onChange={(x) => setWho(x.target.value)}
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
            className="ctl w-auto h-[40px] text-[14px] flex-[0_1_130px]"
            aria-label="Status"
            value={status}
            onChange={(x) => setStatus(x.target.value)}
          >
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {picked.length > 0 && (
          <div className="row between py-2 px-3.5 [background:var(--bg)] [border:1px_solid_var(--line2)] [box-shadow:2px_2px_0_var(--line2)] items-center">
            <span className="mono text-[14px] font-bold">
              {picked.length} {picked.length === 1 ? 'entry' : 'entries'} selected
            </span>
            <div className="row gap-2 items-center">
              <button
                type="button"
                className="py-[5px] px-3 text-[14px] font-bold [font-family:var(--f-mono,_monospace)] uppercase tracking-[0.04em] [background:#16a34a] text-[#ffffff] [border:1px_solid_#16a34a] cursor-pointer"
                onClick={() => decide(picked, 'approved')}
              >
                Approve ({picked.length})
              </button>
              <button
                type="button"
                className="py-[5px] px-2.5 text-[14px] font-bold [font-family:var(--f-mono,_monospace)] uppercase tracking-[0.04em] [background:transparent] text-[#dc2626] [border:none] cursor-pointer"
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
                onClick={() => decide(picked, 'rejected')}
              >
                Decline ({picked.length})
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto [border:1px_solid_var(--line2)] [background:var(--panel)] [box-shadow:2px_2px_0_var(--line2)]">
          <table className="mini-table [.ev-detail_&]:w-full [.ev-detail_&]:[border-collapse:collapse] [.ev-detail_&]:text-[14px] [.ev-detail_&]:[font-family:var(--f-body,_sans-serif)] [.evm-modal_&]:w-full [.evm-modal_&]:[border-collapse:collapse] [.evm-modal_&]:text-[14px] [.evm-modal_&]:[font-family:var(--f-body,_sans-serif)]">
            <thead>
              <tr>
                <th className="pl-3.5 w-[36px]">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={!!rows.length && rows.every((x) => picked.includes(x.id))}
                    onChange={(x) => setPicked(x.target.checked ? rows.map((r) => r.id) : [])}
                  />
                </th>
                <th>NAME &amp; CONTACT</th>
                <th>STATUS / PLACE</th>
                <th className="pr-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <Fragment key={x.id}>
                  <tr>
                    <td className="pl-3.5">
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
                      <span className="block text-[14px] font-bold text-hi">{x.name}</span>
                      <div className="mono text-dim mt-1 text-[14px] flex flex-wrap gap-1.5 items-center">
                        <span className="py-px px-1.5 [background:var(--bg)] [border:1px_solid_var(--line)] text-hi font-semibold">
                          {roleName(x)}
                        </span>
                        {x.batch && <span>b{x.batch}</span>}
                        <span>{x.email}</span>
                        {x.phone && <span>· {x.phone}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="row gap-2 items-center">
                        {(() => {
                          const statusConfig: Record<
                            string,
                            {
                              label: string;
                              color: string;
                              border: string;
                              bg: string;
                              dot: string;
                            }
                          > = {
                            approved: {
                              label: 'Approved',
                              color: '#15803d',
                              border: '#86efac',
                              bg: 'rgba(22, 163, 74, 0.08)',
                              dot: '#16a34a',
                            },
                            pending: {
                              label: 'Pending',
                              color: '#b45309',
                              border: '#fcd34d',
                              bg: 'rgba(245, 158, 11, 0.08)',
                              dot: '#f59e0b',
                            },
                            rejected: {
                              label: 'Declined',
                              color: '#b91c1c',
                              border: '#fca5a5',
                              bg: 'rgba(220, 38, 38, 0.08)',
                              dot: '#dc2626',
                            },
                            cancelled: {
                              label: 'Cancelled',
                              color: '#64748b',
                              border: '#cbd5e1',
                              bg: 'rgba(100, 116, 139, 0.08)',
                              dot: '#94a3b8',
                            },
                          };
                          const cfg = statusConfig[x.status] ?? {
                            label: x.status,
                            color: 'var(--hi)',
                            border: 'var(--line2)',
                            bg: 'var(--bg)',
                            dot: 'var(--hi)',
                          };
                          return (
                            <span
                              className="py-[3px] px-2 inline-flex items-center gap-1.5 [border-radius:2px]"
                              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                            >
                              <span
                                className="w-[6px] h-[6px] [border-radius:50%]"
                                style={{ background: cfg.dot }}
                              />
                              <span
                                className="mono text-[14px] font-bold uppercase tracking-[0.04em]"
                                style={{ color: cfg.color }}
                              >
                                {cfg.label}
                              </span>
                            </span>
                          );
                        })()}
                        {x.roleId === null && x.status === 'approved' && (
                          <select
                            className="ctl py-0 px-2 w-auto text-[14px] h-[26px] [font-family:var(--f-mono,_monospace)] font-semibold"
                            aria-label={`Place for ${x.name}`}
                            value={x.place ?? ''}
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
                    <td className="pr-3.5">
                      <div className="row gap-2 justify-end items-center">
                        {x.status !== 'approved' && x.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="py-1 px-2.5 text-[14px] font-bold [font-family:var(--f-mono,_monospace)] uppercase tracking-[0.04em] [background:#16a34a] text-[#ffffff] [border:1px_solid_#16a34a] cursor-pointer"
                            onClick={() => decide([x.id], 'approved')}
                          >
                            Approve
                          </button>
                        )}
                        {x.status !== 'rejected' && x.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="py-1 px-2 text-[14px] font-bold [font-family:var(--f-mono,_monospace)] uppercase tracking-[0.04em] [background:transparent] text-[#dc2626] [border:none] cursor-pointer"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                            onClick={() => decide([x.id], 'rejected')}
                          >
                            Decline
                          </button>
                        )}
                        {Object.keys(x.answers).length > 0 && (
                          <button
                            className="eb py-1 px-2.5 text-[14px] font-bold [font-family:var(--f-mono,_monospace)] uppercase tracking-[0.04em] border-line2 cursor-pointer"
                            type="button"
                            style={{
                              background: shown === x.id ? 'var(--ink)' : 'transparent',
                              color: shown === x.id ? 'var(--panel)' : 'var(--hi)',
                            }}
                            onClick={() => setShown(shown === x.id ? null : x.id)}
                          >
                            {shown === x.id ? 'Close' : `Ans (${Object.keys(x.answers).length})`}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {shown === x.id && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-3.5 px-4.5 [background:var(--bg)] [border-bottom:1px_solid_var(--line2)]"
                      >
                        <dl className="stack m-0 gap-2">
                          {Object.entries(x.answers).map(([k, v]) => (
                            <div key={k} className="text-[14px] flex flex-col gap-0.5">
                              <dt className="mono text-dim text-[14px] font-bold uppercase tracking-[0.06em]">
                                {k}
                              </dt>
                              <dd className="m-0 text-hi font-medium">{v}</dd>
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
                  <td colSpan={4} className="py-[2rem] px-[1rem] text-center text-dim">
                    No responses match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </EventModal>
  );
}

function Feedback({ e }: { e: EventDetail }) {
  const fb = e.admin!.feedback;
  if (!fb.length)
    return (
      <div className="py-8 px-4 text-center">
        <p className="mono text-dim m-0 text-[14px]">
          {e.status === 'completed'
            ? 'No feedback submitted yet.'
            : 'Attendee feedback opens when the event is marked completed.'}
        </p>
      </div>
    );
  const avg = (fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1);
  return (
    <div className="stack gap-4">
      <div className="panel py-4 px-5 [background:var(--bg)]">
        <div className="row between items-baseline">
          <div>
            <span className="mono text-[14px] text-dim">OVERALL RATING</span>
            <div className="big mt-1 text-[28px]">
              ★ {avg} <span className="text-[16px] text-dim font-medium">/ 5</span>
            </div>
          </div>
          <span className="mono text-[14px]">
            {fb.length} {fb.length === 1 ? 'response' : 'responses'}
          </span>
        </div>
      </div>

      <div className="stack gap-2.5">
        {fb.map((f, i) => (
          <div key={i} className="panel py-3.5 px-4.5">
            <div className="row between mb-1.5">
              <span className="mono font-bold text-[14px]">{f.name}</span>
              <span className="tag dark text-[14px] [background:var(--ink)]">
                {'★'.repeat(f.rating)}
                {'☆'.repeat(5 - f.rating)}
              </span>
            </div>
            {f.body && <p className="m-0 text-[14px] leading-[1.5] text-hi">“{f.body}”</p>}
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
      noShadow
      title={`Certificate Preview · ${sample.headline || 'Participation'}`}
      onClose={onClose}
    >
      <div className="stack gap-4">
        {/* Certificate Preview (A4 landscape scale) */}
        <CertPreview
          html={fillTemplate(html, sample)}
          title={`Certificate Preview · ${sample.headline || 'Participation'}`}
        />

        {/* HTML/CSS Template Editor */}
        {editHtml && (
          <div className="stack p-[1rem] [background:var(--bg)] [border:1px_solid_var(--line)]">
            <span className="mono text-dim text-[14px]">
              PLACEHOLDERS: {CERT_VARS.map((v) => `{{${v}}}`).join(' ')}
            </span>
            <textarea
              className="ctl mono h-auto min-h-[180px] resize-y"
              rows={10}
              value={html}
              onChange={(x) => setHtml(x.target.value)}
            />
            <div className="row mt-2 gap-2">
              <button
                className="eb [background:var(--acc)] [color:white] border-acc"
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
                className={`${itemDelete} ${delCls}`}
                type="button"
                disabled={!custom}
                onClick={() => setHtml(DEFAULT_CERT)}
              >
                Use built-in design
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-[0.75rem] flex-wrap">
          <button type="button" className="eb" onClick={() => setEditHtml(!editHtml)}>
            {editHtml ? 'Hide HTML/CSS' : 'Edit HTML/CSS'}
          </button>
          <button
            type="button"
            className="add"
            onClick={() => renderCertificate(fillTemplate(html, sample), 'png', `${e.id}-preview`)}
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
    <div className="stack gap-4">
      {/* Top Banner / Distribution State */}
      <div className="panel py-3.5 px-4.5 [background:var(--bg)]">
        <div className="row between items-center">
          <div>
            <span className="mono text-[14px] text-dim block">ATTENDEE DOWNLOADS</span>
            <span
              className="mono text-[14px] font-bold"
              style={{ color: e.certs ? 'var(--acc)' : 'var(--dim)' }}
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
      <div className="panel py-4 px-5 [background:var(--bg)]">
        <div className="stack gap-3">
          <div>
            <label className="mono mb-1.5 text-[14px] text-dim uppercase tracking-[0.08em] block">
              Select Certificate Type
            </label>
            <select className="ctl" value={kind} onChange={(x) => setKind(x.target.value)}>
              {kinds.map(([k, t]) => (
                <option key={k} value={k}>
                  {t} {templates[k] ? '(custom template)' : '(built-in template)'}
                  {issued[k] ? ` · ${issued[k]} issued` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="row gap-2">
            <button
              type="button"
              className="eb py-2.5 px-3.5 flex-1 text-center"
              onClick={onOpenPreview}
            >
              Edit Template &amp; Live Preview ↗
            </button>
            <button
              type="button"
              className="eb py-2.5 px-3.5 flex-1 text-center [background:var(--acc)] [color:white] border-acc"
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
      <div className="panel p-4">
        <div className="row between items-center">
          <div>
            <span className="mono text-[14px] text-dim block">BATCH ISSUANCE VIA CSV</span>
            <span className="text-[14px] text-hi">
              Issue certificates to a list of external recipients
            </span>
          </div>
          <label className="eb m-0 cursor-pointer">
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
          <div className="stack p-3 mt-3.5 [background:var(--bg)] [border:1px_solid_var(--line)]">
            <p className="mono text-dim m-0 text-[14px]">
              {csv.length - 1} rows detected. Map columns to certificate variables:
            </p>
            <div className="stack mt-2 gap-1.5">
              {csv[0]!.map((h, i) => (
                <label key={i} className="row between text-[14px] items-center">
                  <span className="mono">{h}</span>
                  <input
                    className="ctl py-0.5 px-2 w-[160px] h-[32px] text-[14px]"
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
            <div className="row mt-3 gap-2">
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
              <button
                className={`${itemDelete} ${delCls}`}
                type="button"
                onClick={() => setCsv(null)}
              >
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
      <div className="row between items-center">
        <p className="body m-0 text-[14px] text-dim">
          Sent when someone is approved, by you or automatically.{' '}
          {e.admin!.mail ? 'Custom design active.' : 'Built-in design active.'}
        </p>
        <button className="eb" onClick={() => setEditing(true)}>
          Edit email
        </button>
      </div>
      <div className={previewCard}>
        <p className={previewMeta}>
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
