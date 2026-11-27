'use client';
import { useEffect, useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { MarkdownEditor } from '@/components/app/shared/MarkdownEditor';
import type { IdeaType } from '@fecpc/contracts';
import {
  cmChips,
  cmSideBox,
  cmIdeaSubmitTitle,
  cmIdeaSubmitNote,
  cmIdeaPublish,
  ideaSubmitFoot,
  IDEA_TYPE_OPTIONS,
} from '@/components/app/ideas/ui';

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
        className="cm-modal cm-idea-submit p-0 gap-0 [box-shadow:8px_8px_0_rgba(13,_13,_11,_0.2)] [.t-d_&]:[box-shadow:8px_8px_0_rgba(0,_0,_0,_0.8)] max-w-[750px]"

        label="Unsubmitted idea"
        saveLabel="Submit idea"
        onDiscard={() => {
          clear();
          onClose();
        }}
        onSubmit={handleSubmit}
      >
        <div className="cm-modal-head [&_.cm-modal-close]:flex-none flex items-start gap-3.5 p-6 [background:var(--bg)] [border-bottom:2px_solid_var(--line2)] max-[521px]:p-4">
          <h2 className={`h3 cm-idea-submit-title ${cmIdeaSubmitTitle}`}>Submit Idea</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cm-idea-submit-body">
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
            <div
              className={`cm-chips flex gap-2 items-center ${cmChips}`}
              role="radiogroup"
              aria-label="Idea type"
            >
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

          <div
            className={`cm-side-box flex gap-3 ${cmSideBox} p-5 [border:2px_solid_var(--line2)] [&&]:[background:var(--bg)]`}
          >
            <label className="row cursor-pointer [--g:10px]">
              <input
                type="checkbox"
                className="check"
                checked={wantsRoles}
                onChange={(e) => setWantsRoles(e.target.checked)}
              />
              <span>
                <strong>Ask questions to interested members</strong>
                <span className="label block text-[11px] mt-0.5">
                  Optional (1–3 fields). Responses are visible only to you.
                </span>
              </span>
            </label>

            {wantsRoles && (
              <div className="stack [--g:10px] mt-1">
                {roles.map((r, idx) => (
                  <label key={idx} className="field">
                    <span className="label">
                      Question {idx + 1}
                      {idx === 0 ? '' : ' (Optional)'}
                    </span>
                    <div className="row [--g:8px] flex-nowrap">
                      <input
                        className="input grow min-h-[40px]"

                        value={r}
                        onChange={(e) => setRoleAt(idx, e.target.value)}
                        maxLength={140}
                        placeholder={
                          idx === 0
                            ? 'e.g. What is your Codeforces handle?'
                            : idx === 1
                              ? 'e.g. How many hours can you commit per week?'
                              : 'e.g. Availability before contest day?'
                        }
                        aria-label={`Question ${idx + 1}`}
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
                  </label>
                ))}
                {roles.length < 3 && (
                  <button
                    type="button"
                    className="btn xs line self-start"

                    onClick={addRole}
                  >
                    + Add prompt ({roles.length}/3)
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={ideaSubmitFoot}>
            <span className={`cm-idea-submit-note tracking-[0.05em] ${cmIdeaSubmitNote}`}>
              Responses visible only to you.
            </span>
            <button type="submit" className={`btn sm cm-idea-publish ${cmIdeaPublish}`}>
              Publish Idea
            </button>
          </div>
        </div>
      </SaveForm>
    </div>
  );
}

export default NewIdeaModal;
