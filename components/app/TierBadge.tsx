"use client";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/pixel/Sprites";
import { rankFor, type Rank } from "@/lib/rank";

export function TierBadge({
  solved,
  rating,
  cfHandle,
  size = "sm",
  rank: rankProp,
}: {
  solved: number | null | undefined;
  rating?: number | null;
  cfHandle?: string | null;
  size?: "sm" | "md";
  rank?: Rank;
}) {
  const rank = rankProp ?? rankFor(solved, cfHandle);
  if (rank.unrated) return null;

  const hasRating = typeof rating === "number" && rating > 0;
  const label = hasRating ? `${rating} · ${rank.title}` : rank.title;
  const isLegendary = rank.title === "Legendary GM";

  return (
    <span
      className={`rank-pill rank-pill--${size}${isLegendary ? " rank-pill--legendary" : ""}`}
      style={
        {
          "--rank-color": rank.color,
          "--rank-bg": rank.bg,
          "--rank-border": rank.border,
          "--rank-text": rank.textColor,
        } as CSSProperties
      }
    >
      {label}
    </span>
  );
}

export function AvatarRing({
  name,
  solved,
  cfHandle,
  avatarUrl,
  size = 40,
  ringWidth = 2,
  ringOffset = 2,
  notched = false,
  rank: rankProp,
}: {
  name: string;
  solved: number | null | undefined;
  cfHandle?: string | null;
  avatarUrl?: string | null;
  size?: number;
  ringWidth?: number;
  ringOffset?: number;
  notched?: boolean;
  rank?: Rank;
}) {
  const rank = rankProp ?? rankFor(solved, cfHandle);

  return (
    <span
      className={`avatar-ring${notched ? " avatar-ring--notched" : ""}${rank.unrated ? " avatar-ring--unrated" : ""}`}
      style={
        {
          "--rank-color": rank.color,
          "--ring-w": `${ringWidth}px`,
          "--ring-off": `${ringOffset}px`,
        } as CSSProperties
      }
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          className="avatar-ring__img"
          style={{ width: size, height: size }}
        />
      ) : (
        <Avatar name={name} size={size} fg="#0D0D0B" bg="#DAD6CB" />
      )}
    </span>
  );
}

export default TierBadge;
