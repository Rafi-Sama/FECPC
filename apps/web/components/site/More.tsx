'use client';
import { useState } from 'react';

/** Long lists render `step` rows at a time; the returned button adds the next `step`. */
export function useMore<T>(list: T[], step = 100) {
  const [n, setN] = useState(step);
  const more = list.length > n && (
    <button
      type="button"
      className="btn sm line self-center mt-4"

      onClick={() => setN(n + step)}
    >
      Show more · {list.length - n} left
    </button>
  );
  return [list.length > n ? list.slice(0, n) : list, more] as const;
}
