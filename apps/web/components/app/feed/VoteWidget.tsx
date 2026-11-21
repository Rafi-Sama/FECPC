'use client';

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
    <div className="cm-vote" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`cm-vote-btn ${myVote === 1 ? 'on' : ''}`}
        aria-label="Upvote"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(1)}
      >
        ▲
      </button>
      <span className={`cm-vote-score ${myVote !== 0 ? 'on' : ''}`}>{score}</span>
      <button
        type="button"
        className={`cm-vote-btn ${myVote === -1 ? 'on' : ''}`}
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
