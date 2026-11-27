'use client';
import React, { useState } from 'react';
import type {
  InterviewProblem,
  InterviewRoadmap,
  InterviewTopic,
  RoadmapKind,
} from '@fecpc/contracts';
import { SaveForm } from '@/components/app/SaveBar';
import { NODE_H, NODE_W, TreeEdges, TreeFrame, layoutTree } from './RoadmapTreeCanvas';
import { useConfirm } from '@/components/app/shared/PromptDialog';

type Difficulty = 'easy' | 'medium' | 'hard';
type EditorProblem = {
  key: string;
  id: number | null;
  title: string;
  url: string;
  difficulty: Difficulty;
};
type EditorNode = {
  key: string;
  id: number | null;
  parentKey: string | null;
  name: string;
  description: string;
  link: string;
  problems: EditorProblem[];
};
type Add = 'child' | 'before' | 'after';
export type RoadmapProblem = Pick<
  InterviewProblem,
  'id' | 'topic_id' | 'title' | 'url' | 'difficulty'
>;

// The API's limits, checked here first so mistakes show on the right box.
const MAX_TOPICS = 200;
const MAX_PROBLEMS = 200;
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const isUrl = (u: string) => u.length <= 400 && /^https?:\/\/\S+$/i.test(u);
const uid = () => `new-${crypto.randomUUID()}`;

const fromTopics = (topics: InterviewTopic[], problems: RoadmapProblem[]): EditorNode[] =>
  topics.map((t) => ({
    key: String(t.id),
    id: t.id,
    parentKey: t.parent_id ? String(t.parent_id) : null,
    name: t.name,
    description: t.description ?? '',
    link: t.link ?? '',
    problems: problems
      .filter((p) => p.topic_id === t.id)
      .map((p) => ({
        key: String(p.id),
        id: p.id,
        title: p.title,
        url: p.url,
        difficulty: p.difficulty,
      })),
  }));

const blank = (parentKey: string | null): EditorNode => ({
  key: uid(),
  id: null,
  parentKey,
  name: 'New topic',
  description: '',
  link: '',
  problems: [],
});

/** The node plus everything under it. */
function subtree(nodes: EditorNode[], key: string): Set<string> {
  const out = new Set([key]);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of nodes)
      if (n.parentKey && out.has(n.parentKey) && !out.has(n.key)) {
        out.add(n.key);
        grew = true;
      }
  }
  return out;
}

/** "Title, https://…, medium" per line; difficulty is optional (easy). */
export function parseBulk(text: string): { problems: EditorProblem[]; error: string | null } {
  const problems: EditorProblem[] = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    const url = line.match(/https?:\/\/[^\s,|]+/i)?.[0];
    if (!url) return { problems, error: `Line ${i + 1} has no http(s) link.` };
    const at = line.indexOf(url);
    const title = line
      .slice(0, at)
      .replace(/[\s,|-]+$/, '')
      .trim();
    const diff =
      line
        .slice(at + url.length)
        .replace(/[\s,|]/g, '')
        .toLowerCase() || 'easy';
    if (title.length < 2)
      return { problems, error: `Line ${i + 1} needs a title before the link.` };
    if (!DIFFS.includes(diff as Difficulty))
      return { problems, error: `Line ${i + 1}: difficulty must be easy, medium or hard.` };
    problems.push({ key: uid(), id: null, title, url, difficulty: diff as Difficulty });
  }
  return { problems, error: problems.length ? null : 'Paste at least one line.' };
}

/** First thing the API would reject, so it can be shown on the right box before saving. */
function invalid(name: string, description: string, nodes: EditorNode[]) {
  if (name.trim().length < 2 || name.trim().length > 80)
    return { key: null, msg: 'Roadmap name must be 2 to 80 characters.' };
  if (description.trim().length > 300)
    return { key: null, msg: 'Roadmap description must be at most 300 characters.' };
  for (const n of nodes) {
    const at = (msg: string) => ({
      key: n.key,
      msg: `${n.name.trim() || 'Untitled topic'}: ${msg}`,
    });
    if (n.name.trim().length < 2 || n.name.trim().length > 80)
      return at('topic names must be 2 to 80 characters.');
    if (n.description.trim().length > 300) return at('description is over 300 characters.');
    if (n.link.trim() && !isUrl(n.link.trim()))
      return at('the topic link must start with http(s)://.');
    if (n.problems.length > MAX_PROBLEMS) return at(`at most ${MAX_PROBLEMS} problems.`);
    for (const [i, p] of n.problems.entries()) {
      if (p.title.trim().length < 2 || p.title.trim().length > 120)
        return at(`problem ${i + 1} needs a 2 to 120 character title.`);
      if (!isUrl(p.url.trim())) return at(`“${p.title.trim()}” needs an http(s) link.`);
    }
  }
  return null;
}

// Shared editor styles. Parts are split so an override never puts two classes for one property on an element.
const fieldBox = '[border:2px_solid_var(--line2)] [background:var(--bg)] py-2.5 px-3 text-ink';
const fieldFont = '[font:14px_Inter,_Arial,_sans-serif]';
const field = `${fieldBox} ${fieldFont} min-h-[44px] w-full`;
const fieldRow = `${fieldBox} ${fieldFont} min-h-[40px]`;
const labelText = 'block [font:14px_ui-monospace,_Menlo,_monospace] text-dim';
const label = `${labelText} mb-1.5`;
const headingText =
  '[font:600_14px_ui-monospace,_Menlo,_monospace] uppercase tracking-[.06em] text-ink';
const heading = `${headingText} mt-0 mx-0 mb-3`;
const section = '[border-top:2px_solid_var(--line2)] py-4 px-0';
const btnBase =
  '[font:500_14px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] py-0 px-3.5 [background:var(--panel)] min-h-[40px] cursor-pointer';
const btn = `${btnBase} text-ink`;
const danger = `${btnBase} w-full text-bad`;
const plus =
  'absolute w-[32px] h-[32px] p-0 text-[20px] leading-[1] [background:var(--acc)] text-on [border:2px_solid_var(--line2)] cursor-pointer z-[4]';

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/alumni', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export function RoadmapEditor({
  roadmap,
  topics,
  problems,
  onCancel,
  onSaved,
  onDeleted,
  kind = 'prep',
}: {
  readonly kind?: RoadmapKind;
  readonly roadmap: InterviewRoadmap | null;
  readonly topics: InterviewTopic[];
  readonly problems: RoadmapProblem[];
  readonly onCancel: () => void;
  readonly onSaved: (roadmapId: number) => void;
  readonly onDeleted: () => void;
}) {
  const sure = useConfirm();
  const [name, setName] = useState(roadmap?.name ?? '');
  const [description, setDescription] = useState(roadmap?.description ?? '');
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    topics.length ? fromTopics(topics, problems) : [{ ...blank(null), name: 'First topic' }],
  );
  const [selectedKey, setSelectedKey] = useState(nodes[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState<string | null>(null); // null = closed
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [initial] = useState(() => JSON.stringify([name, description, nodes]));
  const dirty = JSON.stringify([name, description, nodes]) !== initial;
  const { pos, width, height } = layoutTree(nodes);
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const selected = byKey.get(selectedKey);
  const roots = nodes.filter((n) => n.parentKey === null).length;
  const full = nodes.length >= MAX_TOPICS;
  const canDelete = !!selected && (selected.parentKey !== null || roots > 1);
  const problemCount = nodes.reduce((t, n) => t + n.problems.length, 0);

  const path = (n: EditorNode | undefined): string[] =>
    n
      ? [...path(n.parentKey ? byKey.get(n.parentKey) : undefined), n.name.trim() || 'Untitled']
      : [];
  const siblings = selected ? nodes.filter((n) => n.parentKey === selected.parentKey) : [];
  const sibIndex = selected ? siblings.indexOf(selected) : -1;
  const parentChoices = selected
    ? nodes.filter((n) => !subtree(nodes, selected.key).has(n.key))
    : [];

  const update = (patch: Partial<EditorNode>) =>
    setNodes((prev) => prev.map((n) => (n.key === selectedKey ? { ...n, ...patch } : n)));
  const setProblems = (fn: (ps: EditorProblem[]) => EditorProblem[]) =>
    setNodes((prev) =>
      prev.map((n) => (n.key === selectedKey ? { ...n, problems: fn(n.problems) } : n)),
    );
  const editProblem = (key: string, patch: Partial<EditorProblem>) =>
    setProblems((ps) => ps.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const select = (key: string) => {
    setSelectedKey(key);
    setBulk(null);
    setBulkError(null);
  };

  const add = (at: EditorNode, how: Add) => {
    if (full) return;
    const node = blank(how === 'child' ? at.key : at.parentKey);
    setNodes((prev) => {
      // Sibling order is array order, so a sibling goes right next to `at`.
      const i = prev.findIndex((n) => n.key === at.key);
      const next = [...prev];
      next.splice(how === 'before' ? i : how === 'after' ? i + 1 : prev.length, 0, node);
      return next;
    });
    select(node.key);
    setError(null);
  };

  /** Swap with the previous (-1) or next (+1) sibling. */
  const move = (d: -1 | 1) => {
    const other = siblings[sibIndex + d];
    if (!selected || !other) return;
    setNodes((prev) => {
      const next = [...prev];
      const a = next.indexOf(selected),
        b = next.indexOf(other);
      [next[a], next[b]] = [next[b]!, next[a]!];
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!selected || !canDelete) return;
    const doomed = subtree(nodes, selected.key);
    const gone = nodes.filter((n) => doomed.has(n.key));
    const lost = gone.reduce((s, n) => s + n.problems.length, 0);
    const what =
      gone.length > 1
        ? `“${selected.name}” and ${gone.length - 1} subtopic(s)`
        : `“${selected.name}”`;
    if (
      (lost || gone.length > 1) &&
      !(await sure(
        `Delete ${what}?${lost ? ` ${lost} problem(s) and everyone's progress on them go too.` : ''} Nothing is removed until you save.`,
      ))
    )
      return;
    const rest = nodes.filter((n) => !doomed.has(n.key));
    setNodes(rest);
    select(selected.parentKey ?? rest.find((n) => n.parentKey === null)?.key ?? '');
  };

  const addBulk = () => {
    const { problems: parsed, error: e } = parseBulk(bulk ?? '');
    if (e) return setBulkError(e);
    if (selected && selected.problems.length + parsed.length > MAX_PROBLEMS)
      return setBulkError(`A topic can have at most ${MAX_PROBLEMS} problems.`);
    setProblems((ps) => [...ps, ...parsed]);
    setBulk(null);
    setBulkError(null);
  };

  const save = async () => {
    const bad = invalid(name, description, nodes);
    if (bad) {
      if (bad.key) select(bad.key);
      setError(bad.msg);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await post({
        action: 'saveInterviewRoadmap',
        roadmapId: roadmap?.id,
        kind,
        name: name.trim(),
        description: description.trim(),
        topics: nodes.map((n) => ({
          key: n.key,
          id: n.id,
          parentKey: n.parentKey,
          name: n.name.trim(),
          description: n.description.trim(),
          link: n.link.trim() || null,
          ...pos.get(n.key),
          problems: n.problems.map((p) => ({
            id: p.id,
            title: p.title.trim(),
            url: p.url.trim(),
            difficulty: p.difficulty,
          })),
        })),
      });
      onSaved(Number(data.roadmapId));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!roadmap || !(await sure(`Delete “${roadmap.name}” with all its topics and problems?`)))
      return;
    setBusy(true);
    try {
      await post({ action: 'deleteInterviewRoadmap', roadmapId: roadmap.id });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <SaveForm
      className="pb-15 my-0 mx-auto max-w-[1280px]"
      label={roadmap ? 'Unsaved changes to this roadmap' : 'Unsaved new roadmap'}
      saveLabel="Save roadmap"
      trackFields={false}
      extraDirty={dirty}
      onDiscard={onCancel}
      onSubmit={save}
    >
      <div className="row between mb-4 items-baseline">
        <h1 className="m-0 text-[40px] text-ink">
          <span className="font-medium">{roadmap ? 'Edit' : 'Create'}</span>{' '}
          <i className="text-acc not-italic">roadmap.</i>
        </h1>
        <button type="button" data-close onClick={onCancel} className={btn} disabled={busy}>
          ← Back
        </button>
      </div>

      <div className="mb-3 flex gap-4 flex-wrap">
        <label className="flex-[1_1_260px]">
          <span className={label}>Roadmap name</span>
          <input
            maxLength={80}
            value={name}
            placeholder="e.g. Data structures & algorithms"
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex-[2_1_360px]">
          <span className={label}>Description (optional)</span>
          <input
            maxLength={300}
            value={description}
            placeholder="One line shown on the roadmap card"
            onChange={(e) => setDescription(e.target.value)}
            className={field}
          />
        </label>
      </div>
      <p className={`${labelText} mb-3`}>
        {nodes.length} topic{nodes.length === 1 ? '' : 's'} · {problemCount} problem
        {problemCount === 1 ? '' : 's'}
        {full && ` · topic limit (${MAX_TOPICS}) reached`}
      </p>
      {error && (
        <p role="alert" className="mt-0 mx-0 mb-3 text-bad text-[14px]">
          {error}
        </p>
      )}

      <div className="flex gap-6 flex-wrap items-start">
        {/* Tree */}
        <div className="flex-[3_1_480px] min-w-0">
          <p className={`${labelText} mt-0 mx-0 mb-2`}>
            Click a topic to edit it. On the selected topic, + below adds a subtopic, + on a side
            adds a topic beside it.
          </p>
          <TreeFrame width={width} height={height}>
            <TreeEdges nodes={nodes} pos={pos} width={width} height={height} />
            {nodes.map((n) => {
              const b = pos.get(n.key);
              if (!b) return null;
              const isSelected = n.key === selectedKey;
              const bad = invalid('ok', '', [n]) !== null;
              return (
                <React.Fragment key={n.key}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    title={n.name}
                    onClick={() => select(n.key)}
                    onKeyDown={(e) => {
                      if (isSelected && e.key === 'Delete') {
                        e.preventDefault();
                        void deleteSelected();
                      }
                    }}
                    className="py-0 px-3.5 absolute flex flex-col justify-center gap-1 text-left text-ink cursor-pointer z-[3]"
                    style={{
                      left: b.x,
                      top: b.y,
                      width: NODE_W,
                      height: NODE_H,
                      background: n.id === null ? 'var(--bg, #FFFFFF)' : 'var(--panel, #F6F4EE)',
                      border: isSelected
                        ? '3px solid var(--acc, #1F3BFF)'
                        : bad
                          ? '2px dashed var(--bad, #C8261B)'
                          : '2px solid var(--line2, #0B0B0B)',
                    }}
                  >
                    <b className="text-[16px] overflow-hidden text-ellipsis whitespace-nowrap w-full">
                      {n.name.trim() || 'Untitled topic'}
                    </b>
                    <span className={`${labelText} m-0`}>
                      {n.problems.length} problem{n.problems.length === 1 ? '' : 's'}
                      {n.link.trim() ? ' · link' : ''}
                      {n.id === null ? ' · new' : ''}
                    </span>
                  </button>
                  {isSelected && !full && (
                    <>
                      <button
                        type="button"
                        aria-label={`Add subtopic under ${n.name}`}
                        title="Add subtopic"
                        onClick={() => add(n, 'child')}
                        className={plus}
                        style={{ left: b.x + NODE_W / 2 - 16, top: b.y + NODE_H - 16 }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={`Add topic before ${n.name}`}
                        title="Add topic before"
                        onClick={() => add(n, 'before')}
                        className={plus}
                        style={{ left: b.x - 16, top: b.y + NODE_H / 2 - 16 }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={`Add topic after ${n.name}`}
                        title="Add topic after"
                        onClick={() => add(n, 'after')}
                        className={plus}
                        style={{ left: b.x + NODE_W - 16, top: b.y + NODE_H / 2 - 16 }}
                      >
                        +
                      </button>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </TreeFrame>
        </div>

        {/* Inspector */}
        <aside
          className="pn py-4 px-5 m-0 flex-[2_1_380px] [background:var(--panel)] [border:2px_solid_var(--line2)]"
          aria-label="Selected topic"
        >
          {selected ? (
            <>
              <p className={`${labelText} mt-0 mx-0 mb-3`}>{path(selected).join(' › ')}</p>

              <section className="[border-top:0] pt-0 pb-4 px-0">
                <h2 className={heading}>Details</h2>
                <label className="mb-3 block">
                  <span className={label}>Topic name</span>
                  <input
                    maxLength={80}
                    value={selected.name}
                    onChange={(e) => update({ name: e.target.value })}
                    className={field}
                  />
                </label>
                <label className="mb-3 block">
                  <span className={label}>Description</span>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={selected.description}
                    onChange={(e) => update({ description: e.target.value })}
                    className={`${field} resize-y`}
                  />
                </label>
                <label className="block">
                  <span className={label}>Editorial or playlist link (optional)</span>
                  <input
                    type="url"
                    maxLength={400}
                    placeholder="https://youtube.com/playlist?list=…"
                    value={selected.link}
                    onChange={(e) => update({ link: e.target.value })}
                    className={field}
                  />
                </label>
              </section>

              <section className={section}>
                <h2 className={heading}>Position</h2>
                <label className="mb-3 block">
                  <span className={label}>Parent topic</span>
                  <select
                    value={selected.parentKey ?? ''}
                    onChange={(e) => update({ parentKey: e.target.value || null })}
                    className={field}
                  >
                    <option value="">None (top level)</option>
                    {parentChoices.map((n) => (
                      <option key={n.key} value={n.key}>
                        {path(n).join(' › ')}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                  <button
                    type="button"
                    className={btn}
                    disabled={sibIndex < 1}
                    onClick={() => move(-1)}
                  >
                    ← Move earlier
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={sibIndex < 0 || sibIndex >= siblings.length - 1}
                    onClick={() => move(1)}
                  >
                    Move later →
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={full}
                    onClick={() => add(selected, 'child')}
                  >
                    + Subtopic
                  </button>
                </div>
              </section>

              <section className={section}>
                <div className="row between mb-3">
                  <h2 className={`${headingText} m-0`}>Problems · {selected.problems.length}</h2>
                  <span className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                    <button
                      type="button"
                      className={btn}
                      onClick={() => {
                        setBulk(bulk === null ? '' : null);
                        setBulkError(null);
                      }}
                    >
                      {bulk === null ? 'Paste list' : 'Close paste'}
                    </button>
                    <button
                      type="button"
                      className={btn}
                      disabled={selected.problems.length >= MAX_PROBLEMS}
                      onClick={() =>
                        setProblems((ps) => [
                          ...ps,
                          { key: uid(), id: null, title: '', url: '', difficulty: 'easy' },
                        ])
                      }
                    >
                      + Problem
                    </button>
                  </span>
                </div>

                {bulk !== null && (
                  <div className="mb-3">
                    <label className="block">
                      <span className={label}>One per line: title, link, difficulty</span>
                      <textarea
                        rows={5}
                        value={bulk}
                        placeholder={
                          'Two Sum, https://leetcode.com/problems/two-sum/, easy\nGroup Anagrams, https://leetcode.com/problems/group-anagrams/, medium'
                        }
                        onChange={(e) => setBulk(e.target.value)}
                        className={`${fieldBox} [font:14px_ui-monospace,_Menlo,_monospace] min-h-[44px] w-full`}
                      />
                    </label>
                    {bulkError && (
                      <p role="alert" className="text-bad text-[14px]">
                        {bulkError}
                      </p>
                    )}
                    <button type="button" className={`${btn} mt-2`} onClick={addBulk}>
                      Add these problems
                    </button>
                  </div>
                )}

                {selected.problems.length === 0 && bulk === null && (
                  <p className={label}>No problems yet. Add one, or paste a list.</p>
                )}
                <ol className="p-0 m-0 [list-style:none]">
                  {selected.problems.map((p, i) => (
                    <li
                      key={p.key}
                      className="py-2.5 px-0 [display:grid] grid-cols-[1fr_auto_auto] gap-1.5"
                      style={{ borderTop: i ? '1px solid var(--line, #CFCBBF)' : 0 }}
                    >
                      <input
                        aria-label={`Problem ${i + 1} title`}
                        placeholder="Title"
                        maxLength={120}
                        value={p.title}
                        onChange={(e) => editProblem(p.key, { title: e.target.value })}
                        className={`${fieldRow} w-full`}
                      />
                      <select
                        aria-label={`Problem ${i + 1} difficulty`}
                        value={p.difficulty}
                        onChange={(e) =>
                          editProblem(p.key, { difficulty: e.target.value as Difficulty })
                        }
                        className={`${fieldRow} w-auto`}
                      >
                        {DIFFS.map((d) => (
                          <option key={d} value={d}>
                            {d[0]!.toUpperCase() + d.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Remove ${p.title || `problem ${i + 1}`}`}
                        title="Remove problem"
                        onClick={() => setProblems((ps) => ps.filter((x) => x.key !== p.key))}
                        className={`${btnBase} text-bad`}
                      >
                        ×
                      </button>
                      <input
                        aria-label={`Problem ${i + 1} link`}
                        type="url"
                        placeholder="https://leetcode.com/problems/…"
                        maxLength={400}
                        value={p.url}
                        onChange={(e) => editProblem(p.key, { url: e.target.value })}
                        className={`${fieldRow} w-full col-span-full`}
                      />
                    </li>
                  ))}
                </ol>
                {selected.problems.some((p) => p.id !== null) && (
                  <p className={`${label} mt-2`}>
                    Editing a problem keeps members’ progress; removing it deletes that progress.
                  </p>
                )}
              </section>

              <section className={section}>
                <h2 className={heading}>Delete</h2>
                {canDelete ? (
                  <button type="button" onClick={deleteSelected} className={danger}>
                    Delete topic
                    {subtree(nodes, selected.key).size > 1 ? ' and its subtopics' : ''}
                  </button>
                ) : (
                  <p className={label}>The only top-level topic can’t be deleted.</p>
                )}
              </section>
            </>
          ) : (
            <p className={label}>Select a topic in the tree.</p>
          )}

          {roadmap && (
            <section className={section}>
              <h2 className={heading}>Roadmap</h2>
              <button type="button" onClick={remove} disabled={busy} className={danger}>
                Delete the whole roadmap
              </button>
            </section>
          )}
        </aside>
      </div>
    </SaveForm>
  );
}

export default RoadmapEditor;
