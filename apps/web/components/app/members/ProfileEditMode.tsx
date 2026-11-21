'use client';
import { useRef, useState } from 'react';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { useStore } from '@/components/app/Store';
import { SaveForm } from '@/components/app/SaveBar';
import { rankFor } from '@fecpc/contracts';
import type { MemberProfile } from '@fecpc/contracts';

const SKILL_CHOICES = [
  'CP',
  'Graphs',
  'DP',
  'Math',
  'Data structures',
  'Strings',
  'Systems',
  'Web',
  'AI/ML',
  'Game dev',
  'Security',
];

/** Center-crops an uploaded image to 1:1 and scales down to max 512×512 JPEG data URL. */
async function cropAvatarSquare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const outSize = Math.min(512, side);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, outSize, outSize);
  bitmap.close?.();

  let dataUrl = canvas.toDataURL('image/webp', 0.85);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  }
  return dataUrl;
}

export function ProfileEditMode({
  profile,
  formId = 'profile-edit-form',
  onCancel,
  onSaved,
  onBusyChange,
}: {
  profile: MemberProfile;
  formId?: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { act } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [cfHandle, setCfHandle] = useState(profile.cf_handle ?? '');
  const [githubUrl, setGithubUrl] = useState(profile.github_url ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? '');
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [cfStatus, setCfStatus] = useState('');
  const [cfSynced, setCfSynced] = useState<{ rating: number; solved: number } | null>(null);
  const [avatarErr, setAvatarErr] = useState('');

  const allSkillOptions = Array.from(new Set([...SKILL_CHOICES, ...profile.skills]));
  const previewSolved = cfSynced ? cfSynced.solved : profile.problems_solved;
  const rank = rankFor(previewSolved, cfHandle);
  const roleLabel = profile.role || (profile.is_alumni ? 'Alumni' : 'Member');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarErr('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarErr('Please pick a PNG, JPEG, or WebP image.');
      return;
    }
    try {
      const cropped = await cropAvatarSquare(file);
      if (cropped.length > 440_000) {
        setAvatarErr('Image is too large after cropping. Try a smaller file.');
        return;
      }
      setAvatarUrl(cropped);
    } catch {
      setAvatarErr('Could not process that image file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCfBlur = async () => {
    const trimmed = cfHandle.trim();
    if (!trimmed) {
      setCfStatus('');
      setCfSynced(null);
      return;
    }
    if (!/^[\w.-]{3,24}$/.test(trimmed)) {
      setCfStatus('Handle must be 3–24 letters, digits, _, . or -');
      return;
    }
    if (trimmed === (profile.cf_handle ?? '')) return;

    setCfStatus('Fetching Codeforces rating & solved count…');
    try {
      const res = await fetch(`/api/cf/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setCfStatus(j.error ?? 'Could not fetch Codeforces stats right now.');
        return;
      }
      const data = (await res.json()) as { rating?: number; solved?: string[] };
      const nextRating = typeof data.rating === 'number' ? data.rating : 0;
      const nextSolved = Array.isArray(data.solved) ? data.solved.length : profile.problems_solved;
      setCfSynced({ rating: nextRating, solved: nextSolved });
      setCfStatus(
        `Synced from Codeforces: ${nextRating || 'Unrated'} rating · ${nextSolved} solved`,
      );
    } catch {
      setCfStatus('Codeforces unreachable right now; handle will still be saved.');
    }
  };

  const toggleSkill = (sk: string) => {
    setSkills((prev) => (prev.includes(sk) ? prev.filter((x) => x !== sk) : [...prev, sk]));
  };

  const handleSubmit = async () => {
    if (cfStatus.startsWith('Handle must')) return false;
    onBusyChange?.(true);
    try {
      const payload: Record<string, unknown> = {
        bio: bio.trim(),
        cf_handle: cfHandle.trim(),
        github_url: githubUrl.trim(),
        linkedin_url: linkedinUrl.trim(),
        skills,
        avatar_url: avatarUrl,
      };
      const ok = await act('updateProfile', payload);
      if (ok) {
        // The server fetches the (possibly new) handle's rating and solves itself; the client never sends them.
        await fetch('/api/codeforces/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }).catch(() => {});
        await onSaved();
      }
      return ok;
    } finally {
      onBusyChange?.(false);
    }
  };

  return (
    <SaveForm
      id={formId}
      className="stack"
      style={{ '--g': '16px' } as React.CSSProperties}
      label="Unsaved profile changes"
      onDiscard={onCancel}
      extraDirty={
        avatarUrl !== profile.avatar_url ||
        [...skills].sort().join() !== [...profile.skills].sort().join()
      }
      onSubmit={handleSubmit}
    >
      <div className="avatar-upload-zone">
        <button
          type="button"
          className="avatar-upload-trigger"
          aria-label="Upload profile photo"
          onClick={() => fileRef.current?.click()}
        >
          <AvatarRing
            name={profile.name}
            solved={previewSolved}
            cfHandle={cfHandle}
            avatarUrl={avatarUrl}
            size={96}
            ringWidth={3}
            ringOffset={4}
            notched
            rank={rank}
          />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr"
          onChange={handleFileChange}
        />
        <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
          <button type="button" className="btn xs line" onClick={() => fileRef.current?.click()}>
            Upload avatar
          </button>
          {avatarUrl && (
            <button type="button" className="btn xs line" onClick={() => setAvatarUrl(null)}>
              Remove avatar
            </button>
          )}
        </div>
        {avatarErr && (
          <p className="label bad" style={{ fontSize: 12 }}>
            {avatarErr}
          </p>
        )}
      </div>

      <div className="profile-edit-field">
        <span className="label" style={{ fontSize: 11 }}>
          Name · readonly
        </span>
        <strong style={{ fontSize: 18 }}>{profile.name}</strong>
      </div>

      <label className="profile-edit-field">
        <span className="label" style={{ fontSize: 11 }}>
          Bio
        </span>
        <textarea
          className="member-filter-ctrl"
          rows={4}
          maxLength={400}
          style={{ padding: '10px 12px', minHeight: 96, resize: 'vertical' }}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short bio (up to 400 characters)"
        />
        <span className="label" style={{ fontSize: 11, textAlign: 'right' }}>
          {bio.length} / 400
        </span>
      </label>

      <label className="profile-edit-field">
        <span className="label" style={{ fontSize: 11 }}>
          CF handle
        </span>
        <input
          className="member-filter-ctrl"
          value={cfHandle}
          onChange={(e) => setCfHandle(e.target.value)}
          onBlur={handleCfBlur}
          placeholder="e.g. tourist"
        />
        {cfStatus && (
          <span className="label" style={{ fontSize: 11 }} role="status">
            {cfStatus}
          </span>
        )}
      </label>

      <label className="profile-edit-field">
        <span className="label" style={{ fontSize: 11 }}>
          GitHub URL
        </span>
        <input
          type="url"
          className="member-filter-ctrl"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/username"
        />
      </label>

      <label className="profile-edit-field">
        <span className="label" style={{ fontSize: 11 }}>
          LinkedIn URL
        </span>
        <input
          type="url"
          className="member-filter-ctrl"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/in/username"
        />
      </label>

      <div className="profile-edit-field">
        <span className="label" style={{ fontSize: 11 }}>
          Skills
        </span>
        <div className="profile-edit-skills" role="group" aria-label="Select skills">
          {allSkillOptions.map((sk) => {
            const active = skills.includes(sk);
            return (
              <button
                key={sk}
                type="button"
                className={`tag${active ? ' on' : ''}`}
                aria-pressed={active}
                onClick={() => toggleSkill(sk)}
              >
                {sk}
              </button>
            );
          })}
        </div>
      </div>

      <p className="label" style={{ fontSize: 11 }}>
        {roleLabel} · {profile.dept} · Batch {profile.batch} · readonly
      </p>
    </SaveForm>
  );
}

export default ProfileEditMode;
