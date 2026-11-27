'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Denied, Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Bars } from '@/components/app/Charts';
import { cols } from '@fecpc/content/training';
import { fmtDate } from '@fecpc/content/site';
import { isAdmin } from '@fecpc/contracts';
import { MemberFace } from '@/components/app/shared/MemberFace';
import { DatePicker } from '@/components/app/shared/DatePicker';
import { PersonPicker } from '@/components/app/shared/PersonPicker';
import { SaveForm } from '@/components/app/SaveBar';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const allTabs = ['Board', 'Documents', 'Inventory', 'Reports'] as const;
// Assignee picker shared by tasks, action items and equipment; '' means nobody.
function Who({
  value,
  onPick,
  label,
}: {
  value: string | null;
  onPick: (v: string | null) => void;
  label: string;
}) {
  const { members } = useStore();
  return (
    <PersonPicker
      people={members.filter((m) => !m.suspended)}
      value={value}
      onPick={onPick}
      label={label}
    />
  );
}

export default function Ops() {
  const sure = useConfirm();
  const [adding, setAdding] = useState<'doc' | 'item' | null>(null);
  const { s, me, act, office, who, members } = useStore();
  const [tab, setTab] = useState<(typeof allTabs)[number]>('Board');
  // Drag a card onto a column to move it; `moving` shows it there until the server confirms.
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ id: number; col: string } | null>(null);
  if (!office.ops)
    return (
      <Page title="Executive workspace">
        <Denied need="a committee role" />
      </Page>
    );
  const { docs, inventory, reports, tasks } = office.ops;
  const people = members.filter((m) => !m.suspended);
  const admin = isAdmin(s.roles);
  return (
    <Page
      title={
        tab === 'Board' ? (
          <>
            {tasks.filter((t) => t.col !== 'Done').length} tasks <span className="acc">open.</span>
          </>
        ) : (
          <>
            {tab}
            <span className="acc">.</span>
          </>
        )
      }
    >
      <Tabs tabs={allTabs} value={tab} onChange={setTab} />
      {tab === 'Board' && (
        <>
          <SaveForm
            className="row ops-add"
            label="New task"
            saveLabel="Add task"
            onSubmit={async (e) => {
              const f = e.currentTarget,
                d = new FormData(f);
              const ok = await act('saveTask', {
                title: String(d.get('title')).trim(),
                who: d.get('who') || null,
                due: d.get('due') || null,
              });
              if (ok) f.reset();
              return ok;
            }}
          >
            <input
              name="title"
              className="input"
              placeholder="New task"
              aria-label="New task"
              required
              minLength={3}
            />
            <PersonPicker name="who" people={people} label="Assign to" />
            <DatePicker name="due" label="Due" placeholder="Due date" />
            <button type="submit" className="btn sm">
              Add task
            </button>
          </SaveForm>
          <div className="kanban">
            {cols.map((c) => {
              const colOf = (t: (typeof tasks)[number]) =>
                moving?.id === t.id ? moving.col : t.col;
              const list = tasks.filter((t) => colOf(t) === c);
              const save = (t: (typeof tasks)[number], patch: Partial<(typeof tasks)[number]>) =>
                act('saveTask', { ...t, ...patch });
              return (
                <section
                  key={c}
                  className={over === c ? 'drop' : undefined}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(c);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setOver(null);
                    const t = tasks.find(
                      (x) => String(x.id) === e.dataTransfer.getData('text/plain'),
                    );
                    if (!t || t.col === c) return;
                    setMoving({ id: t.id, col: c });
                    await save(t, { col: c });
                    setMoving(null);
                  }}
                >
                  <p className="label">
                    {c} · {list.length}
                  </p>
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} people={people} />
                  ))}
                  {list.length === 0 && <p className="body dim">Nothing here.</p>}
                </section>
              );
            })}
          </div>
        </>
      )}
      {tab === 'Documents' && (
        <div className="stack">
          <button
            className="btn sm b self-end"

            onClick={() => setAdding('doc')}
          >
            + Add document
          </button>
          {adding === 'doc' && (
            <AddModal
              title="Add document"
              onClose={() => setAdding(null)}
              save={(d) =>
                act('saveDoc', {
                  title: String(d.get('title')).trim(),
                  about: String(d.get('about')).trim(),
                  url: String(d.get('url')).trim(),
                })
              }
            >
              <label className="field">
                <span className="label">Title</span>
                <input
                  name="title"
                  className="input"
                  required
                  minLength={3}
                  maxLength={120}
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">Short description</span>
                <textarea name="about" className="input" rows={2} maxLength={300} />
              </label>
              <label className="field">
                <span className="label">Link</span>
                <input name="url" type="url" className="input" placeholder="https://…" required />
              </label>
            </AddModal>
          )}
          {docs.length === 0 && <p className="body">No documents yet.</p>}
          <div className="list">
            {docs.map((doc) => (
              <div key={doc.id}>
                <span className="grow">
                  <a className="link" href={doc.url} target="_blank" rel="noopener noreferrer">
                    <strong>{doc.title}</strong> ↗
                  </a>
                  {doc.about && <span className="mut"> · {doc.about}</span>}
                  <br />
                  <span className="label">
                    {doc.by ?? 'former member'} · {fmtDate(doc.at)} · {host(doc.url)}
                  </span>
                </span>
                {(admin || doc.byId === me.id) && (
                  <button
                    className="btn xs line"
                    aria-label={`Delete ${doc.title}`}
                    onClick={async () =>
                      (await sure(
                        `Delete ${doc.title}?`,
                        'The link is removed for everyone on the committee.',
                        'Delete',
                        true,
                      )) && act('deleteDoc', { id: doc.id })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'Inventory' && (
        <div className="stack">
          <button
            className="btn sm b self-end"

            onClick={() => setAdding('item')}
          >
            + Add item
          </button>
          {adding === 'item' && (
            <AddModal
              title="Add item"
              onClose={() => setAdding(null)}
              save={(d) =>
                act('saveItem', {
                  name: String(d.get('name')).trim(),
                  holder: d.get('holder') || null,
                })
              }
            >
              <label className="field">
                <span className="label">Item</span>
                <input
                  name="name"
                  className="input"
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                />
              </label>
              <div className="field">
                <span className="label">Who has it</span>
                {/* Only an admin hands equipment to someone else; anyone else can take it themselves. */}
                <PersonPicker
                  name="holder"
                  people={admin ? people : people.filter((p) => p.id === me.id)}
                  label="Who has it"
                  none="Nobody (in the club room)"
                />
              </div>
            </AddModal>
          )}
          <div className="list">
            {inventory.map((it) => (
              <div key={it.id}>
                <span className="grow">
                  <strong>{it.name}</strong>
                  <br />
                  <span className="label">
                    {it.holder ? `with ${who(it.holder).name}` : 'in the club room'}
                  </span>
                </span>
                {admin ? (
                  <Who
                    label={`Holder of ${it.name}`}
                    value={it.holder}
                    onPick={(v) => act('holdItem', { id: it.id, to: v })}
                  />
                ) : (
                  (!it.holder || it.holder === me.id) && (
                    <button
                      className="btn xs line"
                      onClick={() => act('holdItem', { id: it.id, to: it.holder ? null : me.id })}
                    >
                      {it.holder ? 'Return' : 'Check out'}
                    </button>
                  )
                )}
                <button
                  className="btn xs line danger"
                  aria-label={`Delete ${it.name}`}
                  onClick={async () =>
                    (await sure(`Delete ${it.name}?`)) && act('deleteItem', { id: it.id })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'Reports' && (
        <div className="bento">
          {(
            [
              ['Members', reports.growth, ''],
              ['Weekly retention', reports.retention, '%'],
              ['Problems solved per month', reports.solves, ''],
            ] as const
          ).map(([n, d, u]) => (
            <section key={n} className="panel c4">
              <p className="label">{n}</p>
              <p className="big">
                {d.at(-1)}
                {u}
              </p>
              <Bars data={[...d]} unit={u} />
              <p className="label">8 months</p>
            </section>
          ))}
          <section className="panel no-print col-span-full">
            <div className="row between">
              <p className="h3">Annual report 2026</p>
              <button className="btn sm" onClick={() => print()}>
                Print or save as PDF
              </button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

type Task = { id: number; title: string; who: string | null; due: string | null; col: string };

// Read-only until Edit; then one form saves every field at once. Delete asks inline, not with a browser dialog.
function TaskCard({
  task: t,
  people,
}: {
  task: Task;
  people: { id: string; name: string; handle: string }[];
}) {
  const { act, who } = useStore();
  const [draft, setDraft] = useState<Task | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const overdue = !!t.due && t.col !== 'Done' && t.due < new Date().toISOString().slice(0, 10);
  const close = () => {
    setDraft(null);
    setSure(false);
  };
  if (!draft)
    return (
      <article
        className="panel box task"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(t.id));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <span className="row between flex-nowrap items-start">
          <strong>{t.title}</strong>
          <button
            className="btn xs line"
            aria-label={`Edit ${t.title}`}
            onClick={() => setDraft({ ...t })}
          >
            Edit
          </button>
        </span>
        <span className="row text-[14px] items-center [--g:8px]">
          {t.who ? (
            <>
              <MemberFace id={t.who} name={who(t.who).name} size={22} fg="#0D0D0B" bg="#DAD6CB" />
              <span>{who(t.who).name}</span>
            </>
          ) : (
            <span className="dim">Unassigned</span>
          )}
          {t.due && (
            <span
              className={
                overdue
                  ? 'ml-auto text-dim [&.bad]:text-bad bad'
                  : 'ml-auto text-dim [&.bad]:text-bad'
              }
            >
              {overdue ? 'Overdue · ' : 'Due '}
              {fmtDate(t.due)}
            </span>
          )}
        </span>
      </article>
    );
  return (
    <SaveForm
      className="panel box task editing"
      label={`Unsaved changes to “${t.title}”`}
      onDiscard={close}
      extraDirty={JSON.stringify(draft) !== JSON.stringify(t)}
      onKeyDown={(e) => e.key === 'Escape' && close()}
      onSubmit={async () => {
        const ok = await act('saveTask', { ...draft, title: draft.title.trim() });
        if (ok) close();
        return ok;
      }}
    >
      <label className="field">
        <span className="label">Task</span>
        <input
          className="input sm"
          autoFocus
          required
          minLength={3}
          maxLength={140}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <span className="row [--g:8px]">
        <PersonPicker
          people={people}
          label={`Assignee of ${t.title}`}
          value={draft.who}
          onPick={(v) => setDraft({ ...draft, who: v })}
        />
        <DatePicker
          label={`Due date of ${t.title}`}
          placeholder="Due date"
          value={draft.due}
          onChange={(v) => setDraft({ ...draft, due: v || null })}
        />
        <select
          className="input sm"
          aria-label={`Status of ${t.title}`}
          value={draft.col}
          onChange={(e) => setDraft({ ...draft, col: e.target.value })}
        >
          {cols.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </span>
      {sure ? (
        <span className="row between" role="alert">
          <span className="body">Delete this task?</span>
          <span className="row [--g:6px]">
            <button type="button" className="btn xs line" onClick={() => setSure(false)}>
              Keep
            </button>
            <button
              type="button"
              className="btn xs danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await act('deleteTask', { id: t.id });
                setBusy(false);
              }}
            >
              Delete
            </button>
          </span>
        </span>
      ) : (
        <span className="row between">
          <button type="button" className="btn xs line danger" onClick={() => setSure(true)}>
            Delete
          </button>
          <span className="row [--g:6px]">
            <button type="button" className="btn xs line" data-close onClick={close}>
              Close
            </button>
          </span>
        </span>
      )}
    </SaveForm>
  );
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** The workspace's "add" dialog: the fields come as children; `save` returns true to close. */
function AddModal({
  title,
  onClose,
  save,
  children,
}: {
  title: string;
  onClose: () => void;
  save: (d: FormData) => Promise<boolean>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portalled into <main> (which carries the theme): the page's entry animation is a transform, which would trap a fixed backdrop inside it.
  return createPortal(
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="cm-modal max-w-[520px]"

        onSubmit={async (e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          setBusy(true);
          const ok = await save(d);
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <div className="cm-modal-head">
          <h2 className="h3">{title}</h2>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
        <div className="row justify-end [--g:8px]">
          <button type="button" className="btn sm line" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn sm" disabled={busy}>
            {title}
          </button>
        </div>
      </form>
    </div>,
    document.querySelector('main') ?? document.body,
  );
}
