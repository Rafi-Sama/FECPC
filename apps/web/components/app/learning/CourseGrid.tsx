'use client';
import { useState } from 'react';
import type { Course } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';
import { useStore } from '@/components/app/Store';

export function CourseGrid({ courses, isStaff }: { courses: Course[]; isStaff: boolean }) {
  const { act } = useStore();
  const confirm = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (course: Course) => {
    const ok = await confirm(
      'Delete course?',
      `Are you sure you want to delete "${course.title}"? Members will no longer see it.`,
      'Delete',
      true,
    );
    if (!ok) return;

    setDeletingId(course.id);
    await act('courseDelete', { id: course.id });
    setDeletingId(null);
  };

  if (courses.length === 0) {
    return (
      <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--dim)' }}>
          No courses have been added yet.
        </p>
      </div>
    );
  }

  return (
    <div className="courses-grid">
      {courses.map((c) => (
        <article key={c.id} className="course-card">
          <div className="course-card-header">
            <span className="course-meta">
              {c.weeks} week{c.weeks > 1 ? 's' : ''} · {c.instructor}
            </span>
            <h3 className="course-title">{c.title}</h3>
          </div>

          <p className="course-desc">{c.description || 'No description provided.'}</p>

          <div className="course-card-actions">
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn sm line">
              Open course ↗
            </a>

            {isStaff && (
              <button
                type="button"
                className="btn xs line"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                disabled={deletingId === c.id}
                onClick={() => handleDelete(c)}
              >
                {deletingId === c.id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
