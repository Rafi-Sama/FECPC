"use client";
import React from "react";
import type { AlumniJob } from "@/lib/state";
import { HighlightMatch } from "./HighlightMatch";

const LOGO_PALETTE = [
  "#1F3BFF", // cobalt
  "#AA00AA", // purple
  "#03A89E", // teal
  "#0B0B0B", // ink
  "#E5560B", // orange
  "#2A7D2E", // forest
];

export function deterministicColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  const idx = Math.abs(h) % LOGO_PALETTE.length;
  return LOGO_PALETTE[idx];
}

export function formatDeadlineStatus(deadlineStr?: string | null): {
  text: string;
  isClosed: boolean;
  isSoon: boolean;
} {
  if (!deadlineStr) {
    return { text: "Open role", isClosed: false, isSoon: false };
  }

  const d = new Date(deadlineStr);
  if (Number.isNaN(d.getTime())) {
    return { text: `Apply by ${deadlineStr}`, isClosed: false, isSoon: false };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: "Closed", isClosed: true, isSoon: false };
  }
  if (diffDays === 0) {
    return { text: "Closes today", isClosed: false, isSoon: true };
  }
  if (diffDays === 1) {
    return { text: "1 day left", isClosed: false, isSoon: true };
  }
  if (diffDays <= 5) {
    return { text: `${diffDays} days left`, isClosed: false, isSoon: true };
  }

  const formatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { text: `Apply by ${formatted}`, isClosed: false, isSoon: false };
}

export function JobCard({
  job,
  onOpenDetail,
  highlightQuery,
}: {
  readonly job: AlumniJob;
  readonly onOpenDetail: (job: AlumniJob) => void;
  readonly highlightQuery?: string;
}) {
  const { text: statusText, isClosed, isSoon } = formatDeadlineStatus(job.deadline);
  const companyColor = deterministicColor(job.company);
  const companyInitial = (job.company || "C").trim().charAt(0).toUpperCase();
  const vacancies = Math.max(1, Number(job.vacancies || 1));
  const ghostVacNumber = String(vacancies).padStart(2, "0");

  let bandBg = "var(--acc, #1F3BFF)"; // manual default
  if (isClosed) {
    bandBg = "#8A877D"; // muted grey
  } else if (job.source === "fetched") {
    bandBg = "var(--line2, #0B0B0B)"; // public board ink
  }

  const statusDotColor = isClosed ? "#8A877D" : isSoon ? "#E5560B" : "var(--acc, #1F3BFF)";

  return (
    <article
      className={`job ${job.source === "fetched" ? "fetched" : "manual"} ${isClosed ? "closed" : ""} ${isSoon ? "soon" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`${job.title || job.role} at ${job.company}, ${job.location || "Remote"}. ${statusText}. View details.`}
      onClick={() => onOpenDetail(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(job);
        }
      }}
      style={{
        position: "relative",
        background: "var(--panel, #F6F4EE)",
        border: "2px solid var(--line2, #0B0B0B)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "transform 0.14s ease, box-shadow 0.14s ease",
      }}
    >
      {/* 76px Header Band matching Alumni-Jobs.html */}
      <div
        className="band"
        style={{
          position: "relative",
          height: 76,
          background: bandBg,
          overflow: "hidden",
          flex: "none",
        }}
      >
        {/* Source label at top-left */}
        <span
          className="m"
          style={{
            position: "absolute",
            left: 20,
            top: 16,
            color: "var(--on, #FFFFFF)",
            font: "11px ui-monospace, Menlo, Consolas, monospace",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            zIndex: 1,
          }}
        >
          {job.source === "fetched" ? "Public board · Job" : "Alumni · Job"}
        </span>

        {/* Ghost vacancy number at top-right */}
        <span
          className="big"
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 14,
            top: -14,
            font: "700 112px/1 Inter, Arial, sans-serif",
            letterSpacing: "-5px",
            color: "transparent",
            WebkitTextStroke: "1.5px rgba(255,255,255,.42)",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {ghostVacNumber}
        </span>
      </div>

      {/* Body with overlapping logo and vacancy badge */}
      <div
        className="body"
        style={{
          padding: "0 20px 18px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        <div
          className="top"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Overlapping logo */}
          <div
            className="logo"
            style={{
              display: "inline-block",
              marginTop: -34,
              background: "var(--panel, #F6F4EE)",
              padding: 4,
              lineHeight: 0,
              alignSelf: "flex-start",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              className="in"
              style={{
                width: 60,
                height: 60,
                border: `2px solid ${companyColor}`,
                background: "var(--bg, #FFFFFF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {job.company_logo_url ? (
                <img
                  src={job.company_logo_url}
                  alt={`${job.company} logo`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              ) : (
                <b
                  style={{
                    font: "700 24px Inter, Arial, sans-serif",
                    letterSpacing: "-1px",
                    color: companyColor,
                  }}
                >
                  {companyInitial}
                </b>
              )}
            </div>
          </div>

          {/* Vacancy badge */}
          <span
            className="vac"
            style={{
              font: "600 11px ui-monospace, Menlo, Consolas, monospace",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              border: "2px solid var(--line2, #0B0B0B)",
              padding: "5px 9px",
              background: "var(--bg, #FFFFFF)",
              color: "var(--ink, #0B0B0B)",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 2,
            }}
          >
            <i
              style={{
                width: 8,
                height: 8,
                background: isClosed ? "#8A877D" : "var(--acc, #1F3BFF)",
                display: "inline-block",
              }}
            />
            {vacancies} {vacancies === 1 ? "vacancy" : "vacancies"}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: "12px 0 4px",
            fontSize: 19,
            lineHeight: 1.25,
            fontWeight: 600,
            letterSpacing: "-.2px",
          }}
        >
          <span
            style={{
              color: "var(--ink, #0B0B0B)",
              textDecoration: "none",
            }}
          >
            <HighlightMatch text={job.title || job.role} query={highlightQuery} />
          </span>
        </h3>

        {/* Company in mono */}
        <div
          className="co"
          style={{
            font: "13px ui-monospace, Menlo, Consolas, monospace",
            letterSpacing: ".02em",
            color: "var(--mut, #3B3A35)",
            marginBottom: 18,
          }}
        >
          <HighlightMatch text={job.company} query={highlightQuery} />
        </div>

        {/* Foot with status dot and View details affordance */}
        <div
          className="foot"
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--line, #CFCBBF)",
            paddingTop: 14,
            gap: 8,
          }}
        >
          <span
            className="m"
            style={{
              color: "var(--ink, #0B0B0B)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: "11px ui-monospace, Menlo, Consolas, monospace",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            <i
              style={{
                width: 9,
                height: 9,
                background: statusDotColor,
                display: "inline-block",
              }}
            />
            {statusText}
          </span>

          <span
            className="m"
            style={{
              color: "var(--ink, #0B0B0B)",
              font: "11px ui-monospace, Menlo, Consolas, monospace",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            View details →
          </span>
        </div>
      </div>
    </article>
  );
}

export default JobCard;
