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
      <div className="panel py-10 px-5 text-center">
        <p className="body text-dim">No courses have been added yet.</p>
      </div>
    );
  }

  return (
    <div className="[display:grid] grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 w-full">
      {courses.map((c) => (
        <article
          key={c.id}
          className="flex flex-col justify-between p-5 [border:1px_solid_var(--line)] [background:var(--panel)] rounded-[4px] min-h-[220px] gap-4 [transition:transform_0.15s_ease,border-color_0.15s_ease] hover:border-line2"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] [color:var(--dim)]">
              {c.weeks} week{c.weeks > 1 ? 's' : ''} · {c.instructor}
            </span>
            <h3 className="course-title">{c.title}</h3>
          </div>

          <p className="course-desc">{c.description || 'No description provided.'}</p>

          <div className="flex items-center justify-between gap-3 pt-3 [border-top:1px_solid_var(--line)]">
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn sm line">
              Open course ↗
            </a>

            {isStaff && (
              <button
                type="button"
                className="btn xs line text-[#ef4444] border-[rgba(239,68,68,0.3)]"

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
