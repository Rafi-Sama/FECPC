'use client';
import { useState } from 'react';
import { Avatar } from '@/components/pixel/Sprites';
import { cfTitle, members, type Member } from '@fecpc/content/site';

const tabs: { k: keyof Member; label: string; unit: string }[] = [
  { k: 'rating', label: 'RATING', unit: '' },
  { k: 'solved', label: 'SOLVES', unit: '' },
  { k: 'streak', label: 'STREAK', unit: 'D' },
  { k: 'xp', label: 'XP', unit: '' },
];
const medal = ['#FFD23F', '#3DE1FF', '#FF4D8D'];

export default function Board({ list = members, me }: { list?: Member[]; me?: string }) {
  const [k, setK] = useState<keyof Member>('rating');
  const [batch, setBatch] = useState(0);
  const tab = tabs.find((t) => t.k === k)!;
  const rows = list
    .filter((m) => !batch || m.batch === batch)
    .sort((a, b) => (b[k] as number) - (a[k] as number));
  return (
    <div>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div
          className="row"
          role="tablist"
          aria-label="Category"
          style={{ '--g': '10px' } as React.CSSProperties}
        >
          {tabs.map((t) => (
            <button
              key={t.k}
              role="tab"
              aria-selected={t.k === k}
              className={`tag tab ${t.k === k ? 'on' : ''}`}
              onClick={() => setK(t.k)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="row label" style={{ '--g': '10px' } as React.CSSProperties}>
          BATCH
          <select
            className="input"
            style={{ width: 'auto', minHeight: 40 }}
            value={batch}
            onChange={(e) => setBatch(+e.target.value)}
          >
            <option value={0}>ALL</option>
            {[...new Set(list.map((m) => m.batch))]
              .filter(Boolean)
              .sort((a, b) => a - b)
              .map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
          </select>
        </label>
      </div>
      <ol className="scores big">
        {rows.map((x, i) => (
          <li
            key={x.id}
            aria-current={x.id === me || undefined}
            style={x.id === me ? { outline: '2px solid var(--acc)' } : undefined}
          >
            <span className="rk arcade">{String(i + 1).padStart(2, '0')}</span>
            <Avatar name={x.name} size={36} fg={medal[i] ?? '#8E84C9'} bg="#1D1145" />
            <span className="nm">
              {x.name}
              <small>
                @{x.handle} · {cfTitle(x.rating)} · Batch {x.batch}
              </small>
            </span>
            <span className="arcade sc">
              {x[k] as number}
              {tab.unit}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
