'use client';
import { useState } from 'react';
import { stripJsonComments } from '@/lib/learning.ts';
import { useStore } from '@/components/app/Store';

const EXAMPLE_JSON = `[
  // Each question needs: q, options (exactly 4) and answer (0-3 = position of the correct option, starting at 0)
  {"q":"What is the time complexity of binary search?","options":["O(n)","O(log n)","O(n log n)","O(1)"],"answer":1},
  /* add as many questions as you need, separated by commas */
  {"q":"Which structure does BFS use?","options":["Stack","Queue","Heap","Set"],"answer":1}
]`;

export function BulkImportPanel() {
  const { act } = useStore();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUseExample = () => {
    setRawText(EXAMPLE_JSON);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const stripped = stripJsonComments(rawText);
    if (!stripped) {
      setError('Please enter questions in JSON format or click "Use the example".');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stripped);
    } catch (parseErr: any) {
      setError(`JSON syntax error: ${parseErr.message || 'Invalid JSON format'}`);
      return;
    }

    if (!Array.isArray(parsed)) {
      setError('The input must be a JSON array of question objects.');
      return;
    }

    if (parsed.length === 0) {
      setError('Please provide at least one question.');
      return;
    }

    if (parsed.length > 200) {
      setError(`Too many questions (${parsed.length}). Maximum 200 questions allowed per import.`);
      return;
    }

    // Client-side all-or-nothing validation
    const invalidItems: number[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const qNum = i + 1;
      if (
        !item ||
        typeof item !== 'object' ||
        !item.q ||
        typeof item.q !== 'string' ||
        item.q.trim().length === 0 ||
        item.q.trim().length > 200 ||
        !Array.isArray(item.options) ||
        item.options.length !== 4 ||
        item.options.some(
          (opt: any) =>
            !opt || typeof opt !== 'string' || opt.trim().length === 0 || opt.trim().length > 200,
        ) ||
        typeof item.answer !== 'number' ||
        !Number.isInteger(item.answer) ||
        item.answer < 0 ||
        item.answer > 3
      ) {
        invalidItems.push(qNum);
      }
    }

    if (invalidItems.length > 0) {
      setError(
        `Invalid questions found at position: #${invalidItems.join(', #')}. Check that each has 'q' (1-200 chars), 4 non-empty options, and 'answer' (0-3). Nothing was imported.`,
      );
      return;
    }

    setSubmitting(true);
    const ok = await act('quizImport', { questions: parsed });
    setSubmitting(false);
    if (!ok) return;
    setSuccess(`Imported ${parsed.length} question${parsed.length > 1 ? 's' : ''}.`);
    setRawText('');
  };

  return (
    <div className="[border:1px_solid_var(--line)] rounded-[4px] [background:var(--panel)] mb-6 overflow-hidden">
      <button
        type="button"
        className="w-full p-[16px_20px] flex items-center justify-between [background:none] [border:none] cursor-pointer text-[15px] [font-weight:600] text-ink text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>Add many questions (JSON)</span>
        <span>{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {open && (
        <form className="p-[0_20px_20px_20px] flex flex-col gap-3.5" onSubmit={handleSubmit}>
          <div>
            <p className="body text-dim mb-2">Bulk format example (supports comments):</p>
            <div className="[background:#1e1e1e] text-[#d4d4d4] [font-family:ui-monospace,Menlo,Monaco,'Courier_New',monospace] text-[14px] p-3 rounded-[4px] whitespace-pre-wrap break-all overflow-x-auto">
              {EXAMPLE_JSON}
            </div>
          </div>

          <div className="row between items-center">
            <span className="label">JSON Questions (max 200)</span>
            <button type="button" className="btn xs line" onClick={handleUseExample}>
              Use the example
            </button>
          </div>

          <textarea
            className="bulk-textarea"
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your JSON array here..."
            spellCheck={false}
          />

          {error && <div className="alert-box error">{error}</div>}
          {success && (
            <div className="alert-box [background:rgba(16,185,129,0.1)] border-[#10b981] text-[#047857]">
              {success}
            </div>
          )}

          <div>
            <button type="submit" className="btn sm" disabled={submitting}>
              {submitting ? 'Importing questions...' : 'Add all questions'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
