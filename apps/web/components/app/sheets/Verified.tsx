/** A ticked problem's status: a solid check once Codeforces confirmed it (only then it earns XP), a dashed ring until then. */
export function Verified({ on }: { on: boolean }) {
  const label = on ? 'Confirmed by Codeforces' : 'Not confirmed by Codeforces yet';
  return (
    <svg
      className={`vf ${on ? 'on' : ''}`}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {on ? (
        <>
          <circle cx="8" cy="8" r="7" />
          <path d="M4.5 8.3l2.3 2.3 4.7-4.9" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6" strokeDasharray="2.4 2" />
      )}
    </svg>
  );
}
