'use client';
import { useState } from 'react';
import { useStore } from '../Store';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function Suggest() {
  const { act } = useStore();
  const [sent, setSent] = useState(false);
  return (
    <form
      className="panel stack"
      style={css({ maxWidth: 560, '--g': '14px' })}
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        act('send', { kind: 'suggest', body: new FormData(f).get('body') }).then((ok) => {
          if (ok) {
            f.reset();
            setSent(true);
          }
        });
      }}
    >
      {sent && (
        <p className="body ok" role="status">
          Sent. Your name was not stored with it.
        </p>
      )}
      <label className="field">
        <span className="label">Anonymous suggestion or complaint</span>
        <textarea
          name="body"
          className="input"
          required
          minLength={10}
          maxLength={1000}
          style={{ minHeight: 110 }}
        />
      </label>
      <p className="label">Read by the committee officers. It is saved without your name.</p>
      <button className="btn sm" style={{ alignSelf: 'flex-start' }}>
        Send anonymously
      </button>
    </form>
  );
}
