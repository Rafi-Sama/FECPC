'use client';
import React, { useState } from 'react';

/** Compact relative timestamp (e.g. "just now", "2h ago", "3d ago"). */
export function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Plain single-line excerpt stripped of Markdown punctuation. */
export function excerptFromMarkdown(md: string, maxLen = 140): string {
  const flat = md
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > maxLen ? flat.slice(0, maxLen - 1).trimEnd() + '…' : flat;
}

const SAFE_URL = /^(https?:\/\/|\/)/i;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Matches inline code, links, bold, italic, or @mentions.
  const re =
    /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|((?:^|[\s(])@[a-zA-Z0-9_.-]{2,32})/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const full = m[0];
    if (m[1]) {
      out.push(<code key={`${keyPrefix}-c-${idx++}`}>{full.slice(1, -1)}</code>);
    } else if (m[2]) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(full);
      if (lm && SAFE_URL.test(lm[2].trim())) {
        const href = lm[2].trim();
        const ext = href.startsWith('http');
        out.push(
          <a
            key={`${keyPrefix}-a-${idx++}`}
            href={href}
            target={ext ? '_blank' : undefined}
            rel={ext ? 'noreferrer noopener' : undefined}
          >
            {lm[1]}
          </a>,
        );
      } else {
        out.push(full);
      }
    } else if (m[3]) {
      out.push(<strong key={`${keyPrefix}-b-${idx++}`}>{full.slice(2, -2)}</strong>);
    } else if (m[4]) {
      out.push(<em key={`${keyPrefix}-i-${idx++}`}>{full.slice(1, -1)}</em>);
    } else if (m[5]) {
      const lead = full.startsWith('@') ? '' : full[0];
      const mention = lead ? full.slice(1) : full;
      if (lead) out.push(lead);
      out.push(
        <span
          key={`${keyPrefix}-m-${idx++}`}
          className="inline-block p-[0_5px] rounded-[4px] [background:rgba(31,59,255,0.12)] text-[#1f3bff] [font-weight:600] [font-size:0.94em] t-d:[background:rgba(96,165,250,0.18)] t-d:text-[#93c5fd] [.read-content_&]:[color:var(--ann-blue)] [.read-content_&]:[font-weight:bold] [.read-content_&]:[background:#eff6ff] [.read-content_&]:p-[0_4px] [.read-content_&]:rounded-[2px] t-d:[.read-content_&]:text-acc t-d:[.read-content_&]:[background:color-mix(in_srgb,var(--acc)_15%,transparent)]"
        >
          {mention}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Zero-dependency safe Markdown renderer supporting headings, bold/italic, inline code, fenced code blocks, lists, links, blockquotes, and @mentions. */
export function MarkdownBody({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing fence
      blocks.push(
        <pre key={key++}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      const lvl = hm[1].length;
      const content = renderInline(hm[2], `h-${key}`);
      blocks.push(
        lvl === 1 ? (
          <h2 key={key++}>{content}</h2>
        ) : lvl === 2 ? (
          <h3 key={key++}>{content}</h3>
        ) : (
          <h4 key={key++}>{content}</h4>
        ),
      );
      i++;
      continue;
    }

    // Blockquote (consecutive > lines)
    if (line.trimStart().startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        bqLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="[border-left:4px_solid_#1f3bff] p-[6px_0_6px_14px] m-[4px_0] [color:var(--mut)] [background:color-mix(in_srgb,#1f3bff_5%,transparent)] t-d:[border-left-color:#60a5fa] t-d:[background:color-mix(in_srgb,#60a5fa_8%,transparent)] [.read-content_&]:[background:#eff6ff] [.read-content_&]:[border-left:4px_solid_var(--ann-blue)] [.read-content_&]:p-[1rem] [.read-content_&]:m-[1.5rem_0] [.read-content_&]:[font-family:var(--ann-font-mono)] [.read-content_&]:[font-size:0.9rem] [.read-content_&]:text-[#111111] t-d:[.read-content_&]:[background:color-mix(in_srgb,var(--acc)_10%,var(--panel))] t-d:[.read-content_&]:[border-left:4px_solid_var(--acc)] t-d:[.read-content_&]:text-hi"
        >
          {bqLines.map((bl, bi) => (
            <React.Fragment key={bi}>
              {bi > 0 && <br />}
              {renderInline(bl, `bq-${key}-${bi}`)}
            </React.Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ul-${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++}>
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol-${key}-${ii}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph (consecutive plain lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].trimStart().startsWith('>') &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((pl, pi) => (
          <React.Fragment key={pi}>
            {pi > 0 && <br />}
            {renderInline(pl, `p-${key}-${pi}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <div className="cm-md">{blocks}</div>;
}

/** Markdown-only editor with Write / Preview tabs. Strictly no image upload or drag-and-drop zones. */
export function MarkdownEditor({
  id,
  label,
  value,
  onChange,
  placeholder = 'Write in Markdown… (**bold**, *italic*, `code`, > quote, @mention)',
  rows = 7,
  required = false,
  minLength,
  maxLength = 10000,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  return (
    <div className="field">
      <div className="[.ann-modal_&_label.label]:[font-family:var(--ann-font-mono)] [.ann-modal_&_label.label]:[font-size:0.8rem] [.ann-modal_&_label.label]:uppercase [.ann-modal_&_label.label]:[color:var(--ann-muted)] flex items-center justify-between gap-2 flex-wrap mb-1.5 [.ann-modal_&]:flex [.ann-modal_&]:justify-between [.ann-modal_&]:items-end [.ann-modal_&]:-mb-0.5 [.ann-modal_&]:relative [.ann-modal_&]:z-1">
        {label ? (
          <label className="label" htmlFor={id}>
            {label}
          </label>
        ) : (
          <span />
        )}
        <div
          className="cm-md-tabs inline-flex gap-1.5 [.ann-modal_&]:flex"
          role="tablist"
          aria-label="Markdown mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'write'}
            className={`tag ${mode === 'write' ? 'on' : ''}`}
            onClick={() => setMode('write')}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            className={`tag ${mode === 'preview' ? 'on' : ''}`}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
        </div>
      </div>
      {mode === 'write' ? (
        <textarea
          id={id}
          className="input"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          style={{ minHeight: rows * 22 }}
        />
      ) : (
        <div className="min-h-[140px] p-3.5 [border:2px_solid_var(--line2)] [background:var(--bg)] t-d:[border-width:1px] [.ann-modal_&]:p-[1rem] [.ann-modal_&]:[border:var(--ann-border-thick)] [.ann-modal_&]:[background:var(--ann-bg)] [.ann-modal_&]:min-h-[150px]">
          {value.trim() ? (
            <MarkdownBody markdown={value} />
          ) : (
            <p className="body">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default MarkdownEditor;
