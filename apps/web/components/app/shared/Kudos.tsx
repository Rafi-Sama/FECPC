'use client';
// The one kudos button. Kudos are permanent: once given it stays pressed. Giving shows the XP the giver earns,
// rising gently from the button; the receiver earns too (see XP rules). No counts: kudos are a gesture, not a score.
import { useState, type CSSProperties } from 'react';
import { xpRates } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';

export function KudosButton({
  given,
  onGive,
  size = 'xs',
  disabled,
  title,
  label = 'Kudos',
}: {
  given: boolean;
  /** Resolves false when the server refused; the button then returns to its unpressed state. */
  onGive: () => Promise<boolean | void> | void;
  size?: 'xs' | 'sm';
  disabled?: boolean;
  title?: string;
  /** Screen-reader name, e.g. "Give kudos to Mim". */
  label?: string;
}) {
  const { s } = useStore();
  const [pending, setPending] = useState(false);
  const [burst, setBurst] = useState(0);
  const [said, setSaid] = useState('');
  const on = given || pending;
  const rates = xpRates(s.kv);
  // Only the first few kudos a member gives earn XP (anti-farming); after that the chip just says it was sent.
  const xp = (s.kudosGiven ?? s.kudos.length) < rates.kudosGivenCap ? rates.kudos : 0;
  return (
    <span className="kudos-wrap">
      <button
        type="button"
        className={`btn ${size} kudos${on ? '' : ' line'}`}
        aria-pressed={on}
        aria-label={on ? `${label}: given` : label}
        title={title}
        // Given stays fully visible (filled heart), not greyed out: it is a state, not an error.
        aria-disabled={on || undefined}
        disabled={disabled}
        onClick={async () => {
          if (on) return; // kudos are permanent
          setPending(true);
          setBurst((b) => b + 1);
          setSaid(xp ? `Kudos sent. +${xp} XP` : 'Kudos sent');
          const ok = await onGive();
          if (ok === false) {
            setPending(false);
            setSaid('');
          }
        }}
      >
        {burst > 0 && (
          <span key={burst} className="kudos__burst" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />
            ))}
          </span>
        )}
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden className="kudos__heart">
          <path
            d="M8 14S2 10.2 2 6.1A3.1 3.1 0 0 1 8 4.6a3.1 3.1 0 0 1 6 1.5C14 10.2 8 14 8 14z"
            fill={on ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        Kudos
      </button>
      {burst > 0 && (
        <span key={burst} className="kudos__xp" aria-hidden>
          {xp ? `+${xp} XP` : 'Sent'}
        </span>
      )}
      <span className="sr-only" role="status">
        {said}
      </span>
    </span>
  );
}
