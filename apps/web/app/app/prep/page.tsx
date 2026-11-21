'use client';
import { useState } from 'react';
import { Page } from '@/components/app/Shell';
import { PrepTab } from '@/components/app/alumni/PrepTab';

export default function Prep() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <Page
      title={
        <>
          Interview <span className="acc">prep.</span>
        </>
      }
    >
      {note && (
        <p className="label" role="status">
          {note}
        </p>
      )}
      <PrepTab onShowToast={setNote} />
    </Page>
  );
}
