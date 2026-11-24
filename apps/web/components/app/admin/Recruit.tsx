'use client';
// Admin → Recruit: a list of recruitments (one shareable form per intake). Opening one shows its link, QR poster,
// CSV import and the applicants, who are accepted or rejected one by one or in bulk.
import { useEffect, useMemo, useState } from 'react';
import {
  checkForm,
  CSV_TEMPLATE,
  RECRUIT,
  readApplicantCsv,
  MAIL_SAMPLE,
  type Applicant,
  type RecruitForm,
  type RecruitLink,
} from '@fecpc/contracts';
import QR from '@/components/app/QR';
import { useStore } from '@/components/app/Store';
import { useConfirm, usePrompt } from '@/components/app/shared/PromptDialog';
import { MailEditor, MailStatus } from '@/components/app/shared/MailEditor';
import { site } from '@/lib/site';
import { poster } from './poster';

const urlOf = (l: RecruitLink) => `${location.origin}/apply/${l.token}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: site.tz,
  });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: site.tz });
const left = (iso: string) => {
  const h = Math.round((Date.parse(iso) - Date.now()) / 36e5);
  return h < 1
    ? 'closes within the hour'
    : h < 48
      ? `closes in ${h} h`
      : `closes in ${Math.round(h / 24)} days`;
};
const STATUS = [
  ['pending', 'To review'],
  ['accepted', 'Accepted'],
  ['declined', 'Rejected'],
] as const;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Applicants with no link: from the old join page, or kept when their link was deleted. */
const EARLIER = 0;

export function Recruit() {
  const { office, act } = useStore();
  const sure = useConfirm();
  const { links, applicants } = office.recruit ?? { links: [], applicants: [] };
  const [open, setOpen] = useState<number | null>(null);
  const [edit, setEdit] = useState<RecruitLink | 'new' | null>(null);
  const [openNewest, setOpenNewest] = useState(false);
  const earlier = applicants.filter((a) => a.link === null);

  // A new recruitment opens straight away, so its link and QR are the next thing the officer sees.
  useEffect(() => {
    if (openNewest && links[0]) {
      setOpen(links[0].id);
      setOpenNewest(false);
    }
  }, [openNewest, links]);

  const remove = async (l: RecruitLink) => {
    const gone = l.pending + l.declined;
    if (
      !(await sure(
        `Delete "${l.title}"?`,
        `The link stops working${gone ? ` and its ${plural(gone, 'pending or rejected applicant')} ${gone === 1 ? 'is' : 'are'} removed` : ''}.${l.accepted ? ` The ${plural(l.accepted, 'accepted member')} stay${l.accepted === 1 ? 's' : ''} on record.` : ''} This cannot be undone.`,
        'Delete',
        true,
      ))
    )
      return;
    if (await act('recruitDelete', { id: l.id })) setOpen(null);
  };
  const close = async (l: RecruitLink) =>
    (await sure(`Close "${l.title}" now?`, 'Nobody can apply until you reopen it.', 'Close now')) &&
    act('recruitClose', { id: l.id });

  const cur = open === EARLIER ? null : links.find((l) => l.id === open);
  const editor = edit && (
    <LinkEditor
      link={edit === 'new' ? null : edit}
      onClose={(saved) => {
        if (saved && edit === 'new') setOpenNewest(true);
        setEdit(null);
      }}
    />
  );

  if (open !== null && (cur || open === EARLIER))
    return (
      <>
        <Detail
          link={cur ?? null}
          list={applicants.filter((a) => a.link === (cur?.id ?? null))}
          back={() => setOpen(null)}
          onEdit={() => cur && setEdit(cur)}
          onClose={() => cur && close(cur)}
          onDelete={() => cur && remove(cur)}
        />
        {editor}
      </>
    );

  return (
    <div className="rc">
      <div className="page-header">
        {links.length > 0 && (
          <span className="intake-count">
            {links.length} {links.length === 1 ? 'INTAKE' : 'INTAKES'}
          </span>
        )}
        <button className="btn btn-primary" onClick={() => setEdit('new')}>
          + New Recruitment
        </button>
      </div>

      <MailStatus />

      {links.length === 0 && (
        <div className="rc-empty">
          <ol className="rc-steps">
            {[
              ['Create a link', 'Pick the batch and how long it stays open.'],
              ['Share it', 'Copy the link or print the QR poster.'],
              ['Review', 'Accept or reject applicants; accepted ones get an email.'],
            ].map(([t, d], n) => (
              <li key={t}>
                <span className="rc-step-n">{n + 1}</span>
                <strong>{t}</strong>
                <span>{d}</span>
              </li>
            ))}
          </ol>
          <button className="btn btn-primary" onClick={() => setEdit('new')}>
            Create the first recruitment
          </button>
        </div>
      )}

      <div className="intake-list">
        {links.map((l) => {
          const total = l.pending + l.accepted + l.declined;
          return (
            <article
              key={l.id}
              className={`intake-card active-card${!l.open ? ' past-card' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setOpen(l.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen(l.id);
                }
              }}
            >
              <div className="card-top">
                <div className="card-details">
                  <h2>{l.title}</h2>
                  <div className="card-meta">
                    <span>Batch {l.batch}</span>
                    <span className="meta-separator">/</span>
                    <span>{plural(total, 'Applicant')}</span>
                    <span className="meta-separator">/</span>
                    <span>By {l.by}</span>
                    {l.pending > 0 ? (
                      <>
                        <span className="meta-separator">/</span>
                        <span className="intake-pending-badge">
                          <b>{l.pending}</b> to review
                        </span>
                      </>
                    ) : total > 0 ? (
                      <>
                        <span className="meta-separator">/</span>
                        <span className="intake-done-badge">All reviewed</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="card-right-col">
                  <div className="card-actions-top">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdit(l);
                      }}
                    >
                      {l.open ? 'Edit' : 'Reopen'}
                    </button>

                    {l.open && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          close(l);
                        }}
                      >
                        Close
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-sm btn-text-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(l);
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="status-group">
                    <span className={`status-dot${!l.open ? ' closed' : ''}`} aria-hidden="true" />
                    <span>{l.open ? 'Open' : 'Closed'}</span>
                    <span className="status-meta">
                      • {l.open ? left(l.closes) : `Closed ${day(l.closes)}`}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {earlier.length > 0 && (
          <article
            className="intake-card past-card"
            role="button"
            tabIndex={0}
            onClick={() => setOpen(EARLIER)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(EARLIER);
              }
            }}
          >
            <div className="card-top">
              <div className="card-details">
                <h2>Earlier applications</h2>
                <div className="card-meta">
                  <span>{plural(earlier.length, 'Applicant')}</span>
                  {earlier.filter((a) => a.status === 'pending').length > 0 && (
                    <>
                      <span className="meta-separator">/</span>
                      <span className="intake-pending-badge">
                        <b>{earlier.filter((a) => a.status === 'pending').length}</b> to review
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="card-right-col">
                <div className="status-group">
                  <span className="past-sub">Before recruitment links</span>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>
      {editor}
    </div>
  );
}

function Detail({
  link,
  list,
  back,
}: {
  link: RecruitLink | null;
  list: Applicant[];
  back: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onDelete?: () => void;
}) {
  const { toast, act } = useStore();
  const [showShare, setShowShare] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [viewQr, setViewQr] = useState(false);
  const copy = (l: RecruitLink) =>
    navigator.clipboard.writeText(urlOf(l)).then(
      () => toast('Link copied.'),
      () => toast('Copy failed. Select the link and copy it.', 'bad'),
    );
  const png = (l: RecruitLink) =>
    poster({
      url: urlOf(l),
      title: l.title,
      batch: l.batch,
      club: site.short,
      closes: when(l.closes),
    });
  const download = async (l: RecruitLink) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await png(l));
    a.download = `${site.short}-batch-${l.batch}-qr.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const share = async (l: RecruitLink) => {
    const file = new File([await png(l)], `${site.short}-batch-${l.batch}.png`, {
      type: 'image/png',
    });
    const text = `${l.title}: apply by ${when(l.closes)}`;
    try {
      if (navigator.canShare?.({ files: [file] }))
        return await navigator.share({
          files: [file],
          title: l.title,
          text: `${text}\n${urlOf(l)}`,
        });
      if (navigator.share) return await navigator.share({ title: l.title, text, url: urlOf(l) });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // the person closed the share sheet
    }
    await copy(l); // no share sheet on this device: the link is the next best thing
  };

  return (
    <div className="rc">
      {/* Red box combined into a single, thoughtful neo-brutalist card */}
      {/* Campaign Header Panel (matching design/recruit.html) */}
      <header className="header-panel">
        <div className="header-top">
          <button type="button" className="breadcrumb" onClick={back}>
            ← All recruitments
          </button>
          {link && (
            <div className="status-badge">
              <span className="status-dot" aria-hidden="true" />
              <span>
                {link.open
                  ? `OPEN UNTIL ${when(link.closes).toUpperCase()}`
                  : `CLOSED ${when(link.closes).toUpperCase()}`}
              </span>
            </div>
          )}
        </div>

        <div className="header-main">
          <div className="header-title">
            <h1>{link?.title ?? 'Earlier applications'}</h1>
            <p>
              {link
                ? `Batch ${link.batch} / Created by ${link.by} / On ${day(link.at)}`
                : 'From the old join page, or from deleted recruitments.'}
            </p>
          </div>

          {link && (
            <div className="header-actions">
              {link.open && (
                <button
                  type="button"
                  className={`btn ${showShare ? 'btn-black' : ''}`}
                  onClick={() => setShowShare((v) => !v)}
                  title={showShare ? 'Hide share link and QR' : 'Show share link and QR'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span>{showShare ? 'Hide Share' : 'Share'}</span>
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => setMailing(true)}
              >
                Acceptance email
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Yellow box (Share card) revealed only when Share button is pressed */}
      {showShare && link && link.open && (
        <section className="rc-share-card">
          <div className="rc-qr-box" onClick={() => setViewQr(true)} title="Click to enlarge QR">
            <QR text={urlOf(link)} size={124} />
          </div>
          <div className="rc-share-body">
            <div>
              <h2>Share this link</h2>
              <p>Applicants can scan the QR or open the link on any phone.</p>
            </div>
            <div className="rc-input-group">
              <input
                readOnly
                value={urlOf(link)}
                onFocus={(e) => e.target.select()}
                aria-label="Recruitment link"
              />
              <button className="btn btn-primary" onClick={() => copy(link)}>
                Copy
              </button>
            </div>
            <div className="rc-secondary-actions">
              <button className="btn line" onClick={() => share(link)}>
                Share
              </button>
              <button className="btn line" onClick={() => download(link)}>
                Download QR poster
              </button>
              <a className="btn line" href={urlOf(link)} target="_blank" rel="noreferrer">
                Preview form ↗
              </a>
            </div>
          </div>
        </section>
      )}

      <div className="section-header">
        <h2>Applicants</h2>
        {link && (
          <button className="btn" onClick={() => setImporting(true)}>
            Import CSV
          </button>
        )}
      </div>

      <MailStatus />
      <Applicants list={list} />

      {viewQr && link && (
        <Modal title={`QR Code · ${link.title}`} onClose={() => setViewQr(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
            <div style={{ background: '#fff', padding: 16, border: '1px solid var(--line2)' }}>
              <QR text={urlOf(link)} size={200} />
            </div>
            <p className="label dim" style={{ marginTop: 14, textAlign: 'center' }}>
              Scan with any mobile camera to apply directly.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => copy(link)}>
                Copy link
              </button>
              <button className="btn" onClick={() => download(link)}>
                Download poster PNG
              </button>
            </div>
          </div>
        </Modal>
      )}

      {importing && link && <ImportCsv link={link} onClose={() => setImporting(false)} />}
      {mailing && link && (
        <MailEditor
          kind="recruit"
          title={`Acceptance email · ${link.title}`}
          current={link.mail}
          sample={{ ...MAIL_SAMPLE.recruit, recruitment: link.title, batch: String(link.batch) }}
          onSave={(t) => act('recruitMail', { id: link.id, ...(t ?? { subject: '', html: '' }) })}
          onClose={() => setMailing(false)}
        />
      )}
    </div>
  );
}

function Applicants({ list }: { list: Applicant[] }) {
  const { act } = useStore();
  const sure = useConfirm(),
    ask = usePrompt();
  const [status, setStatus] = useState<Applicant['status']>('pending');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [openAnswers, setOpenAnswers] = useState<Set<string>>(new Set());

  const toggleAnswers = (id: string) => {
    setOpenAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const needle = q.trim().toLowerCase();
  const shown = list.filter(
    (a) =>
      a.status === status &&
      (!needle ||
        [a.name, a.sid, a.email, a.phone, a.dept].some((v) => v.toLowerCase().includes(needle))),
  );
  // Only pending applicants can be picked, and only those the officer can see right now.
  const sel = shown.filter((a) => picked.has(a.id));
  const all = status === 'pending' && shown.length > 0 && sel.length === shown.length;
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const decide = async (who: Applicant[], to: 'accepted' | 'declined') => {
    const one = who.length === 1 ? who[0]! : null;
    let reason: string | null = null;
    if (to === 'accepted') {
      const ok = await sure(
        one ? `Accept ${one.name}?` : `Accept ${who.length} applicants?`,
        one
          ? `Creates their account and emails ${one.email} a link to set their password.`
          : 'Each gets an account and an email with a link to set their password.',
        one ? 'Accept' : `Accept ${who.length}`,
      );
      if (!ok) return;
    } else {
      reason = await ask({
        title: one ? `Reject ${one.name}?` : `Reject ${who.length} applicants?`,
        label: 'Reason (optional). Saved in the audit log; applicants are not told.',
        placeholder: 'e.g. not a student here',
        confirmLabel: one ? 'Reject' : `Reject ${who.length}`,
        maxLength: 200,
        danger: true,
      });
      if (reason === null) return;
      if (reason.trim().length < 3) reason = '';
    }
    setBusy(true);
    const ok = one
      ? await act('decide', {
          kind: 'application',
          id: one.id,
          to,
          ...(reason ? { reason } : {}),
        })
      : await act('recruitDecide', {
          ids: who.map((a) => a.id),
          to,
          ...(reason ? { reason } : {}),
        });
    setBusy(false);
    if (ok) setPicked(new Set());
  };

  const count = (st: Applicant['status']) => list.filter((a) => a.status === st).length;
  return (
    <div className="rc-apps-wrap">
      <div className="controls-row">
        <div className="segmented-control" role="tablist">
          {STATUS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={status === k}
              className={`segment-btn${status === k ? ' active' : ''}`}
              onClick={() => {
                setStatus(k);
                setPicked(new Set());
              }}
            >
              <span>{label}</span>
              <span className="count-badge">{count(k)}</span>
            </button>
          ))}
        </div>
        <input
          className="search-input"
          type="search"
          placeholder="Search name, ID, email or phone..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search applicants"
        />
      </div>

      {status === 'pending' && shown.length > 0 && (
        <div className="bulk-actions">
          <input
            type="checkbox"
            id="selectAll"
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = sel.length > 0 && !all;
            }}
            onChange={() => setPicked(all ? new Set() : new Set(shown.map((a) => a.id)))}
          />
          <label htmlFor="selectAll" style={{ cursor: 'pointer', textTransform: 'uppercase' }}>
            {sel.length ? `${sel.length} of ${shown.length} selected` : `Select all ${shown.length}`}
          </label>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty-state">
          {needle
            ? 'Nobody matches that search.'
            : status === 'pending'
              ? 'Nobody is waiting for a decision.'
              : 'None yet.'}
        </div>
      ) : (
        <div className="applicant-list">
          {shown.map((a) => {
            const hasAnswers = !!a.why || a.answers.length > 0;
            const isAnswersOpen = openAnswers.has(a.id);
            return (
              <div key={a.id} className={`applicant-card${picked.has(a.id) ? ' picked' : ''}`}>
                <div
                  className="card-main"
                  aria-expanded={isAnswersOpen}
                  onClick={() => {
                    if (hasAnswers) toggleAnswers(a.id);
                  }}
                  role={hasAnswers ? 'button' : undefined}
                  tabIndex={hasAnswers ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (hasAnswers && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      toggleAnswers(a.id);
                    }
                  }}
                >
                  <div className="card-profile-col" onClick={(e) => e.stopPropagation()}>
                    {a.status === 'pending' ? (
                      <input
                        type="checkbox"
                        className="card-checkbox"
                        checked={picked.has(a.id)}
                        onChange={() => toggle(a.id)}
                        aria-label={`Select ${a.name}`}
                      />
                    ) : (
                      <div className="card-checkbox-spacer" />
                    )}

                    {a.photo ? (
                      <img className="avatar" src={`/api/recruit/photo/${a.id}`} alt="" loading="lazy" />
                    ) : (
                      <div className="avatar" title="No photo">
                        {a.name
                          .split(' ')
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                    )}
                  </div>

                  <div className="card-info">
                    <div className="name-row">
                      <span className="applicant-name">{a.name}</span>
                      <div className="tag-group">
                        <span className="tag">{a.sid}</span>
                        <span className="tag">{a.dept}</span>
                        <span className="tag">Batch {a.batch}</span>
                      </div>
                    </div>

                    <div className="meta-row">
                      <span className="contact-item">
                        <svg viewBox="0 0 24 24">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                        </svg>
                        <a href={`mailto:${a.email}`} onClick={(e) => e.stopPropagation()}>{a.email}</a>
                      </span>
                      {a.phone && (
                        <span className="contact-item">
                          <svg viewBox="0 0 24 24">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                          </svg>
                          <a href={`tel:${a.phone}`} onClick={(e) => e.stopPropagation()}>{a.phone}</a>
                        </span>
                      )}
                      {a.cf && (
                        <span className="contact-item">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                          </svg>
                          <a
                            href={`https://codeforces.com/profile/${encodeURIComponent(a.cf)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{a.cf}
                          </a>
                        </span>
                      )}
                      <span className="applied-meta">
                        {a.src === 'CSV import' ? 'Imported from CSV' : 'Applied'} {when(a.at)}
                      </span>
                    </div>
                  </div>

                  <div className="card-actions">
                    {a.status === 'pending' ? (
                      <>
                        <button
                          className="btn btn-black"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            decide([a], 'accepted');
                          }}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            decide([a], 'declined');
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <span className={`rc-verdict ${a.status}`}>
                          {a.status === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
                        </span>
                        {a.decidedBy && <div className="card-footer-meta" style={{ padding: 0, marginTop: 4 }}>by {a.decidedBy}</div>}
                        {a.reason && <div className="rc-reason" style={{ marginTop: 4 }}>“{a.reason}”</div>}
                      </div>
                    )}
                  </div>

                  {hasAnswers ? (
                    <div className="toggle-icon">▼</div>
                  ) : (
                    <div style={{ width: 24 }} />
                  )}
                </div>

                {hasAnswers && (
                  <div className={`answers-wrapper${isAnswersOpen ? ' open' : ''}`}>
                    <div className="answers-inner">
                      <div className="answers-content">
                        {a.why && (
                          <div className="qa-block">
                            <div className="qa-question">
                              <span className="qa-label">Q</span> What do you want to build or learn?
                            </div>
                            <div className="qa-answer">{a.why}</div>
                          </div>
                        )}
                        {a.answers.map((x, idx) => (
                          <div key={x.q ? `${x.q}-${idx}` : `ans-${idx}`} className="qa-block">
                            <div className="qa-question">
                              <span className="qa-label">Q</span> {x.q || `Question ${idx + 1}`}
                            </div>
                            <div className="qa-answer">{x.a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Floating Save Bar when items are selected */}
      <div className={`floating-save-bar${sel.length > 0 ? ' active' : ''}`}>
        <span className="floating-count">
          {sel.length} applicant{sel.length > 1 ? 's' : ''} selected
        </span>
        <div className="floating-actions">
          <button
            className="btn btn-outline-danger"
            disabled={busy}
            onClick={() => decide(sel, 'declined')}
          >
            Reject Selected
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => decide(sel, 'accepted')}
          >
            Accept Selected
          </button>
          <button
            className="btn btn-clear"
            onClick={() => setPicked(new Set())}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="cm-modal rc-modal">
        <header className="cm-modal-head">
          <h2 className="h3">{title}</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// datetime-local works in the viewer's local time; the API gets an ISO time with a zone.
const toLocal = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const inDays = (n: number) => {
  const d = new Date(Date.now() + n * 864e5);
  d.setHours(23, 59, 0, 0);
  return toLocal(d);
};
const PRESETS = [
  [3, '3 days'],
  [7, '1 week'],
  [14, '2 weeks'],
  [30, '1 month'],
] as const;
const COLUMN: Record<string, string> = {
  name: 'Name',
  sid: 'Student ID',
  dept: 'Department',
  email: 'Email',
  phone: 'Phone',
  cf: 'Codeforces',
};
const LOCKED = ['Photo', 'Full name', 'Student ID', 'Department', 'Batch', 'Email', 'Phone number'];

function LinkEditor({
  link,
  onClose,
}: {
  link: RecruitLink | null;
  onClose: (saved: boolean) => void;
}) {
  const { act } = useStore();
  const used = !!link && link.pending + link.accepted + link.declined > 0;
  const [batch, setBatch] = useState(link ? String(link.batch) : '');
  const [title, setTitle] = useState(link?.title ?? '');
  const [closes, setCloses] = useState(link?.open ? toLocal(new Date(link.closes)) : inDays(7));
  const [form, setForm] = useState<RecruitForm>(
    link?.form ?? { cf: true, why: true, questions: [] },
  );
  const [busy, setBusy] = useState(false);
  const check = checkForm(form);
  const b = Number(batch);
  const problem = !/^\d{1,2}$/.test(batch)
    ? 'Enter the batch number, like 27.'
    : title.trim() && (title.trim().length < 3 || title.trim().length > 80)
      ? 'The title must be 3 to 80 characters.'
      : !closes || Date.parse(closes) < Date.now() + 6e4
        ? 'The closing time must be in the future.'
        : Date.parse(closes) > Date.now() + RECRUIT.maxDays * 864e5
          ? `A link can stay open for at most ${RECRUIT.maxDays} days.`
          : check.error;
  const loud = problem && batch !== '' ? problem : null; // no red text before the officer has typed
  const q = (n: number, patch: Partial<RecruitForm['questions'][number]> | null) =>
    setForm((f) => ({
      ...f,
      questions:
        patch === null
          ? f.questions.filter((_, j) => j !== n)
          : f.questions.map((x, j) => (j === n ? { ...x, ...patch } : x)),
    }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    const ok = await act(link ? 'recruitUpdate' : 'recruitCreate', {
      ...(link && { id: link.id }),
      title: title.trim() || `Batch ${b} recruitment`,
      batch: b,
      closes: new Date(closes).toISOString(),
      form: check.value,
    });
    setBusy(false);
    if (ok) onClose(true);
  };
  return (
    <Modal
      title={link ? (link.open ? 'Edit recruitment' : 'Reopen recruitment') : 'New recruitment'}
      onClose={() => onClose(false)}
    >
      <form className="stack" style={{ '--g': '20px' } as React.CSSProperties} onSubmit={save}>
        <div className="rc-two">
          <label className="field">
            <span className="label">BATCH</span>
            <input
              className="input"
              inputMode="numeric"
              value={batch}
              maxLength={2}
              disabled={used}
              onChange={(e) => setBatch(e.target.value.replace(/\D/g, ''))}
              placeholder="27"
              autoFocus={!link}
            />
          </label>
          <label className="field">
            <span className="label">TITLE</span>
            <input
              className="input"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={batch ? `Batch ${batch} recruitment` : 'Batch 27 recruitment'}
            />
          </label>
        </div>

        <div className="field">
          <span className="label">OPEN UNTIL</span>
          <div className="row" style={{ '--g': '6px' } as React.CSSProperties}>
            {PRESETS.map(([n, l]) => (
              <button
                type="button"
                key={n}
                className={`tag tab ${closes === inDays(n) ? 'on' : ''}`}
                onClick={() => setCloses(inDays(n))}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="datetime-local"
            value={closes}
            min={toLocal(new Date())}
            onChange={(e) => setCloses(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="label">DEFAULT FIELDS</span>
          <div className="rc-tags-wrap">
            {LOCKED.map((f) => (
              <span key={f} className="tag rc-default-tag">
                ✓ {f.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">OPTIONAL QUESTIONS</span>
          <div className="stack" style={{ '--g': '8px' } as React.CSSProperties}>
            <label className={`rc-neo-check ${form.cf ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={form.cf}
                onChange={(e) => setForm({ ...form, cf: e.target.checked })}
              />
              <span>Codeforces handle</span>
            </label>
            <label className={`rc-neo-check ${form.why ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={form.why}
                onChange={(e) => setForm({ ...form, why: e.target.checked })}
              />
              <span>What do you want to build or learn?</span>
            </label>
            {form.questions.map((x, n) => (
              <div key={x.id} className="rc-q-row">
                <input
                  className="input sm"
                  value={x.label}
                  maxLength={120}
                  placeholder="Question text"
                  aria-label={`Question ${n + 1}`}
                  onChange={(e) => q(n, { label: e.target.value })}
                />
                <select
                  className="input sm"
                  value={x.long ? 'long' : 'short'}
                  onChange={(e) => q(n, { long: e.target.value === 'long' })}
                  aria-label="Answer length"
                >
                  <option value="short">Short answer</option>
                  <option value="long">Paragraph</option>
                </select>
                <button
                  type="button"
                  className="btn xs line rc-danger-btn"
                  onClick={() => q(n, null)}
                  aria-label={`Remove question ${n + 1}`}
                >
                  REMOVE
                </button>
              </div>
            ))}
            {form.questions.length < RECRUIT.maxQuestions && (
              <button
                type="button"
                className="btn xs line"
                style={{ alignSelf: 'flex-start' }}
                onClick={() =>
                  setForm({
                    ...form,
                    questions: [
                      ...form.questions,
                      { id: `q${Date.now().toString(36)}`, label: '', long: false },
                    ],
                  })
                }
              >
                + ADD A QUESTION
              </button>
            )}
          </div>
        </div>

        <div className="row between" style={{ '--g': '12px', marginTop: 8, alignItems: 'center' } as React.CSSProperties}>
          <div>
            {loud && (
              <span className="body bad" role="alert">
                {loud}
              </span>
            )}
          </div>
          <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
            <button type="button" className="btn sm line" onClick={() => onClose(false)}>
              CANCEL
            </button>
            <button className="btn sm btn-primary" disabled={!!problem || busy}>
              {busy ? 'SAVING…' : link ? (link.open ? 'SAVE' : 'REOPEN') : 'CREATE LINK'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ImportCsv({ link, onClose }: { link: RecruitLink; onClose: (done: boolean) => void }) {
  const { act } = useStore();
  const [parsed, setParsed] = useState<ReturnType<typeof readApplicantCsv> | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [busy, setBusy] = useState(false);
  const good = useMemo(
    () => parsed?.rows.filter((r) => !Object.keys(r.errors).length) ?? [],
    [parsed],
  );
  const bad = useMemo(
    () => parsed?.rows.filter((r) => Object.keys(r.errors).length) ?? [],
    [parsed],
  );
  const read = async (f?: File) => {
    setParsed(null);
    setFileErr('');
    if (!f) return;
    if (f.size > 2_000_000)
      return setFileErr('That file is over 2 MB. Split it into smaller files.');
    setParsed(readApplicantCsv(await f.text()));
  };
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;
  const tooMany = good.length > RECRUIT.importRows;
  const go = async () => {
    setBusy(true);
    const ok = await act('recruitImport', {
      id: link.id,
      rows: good.map(({ value: { name, sid, dept, email, phone, cf } }) => ({
        name,
        sid,
        dept,
        email,
        phone,
        cf,
      })),
    });
    setBusy(false);
    if (ok) onClose(true);
  };
  return (
    <Modal title={`Import CSV · ${link.title}`} onClose={() => onClose(false)}>
      <p>
        Rows become <b>pending</b> applicants for Batch {link.batch}; you still accept or reject
        each one. A CSV cannot carry photos.
      </p>
      <div className="row" style={{ '--g': '12px' } as React.CSSProperties}>
        <label className="btn sm">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr"
            onChange={(e) => read(e.target.files?.[0])}
          />
        </label>
        <a className="link" href={template} download="recruit-template.csv">
          Download the template
        </a>
      </div>
      {fileErr && (
        <p className="body bad" role="alert">
          {fileErr}
        </p>
      )}
      {parsed &&
        (parsed.missing.length ? (
          <p className="body bad" role="alert">
            Missing columns: {parsed.missing.join(', ')}. Use the template&apos;s header row.
          </p>
        ) : (
          <>
            <p>
              <b className="ok">{good.length} ready</b>
              {bad.length > 0 && (
                <>
                  {' · '}
                  <b className="bad">{bad.length} with problems</b> (skipped; fix them in the file
                  and import again)
                </>
              )}
            </p>
            {bad.length > 0 && (
              <div className="scroll-x rc-preview">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bad.slice(0, 50).map((r) => (
                      <tr key={r.row}>
                        <td className="mono">{r.row}</td>
                        <td>{r.value.name || '–'}</td>
                        <td>
                          {Object.entries(r.errors)
                            .map(([k, v]) => `${COLUMN[k] ?? k}: ${v}`)
                            .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tooMany && (
              <p className="body bad" role="alert">
                At most {RECRUIT.importRows} rows per import. Split the file.
              </p>
            )}
            <div
              className="row"
              style={{ '--g': '8px', justifyContent: 'flex-end' } as React.CSSProperties}
            >
              <button className="btn sm" disabled={!good.length || tooMany || busy} onClick={go}>
                {busy ? 'Adding…' : `Add ${good.length} for review`}
              </button>
            </div>
          </>
        ))}
    </Modal>
  );
}
