'use client';
import { useEffect, useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { MarkdownEditor } from '@/components/app/shared/MarkdownEditor';
import type { FeedCategory } from '@fecpc/contracts';
import { FEED_CATEGORIES } from '@/components/app/feed/ui';

export function NewPostModal({
  open,
  onClose,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  onPublish: (data: { title: string; body_md: string; category: FeedCategory }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [category, setCategory] = useState<FeedCategory>('problem-solving');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const clear = () => {
    setTitle('');
    setBodyMd('');
    setCategory('problem-solving');
  };
  const submit = async () => {
    const ok = await onPublish({ title: title.trim(), body_md: bodyMd.trim(), category });
    if (ok) {
      clear();
      onClose();
    }
    return ok;
  };

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="New post"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <SaveForm
        className="cm-modal max-w-[640px]"

        label="Unpublished post"
        saveLabel="Publish"
        onDiscard={() => {
          clear();
          onClose();
        }}
        onSubmit={submit}
      >
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
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedCategory)}
          >
            {FEED_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </SaveForm>
    </div>
  );
}

export default NewPostModal;
