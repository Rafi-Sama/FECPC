"use client";
import { useEffect, useState } from "react";
import { MarkdownEditor } from "@/components/app/shared/MarkdownEditor";
import type { FeedCategory } from "@/lib/state";

export const FEED_CATEGORIES: { value: FeedCategory; label: string; chip: string }[] = [
  { value: "problem-solving", label: "Wins · Problem-solving", chip: "Wins" },
  { value: "upsolving", label: "Help · Upsolving", chip: "Help" },
  { value: "topic", label: "Contests · Topic", chip: "Contests" },
];

export function feedCategoryChip(cat: FeedCategory): string {
  return FEED_CATEGORIES.find((c) => c.value === cat)?.chip ?? cat;
}

export function NewPostModal({
  open,
  onClose,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  onPublish: (data: { title: string; body_md: string; category: FeedCategory }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [category, setCategory] = useState<FeedCategory>("problem-solving");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await onPublish({ title: title.trim(), body_md: bodyMd.trim(), category });
    setBusy(false);
    if (ok) {
      setTitle("");
      setBodyMd("");
      setCategory("problem-solving");
      onClose();
    }
  };

  return (
    <div className="cm-backdrop" role="dialog" aria-modal="true" aria-label="New post" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="cm-modal" style={{ maxWidth: 640 }} onSubmit={submit}>
        <div className="cm-modal-head">
          <h2 className="h3">New post</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="field">
          <span className="label">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={160}
            placeholder="Share a win, question, or contest recap"
            autoFocus
          />
        </label>

        <MarkdownEditor
          id="new-post-body"
          label="Body (Markdown)"
          value={bodyMd}
          onChange={setBodyMd}
          required
          minLength={3}
          maxLength={10000}
          rows={8}
          placeholder="Write your post in Markdown… (bold, lists, links, fenced code blocks)"
        />

        <label className="field">
          <span className="label">Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as FeedCategory)}>
            {FEED_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="row" style={{ justifyContent: "flex-end", "--g": "8px" } as React.CSSProperties}>
          <button type="button" className="btn sm line" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn sm" disabled={busy}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewPostModal;
