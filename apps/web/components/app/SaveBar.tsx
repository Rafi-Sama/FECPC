'use client';
// Shopify-style contextual save bar. A create/edit form registers with useSaveBar(formRef); while
// it has changes, a bar at the top offers Discard and Save, and anything that would leave the form
// (links, tabs, modal close, Escape, reload) is refused with a shake instead.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';

type Entry = {
  form: HTMLFormElement;
  label: string;
  saveLabel: string;
  saving: boolean;
  save: () => void;
  discard: () => void;
};
type Ctx = {
  set: (id: string, e: Entry | null) => void;
  /** False (and the bar shakes) while a form has unsaved changes. */
  canLeave: () => boolean;
};

const SaveBarCtx = createContext<Ctx | null>(null);

/** What the user has typed, read from the DOM so controlled and uncontrolled forms both work. */
export function snapshot(form: HTMLFormElement): string {
  return JSON.stringify(
    [...form.elements].flatMap((el): (string | boolean)[] => {
      if (!(
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ))
        return [];
      if (el.dataset.saveIgnore !== undefined) return [];
      if (el instanceof HTMLInputElement) {
        if (['submit', 'button', 'reset', 'file', 'password'].includes(el.type)) return [];
        if (el.type === 'checkbox' || el.type === 'radio') return [el.checked];
      }
      return [el.value];
    }),
  );
}

// Clicks that leave the current form: links, tabs, explicit section switchers, modal close.
const CLOSE = '[aria-label^="Close"], [data-close]';
const LEAVING = `a[href], [role="tab"], [data-nav], ${CLOSE}`;
const BACKDROP = '[role="dialog"], [role="presentation"], [class*="backdrop"], .ov';

export function SaveBarProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [shake, setShake] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const active = Object.values(entries).at(-1) ?? null;

  const set = useCallback((id: string, e: Entry | null) => {
    setEntries((prev) => {
      if (!e) {
        if (!(id in prev)) return prev;
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      const old = prev[id];
      if (
        old &&
        old.form === e.form &&
        old.label === e.label &&
        old.saveLabel === e.saveLabel &&
        old.saving === e.saving
      ) {
        old.save = e.save;
        old.discard = e.discard;
        return prev;
      }
      return { ...prev, [id]: e };
    });
  }, []);

  const nudge = useCallback(() => {
    setShake((n) => n + 1);
    navigator.vibrate?.(150);
  }, []);

  const activeRef = useRef(active);
  activeRef.current = active;
  const canLeave = useCallback(() => {
    if (!activeRef.current) return true;
    nudge();
    return false;
  }, [nudge]);

  // Stable, or every provider render would re-run each form's register/cleanup effects in a loop.
  const ctx = useMemo(() => ({ set, canLeave }), [set, canLeave]);

  useEffect(() => {
    if (!active) return;
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as Element | null;
      // The save bar itself, and an in-app question asked during a save, are never "leaving".
      if (!t || barRef.current?.contains(t) || t.closest('[data-prompt]')) return;
      const hit = t.closest(LEAVING);
      // A click on a modal's own backdrop closes it, too.
      const backdrop = t.matches(BACKDROP) ? t : null;
      const leaving =
        (hit && (!active.form.contains(hit) || hit.matches(CLOSE))) ||
        (backdrop && !active.form.contains(backdrop));
      if (!leaving) return;
      if (
        hit instanceof HTMLAnchorElement &&
        (hit.target === '_blank' || hit.hasAttribute('download'))
      )
        return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      nudge();
    };
    const onKey = (ev: KeyboardEvent) => {
      // An open popup (picker, menu) gets its Escape; only leaving the form is refused.
      if (ev.key !== 'Escape' || document.querySelector('[aria-expanded="true"], [data-prompt]'))
        return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      nudge();
    };
    const onUnload = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [active, nudge]);

  return (
    <SaveBarCtx.Provider value={ctx}>
      {children}
      {active && (
        <div
          ref={barRef}
          key={shake}
          className={`savebar${shake ? ' shake' : ''}`}
          role="region"
          aria-label="Unsaved changes"
        >
          <span className="savebar-label">
            <span aria-hidden="true">●</span> {active.label}
          </span>
          <div className="row [--g:8px]">
            <button
              type="button"
              className="btn sm line"
              onClick={active.discard}
              disabled={active.saving}
            >
              Discard
            </button>
            <button
              type="button"
              data-save
              className="btn sm"
              onClick={active.save}
              disabled={active.saving}
            >
              {active.saving ? 'Saving…' : active.saveLabel}
            </button>
          </div>
        </div>
      )}
    </SaveBarCtx.Provider>
  );
}

/**
 * Puts `formRef` under the save bar. Save submits the form (native validation and its onSubmit
 * run as usual); Discard calls `onDiscard`, or resets an uncontrolled form. Call `markSaved()`
 * after a save that keeps the form on screen. `extraDirty` covers widgets without form fields.
 * `baselineKey` re-reads the starting values when they arrive later (e.g. after a fetch).
 */
export function useSaveBar(
  formRef: RefObject<HTMLFormElement | null>,
  opts: {
    label?: string;
    saveLabel?: string;
    saving?: boolean;
    onDiscard?: () => void;
    extraDirty?: boolean;
    baselineKey?: unknown;
    disabled?: boolean;
    /** false: only `extraDirty` counts (editors whose fields show a changing selection). */
    trackFields?: boolean;
  } = {},
) {
  const ctx = useContext(SaveBarCtx);
  const id = useId();
  const base = useRef<string | null>(null);
  const [typed, setTyped] = useState(false);
  // Set by Discard: the bar stays away until the person changes something again, so a form whose state
  // cannot be put back (or that counts as changed from the start) never traps them.
  const [quiet, setQuiet] = useState(false);
  const extraWas = useRef(!!opts.extraDirty);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const check = useCallback(() => {
    const f = formRef.current;
    if (!f) return;
    if (base.current === null) base.current = snapshot(f);
    setTyped(snapshot(f) !== base.current);
  }, [formRef]);

  const markSaved = useCallback(() => {
    // After React commits the saved values.
    requestAnimationFrame(() => {
      const f = formRef.current;
      if (f) base.current = snapshot(f);
      setTyped(false);
    });
  }, [formRef]);
  // A successful save ends any quiet too; the next edit starts a fresh change.
  const saved = useCallback(() => {
    markSaved();
    setQuiet(false);
  }, [markSaved]);

  // Starting values: on mount, and again whenever baselineKey changes.
  useEffect(() => {
    base.current = null;
    requestAnimationFrame(check);
  }, [opts.baselineKey, check]);

  // Typing, plus any re-render of the owner (controlled widgets, chips, pickers).
  useEffect(() => {
    const f = formRef.current;
    if (!f) return;
    const later = () => setTimeout(check, 0);
    // Only a real person's edit ends the quiet; pickers dispatch synthetic change events.
    const edit = (e: Event) => {
      if (e.isTrusted) setQuiet(false);
      check();
    };
    f.addEventListener('input', edit);
    f.addEventListener('change', edit);
    f.addEventListener('reset', later);
    return () => {
      f.removeEventListener('input', edit);
      f.removeEventListener('change', edit);
      f.removeEventListener('reset', later);
    };
  }, [formRef, check]);
  useEffect(() => {
    if (base.current !== null) check();
  });

  // A change that has no form field (a chip, a tree node) also ends the quiet.
  useEffect(() => {
    if (opts.extraDirty && !extraWas.current) setQuiet(false);
    extraWas.current = !!opts.extraDirty;
  }, [opts.extraDirty]);

  const dirty =
    !opts.disabled && !quiet && ((opts.trackFields !== false && typed) || !!opts.extraDirty);

  useEffect(() => {
    const f = formRef.current;
    if (!ctx || !f) return;
    if (!dirty) {
      ctx.set(id, null);
      return;
    }
    ctx.set(id, {
      form: f,
      label: opts.label ?? 'Unsaved changes',
      saveLabel: opts.saveLabel ?? 'Save',
      saving: !!opts.saving,
      save: () => formRef.current?.requestSubmit(),
      discard: () => {
        const o = optsRef.current;
        if (o.onDiscard) o.onDiscard();
        else formRef.current?.reset();
        markSaved();
        setQuiet(true);
      },
    });
  }, [ctx, id, dirty, opts.label, opts.saveLabel, opts.saving, formRef, markSaved]);
  useEffect(() => () => ctx?.set(id, null), [ctx, id]);

  return { dirty, markSaved: saved };
}

type SaveFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  /** Return true once saved; anything else keeps the changes (and the bar) in place. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => unknown;
  label?: string;
  saveLabel?: string;
  onDiscard?: () => void;
  extraDirty?: boolean;
  baselineKey?: unknown;
  trackFields?: boolean;
};

/** A <form> under the save bar: no submit button of its own, Save/Discard live in the bar. */
export function SaveForm({
  onSubmit,
  label,
  saveLabel,
  onDiscard,
  extraDirty,
  baselineKey,
  trackFields,
  children,
  ...rest
}: SaveFormProps) {
  const ref = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const { markSaved } = useSaveBar(ref, {
    label,
    saveLabel,
    saving,
    onDiscard,
    extraDirty,
    baselineKey,
    trackFields,
  });
  return (
    <form
      ref={ref}
      {...rest}
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          if ((await onSubmit(e)) === true) markSaved();
        } finally {
          setSaving(false);
        }
      }}
    >
      {children}
    </form>
  );
}

/** For section switches that are not links or tabs (a <select>, a swipe): `if (!canLeave()) return;`. */
export function useCanLeave() {
  return useContext(SaveBarCtx)?.canLeave ?? (() => true);
}
