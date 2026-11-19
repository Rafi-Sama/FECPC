"use client";
import React, { useEffect, useRef, useState } from "react";
import type { AlumniJob } from "@/lib/state";
import { JobCard } from "./JobCard";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PostJobModal({
  onClose,
  onJobCreated,
}: {
  onClose: () => void;
  onJobCreated: (job: AlumniJob) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [vacancies, setVacancies] = useState(1);
  const [jobType, setJobType] = useState("Full-time");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilitiesText, setResponsibilitiesText] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Set default deadline to 14 days from today
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDeadline(d.toISOString().slice(0, 10));
  }, []);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Initial focus + Esc
  useEffect(() => {
    companyInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (!active || active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modalRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Real-time preview job object
  const previewJob: AlumniJob = {
    id: 9999,
    company: company.trim() || "Your Company",
    role: role.trim() || "Software Engineer",
    title: role.trim() || "Software Engineer",
    vacancies,
    job_type: jobType,
    location: location.trim() || "Dhaka · Hybrid",
    url: url.trim() || "https://example.com/careers",
    deadline: deadline || null,
    source: "manual",
    company_logo_url: companyLogoUrl.trim() || null,
    experience: experience.trim() || null,
    salary: salary.trim() || null,
    description: description.trim() || null,
    responsibilities: responsibilitiesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    requirements: requirementsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    mine: true,
    alumni_id: "preview",
    fetched_at: null,
    created_at: new Date().toISOString(),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!company.trim()) newErrors.company = "Company name is required";
    if (!role.trim()) newErrors.role = "Role title is required";
    if (!url.trim()) {
      newErrors.url = "Application URL is required";
    } else {
      try {
        new URL(url.trim());
      } catch {
        newErrors.url = "Enter a valid URL (e.g. https://...)";
      }
    }
    if (!deadline) newErrors.deadline = "Closing deadline is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Focus first error
      if (newErrors.company) companyInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const responsibilities = responsibilitiesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const requirements = requirementsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "createAlumniJob",
          company: company.trim(),
          title: role.trim(),
          role: role.trim(),
          vacancies,
          job_type: jobType,
          location: location.trim() || null,
          url: url.trim(),
          deadline,
          experience: experience.trim() || null,
          salary: salary.trim() || null,
          description: description.trim() || null,
          responsibilities,
          requirements,
          company_logo_url: companyLogoUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrors({ form: j.error ?? "Failed to post job." });
        return;
      }

      const created = (await res.json()) as AlumniJob;
      onJobCreated({
        ...previewJob,
        ...created,
      });
      onClose();
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="profile-modal-backdrop post-job-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 11, 11, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        ref={modalRef}
        className="panel post-job-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Post a new job"
        style={{
          width: "100%",
          maxWidth: 1040,
          maxHeight: "90vh",
          background: "var(--panel, #F6F4EE)",
          border: "2px solid var(--line2, #0B0B0B)",
          boxShadow: "10px 10px 0 var(--line2, #0B0B0B)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          padding: 0,
        }}
      >
        {/* Top Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "2px solid var(--line2, #0B0B0B)",
            background: "var(--bg, #ECE9E1)",
          }}
        >
          <div>
            <span
              className="m"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--acc, #1F3BFF)",
                letterSpacing: ".08em",
                display: "block",
              }}
            >
              MANUAL · SHARED WITH ALL ALUMNI
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "2px 0 0", color: "var(--ink, #0B0B0B)" }}>
              Post a <i style={{ color: "var(--acc, #1F3BFF)", fontStyle: "normal" }}>job.</i>
            </h2>
          </div>

          <button
            type="button"
            className="btn xs line"
            aria-label="Close"
            onClick={onClose}
            style={{ minWidth: 36, minHeight: 36, padding: 0, fontSize: 18, color: "var(--ink, #0B0B0B)" }}
          >
            ×
          </button>
        </header>

        {/* Modal Body: Two Columns (Form on Left, Sticky Live Preview on Right) */}
        <div
          className="post-job-modal__grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: "24px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              borderRight: "2px solid var(--line2, #0B0B0B)",
            }}
          >
            {errors.form && (
              <div
                style={{
                  background: "rgba(176, 0, 32, 0.12)",
                  border: "2px solid var(--acc, #B00020)",
                  color: "var(--acc, #B00020)",
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {errors.form}
              </div>
            )}

            {/* Row 1: Company + Role */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  COMPANY NAME *
                </label>
                <input
                  ref={companyInputRef}
                  className="btn line"
                  required
                  placeholder="e.g. Northwind Labs"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 40,
                    textAlign: "left",
                    background: "var(--bg, #FFFFFF)",
                    color: "var(--ink, #0B0B0B)",
                    borderColor: errors.company ? "var(--acc, #B00020)" : "var(--line2, #0B0B0B)",
                  }}
                />
                {errors.company && (
                  <span style={{ fontSize: 11, color: "var(--acc, #B00020)", marginTop: 4, display: "block" }}>
                    {errors.company}
                  </span>
                )}
              </div>

              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  ROLE TITLE *
                </label>
                <input
                  className="btn line"
                  required
                  placeholder="e.g. Frontend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 40,
                    textAlign: "left",
                    background: "var(--bg, #FFFFFF)",
                    color: "var(--ink, #0B0B0B)",
                    borderColor: errors.role ? "var(--acc, #B00020)" : "var(--line2, #0B0B0B)",
                  }}
                />
                {errors.role && (
                  <span style={{ fontSize: 11, color: "var(--acc, #B00020)", marginTop: 4, display: "block" }}>
                    {errors.role}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Vacancies Stepper + Job Type */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16 }}>
              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  VACANCIES
                </label>
                <div style={{ display: "flex", alignItems: "center", border: "2px solid var(--line2, #0B0B0B)", background: "var(--bg, #FFF)", color: "var(--ink, #0B0B0B)" }}>
                  <button
                    type="button"
                    onClick={() => setVacancies((v) => Math.max(1, v - 1))}
                    style={{
                      width: 38,
                      height: 38,
                      border: "none",
                      background: "transparent",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--ink, #0B0B0B)",
                    }}
                  >
                    -
                  </button>
                  <span
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {vacancies}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVacancies((v) => Math.min(99, v + 1))}
                    style={{
                      width: 38,
                      height: 38,
                      border: "none",
                      background: "transparent",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--ink, #0B0B0B)",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  JOB TYPE
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Full-time", "Part-time", "Contract", "Internship"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`tag tab ${jobType === type ? "on" : ""}`}
                      onClick={() => setJobType(type)}
                      style={{ minHeight: 38, fontSize: 12 }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Location + Deadline */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  LOCATION
                </label>
                <input
                  className="btn line"
                  placeholder="Dhaka · Hybrid / Remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ width: "100%", minHeight: 40, textAlign: "left", background: "var(--bg, #FFFFFF)", color: "var(--ink, #0B0B0B)", borderColor: "var(--line2, #0B0B0B)" }}
                />
              </div>

              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  CLOSING DEADLINE *
                </label>
                <input
                  type="date"
                  className="btn line"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{ width: "100%", minHeight: 40, textAlign: "left", background: "var(--bg, #FFFFFF)", color: "var(--ink, #0B0B0B)", borderColor: errors.deadline ? "var(--acc, #B00020)" : "var(--line2, #0B0B0B)" }}
                />
                {errors.deadline && (
                  <span style={{ fontSize: 11, color: "var(--acc, #B00020)", marginTop: 4, display: "block" }}>
                    {errors.deadline}
                  </span>
                )}
              </div>
            </div>

            {/* Row 4: Application URL + Experience */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  APPLICATION URL *
                </label>
                <input
                  type="url"
                  className="btn line"
                  required
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 40,
                    textAlign: "left",
                    background: "var(--bg, #FFFFFF)",
                    color: "var(--ink, #0B0B0B)",
                    borderColor: errors.url ? "var(--acc, #B00020)" : "var(--line2, #0B0B0B)",
                  }}
                />
                {errors.url && (
                  <span style={{ fontSize: 11, color: "var(--acc, #B00020)", marginTop: 4, display: "block" }}>
                    {errors.url}
                  </span>
                )}
              </div>

              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  EXPERIENCE (OPTIONAL)
                </label>
                <input
                  className="btn line"
                  placeholder="e.g. 2–4 years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  style={{ width: "100%", minHeight: 40, textAlign: "left", background: "var(--bg, #FFFFFF)", color: "var(--ink, #0B0B0B)", borderColor: "var(--line2, #0B0B0B)" }}
                />
              </div>
            </div>

            {/* Row 5: Salary + Logo URL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  SALARY / STIPEND (OPTIONAL)
                </label>
                <input
                  className="btn line"
                  placeholder="e.g. ৳70k–110k"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  style={{ width: "100%", minHeight: 40, textAlign: "left", background: "var(--bg, #FFFFFF)", color: "var(--ink, #0B0B0B)", borderColor: "var(--line2, #0B0B0B)" }}
                />
              </div>

              <div>
                <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                  COMPANY LOGO URL (OPTIONAL)
                </label>
                <input
                  type="url"
                  className="btn line"
                  placeholder="https://.../logo.png"
                  value={companyLogoUrl}
                  onChange={(e) => setCompanyLogoUrl(e.target.value)}
                  style={{ width: "100%", minHeight: 40, textAlign: "left", background: "var(--bg, #FFFFFF)", color: "var(--ink, #0B0B0B)", borderColor: "var(--line2, #0B0B0B)" }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                ABOUT THE ROLE (OPTIONAL)
              </label>
              <textarea
                className="btn line"
                rows={3}
                placeholder="Give candidates an overview of the company, team and what you are building…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 70,
                  textAlign: "left",
                  background: "var(--bg, #FFFFFF)",
                  color: "var(--ink, #0B0B0B)",
                  borderColor: "var(--line2, #0B0B0B)",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Responsibilities (one per line) */}
            <div>
              <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                RESPONSIBILITIES (ONE PER LINE)
              </label>
              <textarea
                className="btn line"
                rows={3}
                placeholder="Build and maintain React interfaces&#10;Turn designs into accessible components&#10;Review pull requests"
                value={responsibilitiesText}
                onChange={(e) => setResponsibilitiesText(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 70,
                  textAlign: "left",
                  background: "var(--bg, #FFFFFF)",
                  color: "var(--ink, #0B0B0B)",
                  borderColor: "var(--line2, #0B0B0B)",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Requirements (one per line) */}
            <div>
              <label className="m" style={{ display: "block", marginBottom: 6, color: "var(--dim, #5F5F5F)" }}>
                REQUIREMENTS (ONE PER LINE)
              </label>
              <textarea
                className="btn line"
                rows={3}
                placeholder="2+ years of professional React experience&#10;Comfortable with TypeScript&#10;Clear written English"
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 70,
                  textAlign: "left",
                  background: "var(--bg, #FFFFFF)",
                  color: "var(--ink, #0B0B0B)",
                  borderColor: "var(--line2, #0B0B0B)",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
              <button
                type="button"
                className="btn line"
                onClick={onClose}
                disabled={submitting}
                style={{ minHeight: 44, padding: "0 20px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn"
                disabled={submitting}
                style={{
                  minHeight: 44,
                  padding: "0 28px",
                  background: "var(--acc, #1F3BFF)",
                  color: "var(--on, #FFFFFF)",
                  borderColor: "var(--line2, #0B0B0B)",
                  fontWeight: 600,
                }}
              >
                {submitting ? "Publishing…" : "Publish job"}
              </button>
            </div>
          </form>

          {/* Right Column: Sticky Live Preview */}
          <aside
            style={{
              padding: "24px 20px",
              background: "var(--bg, #ECE9E1)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <span
                className="m"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  color: "var(--dim, #5F5F5F)",
                  display: "block",
                  marginBottom: 12,
                }}
              >
                LIVE PREVIEW
              </span>
              <p style={{ fontSize: 12, color: "var(--dim, #5F5F5F)", margin: "0 0 16px" }}>
                This is how alumni and students will see your posting in the Jobs directory.
              </p>
            </div>

            <div style={{ pointerEvents: "none" }}>
              <JobCard job={previewJob} onOpenDetail={() => {}} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default PostJobModal;
