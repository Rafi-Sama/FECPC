"use client";
import React, { useEffect, useRef } from "react";
import type { InterviewTip } from "@/lib/state";
import { TierAvatar, TierName } from "@/components/app/shared/TierBadge";
import { MarkdownBody, relTime } from "@/components/app/shared/MarkdownEditor";
import { useStore } from "@/components/app/Store";
import { isAdmin } from "@/lib/permissions";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ExperienceModal({
  tip,
  onClose,
  onDeleted,
}: {
  tip: InterviewTip;
  onClose: () => void;
  onDeleted?: (tipId: number) => void;
}) {
  const { me, s } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const canDelete = tip.author_id === me.id || isAdmin(s.role);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap + Esc
  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this tip?")) return;
    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "deleteInterviewTip",
          tipId: tip.id,
        }),
      });

      if (res.ok) {
        onDeleted?.(tip.id);
        onClose();
      }
    } catch (err) {
      console.error("Failed to delete tip", err);
    }
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 11, 11, 0.65)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expModalTitle"
        style={{
          width: "100%",
          maxWidth: 680,
          background: "var(--panel, #F6F4EE)",
          border: "2px solid var(--line2, #0B0B0B)",
          boxShadow: "8px 8px 0 var(--line2, #0B0B0B)",
          padding: "36px 32px",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            fontFamily: "var(--mono)",
            fontSize: 22,
            cursor: "pointer",
            lineHeight: 1,
            color: "var(--ink, #0B0B0B)",
          }}
        >
          ✕
        </button>

        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--acc, #1F3BFF)",
            marginBottom: 8,
          }}
        >
          INTERVIEW EXPERIENCE
        </div>

        <h2
          id="expModalTitle"
          style={{
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.25,
            margin: "0 0 16px",
            color: "var(--ink, #0B0B0B)",
          }}
        >
          {tip.title}
        </h2>

        {/* Author row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 16,
            borderBottom: "1px solid var(--line, #CFCCBF)",
            marginBottom: 24,
          }}
        >
          <TierAvatar
            name={tip.author_name || "Alumnus"}
            solved={tip.author_rating ?? 0}
            avatarUrl={tip.author_avatar}
            size={36}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              <TierName
                name={tip.author_name || "Alumnus"}
                solved={tip.author_rating ?? 0}
              />
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--dim, #6B6B6B)",
                marginTop: 2,
              }}
            >
              {tip.created_at ? relTime(tip.created_at) : "Recently"}
            </div>
          </div>

          {canDelete && (
            <button
              type="button"
              className="btn line sm"
              onClick={handleDelete}
              style={{
                marginLeft: "auto",
                color: "var(--accent2, #FF5A1F)",
                borderColor: "var(--accent2, #FF5A1F)",
                fontSize: 11,
                fontFamily: "var(--mono)",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          )}
        </div>

        {/* Markdown content */}
        <div style={{ fontSize: 15, lineHeight: 1.65, color: "var(--ink, #1C1C1A)" }}>
          <MarkdownBody markdown={tip.body_md} />
        </div>
      </div>
    </div>
  );
}
