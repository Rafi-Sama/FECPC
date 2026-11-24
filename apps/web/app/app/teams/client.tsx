'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Page } from '@/components/app/Shell';
import { SaveForm } from '@/components/app/SaveBar';
import { useStore } from '@/components/app/Store';
import { templates } from '@fecpc/content/training';
import { rankFor } from '@fecpc/contracts';
import { MemberFace } from '@/components/app/shared/MemberFace';

// ── Types ────────────────────────────────────────────────────────────────────
// `other`: a teammate's hand in this change (who edited this page, or whose page this was).
type HistoryEntry = { action: string; by: string; ago: string; other?: string };
type Note = { user_id: string; topic: string; code: string; updated_at: string };
export type TeamData = {
  team: {
    id: number;
    name: string;
    mine: boolean;
    size: number;
  } | null;
  members?: { id: string; name: string; handle: string }[];
  notes?: Note[];
  history?: {
    who: string;
    user_id: string;
    what: string;
    at: string;
    by: string | null;
    by_name: string | null;
  }[];
  free: { id: string; name: string; handle: string }[];
  invites: { from: string; fromName: string; name: string | null }[];
  sent: string[];
  teams: { id: number; name: string; size: number }[];
  stats?: TeamStats;
};
type TeamStats = {
  members: {
    id: string;
    cf_handle: string;
    cf_rating: number | null;
    peak: number;
    problems_solved: number;
    vj_solved: number;
    current_streak: number;
    contests_participated: number;
    topics: number;
    edits_30d: number;
  }[];
  tags: { tag: string; team: number; per: Record<string, number> }[];
  spread: { band: number; n: number }[];
  distinctSolved: number;
  solvedByAll: number;
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  return m < 1
    ? 'just now'
    : m < 60
      ? `${m} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : `${Math.round(m / 1440)} d ago`;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function Teams({ initial }: { initial: TeamData | null }) {
  const { me, act } = useStore();
  const [d, setD] = useState<TeamData | null>(initial);
  const served = useRef(!!initial); // page.tsx already loaded the team

  const load = useCallback(async () => {
    const res = await fetch('/api/community', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'getTeam' }),
    });
    if (res.ok) setD(await res.json());
  }, []);
  useEffect(() => {
    if (served.current) return void (served.current = false);
    void load();
  }, [load]);
  const run = async (type: string, args: Record<string, unknown> = {}) => {
    const ok = await act(type, args);
    if (ok) await load();
    return ok;
  };

  const t = d?.team ?? null;
  const onTeam = !!t;
  const maxSlots = t?.size ?? 3;
  // No team yet: you alone, reading the club templates.
  const members = t ? (d?.members ?? []) : [{ id: me.id, name: me.name, handle: '' }];
  const memberSlots = members.map((m) => m.id);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const shortName = (id: string) =>
    id === me.id ? 'YOU' : (nameOf(id).split(' ')[0]?.toUpperCase() ?? id.toUpperCase());
  // Topics belong to each person, on a team or not. A club template prefills a topic of the same name.
  const topicsOf = (uid: string) =>
    (d?.notes ?? [])
      .filter((n) => n.user_id === uid)
      .map((n) => n.topic)
      .sort((a, b) => a.localeCompare(b));
  const codeOf = (uid: string, topic: string) =>
    d?.notes?.find((n) => n.user_id === uid && n.topic === topic)?.code;

  const [activeMember, setActiveMember] = useState<string>(me.id);
  const [topicName, setTopicName] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const [showLFT, setShowLFT] = useState(false);
  const [lftSearch, setLftSearch] = useState('');
  const [manageTopics, setManageTopics] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [confirmDeleteTopic, setConfirmDeleteTopic] = useState<{ name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintMembers, setSelectedPrintMembers] = useState<string[]>([]);
  const [selectedMemberTopics, setSelectedMemberTopics] = useState<Record<string, string[]>>({});
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lftRef = useRef<HTMLDivElement>(null);

  const active = memberSlots.includes(activeMember) ? activeMember : me.id;
  const topicList = topicsOf(active);
  const tpl = topicList.includes(topicName) ? topicName : (topicList[0] ?? '');
  const own = active === me.id; // you change only your own topics
  const [renamingTopic, setRenamingTopic] = useState<string | null>(null);
  const [topicRenameInput, setTopicRenameInput] = useState('');
  const activeName = shortName(active);
  const currentCode = tpl
    ? (codeOf(active, tpl) ?? '')
    : own
      ? `// Add your first topic with +. Club templates: ${templates.map((x) => x.name).join(', ')}.`
      : `// ${nameOf(active)} has no topics yet.`;
  const teamName = t?.name ?? '';

  // ── Team name rename state ──────────────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Leave team confirmation ─────────────────────────────────────────────
  const [confirmLeave, setConfirmLeave] = useState(false);
  // The notebook opens first; Strength (the team's numbers) is one click away.
  const [view, setView] = useState<'notes' | 'strength'>('notes');

  // ── Close LFT dropdown on outside click ────────────────────────────────
  useEffect(() => {
    if (!showLFT) return;
    const handler = (e: MouseEvent) => {
      if (lftRef.current && !lftRef.current.contains(e.target as Node)) {
        setShowLFT(false);
        setLftSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLFT]);

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Print notebook modal actions ─────────────────────────────────────────
  function openPrintModal() {
    const initialMap: Record<string, string[]> = {};
    for (const memId of memberSlots) {
      initialMap[memId] = topicsOf(memId);
    }
    setSelectedMemberTopics(initialMap);
    setSelectedPrintMembers([...memberSlots]);
    setShowPrintModal(true);
  }

  function togglePrintMember(id: string) {
    const isCurrentlySelected = selectedPrintMembers.includes(id);
    if (isCurrentlySelected) {
      // Unselect member -> also unselect all their topics!
      setSelectedPrintMembers((prev) => prev.filter((m) => m !== id));
      setSelectedMemberTopics((prev) => ({
        ...prev,
        [id]: [],
      }));
    } else {
      // Select member -> select all their topics by default!
      setSelectedPrintMembers((prev) => [...prev, id]);
      setSelectedMemberTopics((prev) => ({
        ...prev,
        [id]: topicsOf(id),
      }));
    }
  }

  function selectAllMembers() {
    setSelectedPrintMembers([...memberSlots]);
    const nextMap: Record<string, string[]> = {};
    for (const memId of memberSlots) {
      nextMap[memId] = topicsOf(memId);
    }
    setSelectedMemberTopics(nextMap);
  }

  function clearAllMembers() {
    setSelectedPrintMembers([]);
    const nextMap: Record<string, string[]> = {};
    for (const memId of memberSlots) {
      nextMap[memId] = [];
    }
    setSelectedMemberTopics(nextMap);
  }

  function toggleTopicForMember(memId: string, topicName: string) {
    setSelectedMemberTopics((prev) => {
      const currentList = prev[memId] || [];
      const isSelected = currentList.includes(topicName);
      const nextList = isSelected
        ? currentList.filter((t) => t !== topicName)
        : [...currentList, topicName];

      if (nextList.length > 0 && !selectedPrintMembers.includes(memId)) {
        setSelectedPrintMembers((mList) => [...mList, memId]);
      } else if (nextList.length === 0 && selectedPrintMembers.includes(memId)) {
        setSelectedPrintMembers((mList) => mList.filter((m) => m !== memId));
      }

      return {
        ...prev,
        [memId]: nextList,
      };
    });
  }

  function selectAllTopicsForMember(memId: string) {
    if (!selectedPrintMembers.includes(memId)) {
      setSelectedPrintMembers((prev) => [...prev, memId]);
    }
    setSelectedMemberTopics((prev) => ({
      ...prev,
      [memId]: topicsOf(memId),
    }));
  }

  function clearAllTopicsForMember(memId: string) {
    setSelectedPrintMembers((prev) => prev.filter((m) => m !== memId));
    setSelectedMemberTopics((prev) => ({
      ...prev,
      [memId]: [],
    }));
  }

  function handleExecutePrint() {
    const activeMembers = memberSlots.filter((id) => (selectedMemberTopics[id] || []).length > 0);
    if (activeMembers.length === 0) return;

    let sectionsHtml = '';
    for (const memId of activeMembers) {
      const sName = shortName(memId);
      const fullName = memId === me.id ? `${me.name} (YOU)` : `${nameOf(memId)} (${sName})`;
      const mTopics = topicsOf(memId).filter((x) =>
        (selectedMemberTopics[memId] || []).includes(x),
      );

      let topicsHtml = '';
      for (const tName of mTopics) {
        const code = codeOf(memId, tName) ?? '';
        topicsHtml += `
          <div class="topic-box">
            <div class="topic-title"><span>${escapeHtml(tName.toUpperCase())}</span><span>${escapeHtml(fullName.toUpperCase())}</span></div>
            <pre class="code-box">${escapeHtml(code || '// (No notes available for this topic)')}</pre>
          </div>
        `;
      }

      sectionsHtml += `
        <div class="member-group">
          <div class="member-banner">${escapeHtml(fullName.toUpperCase())} · ${mTopics.length} TOPIC${mTopics.length === 1 ? '' : 'S'}</div>
          ${topicsHtml}
        </div>
      `;
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(teamName || me.name)} — Team Notebook</title>
  <style>
    @page { margin: 14mm 12mm; size: A4 portrait; }
    * { box-sizing: border-box; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 10px;
      font-size: 10pt;
      line-height: 1.45;
    }
    .notebook-top {
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 22px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .doc-title { font-size: 16pt; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
    .doc-sub { font-size: 8.5pt; color: #555; }
    .member-group { margin-bottom: 26px; }
    .member-group + .member-group { break-before: page; page-break-before: always; }
    .member-banner {
      font-size: 11.5pt;
      font-weight: 700;
      background: #f0f0ea;
      border-left: 5px solid #111;
      padding: 7px 12px;
      margin: 0 0 14px 0;
      letter-spacing: 0.04em;
    }
    .topic-box {
      margin-bottom: 16px;
      border: 1px solid #d4d0c8;
      border-radius: 4px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .topic-title {
      background: #f9f9f6;
      border-bottom: 1px solid #e2ded6;
      padding: 6px 12px;
      font-weight: 700;
      font-size: 9.5pt;
      letter-spacing: 0.05em;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .code-box {
      margin: 0;
      padding: 12px;
      font-family: inherit;
      font-size: 8.5pt;
      line-height: 1.42;
      white-space: pre-wrap;
      word-break: break-all;
      background: #fff;
      color: #1a1a1a;
    }
  </style>
</head>
<body>
  <div class="notebook-top">
    <div>
      <h1 class="doc-title">${escapeHtml(teamName || me.name)} · Team Notebook</h1>
      <div class="doc-sub">ICPC reference · one section per member</div>
    </div>
    <div class="doc-sub">${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
  </div>
  ${sectionsHtml}
</body>
</html>`;

    setShowPrintModal(false);

    let iframe = document.getElementById('notebook-print-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'notebook-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    }, 250);
  }

  // ── Notebook actions ────────────────────────────────────────────────────
  // On a team you may edit a teammate's page too; the server logs it on their page with your name.
  const [since, setSince] = useState('');
  function startEdit() {
    setSince(d?.notes?.find((n) => n.user_id === active && n.topic === tpl)?.updated_at ?? '');
    setDraft(codeOf(active, tpl) ?? '');
    setTimeout(() => textRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setDraft(null);
  }

  async function saveEdit() {
    const owner = active === me.id ? {} : { owner: active };
    const ok = await run('teamNote', { topic: tpl, code: draft, since, ...owner });
    if (ok) setDraft(null);
    return ok;
  }

  function switchMember(id: string) {
    if (editing) cancelEdit();
    setActiveMember(id);
  }

  function switchTemplate(name: string) {
    if (editing) cancelEdit();
    setTopicName(name);
  }

  async function commitNewTopic() {
    const name = topicInput.trim();
    if (!name) return;
    const exists = topicList.some((x) => x.toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast(`Topic "${name}" already exists`);
      topicInputRef.current?.focus();
      return;
    }
    if (await run('teamTopic', { topic: name })) {
      setTopicName(name); // switch to the new tab
      setTopicInput('');
    }
  }

  async function commitTopicRename(from: string) {
    const to = topicRenameInput.trim();
    setRenamingTopic(null);
    if (!to || to === from) return;
    if (topicList.some((x) => x !== from && x.toLowerCase() === to.toLowerCase()))
      return showToast(`You already have a topic named "${to}"`);
    if (await run('teamTopicRename', { topic: from, to })) setTopicName(to);
  }

  async function removeTopic(name: string) {
    if (editing) cancelEdit();
    await run('teamTopic', { topic: name, on: false });
  }

  // ── Rename ──────────────────────────────────────────────────────────────
  function startRename() {
    setNameInput(teamName);
    setRenaming(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }
  async function commitRename() {
    setRenaming(false);
    if (t && nameInput.trim() && nameInput.trim() !== teamName)
      await run('teamRename', { teamId: t.id, name: nameInput.trim() });
  }

  // The selected member's own log: what they added, renamed, removed and edited, newest first.
  const history: HistoryEntry[] = (d?.history ?? [])
    .filter((h) => h.user_id === active || h.by === active)
    .map((h) => ({
      action: h.what.charAt(0).toUpperCase() + h.what.slice(1),
      other: !h.by
        ? undefined
        : h.user_id === active
          ? `by ${h.by_name ?? 'a former teammate'}`
          : `on ${h.who}'s page`,
      by: new Date(h.at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      ago: ago(h.at),
    }));

  // ── History: show "editing now" on top when in edit mode ────────────────
  const displayHistory: HistoryEntry[] = editing
    ? [{ action: `Editing ${tpl}`, by: 'now', ago: 'editing now' }, ...history]
    : history;

  // ── Page title ──────────────────────────────────────────────────────────
  const title = onTeam ? (
    <>
      <span
        className="label"
        style={{ display: 'block', marginBottom: 2, textTransform: 'uppercase' }}
      >
        your team
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {renaming ? (
          <input
            ref={nameRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            style={{
              fontSize: 'inherit',
              fontWeight: 'inherit',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid var(--acc)',
              outline: 'none',
              width: '16ch',
            }}
          />
        ) : (
          <span>{teamName}.</span>
        )}
        <button
          className="btn xs line no-print"
          onClick={startRename}
          aria-label="Rename team"
          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
        >
          ✎
        </button>
      </span>
    </>
  ) : (
    <>
      You are not on a team <span className="acc">yet.</span>
    </>
  );

  const aside = (
    <div className="row" style={{ gap: 8 }}>
      <button className="btn sm line no-print" onClick={openPrintModal}>
        print notebook
      </button>
      {onTeam && (
        <button
          className="btn sm line no-print"
          style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}
          onClick={() => setConfirmLeave(true)}
        >
          leave your team
        </button>
      )}
    </div>
  );

  if (!d) return <Page title="ICPC teams">{null}</Page>;

  return (
    <Page title={title} aside={aside}>
      <div className="bento">
        {onTeam && (
          <div
            role="tablist"
            style={{
              gridColumn: '1 / -1',
              flexDirection: 'row',
              justifyContent: 'flex-start',
              gap: 8,
            }}
          >
            {(
              [
                ['notes', 'Notebook'],
                ['strength', 'Strength'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={view === k}
                className={`tag tab ${view === k ? 'on' : ''}`}
                style={{ padding: '10px 18px' }}
                onClick={() => setView(k)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {/* ── Notebook panel ────────────────────────────────────────────── */}
        {(view === 'notes' || !onTeam) && (
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            {/* Row 1: label left · member tabs + count right */}
            <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
              <p className="label" style={{ margin: 0 }}>
                {active === me.id ? 'your topics' : `${nameOf(active)}'s topics`}
              </p>

              <div className="row" style={{ gap: 6, alignItems: 'center', position: 'relative' }}>
                {memberSlots.map((id) => {
                  const label = shortName(id);
                  const isActive = active === id;
                  return (
                    <button
                      key={id}
                      className="tag tab"
                      aria-pressed={isActive}
                      data-nav
                      onClick={() => switchMember(id)}
                      style={
                        isActive
                          ? {
                              background: 'var(--acc)',
                              color: 'var(--on)',
                              borderColor: 'var(--acc)',
                            }
                          : {}
                      }
                    >
                      {label}
                    </button>
                  );
                })}

                {/* + button opens LFT dropdown */}
                <div style={{ position: 'relative' }} ref={lftRef}>
                  <button
                    className="tag tab"
                    style={{ fontWeight: 700 }}
                    title={memberSlots.length >= maxSlots ? 'Your team is full' : 'Find a teammate'}
                    disabled={memberSlots.length >= maxSlots}
                    onClick={() => setShowLFT((v) => !v)}
                  >
                    +
                  </button>

                  {showLFT &&
                    (() => {
                      const q = lftSearch.trim().toLowerCase();
                      const pool = d.free.filter(
                        (m) =>
                          !q ||
                          m.name.toLowerCase().includes(q) ||
                          m.handle.toLowerCase().includes(q),
                      );
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            right: 0,
                            background: 'var(--bg, #f5f5f0)',
                            border: '1px solid var(--line)',
                            borderRadius: 6,
                            width: 300,
                            zIndex: 50,
                            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                          }}
                        >
                          {/* header + search */}
                          <div
                            style={{
                              padding: '10px 12px',
                              borderBottom: '1px solid var(--line)',
                            }}
                          >
                            <p className="label" style={{ margin: '0 0 8px' }}>
                              add a teammate
                            </p>
                            <input
                              autoFocus
                              type="text"
                              placeholder="search by name or CF handle…"
                              value={lftSearch}
                              onChange={(e) => setLftSearch(e.target.value)}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '6px 10px',
                                borderRadius: 4,
                                border: '1px solid var(--line)',
                                background: 'var(--bg)',
                                fontSize: '0.82rem',
                                outline: 'none',
                              }}
                            />
                          </div>
                          {/* results */}
                          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {pool.length === 0 ? (
                              <p className="label" style={{ padding: '12px 14px', margin: 0 }}>
                                no members found
                              </p>
                            ) : (
                              pool.map((m) => {
                                const isSent = d.sent.includes(m.id);
                                return (
                                  <div
                                    key={m.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '9px 12px',
                                      borderBottom: '1px solid var(--line)',
                                    }}
                                  >
                                    <span className="grow" style={{ minWidth: 0 }}>
                                      <strong
                                        className="hi"
                                        style={{ display: 'block', fontSize: '0.88rem' }}
                                      >
                                        {m.name}
                                      </strong>
                                      <span className="label" style={{ fontSize: '0.78rem' }}>
                                        {m.handle}
                                      </span>
                                    </span>
                                    <button
                                      className="btn xs line"
                                      disabled={isSent}
                                      onClick={() => run('teamInvite', { user: m.id })}
                                      style={{ flexShrink: 0 }}
                                    >
                                      {isSent ? 'asked' : 'invite'}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </div>

                <span className="label" style={{ marginLeft: 2 }}>
                  {memberSlots.length}/{maxSlots}
                </span>
              </div>
            </div>

            {/* Row 2: template tabs left · EDIT / CANCEL+SAVE right */}
            <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {topicList.map((x) =>
                  renamingTopic === x ? (
                    <input
                      key={x}
                      autoFocus
                      aria-label={`Rename ${x}`}
                      value={topicRenameInput}
                      maxLength={40}
                      onChange={(e) => setTopicRenameInput(e.target.value)}
                      onBlur={() => commitTopicRename(x)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setRenamingTopic(null);
                      }}
                      style={{
                        height: 40,
                        padding: '0 12px',
                        border: '1px solid var(--acc)',
                        outline: 'none',
                        fontSize: 15,
                        width: '18ch',
                        background: 'var(--bg)',
                      }}
                    />
                  ) : (
                    <span key={x} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <button
                        className="tag tab"
                        aria-pressed={x === tpl}
                        data-nav
                        onClick={() => switchTemplate(x)}
                        onDoubleClick={() => {
                          if (!own) return;
                          setTopicRenameInput(x);
                          setRenamingTopic(x);
                        }}
                        title={own ? 'Double-click to rename' : undefined}
                        style={
                          x === tpl
                            ? { background: '#111', color: '#fff', borderColor: '#111' }
                            : {}
                        }
                      >
                        {x.toUpperCase()}
                      </button>
                      {manageTopics && own && (
                        <>
                          <button
                            type="button"
                            className="tag tab"
                            onClick={() => {
                              setTopicRenameInput(x);
                              setRenamingTopic(x);
                            }}
                            title={`Rename ${x}`}
                            aria-label={`Rename ${x}`}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="tag tab"
                            onClick={() => setConfirmDeleteTopic({ name: x })}
                            title={`Remove ${x}`}
                            aria-label={`Remove ${x}`}
                            style={{ color: 'var(--bad)' }}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </span>
                  ),
                )}

                {/* inline new-topic input & manage controls: your own topics only */}
                {!own ? null : manageTopics ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input
                      ref={topicInputRef}
                      autoFocus
                      type="text"
                      placeholder="topic name…"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitNewTopic();
                        if (e.key === 'Escape') {
                          setManageTopics(false);
                          setTopicInput('');
                        }
                      }}
                      style={{
                        height: 40,
                        padding: '0 12px',
                        border: '1px solid var(--acc)',
                        outline: 'none',
                        fontSize: 15,
                        width: '18ch',
                        background: 'var(--bg)',
                      }}
                    />
                    <button
                      className="btn xs"
                      style={{
                        background: 'var(--acc)',
                        color: 'var(--on)',
                        border: 'none',
                        height: 40,
                        padding: '0 14px',
                      }}
                      onClick={commitNewTopic}
                    >
                      Add
                    </button>
                    <button
                      className="btn xs line"
                      onClick={() => {
                        setManageTopics(false);
                        setTopicInput('');
                      }}
                      style={{ height: 40, padding: '0 14px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="tag tab"
                    style={{ fontWeight: 700 }}
                    title="Add or remove topics"
                    onClick={() => {
                      setManageTopics(true);
                      setTimeout(() => topicInputRef.current?.focus(), 0);
                    }}
                  >
                    +
                  </button>
                )}
              </div>

              {(own || onTeam) &&
                !!tpl &&
                (editing ? (
                  <button className="btn sm line" data-close onClick={cancelEdit}>
                    CLOSE EDITOR
                  </button>
                ) : (
                  <button className="btn sm line no-print" onClick={startEdit}>
                    ✎ EDIT
                  </button>
                ))}
            </div>

            {/* Code area + history */}
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              {/* code / textarea */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing ? (
                  <SaveForm
                    label={`Unsaved changes to ${tpl}`}
                    saveLabel="Save template"
                    extraDirty={draft !== (codeOf(active, tpl) ?? '')}
                    onDiscard={cancelEdit}
                    onSubmit={saveEdit}
                  >
                    <textarea
                      ref={textRef}
                      value={draft ?? ''}
                      maxLength={100000}
                      onChange={(e) => setDraft(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: 280,
                        resize: 'vertical',
                        outline: '2px solid var(--acc)',
                        borderRadius: 4,
                        fontFamily: 'var(--mono, monospace)',
                        fontSize: '0.82rem',
                        padding: 16,
                        background: 'var(--bg)',
                        boxSizing: 'border-box',
                        lineHeight: 1.6,
                      }}
                    />
                  </SaveForm>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      minHeight: 280,
                      background: 'var(--bg)',
                      borderRadius: 4,
                      padding: 16,
                      overflowX: 'auto',
                      fontFamily: 'var(--mono, monospace)',
                      fontSize: '0.82rem',
                      lineHeight: 1.6,
                    }}
                  >
                    {currentCode}
                  </pre>
                )}
              </div>

              {/* edit history */}
              <div
                style={{
                  width: 220,
                  flexShrink: 0,
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: 280,
                }}
              >
                <p
                  className="label"
                  style={{
                    padding: '10px 14px',
                    margin: 0,
                    borderBottom: '1px solid var(--line)',
                    flexShrink: 0,
                    background: 'var(--bg, #f5f5f0)',
                  }}
                >
                  HISTORY · {activeName}
                </p>
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {displayHistory.length === 0 && (
                    <p className="label" style={{ padding: '10px 14px', margin: 0 }}>
                      no changes yet
                    </p>
                  )}
                  {displayHistory.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderBottom:
                          i < displayHistory.length - 1 ? '1px solid var(--line)' : 'none',
                        background: i === 0 && editing ? 'var(--bg)' : undefined,
                      }}
                    >
                      <strong className="hi" style={{ display: 'block', fontSize: '0.85rem' }}>
                        {h.action}
                      </strong>
                      {h.other && (
                        <span className="acc" style={{ display: 'block', fontSize: '0.85rem' }}>
                          {h.other}
                        </span>
                      )}
                      <span className="label">
                        <span className="acc">{h.by}</span>
                        {h.ago === 'editing now' ? (
                          <>
                            {' '}
                            · <span className="acc">editing now</span>
                          </>
                        ) : (
                          <> · {h.ago}</>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* footer */}
            <p className="label" style={{ marginTop: 10, marginBottom: 0 }}>
              {editing ? (
                active === me.id ? (
                  <>Editing your page · topic: {tpl} · saving adds a line to your history</>
                ) : (
                  <>
                    Editing {nameOf(active)}&apos;s page · topic: {tpl} · logged on their page with
                    your name
                  </>
                )
              ) : (
                <>
                  {nameOf(active)} · topic: {tpl || 'none'}
                </>
              )}
            </p>
          </section>
        )}
        {onTeam && view === 'strength' && d.stats && (
          <TeamOverview stats={d.stats} names={nameOf} me={me.id} />
        )}
      </div>

      {/* ── Leave team confirmation modal ─────────────────────────────── */}
      {confirmLeave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--bg, #f5f5f0)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 28,
              maxWidth: 360,
              width: '90%',
            }}
          >
            <p className="h3" style={{ margin: '0 0 8px' }}>
              Leave {teamName}?
            </p>
            <p className="body" style={{ margin: '0 0 20px' }}>
              Your topics stay with you. You lose access to your teammates' notebooks.
            </p>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn sm line" onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
              <button
                className="btn sm"
                style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
                onClick={() => {
                  setConfirmLeave(false);
                  void run('teamLeave');
                }}
              >
                Leave team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove topic confirmation modal ───────────────────────────── */}
      {confirmDeleteTopic && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--bg, #f5f5f0)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 28,
              maxWidth: 380,
              width: '90%',
              boxShadow: '0 8px 30px rgba(0,0,0,.15)',
            }}
          >
            <p className="h3" style={{ margin: '0 0 8px' }}>
              {`Remove "${confirmDeleteTopic.name}"?`}
            </p>
            <p className="body" style={{ margin: '0 0 20px' }}>
              {`Your page on "${confirmDeleteTopic.name}" is deleted. Teammates' topics are not touched.`}
            </p>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn sm line" onClick={() => setConfirmDeleteTopic(null)}>
                Cancel
              </button>
              {
                <button
                  className="btn sm"
                  style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
                  onClick={() => {
                    void removeTopic(confirmDeleteTopic.name);
                    setConfirmDeleteTopic(null);
                  }}
                >
                  Remove topic
                </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Print notebook modal ────────────────────────────────────────── */}
      {showPrintModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--bg, #f5f5f0)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 24,
              maxWidth: 480,
              width: '92%',
              boxShadow: '0 8px 30px rgba(0,0,0,.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <p className="h3" style={{ margin: '0 0 4px' }}>
              Print team notebook
            </p>
            <p className="body" style={{ margin: '0 0 16px', fontSize: '0.88rem' }}>
              Select which members and topics to include. The notebook will be printed with
              categories of which user and their topics.
            </p>

            {/* Member Selection Section */}
            <div
              style={{
                marginBottom: 16,
                border: '1px solid var(--line)',
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                <strong
                  className="label"
                  style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}
                >
                  Members ({selectedPrintMembers.length}/{memberSlots.length})
                </strong>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn xs line"
                    style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={selectAllMembers}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="btn xs line"
                    style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={clearAllMembers}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {memberSlots.map((id) => {
                  const isChecked = selectedPrintMembers.includes(id);
                  const label =
                    id === me.id ? `YOU (${me.name})` : `${shortName(id)} (${nameOf(id)})`;
                  return (
                    <label
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        padding: '4px 0',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePrintMember(id)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Topic Selection Section */}
            <div
              style={{
                marginBottom: 20,
                border: '1px solid var(--line)',
                borderRadius: 6,
                padding: 14,
              }}
            >
              {memberSlots.length === 1 ? (
                // Single member layout (matches exact screenshot layout)
                <>
                  <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                    <strong
                      className="label"
                      style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}
                    >
                      Topics ({(selectedMemberTopics[memberSlots[0]] || []).length}/
                      {topicsOf(memberSlots[0]).length})
                    </strong>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="btn xs line"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => selectAllTopicsForMember(memberSlots[0])}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="btn xs line"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => clearAllTopicsForMember(memberSlots[0])}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 180,
                      overflowY: 'auto',
                    }}
                  >
                    {topicsOf(memberSlots[0]).map((tp) => {
                      const isChecked = (selectedMemberTopics[memberSlots[0]] || []).includes(tp);
                      return (
                        <label
                          key={tp}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '4px 0',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTopicForMember(memberSlots[0], tp)}
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                          <span>{tp}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                // Multi-member layout: categorized by each member
                <>
                  <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
                    <strong
                      className="label"
                      style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}
                    >
                      Topics by Member (
                      {Object.values(selectedMemberTopics).reduce((s, a) => s + a.length, 0)}/
                      {memberSlots.reduce((n, id) => n + topicsOf(id).length, 0)})
                    </strong>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="btn xs line"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={selectAllMembers}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="btn xs line"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={clearAllMembers}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {memberSlots.map((id) => {
                      const mTopics = selectedMemberTopics[id] || [];
                      const label =
                        id === me.id ? `YOU (${me.name})` : `${shortName(id)} (${nameOf(id)})`;
                      return (
                        <div
                          key={id}
                          style={{
                            borderBottom: '1px solid var(--line)',
                            paddingBottom: 10,
                          }}
                        >
                          <div
                            className="row between"
                            style={{ alignItems: 'center', marginBottom: 6 }}
                          >
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</span>
                            <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                              <span className="label" style={{ fontSize: '0.72rem' }}>
                                ({mTopics.length}/{topicsOf(id).length})
                              </span>
                              <button
                                type="button"
                                className="btn xs line"
                                style={{ minHeight: 20, padding: '1px 5px', fontSize: '0.68rem' }}
                                onClick={() => selectAllTopicsForMember(id)}
                              >
                                All
                              </button>
                              <button
                                type="button"
                                className="btn xs line"
                                style={{ minHeight: 20, padding: '1px 5px', fontSize: '0.68rem' }}
                                onClick={() => clearAllTopicsForMember(id)}
                              >
                                None
                              </button>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              paddingLeft: 8,
                            }}
                          >
                            {topicsOf(id).map((tp) => (
                              <label
                                key={tp}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  padding: '2px 0',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={mTopics.includes(tp)}
                                  onChange={() => toggleTopicForMember(id, tp)}
                                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                                />
                                <span>{tp}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="row between" style={{ alignItems: 'center' }}>
              <span className="label" style={{ fontSize: '0.78rem' }}>
                {Object.values(selectedMemberTopics).reduce((s, a) => s + a.length, 0) === 0
                  ? 'SELECT AT LEAST 1 MEMBER AND 1 TOPIC'
                  : `Selected ${memberSlots.filter((id) => (selectedMemberTopics[id] || []).length > 0).length} member(s) · ${Object.values(selectedMemberTopics).reduce((s, a) => s + a.length, 0)} topic(s)`}
              </span>
              <div className="row" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="btn sm line"
                  onClick={() => setShowPrintModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn sm"
                  style={{ background: 'var(--acc)', color: 'var(--on)', border: 'none' }}
                  disabled={
                    Object.values(selectedMemberTopics).reduce((s, a) => s + a.length, 0) === 0
                  }
                  onClick={handleExecutePrint}
                >
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ────────────────────────────────────────── */}
      {toast && (
        <div className="toasts">
          <div
            className="toast"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--mono, monospace)',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>⚠</span>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </Page>
  );
}

// One colour per member, readable on both the paper and the dark skin.
const MEMBER_COLORS = ['#1f3bff', '#ff5a1f', '#0fa968'];

/** The team's real numbers: synced Codeforces/VJudge stats, accepted problems by tag and difficulty, notebooks. */
function TeamOverview({
  stats,
  names,
  me,
}: {
  stats: TeamStats;
  names: (id: string) => string;
  me: string;
}) {
  const color = (id: string) =>
    MEMBER_COLORS[stats.members.findIndex((m) => m.id === id) % MEMBER_COLORS.length];
  const first = (id: string) => (id === me ? 'You' : names(id).split(' ')[0]);
  const rated = stats.members.filter((m) => m.cf_rating);
  const avg = rated.length
    ? Math.round(rated.reduce((a, m) => a + m.cf_rating!, 0) / rated.length)
    : null;
  const totalSolved = stats.members.reduce((a, m) => a + m.problems_solved, 0);
  const topTag = Math.max(1, ...stats.tags.map((x) => x.team));
  // Solves synced before tags were stored carry none; that member is "not synced", not weak everywhere.
  const tagged = new Set(stats.tags.flatMap((x) => Object.keys(x.per)));
  const unsynced = stats.members.filter((m) => m.problems_solved > 0 && !tagged.has(m.id));
  const topBand = Math.max(1, ...stats.spread.map((x) => x.n));
  const kpis: [string, string | number, string?][] = [
    ['avg rating', avg ?? '—', avg ? rankFor(avg).color : undefined],
    ['team solved', stats.distinctSolved],
    [`solved by all ${stats.members.length}`, stats.solvedByAll],
    ['notebook topics', stats.members.reduce((a, m) => a + m.topics, 0)],
  ];
  return (
    <>
      {/* Scoreboard: the four numbers, then who carries how much of the solving. */}
      <section className="tov-board" style={{ gridColumn: '1 / -1' }}>
        <div className="tov-board-head">
          <span>team overview</span>
        </div>
        <div className="tov-kpis">
          {kpis.map(([k, v, c]) => (
            <div key={k}>
              <b style={c ? { color: `color-mix(in srgb, ${c} 65%, white)` } : undefined}>{v}</b>
              <span>{k}</span>
            </div>
          ))}
        </div>
        {totalSolved > 0 && (
          <>
            <div className="tov-share" aria-label="Share of Codeforces solves per member">
              {stats.members.map((m) => (
                <i
                  key={m.id}
                  title={`${names(m.id)}: ${m.problems_solved}`}
                  style={{ flexGrow: m.problems_solved, background: color(m.id) }}
                />
              ))}
            </div>
            <div className="tov-legend">
              {stats.members.map((m) => (
                <span key={m.id}>
                  <i style={{ background: color(m.id) }} />
                  {first(m.id)} {Math.round((m.problems_solved / totalSolved) * 100)}%
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* One card per member, in their Codeforces rank colour. */}
      {stats.members.map((m) => {
        const rank = rankFor(m.cf_rating);
        const next = Math.min(
          ...[1200, 1400, 1600, 1900, 2100, 2400, 3000].filter((x) => x > (m.cf_rating ?? 0)),
        );
        const prev = Math.max(
          0,
          ...[1200, 1400, 1600, 1900, 2100, 2400, 3000].filter((x) => x <= (m.cf_rating ?? 0)),
        );
        const toNext =
          Number.isFinite(next) && m.cf_rating ? ((m.cf_rating - prev) / (next - prev)) * 100 : 0;
        return (
          <section
            key={m.id}
            className={`panel ${stats.members.length === 2 ? 'c6' : 'c4'} tov-card`}
            style={{ '--rk': rank.color, '--mc': color(m.id) } as React.CSSProperties}
          >
            <div className="tov-who">
              <MemberFace id={m.id} name={names(m.id)} size={44} fg={color(m.id)} />
              <span>
                <strong>{names(m.id)}</strong>
                <span className="label">
                  {m.cf_handle || 'no CF handle'}
                  {m.id === me && ' · you'}
                </span>
              </span>
            </div>
            <div className="tov-rating">
              <b>{m.cf_rating ?? '—'}</b>
              <span className="tov-rank">{rank.title}</span>
            </div>
            <div className="tov-next">
              <div>
                <i style={{ width: `${toNext}%` }} />
              </div>
              <span className="label">
                {m.cf_rating && Number.isFinite(next)
                  ? `${next - m.cf_rating} to ${next} · peak ${m.peak || m.cf_rating}`
                  : `peak ${m.peak || '—'}`}
              </span>
            </div>
            <dl className="tov-mini">
              {(
                [
                  ['CF solved', m.problems_solved],
                  ['VJ solved', m.vj_solved],
                  ['contests', m.contests_participated],
                  ['streak', `${m.current_streak}d`],
                  ['topics', m.topics],
                  ['edits · 30d', m.edits_30d],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      {/* Solve map: bar length = distinct team solves; segments = each member's solves on that tag. */}
      <section className="panel c8">
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <p className="label">solve map · top tags</p>
          <div className="tov-legend">
            {stats.members.map((m) => (
              <span key={m.id}>
                <i style={{ background: color(m.id) }} />
                {first(m.id)}
              </span>
            ))}
          </div>
        </div>
        {stats.tags.length === 0 ? (
          <p className="body">
            No tagged solves yet. Each member syncs Codeforces once to fill this in.
          </p>
        ) : (
          <div className="tov-tags">
            {unsynced.length > 0 && (
              <p className="label">
                {unsynced.map((m) => first(m.id)).join(', ')}: sync Codeforces once to add tags
              </p>
            )}
            {stats.tags.map((x) => {
              const sum = stats.members.reduce((a, m) => a + (x.per[m.id] ?? 0), 0) || 1;
              const gaps = stats.members
                .filter((m) => tagged.has(m.id) && !x.per[m.id])
                .map((m) => first(m.id));
              return (
                <div key={x.tag} className="tov-tag">
                  <span className="tov-tag-name">{x.tag}</span>
                  <div className="tov-tag-track">
                    <div style={{ width: `${(x.team / topTag) * 100}%` }}>
                      {stats.members.map((m) =>
                        x.per[m.id] ? (
                          <i
                            key={m.id}
                            title={`${names(m.id)}: ${x.per[m.id]}`}
                            style={{ flexGrow: x.per[m.id]! / sum, background: color(m.id) }}
                          />
                        ) : null,
                      )}
                    </div>
                  </div>
                  <b className="tov-tag-n">{x.team}</b>
                  <span className="tov-gap">{gaps.length ? `gap: ${gaps.join(', ')}` : ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Difficulty histogram, each band in the Codeforces colour of that rating. */}
      <section className="panel c4">
        <p className="label">difficulty spread</p>
        {stats.spread.length === 0 ? (
          <p className="body">No rated problems yet. Sync Codeforces from your profile.</p>
        ) : (
          <div className="tov-hist">
            {stats.spread.map((b) => (
              <div key={b.band} title={`${b.n} problems rated ${b.band}–${b.band + 399}`}>
                <span className="tov-hist-n">{b.n}</span>
                <i
                  style={{
                    height: `${Math.max(4, (b.n / topBand) * 100)}%`,
                    background: rankFor(b.band).color,
                  }}
                />
                <span className="tov-hist-k">{b.band === 2800 ? '2800+' : b.band}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
