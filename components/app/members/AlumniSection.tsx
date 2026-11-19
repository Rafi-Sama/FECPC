"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/components/app/Store";
import { canFully, isAdmin } from "@/lib/permissions";
import type { AlumniJob, MemberProfile } from "@/lib/state";

function fmtShortDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function AlumniSection({
  profile,
  onReload,
}: {
  profile: MemberProfile;
  onReload: () => Promise<void> | void;
}) {
  const { s, me, act } = useStore();
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  if (!profile.is_alumni) return null;

  const isOwner = me.id === profile.id;
  const admin = isAdmin(s.role);
  const canPost = (isOwner && canFully(s.role, "alumni.job.post")) || admin;
  const canDeleteJob = (j: AlumniJob) => j.alumni_id === me.id || admin;

  const prep = profile.interview_prep ?? [];
  const fetched = profile.jobs_fetched ?? [];
  const manual = profile.jobs_manual ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ok = await act("createAlumniJob", {
        company,
        role,
        location,
        url,
        ...(admin && !isOwner ? { alumniId: profile.id } : {}),
      });
      if (ok) {
        setCompany("");
        setRole("");
        setLocation("");
        setUrl("");
        setAdding(false);
        await onReload();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (jobId: number) => {
    if (!window.confirm("Delete this job listing?")) return;
    const ok = await act("deleteAlumniJob", { jobId });
    if (ok) await onReload();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "fetchAlumniJobs", userId: profile.id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { added: number };
        setSyncMsg(data.added > 0 ? `Synced ${data.added} new listing${data.added === 1 ? "" : "s"}.` : "Job boards are up to date.");
        await onReload();
      } else {
        setSyncMsg("Could not reach job boards right now.");
      }
    } catch {
      setSyncMsg("Could not reach job boards right now.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <section className="profile-section" aria-label="Interview prep">
        <div className="profile-section__head">
          <h3 className="profile-section__label">· Interview prep</h3>
        </div>
        {prep.length === 0 ? (
          <p className="body" style={{ fontSize: 14 }}>
            No interview prep posts yet.
          </p>
        ) : (
          <ul className="list">
            {prep.map((p) => (
              <li key={p.id}>
                <span className="grow">
                  <strong>{p.title}</strong>
                </span>
                <span className="label" style={{ fontSize: 12 }}>
                  {fmtShortDate(p.created_at)}
                </span>
                <Link
                  href={`/app/community?tab=feed&post=${p.id}`}
                  className="profile-modal__link"
                >
                  Open ↗
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-section" aria-label="Jobs">
        <div className="profile-section__head">
          <h3 className="profile-section__label">· Jobs</h3>
          {canPost && (
            <div className="row" style={{ "--g": "6px" } as React.CSSProperties}>
              <button
                type="button"
                className="btn xs line"
                disabled={syncing}
                onClick={handleSync}
              >
                {syncing ? "Syncing…" : "Sync boards"}
              </button>
              <button
                type="button"
                className="btn xs line"
                onClick={() => setAdding((v) => !v)}
              >
                {adding ? "Close" : "+ Post job"}
              </button>
            </div>
          )}
        </div>

        {syncMsg && (
          <p className="label" style={{ fontSize: 12 }} role="status">
            {syncMsg}
          </p>
        )}

        {adding && canPost && (
          <form className="profile-edit-job-form" onSubmit={handleCreate}>
            <label className="profile-edit-field">
              <span className="label" style={{ fontSize: 11 }}>Company</span>
              <input
                className="member-filter-ctrl"
                required
                minLength={2}
                maxLength={100}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. bKash Engineering"
              />
            </label>
            <label className="profile-edit-field">
              <span className="label" style={{ fontSize: 11 }}>Role</span>
              <input
                className="member-filter-ctrl"
                required
                minLength={2}
                maxLength={120}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Junior Backend Engineer"
              />
            </label>
            <label className="profile-edit-field">
              <span className="label" style={{ fontSize: 11 }}>Location</span>
              <input
                className="member-filter-ctrl"
                maxLength={100}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dhaka / Remote"
              />
            </label>
            <label className="profile-edit-field">
              <span className="label" style={{ fontSize: 11 }}>Application URL</span>
              <input
                className="member-filter-ctrl"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn xs line" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="submit" className="btn xs" disabled={saving}>
                {saving ? "Saving…" : "Publish job"}
              </button>
            </div>
          </form>
        )}

        {fetched.length > 0 && (
          <div>
            <p className="label" style={{ fontSize: 11, marginBottom: 4 }}>
              Fetched
            </p>
            <ul className="list">
              {fetched.map((j) => (
                <li key={j.id}>
                  <span className="grow">
                    <strong>{j.company}</strong> · {j.role}
                    {j.location && (
                      <>
                        <br />
                        <span className="label" style={{ fontSize: 11 }}>
                          {j.location}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="tag" style={{ fontSize: 11, padding: "2px 6px", cursor: "default" }}>
                    fetched
                  </span>
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn xs line"
                  >
                    Apply ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="label" style={{ fontSize: 11, marginBottom: 4 }}>
            Manual
          </p>
          {manual.length === 0 ? (
            <p className="profile-empty-dash">—</p>
          ) : (
            <ul className="list">
              {manual.map((j) => (
                <li key={j.id}>
                  <span className="grow">
                    <strong>{j.company}</strong> · {j.role}
                    {j.location && (
                      <>
                        <br />
                        <span className="label" style={{ fontSize: 11 }}>
                          {j.location}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="tag" style={{ fontSize: 11, padding: "2px 6px", cursor: "default" }}>
                    manual
                  </span>
                  {canDeleteJob(j) && (
                    <button
                      type="button"
                      className="btn xs line"
                      onClick={() => handleDelete(j.id)}
                    >
                      Delete
                    </button>
                  )}
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn xs line"
                  >
                    Apply ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

export default AlumniSection;
