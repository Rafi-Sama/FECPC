'use client';
import { useState } from 'react';
import { Page } from '@/components/app/Shell';
import { PrepTab } from '@/components/app/alumni/PrepTab';

// The club's one learning roadmap, kept by the CP Head and President (same editor as interview prep).
export default function Learn() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <Page
      title={
        <>
          Learning <span className="acc">roadmap.</span>
        </>
      }
    >
      {note && (
        <p className="label" role="status">
          {note}
        </p>
      )}
      <PrepTab kind="learn" onShowToast={setNote} />
    </Page>
  );
}
