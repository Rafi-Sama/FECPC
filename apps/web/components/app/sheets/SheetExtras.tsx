'use client';
import { useStore } from '../Store';
import { cfUrl, sheet } from '@fecpc/content/member-area';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function SheetExtras({ isDone }: { isDone: (id: string) => boolean }) {
  const { s, act } = useStore();
  const topics = [...new Set(sheet.map((p) => p.topic))]
    .map((t) => {
      const ps = sheet.filter((p) => p.topic === t);
      return { t, pct: ps.filter((p) => isDone(p.id)).length / ps.length };
    })
    .sort((a, b) => a.pct - b.pct);
  const rec = sheet
    .filter((p) => !isDone(p.id) && topics.slice(0, 2).some((x) => x.t === p.topic))
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 3);
  const revisit = s.solved.slice(0, 3).filter(isDone);
  return (
    <>
      <section className="panel c6">
        <p className="label">
          recommended · weakest tags:{' '}
          {topics
            .slice(0, 2)
            .map((x) => x.t.toLowerCase())
            .join(', ')}
        </p>
        <div>
          {rec.map((p) => (
            <div key={p.id} className="prob">
              <span className="acc">→</span>
              <a href={cfUrl(p.id)} target="_blank" rel="noreferrer">
                <span className="dim">{p.id}</span> {p.name}
              </a>
              <span className="label">{p.topic}</span>
              <span className="num acc2">{p.rating}</span>
            </div>
          ))}
          {rec.length === 0 && (
            <p className="body">nothing left to recommend. the sheet is done.</p>
          )}
        </div>
      </section>
      <section className="panel c6">
        <p className="label">revisit queue · solved 7 days ago · how sure are you?</p>
        <div>
          {revisit.map((id) => {
            const p = sheet.find((x) => x.id === id)!,
              c = s.kv['conf:' + id];
            return (
              <div key={id} className="prob" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <a href={cfUrl(id)} target="_blank" rel="noreferrer">
                  <span className="dim">{id}</span> {p.name}
                </a>
                <span className="row" style={css({ '--g': '4px' })}>
                  {['shaky', 'ok', 'solid'].map((v) => (
                    <button
                      key={v}
                      className={`tag tab ${c === v ? 'on' : ''}`}
                      aria-pressed={c === v}
                      onClick={() => act('kv', { key: 'conf:' + id, value: v })}
                    >
                      {v}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
