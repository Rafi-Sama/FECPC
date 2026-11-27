'use client';
import { useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { wiki } from '@fecpc/content/training';
import { byId } from '@fecpc/content/site';

export default function Wiki() {
  const { s, act } = useStore();
  const [open, setOpen] = useState(wiki[0].id);
  const w = wiki.find((x) => x.id === open)!,
    read = s.done.includes('wiki:' + w.id);
  return (
    <Page
      title={
        <>
          {wiki.filter((x) => s.done.includes('wiki:' + x.id)).length} of {wiki.length}{' '}
          <span className="acc">read.</span>
        </>
      }
    >
      <div className="bento">
        <nav className="c4 gap-3" aria-label="Articles">
          {wiki.map((x) => (
            <button
              key={x.id}
              className={`panel box pick ${x.id === open ? 'sel' : ''}`}
              aria-pressed={x.id === open}
              onClick={() => setOpen(x.id)}
            >
              <span className="h3">{x.title}</span>
              <span className="label">
                rev {x.rev} · {byId(x.by).name}
                {s.done.includes('wiki:' + x.id) ? ' · read ✓' : ''}
              </span>
            </button>
          ))}
        </nav>
        <article className="panel c8">
          <h2 className="h3 text-[30px]">{w.title}</h2>
          <ol className="[&_li]:[counter-increment:p] [&_li]:[display:grid] [&_li]:grid-cols-[32px_minmax(0,1fr)] [&_li::before]:[content:counter(p,decimal-leading-zero)] [&_li::before]:[font-family:var(--mono),monospace] [&_li::before]:text-[14px] [&_li::before]:text-acc [&_li::before]:pt-[4px] flex flex-col gap-3 [counter-reset:p] text-[17px] leading-[1.6] max-w-[66ch]">
            {w.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ol>
          <button
            className={`btn sm ${read ? 'line' : ''}`}
            onClick={() => act('toggle', { list: 'done', id: 'wiki:' + w.id })}
          >
            {read ? 'Read ✓' : 'Mark as read · +15 XP'}
          </button>
        </article>
      </div>
    </Page>
  );
}
