'use client';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import type { Course } from '@/lib/learning.ts';
import { fetchCourses } from '@/lib/learning.ts';
import { CourseGrid } from '@/components/app/learning/CourseGrid';
import { CourseForm } from '@/components/app/learning/CourseForm';
import '@/components/app/learning/learning.css';

export default function Courses() {
  const { s } = useStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Staff check: CP Head, President, or Super Admin
  const isStaff = s.roles.some(
    (r) => r === 'cp_head' || r === 'president' || r === 'super_admin',
  );

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchCourses();
      setCourses(list);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleCourseCreated = (course: Course) => {
    setCourses((prev) => [course, ...prev]);
    setShowAddForm(false);
  };

  const handleCourseDeleted = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <Page
      title={
        <>
          Popular <span className="acc">courses.</span>
        </>
      }
    >
      <div className="learning-container">
        {isStaff && (
          <div className="row between" style={{ alignItems: 'center' }}>
            <span className="label" style={{ color: 'var(--dim)' }}>
              Curated competitive programming courses
            </span>
            {!showAddForm && (
              <button
                type="button"
                className="btn sm"
                onClick={() => setShowAddForm(true)}
              >
                + Add a course
              </button>
            )}
          </div>
        )}

        {isStaff && showAddForm && (
          <CourseForm
            onCourseCreated={handleCourseCreated}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {loading ? (
          <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
            <p className="body" style={{ color: 'var(--dim)' }}>
              Loading courses...
            </p>
          </div>
        ) : (
          <CourseGrid
            courses={courses}
            isStaff={isStaff}
            onCourseDeleted={handleCourseDeleted}
          />
        )}
      </div>
    </Page>
  );
}
