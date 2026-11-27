'use client';
import { useMore } from '@/components/site/More';
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

const applicantPane =
  'max-[861px]:[.job-detail-modal_&]:[flex-basis:100%] max-[861px]:[.job-detail-modal_&]:p-[24px_20px] flex flex-col gap-5';

const applicantHead =
  '[&_.label]:mt-[4px] [&_.label]:normal-case [&_.label]:tracking-[0.02em] flex items-end justify-between gap-[12px_20px] flex-wrap';

const checkLabel =
  '[&_input]:w-[18px] [&_input]:h-[18px] [&_input]:[accent-color:var(--acc)] [&_input]:cursor-pointer flex items-center gap-2.5 min-h-[40px] cursor-pointer';

const rcBadgeCls =
  'py-1.5 px-3 inline-flex items-baseline gap-1.5 [border:0] rounded-[999px] [background:color-mix(in_srgb,#d4a72c_22%,transparent)] text-hi font-label text-[14px] cursor-pointer [&_b]:text-[16px]';

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
    <div className={applicantPane}>
      <div className={applicantHead}>
        <div>
          <h2 className="h3">Recruitments</h2>
          <p className="label">One link per intake. Open one to share it and review applicants.</p>
        </div>
        <button className="btn sm" onClick={() => setEdit('new')}>
          + New recruitment
        </button>
      </div>

      <MailStatus />

      {links.length === 0 && (
        <div className="[display:grid] gap-6 [justify-items:start] p-[clamp(20px,3vw,32px)] [background:var(--panel)] [border:1px_dashed_var(--line2)]">
          <ol className="[&_li]:[display:grid] [&_li]:gap-1.5 [&_li]:[color:var(--mut)] [&_strong]:text-hi [display:grid] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-5 w-full">
            {[
              ['Create a link', 'Pick the batch and how long it stays open.'],
              ['Share it', 'Copy the link or print the QR poster.'],
              ['Review', 'Accept or reject applicants; accepted ones get an email.'],
            ].map(([t, d], n) => (
              <li key={t}>
                <span className="[display:grid] [place-items:center] w-[32px] h-[32px] rounded-[50%] [background:var(--acc)] text-on font-label text-[15px]">
                  {n + 1}
                </span>
                <strong>{t}</strong>
                <span>{d}</span>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={() => setEdit('new')}>
            Create the first recruitment
          </button>
        </div>
      )}

      <ul className="[display:grid] gap-3">
        {links.map((l) => {
          const total = l.pending + l.accepted + l.declined;
          return (
            <li
              key={l.id}
              className={`rc-row${l.open ? ' is-open [&_.rc-row-status]:text-[#1a7f37]' : ''}`}
            >
              <button className="rc-row-main" onClick={() => setOpen(l.id)}>
                <span className="rc-row-status">
                  <i aria-hidden />
                  {l.open ? `Open · ${left(l.closes)}` : `Closed ${day(l.closes)}`}
                </span>
                <span className="rc-row-title">{l.title}</span>
                <span className="rc-row-meta">
                  Batch {l.batch} · {plural(total, 'applicant')} · by {l.by}
                </span>
                {total > 0 && (
                  <span
                    className="flex h-1.5 max-w-80 mt-1 rounded-[3px] overflow-hidden bg-line [&_.p]:bg-[#d4a72c] [&_.a]:bg-[#2da44e] [&_.d]:bg-bad"
                    aria-hidden
                  >
                    <i className="p" style={{ flex: l.pending }} />
                    <i className="a" style={{ flex: l.accepted }} />
                    <i className="d" style={{ flex: l.declined }} />
                  </span>
                )}
              </button>
              <div className="rc-row-side">
                {l.pending > 0 ? (
                  <button className={rcBadgeCls} onClick={() => setOpen(l.id)}>
                    <b>{l.pending}</b> to review
                  </button>
                ) : (
                  <span className="label dim">{total ? 'all reviewed' : 'no applicants yet'}</span>
                )}
                <div className="rc-row-actions">
                  <button className="btn xs line" onClick={() => setEdit(l)}>
                    {l.open ? 'Edit' : 'Reopen'}
                  </button>
                  {l.open && (
                    <button className="btn xs line" onClick={() => close(l)}>
                      Close
                    </button>
                  )}
                  <button
                    className="btn xs line hover:text-bad hover:border-bad"
                    onClick={() => remove(l)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {earlier.length > 0 && (
          <li className="rc-row">
            <button className="rc-row-main" onClick={() => setOpen(EARLIER)}>
              <span className="rc-row-status">Before recruitment links</span>
              <span className="rc-row-title">Earlier applications</span>
              <span className="rc-row-meta">{plural(earlier.length, 'applicant')}</span>
            </button>
            <div className="rc-row-side">
              {earlier.some((a) => a.status === 'pending') && (
                <button className={rcBadgeCls} onClick={() => setOpen(EARLIER)}>
                  <b>{earlier.filter((a) => a.status === 'pending').length}</b> to review
                </button>
              )}
            </div>
          </li>
        )}
      </ul>
      {editor}
    </div>
  );
}

function Detail({
  link,
  list,
  back,
  onEdit,
  onClose,
  onDelete,
}: {
  link: RecruitLink | null;
  list: Applicant[];
  back: () => void;
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { toast, act } = useStore();
  const [importing, setImporting] = useState(false);
  const [mailing, setMailing] = useState(false);
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
    <div className={applicantPane}>
      <button
        className="self-start [background:none] [border:0] p-[6px_0] [color:var(--mut)] font-label text-[14px] cursor-pointer hover:text-acc focus-visible:text-acc"
        onClick={back}
      >
        ← All recruitments
      </button>
      <div className={applicantHead}>
        <div>
          {link && (
            <span className={`rc-row-status${link.open ? ' on' : ''}`}>
              <i aria-hidden />
              {link.open ? `Open until ${when(link.closes)}` : `Closed ${when(link.closes)}`}
            </span>
          )}
          <h2 className="h2 mt-1.5 wrap-anywhere">{link?.title ?? 'Earlier applications'}</h2>
          <p className="label">
            {link
              ? `Batch ${link.batch} · created by ${link.by} on ${day(link.at)}`
              : 'From the old join page, or from deleted recruitments.'}
          </p>
        </div>
        {link && (
          <div className="rc-row-actions">
            <button className="btn xs line" onClick={onEdit}>
              {link.open ? 'Edit' : 'Reopen'}
            </button>
            <button className="btn xs line" onClick={() => setMailing(true)}>
              Acceptance email
            </button>
            {link.open && (
              <button className="btn xs line" onClick={onClose}>
                Close now
              </button>
            )}
            <button className="btn xs line hover:text-bad hover:border-bad" onClick={onDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {link &&
        (link.open ? (
          <section className="flex gap-6 items-center p-5 [background:var(--panel)] [border:1px_solid_var(--line)] max-[721px]:flex-col max-[721px]:items-start">
            <div className="p-2 [background:#fff] [border:1px_solid_var(--line)] flex-none leading-[0]">
              <QR text={urlOf(link)} size={136} />
            </div>
            <div className="[&_.label]:normal-case [&_.label]:tracking-[0.02em] flex flex-col gap-2.5 min-w-0 flex-1">
              <p className="h3">Share this link</p>
              <p className="label">Applicants can scan the QR or open the link on any phone.</p>
              <div className="[&_.input]:font-label [&_.input]:text-[14px] [&_.input]:min-w-0 flex gap-2 max-w-[560px]">
                <input
                  className="input sm"
                  readOnly
                  value={urlOf(link)}
                  onFocus={(e) => e.target.select()}
                  aria-label="Recruitment link"
                />
                <button className="btn sm" onClick={() => copy(link)}>
                  Copy
                </button>
              </div>
              <div className="rc-row-actions">
                <button className="btn xs" onClick={() => share(link)}>
                  Share
                </button>
                <button className="btn xs line" onClick={() => download(link)}>
                  Download QR poster
                </button>
                <a className="btn xs line" href={urlOf(link)} target="_blank" rel="noreferrer">
                  Preview form ↗
                </a>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex gap-6 items-center p-5 [background:var(--panel)] [border:1px_solid_var(--line)] justify-between flex-wrap [&&]:border-dashed max-[721px]:flex-col max-[721px]:items-start closed">
            <p className="body">This link is closed, so nobody can apply.</p>
            <button className="btn sm" onClick={onEdit}>
              Reopen
            </button>
          </section>
        ))}

      <div className={applicantHead}>
        <h3 className="h3">Applicants</h3>
        {link && (
          <button className="btn xs line" onClick={() => setImporting(true)}>
            Import CSV
          </button>
        )}
      </div>
      <MailStatus />
      <Applicants list={list} />
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

  const needle = q.trim().toLowerCase();
  const shown = list.filter(
    (a) =>
      a.status === status &&
      (!needle ||
        [a.name, a.sid, a.email, a.phone, a.dept].some((v) => v.toLowerCase().includes(needle))),
  );
  const [page, more] = useMore(shown, 40);
  // Only pending applicants matching the filter can be picked. The box picks the rows on screen; picking every
  // match (some not loaded yet) is a second, explicit step, and the confirmation says how many are off screen.
  const sel = shown.filter((a) => picked.has(a.id));
  const pageAll = status === 'pending' && page.length > 0 && page.every((a) => picked.has(a.id));
  const everyMatch = sel.length === shown.length;
  const offScreen = sel.length - page.filter((a) => picked.has(a.id)).length;
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
          : `Each gets an account and an email with a link to set their password.${offScreen > 0 ? ` ${offScreen} of them are not on screen.` : ''}`,
        one ? 'Accept' : `Accept ${who.length}`,
      );
      if (!ok) return;
    } else {
      reason = await ask({
        title: one
          ? `Reject ${one.name}?`
          : `Reject ${who.length} applicants?${offScreen > 0 ? ` (${offScreen} not on screen)` : ''}`,
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
      <div className="flex justify-between gap-3 flex-wrap">
        <div className="rc-seg" role="tablist">
          {STATUS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={status === k}
              className={status === k ? 'on' : ''}
              onClick={() => {
                setStatus(k);
                setPicked(new Set());
              }}
            >
              {label} <b>{count(k)}</b>
            </button>
          ))}
        </div>
        <input
          className="input sm rc-search"
          type="search"
          placeholder="Search name, ID, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search applicants"
        />
      </div>

      {status === 'pending' && shown.length > 0 && (
        <div className={`rc-bulk${sel.length ? ' on' : ''}`}>
          <label className="inline-flex items-center gap-2.5 font-label text-[14px] cursor-pointer [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:[accent-color:var(--acc)] [&_input]:cursor-pointer">
            <input
              type="checkbox"
              checked={pageAll}
              ref={(el) => {
                if (el) el.indeterminate = sel.length > 0 && !pageAll;
              }}
              onChange={() =>
                setPicked(pageAll ? new Set() : new Set([...sel, ...page].map((a) => a.id)))
              }
            />
            {sel.length
              ? `${sel.length} selected`
              : page.length < shown.length
                ? `Select the ${page.length} shown`
                : `Select all ${shown.length}`}
          </label>
          {pageAll && shown.length > page.length && (
            <button
              type="button"
              className="link text-[14px] [background:none] [border:0] cursor-pointer underline"
              onClick={() => setPicked(everyMatch ? new Set() : new Set(shown.map((a) => a.id)))}
            >
              {everyMatch
                ? `All ${shown.length} matching selected · clear`
                : `Select all ${shown.length} matching`}
            </button>
          )}
          {sel.length > 0 && (
            <div className="rc-row-actions">
              <button className="btn xs" disabled={busy} onClick={() => decide(sel, 'accepted')}>
                Accept {sel.length}
              </button>
              <button
                className="btn xs line"
                disabled={busy}
                onClick={() => decide(sel, 'declined')}
              >
                Reject {sel.length}
              </button>
              <button className="btn xs line" onClick={() => setPicked(new Set())}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="p-8 text-center [color:var(--dim)] [border:1px_dashed_var(--line)]">
          {needle
            ? 'Nobody matches that search.'
            : status === 'pending'
              ? 'Nobody is waiting for a decision.'
              : 'None yet.'}
        </p>
      ) : (
        <ul className="rc-apps">
          {page.map((a) => (
            <li key={a.id} className={`rc-app${picked.has(a.id) ? ' picked' : ''}`}>
              {a.status === 'pending' && (
                <input
                  type="checkbox"
                  className="rc-pick w-[18px] h-[18px] [accent-color:var(--acc)] cursor-pointer mt-5.5 max-[721px]:mt-3.5"
                  checked={picked.has(a.id)}
                  onChange={() => toggle(a.id)}
                  aria-label={`Select ${a.name}`}
                />
              )}
              {a.photo ? (
                <img
                  className="w-[64px] h-[64px] rounded-[50%] object-cover [background:var(--line)] max-[721px]:w-[48px] max-[721px]:h-[48px]"
                  src={`/api/recruit/photo/${a.id}`}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span
                  className="w-[64px] h-[64px] rounded-[50%] object-cover [background:var(--line)] max-[721px]:w-[48px] max-[721px]:h-[48px] [display:grid] [place-items:center] font-label text-[20px] [color:var(--mut)]"
                  title="No photo (imported from a CSV)"
                >
                  {a.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}
                </span>
              )}
              <div className="flex flex-col gap-[4px] min-w-0 [&_strong]:text-[17px] [&_strong]:text-hi">
                <strong>{a.name}</strong>
                <span className="[color:var(--dim)] text-[14px] font-label">
                  {a.sid} · {a.dept} · Batch {a.batch}
                </span>
                <span className="rc-contact">
                  <a href={`mailto:${a.email}`}>{a.email}</a>
                  {a.phone && <a href={`tel:${a.phone}`}>{a.phone}</a>}
                  {a.cf && (
                    <a
                      href={`https://codeforces.com/profile/${encodeURIComponent(a.cf)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Codeforces @{a.cf}
                    </a>
                  )}
                </span>
                {(a.why || a.answers.length > 0) && (
                  <details className="rc-more">
                    <summary>{plural(a.answers.length + (a.why ? 1 : 0), 'answer')}</summary>
                    <dl>
                      {a.why && (
                        <div>
                          <dt>What do you want to build or learn?</dt>
                          <dd>{a.why}</dd>
                        </div>
                      )}
                      {a.answers.map((x) => (
                        <div key={x.q}>
                          <dt>{x.q}</dt>
                          <dd>{x.a}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
                <span className="[color:var(--dim)] text-[14px]">
                  {a.src === 'CSV import' ? 'Imported from CSV' : 'Applied'} {when(a.at)}
                </span>
              </div>
              <div className="flex flex-col items-stretch gap-2 min-w-[96px] text-right max-[721px]:[grid-column:1_/_-1] max-[721px]:flex-row max-[721px]:flex-wrap max-[721px]:items-center max-[721px]:text-left">
                {a.status === 'pending' ? (
                  <>
                    <button
                      className="btn xs"
                      disabled={busy}
                      onClick={() => decide([a], 'accepted')}
                    >
                      Accept
                    </button>
                    <button
                      className="btn xs line"
                      disabled={busy}
                      onClick={() => decide([a], 'declined')}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`rc-verdict ${a.status}`}>
                      {a.status === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
                    </span>
                    {a.decidedBy && (
                      <span className="[color:var(--dim)] text-[14px]">by {a.decidedBy}</span>
                    )}
                    {a.reason && (
                      <span className="max-w-[28ch] text-[14px] [color:var(--mut)] italic">
                        “{a.reason}”
                      </span>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {more}
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
      <div className="cm-modal">
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
      <form className="stack [--g:20px]" onSubmit={save}>
        <div className="[display:grid] grid-cols-[180px_1fr] gap-4 max-[721px]:grid-cols-[1fr]">
          <label className="field">
            <span className="label">Batch</span>
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
            <span className="label dim">
              {used ? 'Locked: people applied.' : 'Fixed for applicants.'}
            </span>
          </label>
          <label className="field">
            <span className="label">Title</span>
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
          <span className="label">Open until</span>
          <div className="row [--g:8px]">
            {PRESETS.map(([n, l]) => (
              <button
                type="button"
                key={n}
                className={`tag ${closes === inDays(n) ? 'on' : ''}`}
                onClick={() => setCloses(inDays(n))}
              >
                {l}
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
          <span className="label">Always asked · required</span>
          <div className="flex flex-wrap gap-1.5">
            {LOCKED.map((f) => (
              <span key={f} className="tag">
                🔒 {f}
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Optional questions</span>
          <label className={checkLabel}>
            <input
              type="checkbox"
              checked={form.cf}
              onChange={(e) => setForm({ ...form, cf: e.target.checked })}
            />
            Codeforces handle
          </label>
          <label className={checkLabel}>
            <input
              type="checkbox"
              checked={form.why}
              onChange={(e) => setForm({ ...form, why: e.target.checked })}
            />
            What do you want to build or learn?
          </label>
          {form.questions.map((x, n) => (
            <div
              key={x.id}
              className="[display:grid] grid-cols-[1fr_auto_auto] gap-2 max-[721px]:grid-cols-[1fr]"
            >
              <input
                className="input sm"
                value={x.label}
                maxLength={120}
                placeholder="Your question"
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
                className="btn xs line"
                onClick={() => q(n, null)}
                aria-label={`Remove question ${n + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          {form.questions.length < RECRUIT.maxQuestions && (
            <button
              type="button"
              className="btn xs line self-start"

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
              + Add a question
            </button>
          )}
          <span className="label dim">Extra questions are always optional for applicants.</span>
        </div>

        <div className="row between [--g:12px]">
          <span className={loud ? 'body bad' : 'label'} role={loud ? 'alert' : undefined}>
            {loud ??
              (problem
                ? 'Enter the batch to continue.'
                : link
                  ? 'Changes apply to the live form at once.'
                  : 'You get a link and a QR to share.')}
          </span>
          <button className="btn sm" disabled={!!problem || busy}>
            {busy ? 'Saving…' : link ? (link.open ? 'Save' : 'Reopen') : 'Create link'}
          </button>
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
      <div className="row [--g:12px]">
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
              <div className="scroll-x max-h-[260px] overflow-y-auto">
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
            <div className="row [--g:8px] justify-end">
              <button className="btn sm" disabled={!good.length || tooMany || busy} onClick={go}>
                {busy ? 'Adding…' : `Add ${good.length} for review`}
              </button>
            </div>
          </>
        ))}
    </Modal>
  );
}
