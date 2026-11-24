'use client';
import { useState } from 'react';
import { canFully } from '@fecpc/contracts';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { CourseGrid } from '@/components/app/learning/CourseGrid';
import { CourseForm } from '@/components/app/learning/CourseForm';
import '@/components/app/learning/learning.css';

export default function Courses() {
  const { s, me, courses } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  // Cosmetic: the server refuses courseAdd/courseDelete without full `learning.curate`.
  const isStaff = !me.system && !!canFully(s.roles, 'learning.curate');

  return (
    <Page
      title={
        <>
          Popular <span className="acc">courses.</span>
        </>
      }
    >
      <div className="learning-container">
        {isStaff && !showAddForm && (
          <div className="row">
            <button type="button" className="btn sm" onClick={() => setShowAddForm(true)}>
              + Add a course
            </button>
          </div>
        )}
        {isStaff && showAddForm && (
          <CourseForm onDone={() => setShowAddForm(false)} onCancel={() => setShowAddForm(false)} />
        )}
        <CourseGrid courses={courses} isStaff={isStaff} />
      </div>
    </Page>
  );
}
