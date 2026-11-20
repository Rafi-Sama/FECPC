'use client';

export function HighlightMatch({ text, query }: Readonly<{ text: string; query?: string }>) {
  const trimmedQuery = query?.trim() ?? '';
  if (!trimmedQuery) return <>{text}</>;

  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    <>
      {text.split(new RegExp(`(${escapedQuery})`, 'gi')).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={`${part}-${index}`}
            style={{ background: 'var(--acc, #B8FF00)', color: 'inherit', padding: 0 }}
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}
