'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Long lists render `step` rows at a time; the returned button adds the next `step`.
 * `auto`: the next rows also load as the button scrolls into view (feeds, long boards).
 */
export function useMore<T>(list: T[], step = 100, auto = false) {
  const [n, setN] = useState(step);
  const ref = useRef<HTMLButtonElement>(null);
  const left = list.length - n;
  useEffect(() => {
    const el = ref.current;
    if (!auto || !el || left <= 0 || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((e) => e[0]?.isIntersecting && setN((x) => x + step), {
      rootMargin: '200px',
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [auto, left, step]);
  const more = left > 0 && (
    <button
      ref={ref}
      type="button"
      className="btn sm line self-center mt-4"
      onClick={() => setN(n + step)}
    >
      Show more · {left} left
    </button>
  );
  return [left > 0 ? list.slice(0, n) : list, more] as const;
}
