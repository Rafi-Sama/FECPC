'use client';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { QuizMember } from '@/components/app/learning/QuizMember';
import { QuizAdmin } from '@/components/app/learning/QuizAdmin';
import '@/components/app/learning/learning.css';

export default function QuizPage() {
  const { s } = useStore();

  // Staff: CP Head, President, Super Admin
  const isStaff = s.roles.some(
    (r) => r === 'cp_head' || r === 'president' || r === 'super_admin',
  );

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
