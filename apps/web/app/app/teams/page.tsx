'use client';
import { useState, useRef, useEffect } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { myTeam, templates } from '@fecpc/content/training';
import { byId, members as allMembers } from '@fecpc/content/site';

// ── Types ────────────────────────────────────────────────────────────────────
type HistoryEntry = { action: string; by: string; ago: string };

// ── Seed per-member notes (each member's draft of each template) ─────────────
const memberNotes: Record<string, Record<string, string>> = {
  YOU: {
    DSU: templates[0].code,
    'Segment tree (sum)': '// Segment tree notes — YOU\n' + templates[1].code,
    Dijkstra: templates[2].code,
  },
  TANVIN: {
    DSU: "// Tanvin's DSU variant\n" + templates[0].code,
    'Segment tree (sum)': templates[1].code,
    Dijkstra: "// Tanvin's Dijkstra notes\n" + templates[2].code,
  },
  MEHEDI: {
    DSU: templates[0].code,
    'Segment tree (sum)': templates[1].code,
    Dijkstra: templates[2].code,
  },
};

// ── Seed history (newest first) ──────────────────────────────────────────────
const initialHistory: HistoryEntry[] = [
  { action: 'Edited DSU', by: 'YOU', ago: '2 min ago' },
  { action: 'Added Segment tree', by: 'TANVIN', ago: '1 h ago' },
  { action: 'Edited DSU', by: 'YOU', ago: 'yesterday' },
  { action: 'Added DSU', by: 'YOU', ago: '2 days ago' },
  { action: 'Added Dijkstra', by: 'MEHEDI', ago: '3 days ago' },
  { action: 'Optimized DSU find', by: 'YOU', ago: '5 days ago' },
  { action: 'Created notebook', by: 'YOU', ago: '1 week ago' },
];

const MAX_SLOTS = 5;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function Teams() {
  const { s, me, act } = useStore();
  const onTeam = myTeam.members.includes(me.id) || myTeam.coach === me.id;

  // ── Notebook state ──────────────────────────────────────────────────────
  const memberSlots = onTeam ? myTeam.members : [me.id];
  const shortName = (id: string) =>
    id === me.id ? 'YOU' : (byId(id)?.name?.split(' ')[0]?.toUpperCase() ?? id.toUpperCase());

  const [activeMember, setActiveMember] = useState<string>(me.id);
  const [tIdx, setTIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({ ...memberNotes });
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
  const [showLFT, setShowLFT] = useState(false);
  const [lftSearch, setLftSearch] = useState('');
  const [manageTopics, setManageTopics] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [topicList, setTopicList] = useState<{ name: string; code: string }[]>([...templates]);
  const [confirmDeleteTopic, setConfirmDeleteTopic] = useState<{
    index: number;
    name: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintMembers, setSelectedPrintMembers] = useState<string[]>([]);
  const [selectedMemberTopics, setSelectedMemberTopics] = useState<Record<string, string[]>>({});
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lftRef = useRef<HTMLDivElement>(null);

  const allTemplates = topicList;
  const tpl = allTemplates[tIdx] ?? allTemplates[0];
  const activeName = shortName(activeMember);
  const currentCode = drafts[activeName]?.[tpl.name] ?? tpl.code;

  // ── Team name rename state ──────────────────────────────────────────────
  const [teamName, setTeamName] = useState(myTeam.name);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(myTeam.name);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Leave team confirmation ─────────────────────────────────────────────
  const [confirmLeave, setConfirmLeave] = useState(false);

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
    const allTopicNames = topicList.map((t) => t.name);
    const initialMap: Record<string, string[]> = {};
    for (const memId of memberSlots) {
      initialMap[memId] = [...allTopicNames];
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
        [id]: topicList.map((t) => t.name),
      }));
    }
  }

  function selectAllMembers() {
    setSelectedPrintMembers([...memberSlots]);
    const nextMap: Record<string, string[]> = {};
    for (const memId of memberSlots) {
      nextMap[memId] = topicList.map((t) => t.name);
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
      [memId]: topicList.map((t) => t.name),
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
      const fullName =
        memId === me.id
          ? `${me.name} (YOU)`
          : byId(memId)?.name
            ? `${byId(memId).name} (${sName})`
            : sName;
      const mTopics = selectedMemberTopics[memId] || [];

      let topicsHtml = '';
      for (const tName of mTopics) {
        const code = drafts[sName]?.[tName] ?? topicList.find((t) => t.name === tName)?.code ?? '';
        topicsHtml += `
          <div class="topic-box">
            <div class="topic-title">TOPIC: ${escapeHtml(tName.toUpperCase())}</div>
            <pre class="code-box">${escapeHtml(code || '// (No notes available for this topic)')}</pre>
          </div>
        `;
      }

      sectionsHtml += `
        <div class="member-group">
          <div class="member-banner">CATEGORY: MEMBER — ${escapeHtml(fullName.toUpperCase())}</div>
          ${topicsHtml}
        </div>
      `;
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(teamName)} — Team Notebook</title>
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
    .member-group { margin-bottom: 26px; page-break-after: auto; }
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
      <h1 class="doc-title">${escapeHtml(teamName)} · Team Notebook</h1>
      <div class="doc-sub">ICPC Reference Guide · Shared Team Templates</div>
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
  function startEdit() {
    if (activeMember !== me.id) return; // only edit your own notes
    setEditing(true);
    setTimeout(() => textRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
    // restore saved value
    setDrafts((prev) => ({
      ...prev,
      YOU: { ...prev['YOU'], [tpl.name]: memberNotes['YOU'][tpl.name] ?? tpl.code },
    }));
  }

  function saveEdit() {
    setHistory((prev) => [{ action: `Edited ${tpl.name}`, by: 'YOU', ago: 'just now' }, ...prev]);
    // persist the draft as the new saved value
    setDrafts((prev) => ({ ...prev })); // already updated via textarea onChange
    setEditing(false);
  }

  function handleDraftChange(val: string) {
    setDrafts((prev) => ({
      ...prev,
      YOU: { ...(prev['YOU'] ?? {}), [tpl.name]: val },
    }));
  }

  function switchMember(id: string) {
    if (editing) cancelEdit();
    setActiveMember(id);
  }

  function switchTemplate(i: number) {
    if (editing) cancelEdit();
    setTIdx(i);
  }

  function commitNewTopic() {
    const name = topicInput.trim();
    if (!name) return;
    const exists = topicList.some((t) => t.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast(`Topic "${name}" already exists`);
      topicInputRef.current?.focus();
      return;
    }
    setTopicList((prev) => [...prev, { name, code: `// ${name}\n` }]);
    setTIdx(topicList.length); // switch to the new tab
    setTopicInput('');
  }

  function removeTopic(i: number) {
    if (topicList.length <= 1) return; // keep at least one
    if (editing) cancelEdit();
    setTopicList((prev) => prev.filter((_, idx) => idx !== i));
    // keep selection in bounds
    setTIdx((prev) => (prev >= i && prev > 0 ? prev - 1 : 0));
  }

  // ── Rename ──────────────────────────────────────────────────────────────
  function startRename() {
    setNameInput(teamName);
    setRenaming(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }
  function commitRename() {
    if (nameInput.trim()) setTeamName(nameInput.trim());
    setRenaming(false);
  }

  // ── History: show "editing now" on top when in edit mode ────────────────
  const displayHistory: HistoryEntry[] = editing
    ? [{ action: `Edited ${tpl.name}`, by: 'YOU', ago: 'editing now' }, ...history]
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
          style={{ color: 'var(--red, #e63946)', borderColor: 'var(--red, #e63946)' }}
          onClick={() => setConfirmLeave(true)}
        >
          leave your team
        </button>
      )}
    </div>
  );

  return (
    <Page title={title} aside={aside}>
      <div className="bento">
        {/* ── Team stats (only when on a team) ──────────────────────────── */}
        {onTeam && (
          <>
            <section className="panel c4">
              <p className="label">roster · coach {byId(myTeam.coach).name}</p>
              <div className="list">
                {myTeam.members.map((id) => (
                  <div key={id}>
                    <span className="grow">
                      <strong className="hi">{byId(id).name}</strong>
                      <br />
                      <span className="label">
                        {byId(id).rating} · {byId(id).skills.slice(1).join(', ')}
                      </span>
                    </span>
                    {id === me.id && <span className="pill">you</span>}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel c4">
              <p className="label">combined solve map</p>
              {myTeam.map.map(([k, v]) => (
                <div key={k} className="sheet-row">
                  <span>{k}</span>
                  <div className="meter" style={{ '--v': `${v}%` } as React.CSSProperties}>
                    <i />
                  </div>
                  <span className={`num ${v < 35 ? 'bad' : 'acc'}`}>{v}%</span>
                </div>
              ))}
            </section>

            <section className="panel c4">
              <p className="label">mock history</p>
              <div className="list">
                {myTeam.mocks.map(([n, sv, rk]) => (
                  <div key={n}>
                    <span className="grow hi">{n}</span>
                    <span className="acc" style={{ width: 80, textAlign: 'right' }}>
                      {sv} solved
                    </span>
                    <span className="mut" style={{ width: 44, textAlign: 'right' }}>
                      #{rk}
                    </span>
                  </div>
                ))}
              </div>
              <p className="label">next mock: 22 Nov, 10:00</p>
            </section>
          </>
        )}

        {/* ── Notebook panel ────────────────────────────────────────────── */}
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          {/* Row 1: label left · member tabs + count right */}
          <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
            <p className="label" style={{ margin: 0 }}>
              team notebook · shared templates
            </p>

            <div className="row" style={{ gap: 6, alignItems: 'center', position: 'relative' }}>
              {memberSlots.map((id) => {
                const label = shortName(id);
                const isActive = activeMember === id;
                return (
                  <button
                    key={id}
                    className="tag tab"
                    aria-pressed={isActive}
                    onClick={() => switchMember(id)}
                    style={
                      isActive
                        ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }
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
                  title="Find a teammate"
                  onClick={() => setShowLFT((v) => !v)}
                >
                  +
                </button>

                {showLFT &&
                  (() => {
                    const q = lftSearch.trim().toLowerCase();
                    const pool = allMembers.filter(
                      (m) =>
                        !memberSlots.includes(m.id) &&
                        (!q ||
                          m.name.toLowerCase().includes(q) ||
                          m.handle.toLowerCase().includes(q)),
                    );
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          right: 0,
                          background: 'var(--bg, #f5f5f0)',
                          border: '1px solid var(--border, #d8d4cc)',
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
                            borderBottom: '1px solid var(--border, #d8d4cc)',
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
                              border: '1px solid var(--border, #d8d4cc)',
                              background: 'var(--bg2, #eeeee8)',
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
                              const k = `${m.id}:team:`;
                              const isSent = s.sent.includes(k);
                              return (
                                <div
                                  key={m.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '9px 12px',
                                    borderBottom: '1px solid var(--border, #d8d4cc)',
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
                                    onClick={() => act('ping', { kind: 'team', to: m.id })}
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
                {memberSlots.length}/{MAX_SLOTS}
              </span>
            </div>
          </div>

          {/* Row 2: template tabs left · EDIT / CANCEL+SAVE right */}
          <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {allTemplates.map((x, i) => (
                <span
                  key={x.name}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                >
                  <button
                    className="tag tab"
                    aria-pressed={i === tIdx}
                    onClick={() => switchTemplate(i)}
                    style={{
                      ...(i === tIdx
                        ? { background: '#111', color: '#fff', borderColor: '#111' }
                        : {}),
                      paddingRight: manageTopics ? '1.8rem' : undefined,
                    }}
                  >
                    {x.name.toUpperCase()}
                  </button>
                  {manageTopics && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteTopic({ index: i, name: x.name });
                      }}
                      title={`Remove ${x.name}`}
                      aria-label={`Remove ${x.name}`}
                      style={{
                        position: 'absolute',
                        right: 4,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        lineHeight: 1,
                        color: i === tIdx ? '#ff7b7b' : 'var(--red, #e63946)',
                        padding: '2px 4px',
                        fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}

              {/* inline new-topic input & manage controls */}
              {manageTopics ? (
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
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--acc)',
                      outline: 'none',
                      fontSize: '0.78rem',
                      width: '11ch',
                      background: 'var(--bg2, #eeeee8)',
                    }}
                  />
                  <button
                    className="btn xs"
                    style={{
                      background: 'var(--acc)',
                      color: '#fff',
                      border: 'none',
                      padding: '3px 8px',
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
                    style={{ padding: '3px 8px' }}
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

            {activeMember === me.id &&
              (editing ? (
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm line" onClick={cancelEdit}>
                    CANCEL
                  </button>
                  <button
                    className="btn sm"
                    style={{ background: 'var(--acc)', color: '#fff', border: 'none' }}
                    onClick={saveEdit}
                  >
                    SAVE
                  </button>
                </div>
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
              {editing && activeMember === me.id ? (
                <textarea
                  ref={textRef}
                  value={drafts['YOU']?.[tpl.name] ?? tpl.code}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 280,
                    resize: 'vertical',
                    outline: '2px solid var(--acc)',
                    borderRadius: 4,
                    fontFamily: 'var(--mono, monospace)',
                    fontSize: '0.82rem',
                    padding: 16,
                    background: 'var(--bg2, #eeeee8)',
                    boxSizing: 'border-box',
                    lineHeight: 1.6,
                  }}
                />
              ) : (
                <pre
                  style={{
                    margin: 0,
                    minHeight: 280,
                    background: 'var(--bg2, #eeeee8)',
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
                border: '1px solid var(--border, #d8d4cc)',
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
                  borderBottom: '1px solid var(--border, #d8d4cc)',
                  flexShrink: 0,
                  background: 'var(--bg, #f5f5f0)',
                }}
              >
                EDIT HISTORY
              </p>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                }}
              >
                {displayHistory.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderBottom:
                        i < displayHistory.length - 1 ? '1px solid var(--border, #d8d4cc)' : 'none',
                      background: i === 0 && editing ? 'var(--bg2, #eeeee8)' : undefined,
                    }}
                  >
                    <strong className="hi" style={{ display: 'block', fontSize: '0.85rem' }}>
                      {h.action}
                    </strong>
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
              <>Editing as YOU · topic: {tpl.name} · changes are saved to history</>
            ) : (
              <>
                Last edited by {activeName} · topic: {tpl.name}
              </>
            )}
          </p>
        </section>
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
              border: '1px solid var(--border, #d8d4cc)',
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
              You will lose access to the shared notebook. This cannot be undone.
            </p>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn sm line" onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
              <button
                className="btn sm"
                style={{ background: 'var(--red, #e63946)', color: '#fff', border: 'none' }}
                onClick={() => setConfirmLeave(false)}
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
              border: '1px solid var(--border, #d8d4cc)',
              borderRadius: 8,
              padding: 28,
              maxWidth: 380,
              width: '90%',
              boxShadow: '0 8px 30px rgba(0,0,0,.15)',
            }}
          >
            <p className="h3" style={{ margin: '0 0 8px' }}>
              {topicList.length <= 1
                ? 'Cannot remove topic'
                : `Remove "${confirmDeleteTopic.name}"?`}
            </p>
            <p className="body" style={{ margin: '0 0 20px' }}>
              {topicList.length <= 1
                ? 'You must keep at least one topic in the notebook.'
                : `Are you sure you want to remove this topic from the team notebook? All notes under "${confirmDeleteTopic.name}" will be removed.`}
            </p>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn sm line" onClick={() => setConfirmDeleteTopic(null)}>
                {topicList.length <= 1 ? 'Close' : 'Cancel'}
              </button>
              {topicList.length > 1 && (
                <button
                  className="btn sm"
                  style={{ background: 'var(--red, #e63946)', color: '#fff', border: 'none' }}
                  onClick={() => {
                    removeTopic(confirmDeleteTopic.index);
                    setConfirmDeleteTopic(null);
                  }}
                >
                  Remove topic
                </button>
              )}
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
              border: '1px solid var(--border, #d8d4cc)',
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
                border: '1px solid var(--border, #d8d4cc)',
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
                    id === me.id
                      ? `YOU (${me.name})`
                      : byId(id)?.name
                        ? `${shortName(id)} (${byId(id).name})`
                        : shortName(id);
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
                border: '1px solid var(--border, #d8d4cc)',
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
                      {topicList.length})
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
                    {topicList.map((t) => {
                      const isChecked = (selectedMemberTopics[memberSlots[0]] || []).includes(
                        t.name,
                      );
                      return (
                        <label
                          key={t.name}
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
                            onChange={() => toggleTopicForMember(memberSlots[0], t.name)}
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                          <span>{t.name}</span>
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
                      {topicList.length * memberSlots.length})
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
                        id === me.id
                          ? `YOU (${me.name})`
                          : byId(id)?.name
                            ? `${shortName(id)} (${byId(id).name})`
                            : shortName(id);
                      return (
                        <div
                          key={id}
                          style={{
                            borderBottom: '1px solid var(--border, #d8d4cc)',
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
                                ({mTopics.length}/{topicList.length})
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
                            {topicList.map((t) => (
                              <label
                                key={t.name}
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
                                  checked={mTopics.includes(t.name)}
                                  onChange={() => toggleTopicForMember(id, t.name)}
                                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                                />
                                <span>{t.name}</span>
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
                  style={{ background: 'var(--acc)', color: '#fff', border: 'none' }}
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
