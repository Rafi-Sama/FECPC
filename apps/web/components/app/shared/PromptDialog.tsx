'use client';
// An in-app replacement for window.prompt(): a centred modal that asks for one piece of text.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/components/app/Store';

import { modalHead } from '@/components/app/shared/ui';

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
        className="cm-modal evm-modal relative! z-2000001! [border:2px_solid_var(--line2)]! [box-shadow:10px_10px_0_var(--line2)]! [background:var(--panel)]! text-ink! p-0! w-full! max-w-[480px]! m-auto! overflow-hidden!"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(v.trim());
        }}
      >
        <div className={modalHead}>
          <h2 className="h3 m-0 uppercase tracking-[0.08em] text-[14px] font-bold">{title}</h2>
          <button
            type="button"
            className="cm-modal-close inline-flex items-center justify-center w-[32px] h-[32px] [border:2px_solid_var(--line2)] bg-panel text-ink text-[20px] font-bold cursor-pointer leading-[1]"
            aria-label="Close dialog"
            onClick={() => onDone(null)}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 max-[641px]:p-3.5! [background:var(--panel)] text-ink max-h-[calc(85vh_-_70px)] overflow-y-auto box-border [.ev-detail_&]:[background:var(--panel)] [.ev-detail_&]:text-ink [.ev-detail_&]:max-h-[calc(85vh_-_70px)] [.ev-detail_&]:overflow-y-auto [.ev-detail_&]:box-border py-5 px-5.5 flex flex-col gap-4">
          {confirmOnly ? (
            label && <p className="m-0 text-[14px] leading-[1.5] text-hi">{label}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="mono text-[14px] uppercase tracking-[0.08em] text-dim font-semibold">
                {label}
              </label>
              {numeric ? (
                <input
                  className="ctl w-full py-2.5 px-3 text-[14px] bg-bg [border:2px_solid_var(--line2)] text-ink"
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
                  className="ctl w-full h-auto min-h-[90px] py-2.5 px-3 text-[14px] [resize:vertical] leading-[1.5] box-border bg-bg [border:2px_solid_var(--line2)] text-ink"
                  rows={4}
                  autoFocus
                  required={minLength > 0}
                  minLength={minLength || undefined}
                  maxLength={maxLength}
                  placeholder={placeholder}

                  value={v}
                  onChange={(e) => setV(e.target.value)}
                />
              )}
            </div>
          )}
          <div className="row justify-end gap-2.5 mt-1">
            <button
              type="button"
              className="eb py-2 px-4 text-[14px] cursor-pointer bg-panel text-ink [border:2px_solid_var(--line2)] font-semibold"

              onClick={() => onDone(null)}
              autoFocus={confirmOnly}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="eb py-2 px-4.5 text-[14px] font-bold text-[#ffffff] cursor-pointer"
              style={{
                background: danger ? '#dc2626' : 'var(--acc)',
                border: danger ? '2px solid #b91c1c' : '2px solid var(--acc)',
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
