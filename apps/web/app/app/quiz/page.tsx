'use client';
import { canFully } from '@fecpc/contracts';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { QuizMember } from '@/components/app/learning/QuizMember';
import { QuizAdmin } from '@/components/app/learning/QuizAdmin';
import '@/components/app/learning/learning.layer.css';

export default function QuizPage() {
  const { s, me } = useStore();
  // Cosmetic: the server only sends the bank, and only accepts bank edits, for full `learning.curate`.
  const isStaff = !me.system && !!canFully(s.roles, 'learning.curate');

  return (
    <Page
      title={
        isStaff ? (
          <>
            Quiz <span className="acc">bank.</span>
          </>
        ) : (
          <>
            Daily <span className="acc">quiz.</span>
          </>
        )
      }
    >
      {isStaff ? <QuizAdmin /> : <QuizMember />}
    </Page>
  );
}
