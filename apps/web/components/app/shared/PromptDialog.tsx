'use client';
// An in-app replacement for window.prompt(): a centred modal that asks for one piece of text.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Ask = {
  title: string;
  /** What the text is for; shown above the field. */
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  initial?: string;
  /** Characters required; 0 makes the text optional. */
  minLength?: number;
  maxLength?: number;
  /** A number field instead of free text. */
  numeric?: boolean;
  danger?: boolean;
  /** A yes/no question: no text field; resolves '' for yes. */
  confirmOnly?: boolean;
};

const Ctx = createContext<((o: Ask) => Promise<string | null>) | null>(null);

/** Mounted once in the app frame; renders whichever question is being asked. */
export function PromptProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [req, setReq] = useState<(Ask & { resolve: (v: string | null) => void }) | null>(null);
  const ask = useCallback(
    (o: Ask) => new Promise<string | null>((resolve) => setReq({ ...o, resolve })),
    [],
  );
  return (
    <Ctx.Provider value={ask}>
      {children}
      {req && (
        <PromptDialog
          key={req.title}
          {...req}
          onDone={(v) => {
            req.resolve(v);
            setReq(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

/** `const sure = useConfirm(); if (await sure(question, detail?)) …`: the in-app window.confirm(). */
export function useConfirm() {
  const ask = usePrompt();
  return useCallback(
    async (title: string, message = '', confirmLabel = 'Confirm', danger = false) =>
      (await ask({ title, label: message, confirmLabel, danger, confirmOnly: true })) !== null,
    [ask],
  );
}

/** `const ask = usePrompt(); const text = await ask({...})`: null when cancelled. */
export function usePrompt() {
  const ask = useContext(Ctx);
  if (!ask) throw new Error('usePrompt needs <PromptProvider> (it is in the app Shell).');
  return ask;
}

function PromptDialog({
  title,
  label,
  placeholder,
  confirmLabel = 'Confirm',
  initial = '',
  minLength = 0,
  maxLength = 300,
  numeric = false,
  danger = false,
  confirmOnly = false,
  onDone,
}: Ask & { onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    // Capture phase, so Escape closes only this dialog and not the modal underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onDone(null);
      }
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [onDone]);

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-prompt
      onClick={(e) => e.target === e.currentTarget && onDone(null)}
    >
      <form
        className="cm-modal"
        style={{ maxWidth: 480 }}
        onSubmit={(e) => {
          e.preventDefault();
          onDone(v.trim());
        }}
      >
        <div className="cm-modal-head">
          <h2 className="h3">{title}</h2>
        </div>
        {confirmOnly ? (
          label && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{label}</p>
        ) : (
          <label className="field">
            <span className="label">{label}</span>
            {numeric ? (
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                required
                autoFocus
                value={v}
                onChange={(e) => setV(e.target.value)}
              />
            ) : (
              <textarea
                className="input"
                rows={3}
                autoFocus
                required={minLength > 0}
                minLength={minLength || undefined}
                maxLength={maxLength}
                placeholder={placeholder}
                value={v}
                onChange={(e) => setV(e.target.value)}
              />
            )}
          </label>
        )}
        <div
          className="row"
          style={{ justifyContent: 'flex-end', '--g': '8px' } as React.CSSProperties}
        >
          <button type="button" className="btn sm line" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button type="submit" className={`btn sm${danger ? ' danger' : ''}`}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
