'use client';
import { SaveForm } from '@/components/app/SaveBar';
import React, { useState } from 'react';
import type { InterviewTopic, InterviewProblem } from '@fecpc/contracts';

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
      className="ov open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 11, 11, 0.6)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 9999,
        backdropFilter: 'blur(2px)',
      }}
    >
      <aside
        className="md"
        role="dialog"
        aria-modal="true"
        aria-label={`${topic.name} problems`}
        style={{
          position: 'relative',
          display: 'block',
          maxWidth: 480,
          width: '100%',
          alignSelf: 'stretch',
          borderWidth: '0 0 0 2px',
          borderColor: 'var(--line2, #0B0B0B)',
          borderStyle: 'solid',
          overflowY: 'auto',
          padding: 32,
          background: 'var(--panel, #F6F4EE)',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.2)',
          animation: 'rise 0.2s ease-out',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            minWidth: 44,
            height: 44,
            position: 'absolute',
            right: 16,
            top: 16,
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            color: 'var(--ink, #0B0B0B)',
            fontSize: 22,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          ×
        </button>

        {/* Roadmap Breadcrumb */}
        <div
          className="m"
          style={{
            marginBottom: 8,
            paddingRight: 56,
            font: '11px ui-monospace, Menlo, monospace',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--dim, #5F5F5F)',
          }}
        >
          {roadmapName}
        </div>

        {/* Topic Title */}
        <h2
          style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: 'var(--ink, #0B0B0B)' }}
        >
          {topic.name}
        </h2>
        {topic.description && (
          <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--mut, #3B3A35)' }}>
            {topic.description}
          </p>
        )}

        {/* Progress Stats */}
        <div
          className="mo"
          style={{
            marginBottom: 8,
            font: '13px ui-monospace, Menlo, monospace',
            color: 'var(--ink, #0B0B0B)',
            fontWeight: 600,
          }}
        >
          {solvedCount} of {total} solved · {pct}%
        </div>

        <div
          className="pb"
          style={{ height: 8, background: 'var(--line, #DCD8CC)', marginBottom: 16 }}
        >
          <i
            style={{
              display: 'block',
              height: '100%',
              background: 'var(--ink, #0D0D0B)',
              width: `${pct}%`,
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Editorial / playlist link, when the roadmap editors set one */}
        {topic.link && (
          <a
            href={topic.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mo"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '2px solid var(--line2, #0B0B0B)',
              padding: '12px 16px',
              marginBottom: 32,
              color: 'var(--ink, #0B0B0B)',
              textDecoration: 'none',
              background: 'var(--bg, #FFFFFF)',
              font: '13px ui-monospace, Menlo, monospace',
              fontWeight: 600,
            }}
          >
            <span>Editorial playlist</span>
            <span>↗</span>
          </a>
        )}

        {/* Problems List */}
        <section className="sc" style={{ marginBottom: 32 }}>
          <div
            className="m"
            style={{
              paddingBottom: 8,
              borderBottom: '1px solid var(--line, #CFCBBF)',
              marginBottom: 16,
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
            · Problems
          </div>

          {problems.length === 0 ? (
            <div
              className="m"
              style={{
                padding: '16px 0',
                color: 'var(--dim, #5F5F5F)',
                font: '11px ui-monospace, Menlo, monospace',
              }}
            >
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
                  className="r"
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 0',
                    borderTop: '1px solid var(--line, #CFCBBF)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(p.solved)}
                    onChange={() => onToggleProblem(p.id, Boolean(p.solved))}
                    aria-label={`Solved: ${p.title}`}
                    style={{
                      width: 20,
                      minHeight: 20,
                      cursor: 'pointer',
                      border: '2px solid var(--line2, #0B0B0B)',
                    }}
                  />
                  <span
                    className="g"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: p.solved ? 'var(--dim, #5F5F5F)' : 'var(--ink, #0B0B0B)',
                      textDecoration: p.solved ? 'line-through' : 'none',
                    }}
                  >
                    {p.title}
                  </span>

                  {canManage && (
                    <button
                      type="button"
                      className="sm"
                      onClick={() => onDeleteProblem(p.id)}
                      style={{
                        minHeight: 28,
                        padding: '0 8px',
                        fontSize: 11,
                        border: '1px solid var(--line2, #0B0B0B)',
                        background: 'var(--panel, #F6F4EE)',
                        color: 'var(--ink, #0B0B0B)',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}

                  {/* Difficulty pill */}
                  <span
                    className="tg"
                    style={{
                      margin: 0,
                      font: '11px ui-monospace, Menlo, monospace',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      border: `1px solid ${isMed ? 'var(--acc, #1F3BFF)' : 'var(--line2, #0B0B0B)'}`,
                      background: isHard ? 'var(--ink, #0B0B0B)' : 'var(--bg, #FFFFFF)',
                      color: isMed
                        ? 'var(--acc, #1F3BFF)'
                        : isHard
                          ? 'var(--on, #FFFFFF)'
                          : 'var(--ink, #0B0B0B)',
                      padding: '3px 8px',
                      fontWeight: 600,
                    }}
                  >
                    {diffLabel}
                  </span>

                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="m"
                      style={{
                        color: 'var(--ink, #0B0B0B)',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                      title="Open problem in new tab"
                    >
                      ↗
                    </a>
                  )}
                </div>
              );
            })
          )}

          <div
            className="m"
            style={{
              marginTop: 12,
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
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
            className="in"
            style={{
              marginTop: 24,
              borderTop: '2px solid var(--line2, #0B0B0B)',
              paddingTop: 20,
            }}
          >
            <div
              className="m"
              style={{
                marginBottom: 12,
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
                fontWeight: 700,
              }}
            >
              Add problem · alumni and admin
            </div>

            <div className="f" style={{ marginBottom: 12 }}>
              <label
                className="m"
                htmlFor="p-title"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  font: '11px ui-monospace, Menlo, monospace',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
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
                style={{
                  border: '2px solid var(--line2, #0B0B0B)',
                  background: 'var(--bg, #FFFFFF)',
                  color: 'var(--ink, #0B0B0B)',
                  padding: '10px 12px',
                  fontSize: 14,
                  width: '100%',
                }}
              />
            </div>

            <div className="f" style={{ marginBottom: 12 }}>
              <label
                className="m"
                htmlFor="p-url"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  font: '11px ui-monospace, Menlo, monospace',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
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
                style={{
                  border: '2px solid var(--line2, #0B0B0B)',
                  background: 'var(--bg, #FFFFFF)',
                  color: 'var(--ink, #0B0B0B)',
                  padding: '10px 12px',
                  fontSize: 14,
                  width: '100%',
                }}
              />
            </div>

            <div className="f" style={{ marginBottom: 16 }}>
              <label
                className="m"
                htmlFor="p-diff"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  font: '11px ui-monospace, Menlo, monospace',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
                Difficulty
              </label>
              <select
                id="p-diff"
                value={newDiff}
                onChange={(e) => setNewDiff(e.target.value)}
                style={{
                  border: '2px solid var(--line2, #0B0B0B)',
                  background: 'var(--bg, #FFFFFF)',
                  color: 'var(--ink, #0B0B0B)',
                  padding: '10px 12px',
                  fontSize: 14,
                  width: '100%',
                  cursor: 'pointer',
                }}
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
