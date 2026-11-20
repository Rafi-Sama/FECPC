'use client';
import { usePathname } from 'next/navigation';

const map: Record<string, string> = {
  about: 'b',
  verify: 'b',
  contact: 'b',
  leaderboard: 'c',
  events: 'd',
  projects: 'e',
  join: 'b',
  login: 'b',
  alumni: 'd',
  gallery: 'd',
};
export default function FootTheme({ children }: { children: React.ReactNode }) {
  const t = map[usePathname().split('/')[1]] ?? 'a';
  return (
    <footer className={`foot t-${t}`} data-t={t}>
      {children}
    </footer>
  );
}
