'use client';
// A calendar dropdown in place of <input type="date"> / "datetime-local". Values keep the native formats:
// 'YYYY-MM-DD', or 'YYYY-MM-DDTHH:MM' with `time`, and '' / null for no date.
import { useEffect, useRef, useState } from 'react';
import { usePopover } from './usePopover';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
};
/** Moves an ISO day by `n` days (or months with `months`), in local time. */
function shift(day: string, n: number, months = false) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = months ? new Date(y, m - 1 + n, 1) : new Date(y, m - 1, d + n);
  if (months) t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}
function label(v: string, time: boolean) {
  const [y, m, d] = v.slice(0, 10).split('-').map(Number) as [number, number, number];
  const day = `${d} ${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
  return time && v.length > 10 ? `${day}, ${v.slice(11, 16)}` : day;
}

/** An analog clock: pick the hour, then the minute (5-minute steps). `value` is 'HH:MM' (24h). */
function Clock({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'h' | 'm'>('h');
  const h24 = Number(value.slice(0, 2)) || 0,
    min = Number(value.slice(3, 5)) || 0,
    pm = h24 >= 12,
    h12 = h24 % 12 || 12;
  const put = (h: number, mm: number) => onChange(`${pad(h)}:${pad(mm)}`);
  const marks =
    mode === 'h'
      ? Array.from({ length: 12 }, (_, i) => ({
          n: i || 12,
          text: String(i || 12),
          on: (i || 12) === h12,
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          n: i * 5,
          text: pad(i * 5),
          on: Math.round(min / 5) % 12 === i,
        }));
  const angle = mode === 'h' ? (h12 % 12) * 30 : (min / 60) * 360;
  return (
    <div className="clock">
      <div className="clock__read">
        <button type="button" aria-pressed={mode === 'h'} onClick={() => setMode('h')}>
          {pad(h12)}
        </button>
        <span>:</span>
        <button type="button" aria-pressed={mode === 'm'} onClick={() => setMode('m')}>
          {pad(min)}
        </button>
        <span className="clock__ampm">
          <button type="button" aria-pressed={!pm} onClick={() => pm && put(h24 - 12, min)}>
            AM
          </button>
          <button type="button" aria-pressed={pm} onClick={() => !pm && put(h24 + 12, min)}>
            PM
          </button>
        </span>
      </div>
      <div className="clock__face" role="listbox" aria-label={mode === 'h' ? 'Hour' : 'Minute'}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <line
            x1="100"
            y1="100"
            x2={100 + 72 * Math.sin((angle * Math.PI) / 180)}
            y2={100 - 72 * Math.cos((angle * Math.PI) / 180)}
          />
          <circle cx="100" cy="100" r="4" />
        </svg>
        {marks.map((k, i) => (
          <button
            type="button"
            role="option"
            key={k.text}
            aria-selected={k.on}
            aria-label={mode === 'h' ? `${k.n} o'clock` : `${k.n} minutes`}
            style={{
              left: `${50 + 40 * Math.sin((i * Math.PI) / 6)}%`,
              top: `${50 - 40 * Math.cos((i * Math.PI) / 6)}%`,
            }}
            onClick={() => {
              if (mode === 'h') {
                put((k.n % 12) + (pm ? 12 : 0), min);
                setMode('m');
              } else {
                put(h24, k.n);
                onDone();
              }
            }}
          >
            {k.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  name,
  label: aria,
  required = false,
  time = false,
  placeholder = 'Pick a date',
  className = '',
  invalid = false,
  min,
  max,
}: {
  /** Controlled value; leave out (with `name`) to use the picker inside a plain form. */
  value?: string | null;
  onChange?: (v: string) => void;
  /** Form field name; the value is submitted with the form and cleared on form reset. */
  name?: string;
  label: string;
  required?: boolean;
  /** Also pick a time ('YYYY-MM-DDTHH:MM'). */
  time?: boolean;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  /** Earliest / latest selectable day (a date or date-time; only the date part counts). */
  min?: string | null;
  max?: string | null;
}) {
  const lo = min?.slice(0, 10) || '',
    hi = max?.slice(0, 10) || '';
  const outside = (d: string) => (!!lo && d < lo) || (!!hi && d > hi);
  const [own, setOwn] = useState('');
  const current = (value === undefined ? own : value) ?? '';
  const day = current.slice(0, 10);
  const [focus, setFocus] = useState(day || todayIso());
  const [view, setView] = useState<'date' | 'time'>('date');
  const { box, pos, open, toggle, close } = usePopover(300, time ? 410 : 360);
  const field = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = field.current?.form;
    if (!form || value !== undefined) return;
    const reset = () => setOwn('');
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [value]);

  // Keep keyboard focus on the highlighted day as it moves.
  useEffect(() => {
    if (open && view === 'date')
      grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [open, focus, view]);

  // Let the owning form (and its save bar) see the pick.
  useEffect(() => {
    field.current?.dispatchEvent(new Event('change', { bubbles: true }));
  }, [current]);

  const set = (v: string) => {
    setOwn(v);
    onChange?.(v);
  };
  const pick = (d: string) => {
    set(time ? `${d}T${current.slice(11, 16) || '10:00'}` : d);
    if (time) setView('time');
    else close();
  };

  const [y, m] = focus.split('-').map(Number) as [number, number];
  const first = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  const cells = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: count }, (_, i) => iso(y, m - 1, i + 1)),
  ];
  const today = todayIso();

  return (
    <div
      className={`datepick ${className}`}
      ref={box}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      {/* Real input, so `name` submits and `required` blocks the form; the button stands in for it. */}
      <input
        ref={field}
        className="datepick__field"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        value={current}
        onChange={() => {}}
      />
      <button
        type="button"
        className={`input sm datepick__btn${invalid ? ' bad' : ''}`}
        aria-label={`${aria}${current ? `: ${label(current, time)}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          setFocus(day || todayIso());
          setView('date');
          toggle(e.currentTarget);
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span className={current ? '' : 'dim'}>{current ? label(current, time) : placeholder}</span>
      </button>
      {pos && (
        <div className="datepick__pop" style={pos} role="dialog" aria-label={aria}>
          {time && (
            <div className="datepick__views">
              <button type="button" aria-pressed={view === 'date'} onClick={() => setView('date')}>
                {day ? label(day, false) : 'Date'}
              </button>
              <button
                type="button"
                aria-pressed={view === 'time'}
                disabled={!day}
                onClick={() => setView('time')}
              >
                {current.slice(11, 16) || 'Time'}
              </button>
            </div>
          )}
          {view === 'time' && day ? (
            <Clock
              value={current.slice(11, 16) || '10:00'}
              onChange={(t) => set(`${day}T${t}`)}
              onDone={close}
            />
          ) : (
            <>
              <div className="datepick__head">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setFocus(shift(focus, -1, true))}
                >
                  ‹
                </button>
                <strong aria-live="polite">
                  {MONTHS[m - 1]} {y}
                </strong>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setFocus(shift(focus, 1, true))}
                >
                  ›
                </button>
              </div>
              <div className="datepick__grid" role="grid" ref={grid}>
                {DAYS.map((d) => (
                  <span key={d} className="datepick__dow" role="columnheader">
                    {d}
                  </span>
                ))}
                {cells.map((d, i) =>
                  d ? (
                    <button
                      type="button"
                      key={d}
                      role="gridcell"
                      tabIndex={d === focus ? 0 : -1}
                      aria-selected={d === day}
                      aria-current={d === today ? 'date' : undefined}
                      aria-label={label(d, false)}
                      disabled={outside(d)}
                      onClick={() => pick(d)}
                      onKeyDown={(e) => {
                        const step = {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -7,
                          ArrowDown: 7,
                        }[e.key];
                        if (step) {
                          e.preventDefault();
                          setFocus(shift(d, step));
                        } else if (e.key === 'PageUp' || e.key === 'PageDown') {
                          e.preventDefault();
                          setFocus(shift(d, e.key === 'PageUp' ? -1 : 1, true));
                        }
                      }}
                    >
                      {Number(d.slice(8))}
                    </button>
                  ) : (
                    <span key={`b${i}`} />
                  ),
                )}
              </div>
            </>
          )}
          <div className="datepick__foot">
            <button
              type="button"
              className="btn xs line"
              disabled={outside(today)}
              onClick={() => pick(today)}
            >
              Today
            </button>
            {!required && current && (
              <button
                type="button"
                className="btn xs line"
                onClick={() => {
                  set('');
                  close();
                }}
              >
                Clear
              </button>
            )}
            {time && (
              <button type="button" className="btn xs" onClick={close}>
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
