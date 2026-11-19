"use client";
import React, { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/app/shared/MarkdownEditor";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NewTipModal({
  topicId,
  topicName,
  onClose,
  onCreated,
}: {
  topicId?: number | null;
  topicName?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    titleInputRef.current?.focus();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      titleInputRef.current?.focus();
      return;
    }
    if (!bodyMd.trim()) {
      setError("Content is required.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "createInterviewTip",
          topicId: topicId ?? null,
          title: title.trim(),
          body_md: bodyMd.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to post tip.");
      }

      onCreated();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
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
        aria-labelledby="tipModalTitle"
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--panel, #F6F4EE)",
          border: "2px solid var(--line2, #0B0B0B)",
          boxShadow: "6px 6px 0 var(--line2, #0B0B0B)",
          padding: 28,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            fontFamily: "var(--mono)",
            fontSize: 20,
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
            marginBottom: 6,
          }}
        >
          {topicName || "INTERVIEW PREP"}
        </div>
        <h2
          id="tipModalTitle"
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 18px",
            color: "var(--ink, #0B0B0B)",
          }}
        >
          {topicId ? "Add Topic Tip" : "Share Interview Experience"}
        </h2>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(255, 90, 31, 0.12)",
              border: "1px solid var(--acc, #FF5A1F)",
              color: "var(--acc, #FF5A1F)",
              fontSize: 13,
              fontFamily: "var(--mono)",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="tipTitle"
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
                color: "var(--dim, #5F5F5F)",
              }}
            >
              Title *
            </label>
            <input
              id="tipTitle"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to structure code in 45-min rounds, Edge cases to always check"
              required
              style={{
                width: "100%",
                border: "2px solid var(--line2, #0B0B0B)",
                background: "var(--bg, #FFFFFF)",
                color: "var(--ink, #0B0B0B)",
                padding: "10px 12px",
                fontSize: 14,
                borderRadius: 0,
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
                color: "var(--dim, #5F5F5F)",
              }}
            >
              Tip Content (Markdown) *
            </label>
            <MarkdownEditor
              value={bodyMd}
              onChange={setBodyMd}
              placeholder="Write your tip or advice here. Markdown headings, code blocks and lists are supported..."
              rows={8}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              className="btn line sm"
              onClick={onClose}
              disabled={submitting}
              style={{ cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn k sm"
              disabled={submitting}
              style={{ cursor: "pointer" }}
            >
              {submitting ? "Posting..." : "Post Tip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
