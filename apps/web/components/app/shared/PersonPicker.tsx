'use client';
// A searchable people dropdown (the style of "add a teammate" on the ICPC page), in place of a <select>.
import { useEffect, useRef, useState } from 'react';
import { usePopover } from './usePopover';

type Person = { id: string; name: string; handle?: string | null };

export function PersonPicker({
  people,
  value,
  onPick,
  label,
  none = 'Nobody',
  name,
  className = '',
  placeholder = 'Pick someone',
}: {
  people: readonly Person[];
  /** Controlled value; leave out (with `name`) to use the picker inside a plain form. */
  value?: string | null;
  onPick?: (id: string | null) => void;
  label: string;
  /** The "no one" choice; null when someone must be picked. */
  none?: string | null;
  /** Form field name; the choice is submitted as a hidden input and cleared on form reset. */
  name?: string;
  className?: string;
  /** Button text while nobody is picked and `none` is null. */
  placeholder?: string;
}) {
  const [own, setOwn] = useState<string | null>(null);
  const { box, pos, open, toggle, close } = usePopover(300, 320);
  const [q, setQ] = useState('');
  const hidden = useRef<HTMLInputElement>(null);
  const current = value === undefined ? own : value;
  const picked = people.find((p) => p.id === current);

  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setOwn(null);
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, []);

  // Let the owning form (and its save bar) see the pick.
  useEffect(() => {
    hidden.current?.dispatchEvent(new Event('change', { bubbles: true }));
  }, [current]);

  const choose = (id: string | null) => {
    setOwn(id);
    onPick?.(id);
    close();
    setQ('');
  };
  const s = q.trim().toLowerCase();
  const pool = people.filter(
    (p) => !s || p.name.toLowerCase().includes(s) || p.handle?.toLowerCase().includes(s),
  );

  return (
    <div
      className={`picker ${className}`}
      ref={box}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      {name && <input ref={hidden} type="hidden" name={name} value={current ?? ''} />}
      <button
        type="button"
        className="input sm picker__btn"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => toggle(e.currentTarget)}
      >
        <span>{picked?.name ?? none ?? placeholder}</span>
        <b aria-hidden="true">▾</b>
      </button>
      {pos && (
        <div className="picker__pop" style={pos}>
          <input
            autoFocus
            className="picker__search"
            data-save-ignore
            placeholder="Search by name or handle…"
            aria-label={`Search: ${label}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (pool[0]) choose(pool[0].id);
              }
            }}
          />
          <div
            className="picker__list max-h-[260px] overflow-y-auto [border-top:1px_solid_var(--line2)]"
            role="listbox"
            aria-label={label}
          >
            {none !== null && !s && (
              <button
                type="button"
                role="option"
                aria-selected={!current}
                onClick={() => choose(null)}
              >
                <span className="dim">{none}</span>
              </button>
            )}
            {pool.map((p) => (
              <button
                type="button"
                role="option"
                key={p.id}
                aria-selected={p.id === current}
                onClick={() => choose(p.id)}
              >
                <strong>{p.name}</strong>
                {p.handle && <span className="dim">{p.handle}</span>}
              </button>
            ))}
            {pool.length === 0 && (
              <p className="m-0 p-[12px_14px] [color:var(--dim)] text-[14px]">No members found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
