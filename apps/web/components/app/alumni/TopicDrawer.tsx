'use client';
import { SaveForm } from '@/components/app/SaveBar';
import React, { useState } from 'react';
import type { InterviewTopic, InterviewProblem } from '@fecpc/contracts';

const drawerInput =
  'py-2.5 px-3 [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink text-[14px] w-full';

const sectionLabel = 'm mb-1.5 block [font:11px_ui-monospace,_Menlo,_monospace] uppercase text-dim';

export function TopicDrawer({
  roadmapName = 'Data structures & algorithms',
  topic,
  problems,
  canManage,
  onClose,
  onToggleProblem,
  onDeleteProblem,
  onAddProblem,
}: {
  roadmapName?: string;
  topic: InterviewTopic;
  problems: InterviewProblem[];
  canManage: boolean;
  onClose: () => void;
  onToggleProblem: (problemId: number, currentlySolved: boolean) => void;
  onDeleteProblem: (problemId: number) => void;
  onAddProblem: (data: { title: string; url: string; difficulty: string }) => Promise<boolean>;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDiff, setNewDiff] = useState('easy');

  const total = problems.length;
  const solvedCount = problems.filter((p) => p.solved).length;
  const pct = total > 0 ? Math.round((solvedCount / total) * 100) : 0;

  const clearNew = () => {
    setNewTitle('');
    setNewUrl('');
    setNewDiff('easy');
  };
  const handleCreate = async () => {
    const ok = await onAddProblem({
      title: newTitle.trim(),
      url: newUrl.trim(),
      difficulty: newDiff,
    });
    if (ok) clearNew();
    return ok;
  };

  return (
    <div
      className="ov open inset-0 fixed [background:rgba(11,_11,_11,_0.6)] flex justify-end z-[9999] [backdrop-filter:blur(2px)]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="md p-8 relative block max-w-[480px] w-full self-stretch [border-width:0_0_0_2px] border-line2 [border-style:solid] overflow-y-auto [background:var(--panel)] [box-shadow:-8px_0_24px_rgba(0,_0,_0,_0.2)] [animation:rise_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label={`${topic.name} problems`}
      >
        {/* Close Button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="top-4 right-4 min-w-[44px] h-[44px] absolute [background:var(--panel)] [border:2px_solid_var(--line2)] text-ink text-[22px] leading-[1] cursor-pointer flex items-center justify-center font-bold"
        >
          ×
        </button>

        {/* Roadmap Breadcrumb */}
        <div className="m pr-14 mb-2 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
          {roadmapName}
        </div>

        {/* Topic Title */}
        <h2 className="mt-0 mx-0 mb-2 text-[28px] font-bold text-ink">{topic.name}</h2>
        {topic.description && (
          <p className="mt-0 mx-0 mb-3 text-[14px] text-mut">{topic.description}</p>
        )}

        {/* Progress Stats */}
        <div className="mo mb-2 [font:600_13px_ui-monospace,_Menlo,_monospace] text-ink">
          {solvedCount} of {total} solved · {pct}%
        </div>

        <div className="pb mb-4 h-[8px] [background:var(--line)]">
          <i
            className="block h-full [background:var(--ink)] [transition:width_0.25s_ease]"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Editorial / playlist link, when the roadmap editors set one */}
        {topic.link && (
          <a
            href={topic.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mo py-3 px-4 mb-8 flex justify-between items-center [border:2px_solid_var(--line2)] text-ink [text-decoration:none] [background:var(--bg)] [font:600_13px_ui-monospace,_Menlo,_monospace]"
          >
            <span>Editorial playlist</span>
            <span>↗</span>
          </a>
        )}

        {/* Problems List */}
        <section className="sc mb-8">
          <div className="m pb-2 mb-4 [border-bottom:1px_solid_var(--line)] [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
            · Problems
          </div>

          {problems.length === 0 ? (
            <div className="m py-4 px-0 text-dim [font:11px_ui-monospace,_Menlo,_monospace]">
              No problems added yet for this topic.
            </div>
          ) : (
            problems.map((p) => {
              const diffLower = (p.difficulty || 'easy').toLowerCase();
              const isEasy = diffLower === 'easy';
              const isMed = diffLower === 'medium';
              const isHard = diffLower === 'hard';
              const diffLabel = isEasy ? 'Easy' : isMed ? 'Medium' : 'Hard';

              return (
                <div
                  key={p.id}
                  className="r py-3 px-0 flex gap-3 items-center [border-top:1px_solid_var(--line)]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(p.solved)}
                    onChange={() => onToggleProblem(p.id, Boolean(p.solved))}
                    aria-label={`Solved: ${p.title}`}
                    className="w-[20px] min-h-[20px] cursor-pointer [border:2px_solid_var(--line2)]"
                  />
                  <span
                    className="g flex-1 min-w-0 text-[14px] font-semibold"
                    style={{
                      color: p.solved ? 'var(--dim, #5F5F5F)' : 'var(--ink, #0B0B0B)',
                      textDecoration: p.solved ? 'line-through' : 'none',
                    }}
                  >
                    {p.title}
                  </span>

                  {canManage && (
                    <button
                      type="button"
                      className="sm py-0 px-2 min-h-[28px] text-[11px] [border:1px_solid_var(--line2)] [background:var(--panel)] text-ink cursor-pointer"
                      onClick={() => onDeleteProblem(p.id)}
                    >
                      Delete
                    </button>
                  )}

                  {/* Difficulty pill */}
                  <span
                    className="tg py-[3px] px-2 m-0 [font:600_11px_ui-monospace,_Menlo,_monospace] uppercase tracking-[.06em]"
                    style={{
                      border: `1px solid ${isMed ? 'var(--acc, #1F3BFF)' : 'var(--line2, #0B0B0B)'}`,
                      background: isHard ? 'var(--ink, #0B0B0B)' : 'var(--bg, #FFFFFF)',
                      color: isMed
                        ? 'var(--acc, #1F3BFF)'
                        : isHard
                          ? 'var(--on, #FFFFFF)'
                          : 'var(--ink, #0B0B0B)',
                    }}
                  >
                    {diffLabel}
                  </span>

                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m text-ink [text-decoration:none] font-bold text-[13px]"
                      title="Open problem in new tab"
                    >
                      ↗
                    </a>
                  )}
                </div>
              );
            })
          )}

          <div className="m mt-3 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
            Showing {problems.length} of {problems.length}
          </div>
        </section>

        {/* Add problem inline form (CP head and president) */}
        {canManage && (
          <SaveForm
            onSubmit={handleCreate}
            onDiscard={clearNew}
            label="Unsaved problem"
            saveLabel="Add problem"
            className="in pt-5 mt-6 [border-top:2px_solid_var(--line2)]"
          >
            <div className="m mb-3 [font:700_11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
              Add problem · alumni and admin
            </div>

            <div className="f mb-3">
              <label className={sectionLabel} htmlFor="p-title">
                Title
              </label>
              <input
                id="p-title"
                required
                minLength={2}
                maxLength={120}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Valid Anagram"
                className={drawerInput}
              />
            </div>

            <div className="f mb-3">
              <label className={sectionLabel} htmlFor="p-url">
                URL
              </label>
              <input
                id="p-url"
                type="url"
                required
                maxLength={500}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://leetcode.com/problems/..."
                className={drawerInput}
              />
            </div>

            <div className="f mb-4">
              <label className={sectionLabel} htmlFor="p-diff">
                Difficulty
              </label>
              <select
                id="p-diff"
                value={newDiff}
                onChange={(e) => setNewDiff(e.target.value)}
                className="py-2.5 px-3 [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink text-[14px] w-full cursor-pointer"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </SaveForm>
        )}
      </aside>
    </div>
  );
}

export default TopicDrawer;
