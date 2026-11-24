'use client';
// An in-app replacement for window.prompt(): a centred modal that asks for one piece of text.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/components/app/Store';

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const ask = useCallback(
    (o: Ask) => new Promise<string | null>((resolve) => setReq({ ...o, resolve })),
    [],
  );
  return (
    <Ctx.Provider value={ask}>
      {children}
      {req &&
        mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <PromptDialog
            key={req.title}
            {...req}
            onDone={(v) => {
              req.resolve(v);
              setReq(null);
            }}
          />,
          document.body,
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
  // Portalled to <body>, outside the themed frame, so it takes the member's theme itself. No store outside /app.
  const th = (useStore() as ReturnType<typeof useStore> | null)?.s.flags.dark ? 't-d' : 't-b';

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
      className={`cm-backdrop evm-backdrop prompt-backdrop ${th}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-prompt
      onClick={(e) => e.target === e.currentTarget && onDone(null)}
    >
      <form
        className="cm-modal evm-modal prompt-modal"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(v.trim());
        }}
      >
        <div className="cm-modal-head evm-modal-head">
          <h2
            className="h3"
            style={{
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            className="cm-modal-close"
            aria-label="Close dialog"
            onClick={() => onDone(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: '2px solid var(--line2)',
              background: 'var(--panel)',
              color: 'var(--ink)',
              fontSize: 20,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div
          className="evm-modal-body"
          style={{
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {confirmOnly ? (
            label && (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: 'var(--hi)',
                }}
              >
                {label}
              </p>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                className="mono"
                style={{
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--dim)',
                  fontWeight: 600,
                }}
              >
                {label}
              </label>
              {numeric ? (
                <input
                  className="ctl"
                  type="number"
                  min={1}
                  step={1}
                  required
                  autoFocus
                  value={v}
                  onChange={(e) => setV(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    background: 'var(--bg)',
                    border: '2px solid var(--line2)',
                    color: 'var(--ink)',
                  }}
                />
              ) : (
                <textarea
                  className="ctl"
                  rows={4}
                  autoFocus
                  required={minLength > 0}
                  minLength={minLength || undefined}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    height: 'auto',
                    minHeight: 90,
                    padding: '10px 12px',
                    fontSize: 14,
                    resize: 'vertical',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    background: 'var(--bg)',
                    border: '2px solid var(--line2)',
                    color: 'var(--ink)',
                  }}
                  value={v}
                  onChange={(e) => setV(e.target.value)}
                />
              )}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="eb"
              style={{
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer',
                background: 'var(--panel)',
                color: 'var(--ink)',
                border: '2px solid var(--line2)',
                fontWeight: 600,
              }}
              onClick={() => onDone(null)}
              autoFocus={confirmOnly}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="eb"
              style={{
                padding: '8px 18px',
                fontSize: 14,
                fontWeight: 700,
                background: danger ? '#dc2626' : 'var(--acc)',
                color: '#ffffff',
                border: danger ? '2px solid #b91c1c' : '2px solid var(--acc)',
                cursor: 'pointer',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
