import type { MilestoneType } from "./state.ts";

/** Human-readable milestone target phrase, e.g. "Pupil", "500 solved", "30-day streak". */
export function formatMilestoneTarget(type: MilestoneType, toValue: string): string {
  const clean = String(toValue ?? "").trim();
  if (type === "solved_milestone") {
    return /solved/i.test(clean) ? clean : `${clean} solved`;
  }
  if (type === "contest_streak") {
    return /streak/i.test(clean) ? clean : `${clean}-day streak`;
  }
  return clean;
}

/** Short title used in notifications, e.g. "reaching Pupil" or "reaching 500 solved". */
export function formatMilestoneTitle(type: MilestoneType, toValue: string): string {
  return `reaching ${formatMilestoneTarget(type, toValue)}`;
}

/** Mono subline displayed under a milestone row in the Feed sidebar. */
export function formatMilestoneSubline(m: {
  type: MilestoneType;
  from_value: string | null;
  to_value: string;
  threshold: number | null;
}): string {
  if (m.type === "rank_promotion") {
    const parts: string[] = ["Codeforces"];
    if (m.from_value) parts.push(`${m.from_value} → ${m.to_value}`);
    else parts.push(m.to_value);
    if (typeof m.threshold === "number" && m.threshold > 0) parts.push(String(m.threshold));
    return parts.join(" · ");
  }
  if (m.type === "solved_milestone") {
    return "Codeforces · Problems solved";
  }
  return "Codeforces · Current streak";
}

/** Notification copy delivered to a milestone owner when another member congratulates them. */
export function milestoneKudosNotification({
  giverName,
  milestoneTitle,
}: {
  giverName: string;
  milestoneTitle: string;
}): string {
  return `${giverName} congratulated you on ${milestoneTitle}`;
}
