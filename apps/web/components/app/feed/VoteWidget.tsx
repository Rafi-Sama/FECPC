'use client';

const cmVoteBtn =
  'p-0 [background:none] w-[40px] h-[36px] [display:grid] [place-items:center] leading-[1] text-[18px] [color:var(--dim)] cursor-pointer hover:text-hi [&.on]:text-[#1f3bff] [&.on]:font-bold [.t-d_&.on]:text-[#6fa8ff]'; // was .cm-vote-btn

export function VoteWidget({
  score,
  myVote,
  disabled = false,
  layout = 'vertical',
  onVote,
}: {
  score: number;
  myVote: -1 | 0 | 1;
  disabled?: boolean;
  layout?: 'vertical' | 'horizontal';
  onVote: (value: 1 | -1) => void;
}) {
  if (layout === 'horizontal') {
    return (
      <div className="cm-vote-horiz">
        <button
          type="button"
          className={`btn sm ${myVote === 1 ? '' : 'line'}`}
          aria-label={`Upvote, score ${score}`}
          aria-pressed={myVote === 1}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onVote(1);
          }}
        >
          ▲ {score}
        </button>
        <button
          type="button"
          className={`btn sm ${myVote === -1 ? '' : 'line'}`}
          aria-label="Downvote"
          aria-pressed={myVote === -1}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onVote(-1);
          }}
        >
          ▼
        </button>
      </div>
    );
  }

  return (
    <div
      className="cm-vote flex-col w-[48px] flex-none [font-family:var(--mono),_monospace]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`cm-vote-btn [border:1px_solid_transparent] hover:border-line2 ${cmVoteBtn} ${myVote === 1 ? 'on' : ''}`}
        aria-label="Upvote"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(1)}
      >
        ▲
      </button>
      <span
        className={`text-[16px] font-bold text-hi [font-variant-numeric:tabular-nums] [&.on]:text-[#1f3bff] [.t-d_&.on]:text-[#6fa8ff] ${myVote !== 0 ? 'on' : ''}`}
      >
        {score}
      </span>
      <button
        type="button"
        className={`cm-vote-btn [border:1px_solid_transparent] hover:border-line2 ${cmVoteBtn} ${myVote === -1 ? 'on' : ''}`}
        aria-label="Downvote"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(-1)}
      >
        ▼
      </button>
    </div>
  );
}

export default VoteWidget;
