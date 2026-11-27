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
            className="p-0 [background:color-mix(in_srgb,_var(--acc)_18%,_transparent)] [color:inherit] [box-shadow:inset_0_-2px_0_color-mix(in_srgb,_var(--acc)_55%,_transparent)]"
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
