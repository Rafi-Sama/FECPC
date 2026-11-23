'use client';

import { SaveForm } from '@/components/app/SaveBar';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { EventAdmin } from '@/components/app/events/EventAdmin';
import { SignUp } from '@/components/app/events/SignUp';
import { CertPreview } from '@/components/app/events/CertPreview';
import { EventHead } from '@/components/app/events/EventHead';
import { useStore } from '@/components/app/Store';
import { EVENT_STATUS_LABEL, type EventDetail } from '@fecpc/contracts';
import { clubNow, liveStatus, renderCertificate, useEventsQuery } from '@/lib/events';

const CERT_NAME: Record<string, string> = {
  participant: 'Participation',
  winner1: '1st place',
  winner2: '2nd place',
  winner3: '3rd place',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: e, reload } = useEventsQuery<EventDetail>({ action: 'event', id });
  if (e === null) notFound();
  if (!e) return <div className="page" aria-busy="true" />;

  const entry = (roleId: number | null) => e.mine.find((x) => x.roleId === roleId);
  const tookPart = e.mine.some((x) => x.status === 'approved');
  const over = e.status === 'completed' || e.status === 'cancelled';
  const left = e.seats === null ? null : Math.max(0, e.seats - e.taken);
  const certName = (k: string) =>
    CERT_NAME[k] ?? e.roles.find((r) => `role:${r.id}` === k)?.title ?? k;

  const renderMemberParticipation = (isOrg = false) => (
    <div className="stack" style={{ gap: '1rem' }}>
      {e.certificates.length ? (
        <section className="sidebar-panel">
          <div className="sidebar-header">
            <span>Your certificates</span>
          </div>
          <div className="sidebar-content stack">
            {e.certificates.map((c) => (
              <div key={c.code} className="stack">
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  {certName(c.kind)} <span className="text-dim">({c.code})</span>
                </span>
                <CertPreview html={c.html} title={`${certName(c.kind)} certificate preview`} />
                <div className="row">
                  <span className="mono text-dim" style={{ fontSize: 11 }}>
                    Download:
                  </span>
                  {(['png', 'jpeg'] as const).map((t) => (
                    <button
                      key={t}
                      className="btn xs solid"
                      type="button"
                      onClick={() => renderCertificate(c.html, t, `${e.id}-${c.code}`)}
                    >
                      {t === 'png' ? 'PNG' : 'JPG'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : e.status === 'completed' && tookPart ? (
        <section className="sidebar-panel">
          <div className="sidebar-header">
            <span>Your certificates</span>
          </div>
          <div className="sidebar-content">
            <p className="mono text-dim" style={{ fontSize: 12 }}>
              Not issued yet. They will appear here to download.
            </p>
          </div>
        </section>
      ) : (
        <section className="sidebar-panel">
          <div className="sidebar-header">
            <span>Participate</span>
            {e.mode === 'platform' && left !== null && (
              <span className="mono text-dim" style={{ fontSize: 11 }}>
                {left} of {e.seats} left
              </span>
            )}
          </div>
          <div className="sidebar-content stack">
            <SignUp
              eventId={e.id}
              mode={e.mode}
              formUrl={e.formUrl}
              fields={e.fields}
              entry={entry(null)}
              open={e.regOpen && left !== 0}
              locked={over}
              closedText={
                over
                  ? `This event is ${e.status}.`
                  : left === 0 && e.regOpen
                    ? 'Full.'
                    : 'Registration is not open.'
              }
              done={reload}
            />
            {e.fee > 0 && entry(null)?.status === 'approved' && (
              <Link className="btn xs line" href="/app/finance">
                Pay ৳{e.fee}
              </Link>
            )}
          </div>
        </section>
      )}

      {e.status === 'completed' && tookPart && <FeedbackForm e={e} done={reload} />}
      {['open', 'closed', 'ongoing'].includes(e.status) &&
        (e.admin ||
          (entry(null)?.status === 'approved' &&
            e.startsAt.slice(0, 10) <= clubNow().slice(0, 10))) && <CheckIn e={e} />}

      {!over &&
        !isOrg &&
        e.roles.map((r) => (
          <section key={r.id} className="sidebar-panel">
            <div className="sidebar-header">
              <span>{r.title}</span>
            </div>
            <div className="sidebar-content stack">
              {r.about && (
                <span className="mono text-dim" style={{ fontSize: 12 }}>
                  {r.about}
                </span>
              )}
              <SignUp
                eventId={e.id}
                roleId={r.id}
                mode={r.mode}
                formUrl={r.formUrl}
                fields={r.fields}
                entry={entry(r.id)}
                open={['published', 'open', 'closed'].includes(e.status)}
                closedText="Applications are closed."
                done={reload}
              />
            </div>
          </section>
        ))}
    </div>
  );

  return (
    <div className="page ev-detail">
      <div className="breadcrumbs">
        <Link href="/app/events">Events</Link> / {e.title}
      </div>

      <div className="layout-grid">
        {/* Left Column: The Event Canvas */}
        <EventHead e={e} reload={reload} />

        {/* Right Column: The Command Sidebar */}
        <aside className="sidebar">
          {e.admin ? (
            <>
              <EventAdmin e={e} reload={reload} />
              {(tookPart || e.certificates.length > 0) && (
                <details>
                  <summary>My Attendance &amp; Certificates</summary>
                  <div className="details-content">{renderMemberParticipation(true)}</div>
                </details>
              )}
            </>
          ) : (
            <>
              <div className="sidebar-panel">
                <div className="sidebar-header">
                  <span>Status</span>
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
                      style={{ background: '#1a7f37', borderColor: '#1a7f37', color: 'white' }}
                    >
                      {(liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]).toUpperCase()}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--mut)' }}>
                    {e.regOpen
                      ? 'Sign-up is currently open.'
                      : over
                        ? `Event is ${e.status}.`
                        : 'Sign-up is currently closed.'}
                    {left !== null && ` · ${left} of ${e.seats} seats left`}
                  </div>
                </div>
              </div>
              {renderMemberParticipation(false)}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The room code on the projector marks you present (+XP). Organisers see the code here. */
function CheckIn({ e }: { e: EventDetail }) {
  const { s, act } = useStore();
  const [code, setCode] = useState('');
  const room = e.admin?.checkin;
  const approved = e.mine.some((x) => x.roleId === null && x.status === 'approved');
  return (
    <form
      className="sidebar-panel"
      onSubmit={async (x) => {
        x.preventDefault();
        if (await act('attend', { eventId: e.id, code })) setCode('');
      }}
    >
      <div className="sidebar-header">
        <span>Check in</span>
      </div>
      <div className="sidebar-content stack">
        {room && (
          <div className="ev-code" style={{ marginBottom: 12 }}>
            <span className="mono text-dim" style={{ fontSize: 11 }}>
              ROOM CODE
            </span>
            <span
              className="mono"
              style={{ fontSize: 32, fontWeight: 700, letterSpacing: '0.1em' }}
            >
              {room.code}
            </span>
            <span className="mono text-dim" style={{ fontSize: 12 }}>
              {room.arrived} checked in
            </span>
          </div>
        )}
        {!approved ? null : s.present.includes(e.id) ? (
          <p className="ok">You are checked in.</p>
        ) : (
          <div className="row">
            <input
              className="form-control"
              aria-label="Room code"
              placeholder="Code on the projector"
              value={code}
              maxLength={12}
              onChange={(x) => setCode(x.target.value)}
            />
            <button className="btn xs solid" disabled={code.trim().length < 4}>
              Check in
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

function FeedbackForm({ e, done }: { e: EventDetail; done: () => void }) {
  const { act, toast } = useStore();
  const [rating, setRating] = useState(0); // 0 = not rated yet
  const [body, setBody] = useState('');
  if (e.feedback)
    return (
      <section className="sidebar-panel">
        <div className="sidebar-header">
          <span>Feedback</span>
        </div>
        <div className="sidebar-content">
          <p className="ok">Thanks. You rated it {e.feedback.rating}/5.</p>
        </div>
      </section>
    );
  return (
    <SaveForm
      className="sidebar-panel stack"
      label="Feedback not sent"
      saveLabel="Send feedback"
      extraDirty={rating > 0}
      onDiscard={() => {
        setRating(0);
        setBody('');
      }}
      onSubmit={async () => {
        if (!rating) {
          toast('Pick a rating from 1 to 5 first.', 'bad');
          return false;
        }
        const ok = await act('eventFeedback', { eventId: e.id, rating, body: body.trim() });
        if (ok) done();
        return ok;
      }}
    >
      <div className="sidebar-header">
        <span>How was it?</span>
      </div>
      <div className="sidebar-content stack">
        <div className="row" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={rating === v}
              className={`tag tab ${rating === v ? 'on' : ''}`}
              onClick={() => setRating(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <textarea
          className="form-control"
          aria-label="What should change next time?"
          placeholder="What should change next time?"
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(x) => setBody(x.target.value)}
        />
      </div>
    </SaveForm>
  );
}
