'use client';
import { useState } from 'react';
import { can, rankFor, type Sheet } from '@fecpc/contracts';
import { cfUrl } from '@fecpc/content/member-area';
import { useStore } from '../Store';
import { HandleBox, useSolved } from '../Judge';
import { useConfirm } from '../shared/PromptDialog';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;
// Topic colours, matching the Core tab; any other tag gets a stable colour from the same palette.
const HUE: Record<string, string> = {
  implementation: '#12a150',
  strings: '#d98e00',
  dp: '#e5413a',
  greedy: '#7c4dff',
  math: '#2f5bff',
  graphs: '#d6266f',
  'dfs and similar': '#d6266f',
  trees: '#d6266f',
  'binary search': '#0e9aa7',
  'data structures': '#b45309',
  'constructive algorithms': '#9333ea',
  'number theory': '#1d4ed8',
  combinatorics: '#be185d',
  sortings: '#0891b2',
  'brute force': '#64748b',
  bitmasks: '#0d9488',
  'two pointers': '#ca8a04',
};
const PALETTE = Object.values(HUE);
const hue = (t: string) =>
  HUE[t] ?? PALETTE[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]!;
const tier = (r: number | null) => (r ? rankFor(r).color : 'var(--dim)');

/** One sheet: progress, then every problem with its difficulty, tags and how many members solved it. */
function SheetView({ sh, actions }: { sh: Sheet; actions?: React.ReactNode }) {
  const { s, counts } = useStore();
  const { isSolved } = useSolved();
  const done = sh.problems.filter((p) => isSolved(p.id)).length,
    total = Math.max(1, counts.peopleCount);
  return (
    <section className="panel col-span-full">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-3">
        <div>
          <p className="label">
            {sh.kind === 'weekly' ? 'refreshes every monday' : `by ${sh.by ?? 'the club'}`}
          </p>
          <h2 className="h3">{sh.title}</h2>
          {sh.note && <p className="body dim">{sh.note}</p>}
          {actions}
        </div>
        <div className="text-right">
          <p className="label">you solved</p>
          <p className="big num">
            {done}
            <span className="dim">/{sh.problems.length}</span>
          </p>
        </div>
      </div>
      <div
        className="[&_i]:flex-1 [&_i]:[background:color-mix(in_srgb,var(--r)_22%,transparent)] [&_i.on]:[background:var(--r)] flex gap-0.75 h-[12px]"
        aria-hidden
      >
        {sh.problems.map((p) => (
          <i
            key={p.id}
            className={isSolved(p.id) ? 'on' : ''}
            style={css({ '--r': tier(p.rating) })}
          />
        ))}
      </div>
      {!s.handle && (
        <div className="mt-3">
          <HandleBox />
        </div>
      )}
      <div className="mt-5" role="table" aria-label={sh.title}>
        <div
          className="sh-row sh-th max-[641px]:[&_span:nth-child(3)]:hidden pt-0 pb-2 label"
          role="row"
        >
          <span role="columnheader">#</span>
          <span role="columnheader">problem</span>
          <span role="columnheader">club solved</span>
          <span className="text-right" role="columnheader">
            difficulty
          </span>
        </div>
        {sh.problems.map((p, i) => {
          const ok = isSolved(p.id),
            c = tier(p.rating);
          return (
            <div
              key={p.id}
              role="row"
              className={`sh-row ${ok ? 'done' : ''}`}
              style={css({ '--r': c })}
            >
              <span
                role="cell"
                className="[.done_&]:[background:#12a150] [.done_&]:border-[#12a150] w-[28px] h-[28px] [display:grid] [place-items:center] [border:1.5px_solid_var(--line2,var(--dim))] rounded-[50%] text-[14px] [color:var(--dim)] [.done_&]:text-white"
                aria-label={ok ? 'solved' : 'not solved'}
              >
                {ok ? '✓' : i + 1}
              </span>
              <span
                role="cell"
                className="[&_a]:text-hi [&_a]:[text-decoration:none] [&_a]:[font-weight:600] [&_a:hover]:text-acc min-w-0"
              >
                <a href={cfUrl(p.id)} target="_blank" rel="noreferrer">
                  {p.name} <span className="dim">{p.id} ↗</span>
                </a>
                <span className="[&_span]:text-[14px] [&_span]:[color:color-mix(in_oklab,var(--t,var(--dim)),var(--ink)_30%)] [&_span]:[border:1px_solid_color-mix(in_srgb,var(--t,var(--line))_55%,transparent)] [&_span]:[background:color-mix(in_srgb,var(--t,transparent)_10%,transparent)] [&_span]:p-[1px_8px] flex flex-wrap gap-1.5 mt-1.5">
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} style={css({ '--t': hue(t) })}>
                      {t}
                    </span>
                  ))}
                </span>
              </span>
              <span
                role="cell"
                className="[&_.meter]:h-[4px] [display:grid] gap-1.5 max-[641px]:hidden"
              >
                <span className="num">
                  {p.club} <span className="dim">of {counts.peopleCount}</span>
                </span>
                <span className="meter" style={css({ '--v': `${(p.club / total) * 100}%` })}>
                  <i />
                </span>
              </span>
              <span
                role="cell"
                className="[justify-self:end] [color:color-mix(in_oklab,var(--r),var(--ink)_20%)] [background:color-mix(in_srgb,var(--r)_14%,transparent)] [font-weight:600] [border:1.5px_solid_var(--r)] p-[2px_10px] text-[14px] num"
              >
                {p.rating ?? 'unrated'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function WeeklyTab() {
  const { sheets } = useStore();
  const week = sheets.find((x) => x.kind === 'weekly');
  if (!week)
    return (
      <section className="panel col-span-full">
        <p className="body">This week&apos;s sheet is being built. Check back soon.</p>
      </section>
    );
  return <SheetView sh={week} />;
}

function CurateForm({ edit, done }: { edit?: Sheet; done: () => void }) {
  const { act } = useStore();
  const [title, setTitle] = useState(edit?.title ?? ''),
    [note, setNote] = useState(edit?.note ?? ''),
    [links, setLinks] = useState(
      edit?.problems
        .map((p) => {
          const m = p.id.match(/^(\d+)(\w+)$/)!;
          return `https://codeforces.com/contest/${m[1]}/problem/${m[2]}`;
        })
        .join('\n') ?? '',
    );
  return (
    <form
      className="panel col-span-full [display:grid] gap-3"

      onSubmit={async (e) => {
        e.preventDefault();
        if (await act('sheetSave', { id: edit?.id, title, note, links })) done();
      }}
    >
      <p className="label">{edit ? 'edit sheet' : 'new sheet'}</p>
      <input
        className="input"
        placeholder="Title"
        aria-label="Title"
        maxLength={60}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="Note (optional)"
        aria-label="Note"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <textarea
        className="input"
        rows={8}
        aria-label="Codeforces links"
        placeholder={
          'Paste Codeforces problem links, one per line\nhttps://codeforces.com/problemset/problem/1352/C'
        }
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        required
      />
      <div className="row" style={css({ '--g': '8px' })}>
        <button className="btn sm">{edit ? 'Save' : 'Publish'}</button>
        <button type="button" className="btn sm ghost" onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CuratedTab() {
  const { s, sheets, act } = useStore();
  const { isSolved } = useSolved();
  const sure = useConfirm();
  const list = sheets.filter((x) => x.kind === 'custom');
  const curator = !!can(s.roles, 'sheet.curate');
  const [pick, setPick] = useState<number | null>(null),
    [form, setForm] = useState<'new' | 'edit' | null>(null);
  const cur = list.find((x) => x.id === pick) ?? list[0];
  return (
    <>
      <div
        className="[grid-column:1_/_-1] [display:grid] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
        role="tablist"
        aria-label="Curated sheets"
      >
        {list.map((x) => {
          const d = x.problems.filter((p) => isSolved(p.id)).length;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={cur?.id === x.id}
              className={`sheet-card ${cur?.id === x.id ? 'on' : ''}`}
              style={css({
                '--r': tier(
                  Math.round(
                    x.problems.reduce((a, p) => a + (p.rating ?? 0), 0) /
                      Math.max(1, x.problems.filter((p) => p.rating).length),
                  ) || null,
                ),
              })}
              onClick={() => (setPick(x.id), setForm(null))}
            >
              <strong>{x.title}</strong>
              <span className="dim">
                {x.problems.length} problems · by {x.by ?? 'the club'}
              </span>
              <span className="row between" style={css({ '--g': '8px', flexWrap: 'nowrap' })}>
                <span
                  className="meter"
                  style={css({ '--v': `${(d / Math.max(1, x.problems.length)) * 100}%`, flex: 1 })}
                >
                  <i />
                </span>
                <span className="num">
                  {d}/{x.problems.length}
                </span>
              </span>
            </button>
          );
        })}
        {curator && (
          <button className="sheet-card add" onClick={() => setForm('new')}>
            <strong>+ New sheet</strong>
            <span className="dim">paste Codeforces links</span>
          </button>
        )}
      </div>
      {form && (
        <CurateForm
          key={form + (cur?.id ?? '')}
          edit={form === 'edit' ? cur : undefined}
          done={() => setForm(null)}
        />
      )}
      {cur ? (
        <SheetView
          sh={cur}
          actions={
            curator && (
              <span className="row" style={css({ '--g': '8px', marginTop: 12 })}>
                <button className="btn xs line" onClick={() => setForm('edit')}>
                  Edit
                </button>
                <button
                  className="btn xs line"
                  onClick={async () =>
                    (await sure(`Delete “${cur.title}”?`, '', 'Delete', true)) &&
                    act('sheetDelete', { id: cur.id })
                  }
                >
                  Delete
                </button>
              </span>
            )
          }
        />
      ) : (
        !form && (
          <section className="panel col-span-full">
            <p className="body">No curated sheets yet.</p>
          </section>
        )
      )}
    </>
  );
}
