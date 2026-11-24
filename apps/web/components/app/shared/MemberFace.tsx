'use client';
import { Avatar } from '@/components/pixel/Sprites';
import { useStore } from '../Store';

/**
 * A member's photo when they have one, otherwise their pixel avatar in the same box. Pass `id` and the
 * photo is found in the roster; pass `url` when the caller already has it.
 */
export function MemberFace({
  id,
  url,
  name,
  size = 28,
  fg,
  bg,
}: {
  id?: string;
  url?: string | null;
  name: string;
  size?: number;
  fg?: string;
  bg?: string;
}) {
  const { who } = useStore();
  const src = url ?? (id ? (who(id) as { avatar_url?: string | null }).avatar_url : null);
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="face"
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
    />
  ) : (
    <Avatar name={name} size={size} fg={fg} bg={bg} />
  );
}
