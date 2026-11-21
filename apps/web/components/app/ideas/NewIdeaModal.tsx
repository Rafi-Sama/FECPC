'use client';
import { useEffect, useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { MarkdownEditor } from '@/components/app/shared/MarkdownEditor';
import type { IdeaType } from '@fecpc/contracts';

export const IDEA_TYPE_OPTIONS: { value: IdeaType; label: string; short: string }[] = [
  { value: 'idea', label: 'Idea', short: 'Idea' },
  { value: 'teammate', label: 'Teammate request', short: 'Teammate' },
  { value: 'study', label: 'Study partner', short: 'Study' },
];

export function ideaTypeLabel(type: IdeaType): string {
  return IDEA_TYPE_OPTIONS.find((t) => t.value === type)?.short ?? type;
}

export function NewIdeaModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    body_md: string;
    type: IdeaType;
    roles: string[];
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<IdeaType>('idea');
  const [bodyMd, setBodyMd] = useState('');
  const [roles, setRoles] = useState<string[]>(['']);
  const [wantsRoles, setWantsRoles] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setRoleAt = (index: number, val: string) => {
    setRoles((prev) => prev.map((r, i) => (i === index ? val : r)));
  };

  const addRole = () => {
    setRoles((prev) => (prev.length < 3 ? [...prev, ''] : prev));
  };

  const removeRole = (index: number) => {
    setRoles((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  };

  const clear = () => {
    setTitle('');
    setType('idea');
    setBodyMd('');
    setRoles(['']);
    setWantsRoles(false);
  };

  const handleSubmit = async () => {
    const cleanRoles = wantsRoles
      ? roles
          .map((r) => r.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    const ok = await onSubmit({
      title: title.trim(),
      body_md: bodyMd.trim(),
      type,
      roles: cleanRoles,
    });
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
      aria-label="Submit idea"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <SaveForm
        className="cm-modal"
        style={{ maxWidth: 700 }}
        label="Unsubmitted idea"
        saveLabel="Submit idea"
        onDiscard={() => {
          clear();
          onClose();
        }}
        onSubmit={handleSubmit}
      >
        <div className="cm-modal-head">
          <h2 className="h3">Submit idea</h2>
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
            placeholder="Workshop idea, hackathon teammate request, or study group"
            autoFocus
          />
        </label>

        <div className="field">
          <span className="label">Type</span>
          <div className="cm-chips" role="radiogroup" aria-label="Idea type">
            {IDEA_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={type === opt.value}
                className={`tag ${type === opt.value ? 'on' : ''}`}
                onClick={() => {
                  setType(opt.value);
                  if (opt.value === 'teammate') setWantsRoles(true);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <MarkdownEditor
          id="new-idea-body"
          label="Description (Markdown)"
          value={bodyMd}
          onChange={setBodyMd}
          required
          minLength={3}
          maxLength={10000}
          rows={6}
          placeholder="Explain the idea, project scope, or what you're looking for…"
        />

        <div className="cm-side-box">
          <label
            className="row"
            style={{ cursor: 'pointer', '--g': '10px' } as React.CSSProperties}
          >
            <input
              type="checkbox"
              className="check"
              checked={wantsRoles}
              onChange={(e) => setWantsRoles(e.target.checked)}
            />
            <span>
              <strong>Open roles / questions for interested members</strong>
              <span className="label" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                Optional (1–3 fields). Responses are visible only to you.
              </span>
            </span>
          </label>

          {wantsRoles && (
            <div className="stack" style={{ '--g': '10px', marginTop: 4 } as React.CSSProperties}>
              {roles.map((r, idx) => (
                <div
                  key={idx}
                  className="row"
                  style={{ '--g': '8px', flexWrap: 'nowrap' } as React.CSSProperties}
                >
                  <input
                    className="input grow"
                    style={{ minHeight: 40 }}
                    value={r}
                    onChange={(e) => setRoleAt(idx, e.target.value)}
                    maxLength={140}
                    placeholder={
                      idx === 0
                        ? 'e.g. What skills or topics are you strongest in?'
                        : idx === 1
                          ? 'e.g. What is your Codeforces rating?'
                          : 'e.g. Availability before contest day?'
                    }
                    aria-label={`Open role prompt ${idx + 1}`}
                  />
                  {roles.length > 1 && (
                    <button
                      type="button"
                      className="btn xs line"
                      onClick={() => removeRole(idx)}
                      aria-label="Remove prompt"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {roles.length < 3 && (
                <button
                  type="button"
                  className="btn xs line"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={addRole}
                >
                  + Add prompt ({roles.length}/3)
                </button>
              )}
            </div>
          )}
        </div>
      </SaveForm>
    </div>
  );
}

export default NewIdeaModal;
