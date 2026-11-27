'use client';
import { useState } from 'react';
import { Avatar } from '@/components/pixel/Sprites';
import { byId, projects } from '@fecpc/content/site';

const groups = ['All', 'Web', 'CP', 'AI/ML', 'Game dev', 'Security'];

export default function ProjectGrid() {
  const [g, setG] = useState('All');
  const list = projects.filter((p) => g === 'All' || p.tags.includes(g));
  return (
    <>
      <div className="row [--g:8px] mb-9" role="tablist" aria-label="Filter by track">
        {groups.map((x) => (
          <button
            key={x}
            role="tab"
            aria-selected={x === g}
            className={`tag tab ${x === g ? 'on' : ''}`}
            onClick={() => setG(x)}
          >
            {x}
          </button>
        ))}
        <span className="label ml-auto">
          {list.length} of {projects.length}
        </span>
      </div>
      <div className="grid [--min:320px] [--g:0px]">
        {list.map((p, i) => (
          <article key={p.name} className="panel proj">
            <div className="row between">
              <span className="mono dim">{String(i + 1).padStart(2, '0')}</span>
              <span className="label acc2">{p.status}</span>
            </div>
            <h3 className="h3">{p.name}</h3>
            <p className="body">{p.blurb}</p>
            <div className="row [--g:6px]">
              {p.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <div className="row by [--g:8px]">
              {p.by.map((id) => (
                <Avatar key={id} name={byId(id).name} size={28} />
              ))}
              <span className="label">
                {p.by.map((id) => byId(id).name.split(' ')[0]).join(', ')}
              </span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
