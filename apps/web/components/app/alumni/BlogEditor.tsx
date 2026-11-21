'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { BlogPost } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { SaveForm } from '@/components/app/SaveBar';
import { MarkdownBody } from '@/components/app/shared/MarkdownEditor';

const TOPICS = ['Career', 'Interviews', 'Engineering', 'Stories', 'Grad school', 'Life abroad'];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function BlogEditor({
  post,
  onClose,
  onSaved,
}: {
  post?: BlogPost | null;
  onClose: () => void;
  onSaved: (savedPost: BlogPost) => void;
}) {
  const { me } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(post?.title || '');
  const [subtitle, setSubtitle] = useState(post?.subtitle || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const slugCustomized = Boolean(post?.slug);
  const [topic, setTopic] = useState(() => {
    if (post?.tags && post.tags.length > 0 && TOPICS.includes(post.tags[0])) {
      return post.tags[0];
    }
    return 'Career';
  });
  const [tagsInput, setTagsInput] = useState(() => {
    if (post?.tags && post.tags.length > 1) {
      return post.tags.slice(1).join(', ');
    }
    return '';
  });
  const [bodyMd, setBodyMd] = useState(post?.body_md || '');
  const [isPreview, setIsPreview] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-slug from title if not customized
  useEffect(() => {
    if (!slugCustomized && title.trim()) {
      setSlug(slugify(title));
    }
  }, [title, slugCustomized]);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap + Esc
  useEffect(() => {
    titleInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const insertFormat = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = bodyMd.substring(start, end);
    const replacement = before + (selected || 'text') + after;
    const newBody = bodyMd.substring(0, start) + replacement + bodyMd.substring(end);
    setBodyMd(newBody);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + replacement.length - after.length);
    }, 0);
  };

  const isPublished = post?.status === 'published';
  const handleSave = async (published: boolean) => {
    if (!title.trim()) {
      setError('Title is required.');
      titleInputRef.current?.focus();
      return false;
    }
    if (!bodyMd.trim()) {
      setError('Story content cannot be empty.');
      return false;
    }
    setError(null);
    setSubmitting(true);

    const extraTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const combinedTags = Array.from(new Set([topic, ...extraTags]));

    const payload = {
      action: post ? 'updateBlogPost' : 'createBlogPost',
      id: post?.id,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      slug: (slug.trim() || slugify(title)).toLowerCase(),
      tags: combinedTags,
      body_md: bodyMd.trim(),
      published,
    };

    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save blog post.');
      }

      const resData = await res.json();
      onSaved(resData.post);
      return true;
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const words = bodyMd.trim() ? bodyMd.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.round(words / 200));

  return (
    <div
      className="ov open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 11, 11, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'safe center',
        justifyContent: 'center',
        padding: '48px 24px',
        overflowY: 'auto',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        ref={modalRef}
        className="md"
        role="dialog"
        aria-modal="true"
        aria-label={post ? 'Edit blog post' : 'Write post'}
        style={{
          position: 'relative',
          display: 'block',
          maxWidth: 880,
          width: '100%',
          padding: '40px 48px',
          background: 'var(--panel, #F6F4EE)',
          border: '2px solid var(--line2, #0B0B0B)',
          boxShadow: '10px 10px 0 var(--line2, #0B0B0B)',
          animation: 'rise 0.2s ease-out',
        }}
      >
        <SaveForm
          label={post ? 'Unsaved changes to this post' : 'Unsaved new post'}
          saveLabel={isPublished ? 'Save changes' : 'Save draft'}
          onDiscard={onClose}
          onSubmit={() => handleSave(isPublished)}
        >
          {/* Close button */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              minWidth: 44,
              height: 44,
              position: 'absolute',
              right: 16,
              top: 16,
              background: 'var(--panel, #F6F4EE)',
              border: '2px solid var(--line2, #0B0B0B)',
              color: 'var(--ink, #0B0B0B)',
              cursor: 'pointer',
              fontSize: 22,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            ×
          </button>

          {/* Draft byline */}
          <div
            className="m"
            style={{
              marginBottom: 24,
              paddingRight: 56,
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
            Draft by {me?.name || 'You'} ·{' '}
            {post ? (post.published_at ? 'Published' : 'Saved draft') : 'Draft'}
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(255, 90, 31, 0.12)',
                border: '1px solid var(--acc, #FF5A1F)',
                color: 'var(--acc, #FF5A1F)',
                fontSize: 13,
                fontFamily: 'var(--mono)',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* 36px Title Input matching BlogWrite.dc.html */}
          <input
            ref={titleInputRef}
            aria-label="Title"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              font: '700 36px Inter, Arial, sans-serif',
              borderWidth: '0 0 2px',
              borderStyle: 'solid',
              borderColor: 'var(--line2, #0B0B0B)',
              background: 'transparent',
              padding: '8px 0',
              marginBottom: 12,
              width: '100%',
              color: 'var(--ink, #0B0B0B)',
              outline: 'none',
              borderRadius: 0,
            }}
          />

          {/* 20px Subtitle Input matching BlogWrite.dc.html */}
          <input
            aria-label="Subtitle"
            placeholder="Subtitle (optional)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            style={{
              font: '20px Inter, Arial, sans-serif',
              borderWidth: '0 0 1px',
              borderStyle: 'solid',
              borderColor: 'var(--line, #0B0B0B)',
              background: 'transparent',
              padding: '8px 0',
              marginBottom: 24,
              width: '100%',
              color: 'var(--ink, #0B0B0B)',
              outline: 'none',
              borderRadius: 0,
            }}
          />

          {/* Markdown toolstrip matching BlogWrite.dc.html */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              className="sm"
              aria-label="Bold"
              onClick={() => insertFormat('**', '**')}
              style={{
                minWidth: 40,
                height: 36,
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                color: 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              B
            </button>
            <button
              type="button"
              className="sm"
              aria-label="Italic"
              onClick={() => insertFormat('*', '*')}
              style={{
                minWidth: 40,
                height: 36,
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                color: 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
                fontStyle: 'italic',
              }}
            >
              I
            </button>
            <button
              type="button"
              className="sm"
              aria-label="Heading"
              onClick={() => insertFormat('### ', '')}
              style={{
                minWidth: 40,
                height: 36,
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                color: 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              H
            </button>
            <button
              type="button"
              className="sm"
              aria-label="Quote"
              onClick={() => insertFormat('> ', '')}
              style={{
                minWidth: 40,
                height: 36,
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                color: 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
              }}
            >
              ❝
            </button>
            <button
              type="button"
              className="sm"
              aria-label="Code"
              onClick={() => insertFormat('```\n', '\n```')}
              style={{
                minWidth: 40,
                height: 36,
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                color: 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
              }}
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              className="sm"
              aria-label="Link"
              onClick={() => insertFormat('[', '](https://)')}
              style={{
                minWidth: 40,
                height: 36,
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                border: '2px solid var(--line2, #0B0B0B)',
                color: 'var(--ink, #0B0B0B)',
                cursor: 'pointer',
              }}
            >
              ↗
            </button>

            {/* Write · Preview toggle on the right */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={`ch sm ${!isPreview ? 'on' : ''}`}
                onClick={() => setIsPreview(false)}
                style={{
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  border: '2px solid var(--line2, #0B0B0B)',
                  padding: '0 10px',
                  minHeight: 36,
                  background: !isPreview ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                  color: !isPreview ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                  cursor: 'pointer',
                }}
              >
                Write
              </button>
              <button
                type="button"
                className={`ch sm ${isPreview ? 'on' : ''}`}
                onClick={() => setIsPreview(true)}
                style={{
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  border: '2px solid var(--line2, #0B0B0B)',
                  padding: '0 10px',
                  minHeight: 36,
                  background: isPreview ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                  color: isPreview ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                  cursor: 'pointer',
                }}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Textarea or Preview */}
          {isPreview ? (
            <div
              style={{
                minHeight: 280,
                padding: 20,
                border: '2px solid var(--line2, #0B0B0B)',
                background: 'var(--bg, #FFFFFF)',
                color: 'var(--ink, #0B0B0B)',
                overflowY: 'auto',
                marginBottom: 16,
              }}
            >
              <MarkdownBody markdown={bodyMd || '*No content to preview yet.*'} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              aria-label="Story"
              rows={12}
              placeholder="Tell your story in Markdown…"
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              style={{
                width: '100%',
                border: '2px solid var(--line2, #0B0B0B)',
                background: 'var(--panel, #F6F4EE)',
                padding: '14px',
                font: '14px Inter, Arial, sans-serif',
                lineHeight: 1.6,
                color: 'var(--ink, #0B0B0B)',
                borderRadius: 0,
                resize: 'vertical',
                minHeight: 240,
              }}
            />
          )}

          {/* Topic and Tags row matching BlogWrite.dc.html */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '20px 0' }}>
            <div className="f" style={{ flex: '1 1 200px', margin: 0 }}>
              <label
                className="m"
                htmlFor="tp"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
                Topic
              </label>
              <select
                id="tp"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{
                  border: '2px solid var(--line2, #0B0B0B)',
                  background: 'var(--panel, #F6F4EE)',
                  padding: '12px 14px',
                  font: '14px Inter, Arial, sans-serif',
                  minHeight: 44,
                  color: 'var(--ink, #0B0B0B)',
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="f" style={{ flex: '2 1 280px', margin: 0 }}>
              <label
                className="m"
                htmlFor="tg"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                }}
              >
                Tags (comma separated, up to 3)
              </label>
              <input
                id="tg"
                placeholder="e.g. System design, Mock interviews"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                style={{
                  border: '2px solid var(--line2, #0B0B0B)',
                  background: 'var(--panel, #F6F4EE)',
                  padding: '12px 14px',
                  font: '14px Inter, Arial, sans-serif',
                  minHeight: 44,
                  color: 'var(--ink, #0B0B0B)',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Footer Action Bar matching BlogWrite.dc.html */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              borderTop: '1px solid var(--line, #CFCBBF)',
              paddingTop: 20,
            }}
          >
            <span
              className="m"
              style={{
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
              }}
            >
              Read time · {readTimeMin} min read
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {!isPublished && (
                <button
                  type="button"
                  className="k"
                  onClick={() => handleSave(true)}
                  disabled={submitting}
                  style={{
                    font: '500 13px Inter, Arial, sans-serif',
                    border: '2px solid var(--line2, #0B0B0B)',
                    padding: '0 16px',
                    background: 'var(--ink, #0B0B0B)',
                    color: 'var(--on, #FFFFFF)',
                    minHeight: 44,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Publishing…' : 'Publish'}
                </button>
              )}
            </span>
          </div>
        </SaveForm>
      </div>
    </div>
  );
}

export default BlogEditor;
