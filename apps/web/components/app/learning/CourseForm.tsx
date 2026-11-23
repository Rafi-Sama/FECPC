'use client';
import { useState } from 'react';
import type { Course } from '@/lib/learning.ts';
import { createCourse, LearningApiError } from '@/lib/learning.ts';

export function CourseForm({
  onCourseCreated,
  onCancel,
}: {
  onCourseCreated: (course: Course) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('4');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedInstructor = instructor.trim();
    const trimmedDesc = description.trim();
    const trimmedUrl = url.trim();
    const weeks = parseInt(durationWeeks, 10);

    if (!trimmedTitle || trimmedTitle.length > 80) {
      setError('Title is required and must be at most 80 characters.');
      return;
    }
    if (!trimmedInstructor || trimmedInstructor.length > 60) {
      setError('Instructor name is required and must be at most 60 characters.');
      return;
    }
    if (isNaN(weeks) || weeks < 1 || weeks > 52) {
      setError('Duration must be between 1 and 52 weeks.');
      return;
    }
    if (trimmedDesc.length > 200) {
      setError('Description must be at most 200 characters.');
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
      setError('URL must begin with http:// or https://');
      return;
    }

    try {
      setSubmitting(true);
      const newCourse = await createCourse({
        title: trimmedTitle,
        instructor: trimmedInstructor,
        duration_weeks: weeks,
        description: trimmedDesc,
        url: trimmedUrl,
      });
      setTitle('');
      setInstructor('');
      setDurationWeeks('4');
      setDescription('');
      setUrl('');
      onCourseCreated(newCourse);
    } catch (err: any) {
      if (err instanceof LearningApiError) {
        setError(err.message);
      } else {
        setError('Failed to create course. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="course-form-panel" onSubmit={handleSubmit}>
      <div className="row between">
        <h3 className="h3">Add a course</h3>
        {onCancel && (
          <button type="button" className="btn xs line" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="alert-box error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="course-form-grid">
        <div className="form-group">
          <label htmlFor="course-title">Title *</label>
          <input
            id="course-title"
            type="text"
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Competitive Programming Core"
          />
        </div>

        <div className="form-group">
          <label htmlFor="course-instructor">Instructor *</label>
          <input
            id="course-instructor"
            type="text"
            required
            maxLength={60}
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="e.g. Tasnim Ahmed"
          />
        </div>

        <div className="form-group">
          <label htmlFor="course-duration">Duration (weeks) *</label>
          <input
            id="course-duration"
            type="number"
            required
            min={1}
            max={52}
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="course-url">Course URL *</label>
          <input
            id="course-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="form-group full-width">
          <label htmlFor="course-desc">Short description (up to 200 chars)</label>
          <textarea
            id="course-desc"
            rows={2}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of what this course covers..."
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, gap: 12 }}>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Adding course...' : 'Save course'}
        </button>
      </div>
    </form>
  );
}
