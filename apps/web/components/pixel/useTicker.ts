'use client';
import { useEffect, useRef } from 'react';

// Calls draw() every `ms` while the element is on screen. One frame only under reduced motion.
export function useTicker<T extends Element>(draw: (el: T) => void, ms: number) {
  const ref = useRef<T>(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    fn.current(el);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) timer = setInterval(() => fn.current(el), ms);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, [ms]);
  return ref;
}
