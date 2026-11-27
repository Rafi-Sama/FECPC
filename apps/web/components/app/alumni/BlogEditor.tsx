'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { BlogPost } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { SaveForm } from '@/components/app/SaveBar';
import { MarkdownBody } from '@/components/app/shared/MarkdownEditor';

const toolButton =
  'sm py-0 px-3 min-w-[40px] h-[36px] [background:var(--panel)] [border:2px_solid_var(--line2)] text-ink cursor-pointer';

const modeTab =
  'py-0 px-2.5 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase [border:2px_solid_var(--line2)] min-h-[36px] cursor-pointer';

const editorLabel =
  'm mb-2 block [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim';

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
      className="ov open inset-0 py-12 px-6 fixed [background:rgba(11,_11,_11,_0.6)] z-[9999] flex [align-items:safe_center] justify-center overflow-y-auto [backdrop-filter:blur(2px)]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="md py-10 px-12 relative block max-w-[880px] w-full [background:var(--panel)] [border:2px_solid_var(--line2)] [box-shadow:10px_10px_0_var(--line2)] [animation:rise_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label={post ? 'Edit blog post' : 'Write post'}
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
            className="top-4 right-4 min-w-[44px] h-[44px] absolute [background:var(--panel)] [border:2px_solid_var(--line2)] text-ink cursor-pointer text-[22px] leading-[1] flex items-center justify-center font-bold"
          >
            ×
          </button>

          {/* Draft byline */}
          <div className="m pr-14 mb-6 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
            Draft by {me?.name || 'You'} ·{' '}
            {post ? (post.published_at ? 'Published' : 'Saved draft') : 'Draft'}
          </div>

          {error && (
            <div className="py-2.5 px-3.5 mb-4 [background:rgba(255,_90,_31,_0.12)] [border:1px_solid_var(--acc)] text-acc text-[13px] [font-family:var(--mono)]">
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
            className="py-2 px-0 mb-3 [font:700_36px_Inter,_Arial,_sans-serif] [border-width:0_0_2px] [border-style:solid] border-line2 [background:transparent] w-full text-ink [outline:none] [border-radius:0]"
          />

          {/* 20px Subtitle Input matching BlogWrite.dc.html */}
          <input
            aria-label="Subtitle"
            placeholder="Subtitle (optional)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="py-2 px-0 mb-6 [font:20px_Inter,_Arial,_sans-serif] [border-width:0_0_1px] [border-style:solid] border-line [background:transparent] w-full text-ink [outline:none] [border-radius:0]"
          />

          {/* Markdown toolstrip matching BlogWrite.dc.html */}
          <div className="mb-3 flex gap-2 flex-wrap items-center">
            <button
              type="button"
              className={`${toolButton} font-bold`}
              aria-label="Bold"
              onClick={() => insertFormat('**', '**')}
            >
              B
            </button>
            <button
              type="button"
              className={`${toolButton} italic`}
              aria-label="Italic"
              onClick={() => insertFormat('*', '*')}
            >
              I
            </button>
            <button
              type="button"
              className={`${toolButton} font-bold`}
              aria-label="Heading"
              onClick={() => insertFormat('### ', '')}
            >
              H
            </button>
            <button
              type="button"
              className={toolButton}
              aria-label="Quote"
              onClick={() => insertFormat('> ', '')}
            >
              ❝
            </button>
            <button
              type="button"
              className={`${toolButton} [font-family:var(--mono)]`}
              aria-label="Code"
              onClick={() => insertFormat('```\n', '\n```')}
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              className={toolButton}
              aria-label="Link"
              onClick={() => insertFormat('[', '](https://)')}
            >
              ↗
            </button>

            {/* Write · Preview toggle on the right */}
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className={`sm ${!isPreview ? 'on' : ''} ${modeTab}`}
                onClick={() => setIsPreview(false)}
                style={{
                  background: !isPreview ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                  color: !isPreview ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                }}
              >
                Write
              </button>
              <button
                type="button"
                className={`sm ${isPreview ? 'on' : ''} ${modeTab}`}
                onClick={() => setIsPreview(true)}
                style={{
                  background: isPreview ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                  color: isPreview ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                }}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Textarea or Preview */}
          {isPreview ? (
            <div className="p-5 mb-4 min-h-[280px] [border:2px_solid_var(--line2)] [background:var(--bg)] text-ink overflow-y-auto">
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
              className="p-3.5 w-full [border:2px_solid_var(--line2)] [background:var(--panel)] [font:14px/1.6_Inter,_Arial,_sans-serif] text-ink [border-radius:0] resize-y min-h-[240px]"
            />
          )}

          {/* Topic and Tags row matching BlogWrite.dc.html */}
          <div className="my-5 mx-0 flex gap-4 flex-wrap">
            <div className="f m-0 flex-[1_1_200px]">
              <label className={editorLabel} htmlFor="tp">
                Topic
              </label>
              <select
                id="tp"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="py-3 px-3.5 [border:2px_solid_var(--line2)] [background:var(--panel)] [font:14px_Inter,_Arial,_sans-serif] min-h-[44px] text-ink w-full cursor-pointer"
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="f m-0 flex-[2_1_280px]">
              <label className={editorLabel} htmlFor="tg">
                Tags (comma separated, up to 3)
              </label>
              <input
                id="tg"
                placeholder="e.g. System design, Mock interviews"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="py-3 px-3.5 [border:2px_solid_var(--line2)] [background:var(--panel)] [font:14px_Inter,_Arial,_sans-serif] min-h-[44px] text-ink w-full"
              />
            </div>
          </div>

          {/* Footer Action Bar matching BlogWrite.dc.html */}
          <div className="pt-5 flex gap-2 items-center [border-top:1px_solid_var(--line)]">
            <span className="m [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
              Read time · {readTimeMin} min read
            </span>
            <span className="ml-auto flex gap-2">
              {!isPublished && (
                <button
                  type="button"
                  className="k py-0 px-4 [font:500_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--ink)] text-on min-h-[44px] cursor-pointer"
                  onClick={() => handleSave(true)}
                  disabled={submitting}
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
