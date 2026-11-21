'use client';

export function HighlightMatch({ text, query }: Readonly<{ text: string; query?: string }>) {
  const trimmedQuery = query?.trim() ?? '';
  if (!trimmedQuery) return <>{text}</>;

  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // One inline wrapper: flex/grid parents would otherwise turn each piece into its own block.
  return (
    <span>
      {text.split(new RegExp(`(${escapedQuery})`, 'gi')).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={`${part}-${index}`}
            style={{
              // A light tint of the accent keeps the matched text readable in both themes.
              background: 'color-mix(in srgb, var(--acc, #1F3BFF) 18%, transparent)',
              color: 'inherit',
              boxShadow: 'inset 0 -2px 0 color-mix(in srgb, var(--acc, #1F3BFF) 55%, transparent)',
              padding: 0,
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}
