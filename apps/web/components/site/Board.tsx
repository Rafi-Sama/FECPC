'use client';
import { useState } from 'react';
import { Avatar } from '@/components/pixel/Sprites';
import { useMore } from './More';
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
  const [shown, more] = useMore(rows, 25, true);
  return (
    <div>
      <div className="row between mb-6">
        <div className="row [--g:10px]" role="tablist" aria-label="Category">
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
        <label className="row label [--g:10px]">
          BATCH
          <select
            className="input w-auto min-h-[40px]"
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
      <ol className="scores [&_.sc]:[font-size:clamp(14px,1.6vw,18px)] [&_li]:[display:grid] [&_li]:gap-3.5 [&_li]:items-center [&_li]:p-[14px_0] [&_li]:[border-bottom:4px_dotted_var(--line)] [&_small]:[font:14px_var(--mono),monospace] [&_small]:normal-case [&_small]:[color:var(--mut)] [&_li:nth-child(1)]:text-acc [&_li:nth-child(2)]:text-acc3 [&_li:nth-child(3)]:text-acc2 [&_li]:grid-cols-[44px_36px_minmax(0,1fr)_auto] big">
        {shown.map((x, i) => (
          <li
            key={x.id}
            aria-current={x.id === me || undefined}
            style={x.id === me ? { outline: '2px solid var(--acc)' } : undefined}
          >
            <span className="text-[14px] [color:var(--mut)] arcade">
              {String(i + 1).padStart(2, '0')}
            </span>
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
      {more}
    </div>
  );
}
