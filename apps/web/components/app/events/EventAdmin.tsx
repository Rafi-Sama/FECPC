'use client';
import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs } from '../Shell';
import { useStore } from '../Store';
import { EventForm, FieldsEditor, Method, cleanFields } from './EventForm';
import { CERT_H, CERT_W, downloadCsv, renderCertificate } from '@/lib/events';
import {
  CERT_VARS,
  fillTemplate,
  parseCsv,
  type EventDetail,
  type EventEntry,
  type EventRole,
} from '@fecpc/contracts';

const TABS = ['Responses', 'Details', 'Roles', 'Feedback', 'Certificates'] as const;

/** Everything the President and Secretary do with one event. The API checks `event.publish` on each call. */
export function EventAdmin({ e, reload }: { e: EventDetail; reload: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Responses');
  return (
    <section className="panel stack ev-card ev-org">
      <b>Organise</b>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'Responses' && <Responses e={e} reload={reload} />}
      {tab === 'Details' && <Details e={e} reload={reload} />}
      {tab === 'Roles' && <Roles e={e} reload={reload} />}
      {tab === 'Feedback' && <Feedback e={e} />}
      {tab === 'Certificates' && <Certificates e={e} reload={reload} />}
    </section>
  );
}

function Details({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const router = useRouter();
  return (
    <div className="stack">
      <EventForm event={e} saved={reload} />
      <button
        className="btn sm line bad"
        type="button"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          if (
            !confirm(`Delete "${e.title}" with all its registrations, feedback and certificates?`)
          )
            return;
          if (await act('eventDelete', { id: e.id })) router.push('/app/events');
        }}
      >
        Delete event
      </button>
    </div>
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
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  return (
    <form
      className="stack"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (await act('roleSave', { eventId, id: role?.id, ...v, fields: cleanFields(fields) }))
          done();
      }}
    >
      <div className="row">
        <label className="field grow">
          <span className="label">Role</span>
          <input
            className="input"
            required
            maxLength={80}
            placeholder="Volunteer, Teaching Assistant…"
            value={v.title}
            onChange={(x) => set({ title: x.target.value })}
          />
        </label>
        <label className="field grow">
          <span className="label">What they do</span>
          <input
            className="input"
            maxLength={1000}
            value={v.about}
            onChange={(x) => set({ about: x.target.value })}
          />
        </label>
      </div>
      <Method v={v} set={set} />
      {v.mode === 'platform' && <FieldsEditor value={fields} onChange={setFields} />}
      <button className="btn sm b" style={{ alignSelf: 'flex-start' }}>
        {role ? 'Save role' : 'Add role'}
      </button>
    </form>
  );
}

function Roles({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const done = () => {
    setOpen(null);
    reload();
  };
  return (
    <div className="stack">
      {e.roles.map((r) => (
        <div key={r.id} className="stack">
          <div className="row between">
            <span>
              <b>{r.title}</b>{' '}
              <span className="label">
                {r.mode === 'form'
                  ? 'Google Forms'
                  : `${r.approval} approval · ${r.counts?.approved ?? 0} approved · ${r.counts?.pending ?? 0} pending`}
              </span>
            </span>
            <span className="row">
              <button
                className="btn xs line"
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
              >
                Edit
              </button>
              <button
                className="btn xs line"
                type="button"
                onClick={async () =>
                  confirm(`Remove ${r.title} and its applications?`) &&
                  (await act('roleDelete', { eventId: e.id, id: r.id })) &&
                  reload()
                }
              >
                Remove
              </button>
            </span>
          </div>
          {open === r.id && <RoleForm eventId={e.id} role={r} done={done} />}
        </div>
      ))}
      {open === 'new' ? (
        <RoleForm eventId={e.id} done={done} />
      ) : (
        <button
          className="btn sm line"
          type="button"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setOpen('new')}
        >
          Add a role
        </button>
      )}
    </div>
  );
}

const PLACES = ['', '1st', '2nd', '3rd'];

function Responses({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
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
  const count = (pred: (x: EventEntry) => boolean) => entries.filter(pred).length;
  const decide = async (ids: number[], s: string) => {
    if (!(await act('entryStatus', { ids, status: s }))) return;
    setPicked([]);
    reload();
  };
  const questions = [...new Set(rows.flatMap((x) => Object.keys(x.answers)))];

  return (
    <div className="stack">
      {e.mode === 'form' && (
        <p className="label">
          Participants register on Google Forms; their answers are in the form, not here.{' '}
          {e.formUrl && (
            <a className="link" href={e.formUrl} target="_blank" rel="noopener noreferrer">
              Open the form
            </a>
          )}
        </p>
      )}
      <div className="row">
        {[
          ...(e.mode === 'platform'
            ? [{ t: 'Participants', f: (x: EventEntry) => x.roleId === null }]
            : []),
          ...e.roles
            .filter((r) => r.mode === 'platform')
            .map((r) => ({ t: r.title, f: (x: EventEntry) => x.roleId === r.id })),
        ].map(({ t, f }) => (
          <span key={t} className="chip">
            {t}: {count((x) => f(x) && x.status === 'approved')} approved ·{' '}
            {count((x) => f(x) && x.status === 'pending')} pending ·{' '}
            {count((x) => f(x) && x.status === 'rejected')} declined
          </span>
        ))}
      </div>
      <div className="row">
        <input
          type="search"
          className="input grow"
          aria-label="Search responses"
          placeholder="Search name, email, phone, answers"
          value={q}
          onChange={(x) => setQ(x.target.value)}
        />
        <select
          className="input"
          aria-label="Who"
          value={who}
          onChange={(x) => setWho(x.target.value)}
          style={{ width: 'auto' }}
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
          className="input"
          aria-label="Status"
          value={status}
          onChange={(x) => setStatus(x.target.value)}
          style={{ width: 'auto' }}
        >
          {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="row">
        <button
          className="btn xs"
          type="button"
          disabled={!picked.length}
          onClick={() => decide(picked, 'approved')}
        >
          Approve {picked.length || ''}
        </button>
        <button
          className="btn xs line"
          type="button"
          disabled={!picked.length}
          onClick={() => decide(picked, 'rejected')}
        >
          Decline {picked.length || ''}
        </button>
        <button
          className="btn xs line"
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
          Export CSV ({rows.length})
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={!!rows.length && rows.every((x) => picked.includes(x.id))}
                  onChange={(x) => setPicked(x.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th>Name</th>
              <th>Kind</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Place</th>
              <th />
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
                    {x.name}
                    <br />
                    <span className="label">
                      {x.email} · batch {x.batch}
                    </span>
                  </td>
                  <td>{roleName(x)}</td>
                  <td className="mono">{x.phone}</td>
                  <td>{x.status}</td>
                  <td>
                    {x.roleId === null && x.status === 'approved' ? (
                      <select
                        className="input"
                        aria-label={`Place for ${x.name}`}
                        value={x.place ?? ''}
                        onChange={async (c) =>
                          (await act('entryPlace', {
                            id: x.id,
                            place: c.target.value ? +c.target.value : null,
                          })) && reload()
                        }
                      >
                        <option value="">None</option>
                        <option value="1">1st</option>
                        <option value="2">2nd</option>
                        <option value="3">3rd</option>
                      </select>
                    ) : (
                      PLACES[x.place ?? 0]
                    )}
                  </td>
                  <td>
                    <span className="row">
                      {x.status !== 'approved' && x.status !== 'cancelled' && (
                        <button
                          className="btn xs"
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
                      <button
                        className="btn xs line"
                        type="button"
                        aria-expanded={shown === x.id}
                        onClick={() => setShown(shown === x.id ? null : x.id)}
                      >
                        Answers
                      </button>
                    </span>
                  </td>
                </tr>
                {shown === x.id && (
                  <tr>
                    <td />
                    <td colSpan={6}>
                      <dl className="stack">
                        {Object.entries(x.answers).map(([k, v]) => (
                          <div key={k}>
                            <dt className="label">{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                        <div>
                          <dt className="label">Signed up</dt>
                          <dd>{new Date(x.at).toLocaleString()}</dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty">No responses match.</p>}
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

function Certificates({ e, reload }: { e: EventDetail; reload: () => void }) {
  const { act } = useStore();
  const { templates, issued } = e.admin!;
  const kinds: [string, string][] = [
    ['participant', 'Participants'],
    ['winner1', '1st place'],
    ['winner2', '2nd place'],
    ['winner3', '3rd place'],
    ...e.roles.map((r): [string, string] => [`role:${r.id}`, r.title]),
  ];
  const [kind, setKind] = useState('participant');
  const [html, setHtml] = useState(templates.participant ?? '');
  const [csv, setCsv] = useState<string[][] | null>(null);
  const [map, setMap] = useState<string[]>([]);
  const done = e.status === 'completed';
  const sample = { ...SAMPLE, event: e.title, date: e.startsAt.slice(0, 10) };

  return (
    <div className="stack">
      {!done && (
        <p className="label">Certificates are generated once the event is marked Completed.</p>
      )}
      <div className="row">
        <select
          className="input"
          aria-label="Certificate"
          style={{ width: 'auto' }}
          value={kind}
          onChange={(x) => {
            setKind(x.target.value);
            setHtml(templates[x.target.value] ?? '');
          }}
        >
          {kinds.map(([k, t]) => (
            <option key={k} value={k}>
              {t} {templates[k] ? '✓' : ''} {issued[k] ? `· ${issued[k]} issued` : ''}
            </option>
          ))}
        </select>
        <span className="label">
          Placeholders: {CERT_VARS.map((v) => `{{${v}}}`).join(' ')}, or any CSV column you map.
        </span>
      </div>
      <textarea
        className="input mono"
        aria-label="Template HTML and CSS"
        placeholder={`<style>body{margin:0;width:${CERT_W}px;height:${CERT_H}px}</style><h1>{{name}}</h1>`}
        rows={10}
        value={html}
        onChange={(x) => setHtml(x.target.value)}
      />
      <div className="row">
        <button
          className="btn sm"
          type="button"
          onClick={async () =>
            (await act('certTemplate', { eventId: e.id, kind, html })) && reload()
          }
        >
          Save template
        </button>
        <button
          className="btn sm line"
          type="button"
          disabled={!html}
          onClick={() => renderCertificate(fillTemplate(html, sample), 'png', 'preview')}
        >
          Preview as PNG
        </button>
      </div>
      {html && (
        <div style={{ overflow: 'auto', border: '2px solid var(--line2)' }}>
          {/* sandbox: the template's scripts never run; the preview is A4 landscape at half size */}
          <iframe
            title="Certificate preview"
            sandbox=""
            srcDoc={fillTemplate(html, sample)}
            style={{ width: CERT_W, height: CERT_H, border: 0, zoom: 0.5, background: '#fff' }}
          />
        </div>
      )}

      <p className="label">Generate</p>
      <div className="row">
        <button
          className="btn sm"
          type="button"
          disabled={!done}
          title="Every kind with a saved template. Re-running removes certificates people no longer earn."
          onClick={async () => (await act('certIssue', { eventId: e.id })) && reload()}
        >
          From registrations
        </button>
        <label className="btn sm line">
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
        <div className="stack">
          <p className="label">
            {csv.length - 1} rows. Map each column to a placeholder (one must be email); leave empty
            to skip.
          </p>
          <div className="row">
            {csv[0]!.map((h, i) => (
              <label key={i} className="field">
                <span className="label">{h}</span>
                <input
                  className="input"
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
          <div className="row">
            <button
              className="btn sm"
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
              Generate {csv.length - 1} for {kinds.find(([k]) => k === kind)?.[1]}
            </button>
            <button className="btn sm line" type="button" onClick={() => setCsv(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="label">Distribution</p>
      <div className="row">
        <span className={e.certs ? 'ok' : ''}>
          {e.certs ? 'Members can download their certificates.' : 'Downloads are off.'}
        </span>
        <button
          className="btn sm line"
          type="button"
          disabled={!done && !e.certs}
          onClick={async () =>
            (await act('certDistribute', { eventId: e.id, on: !e.certs })) && reload()
          }
        >
          {e.certs ? 'Turn off' : 'Turn on'}
        </button>
      </div>
    </div>
  );
}
