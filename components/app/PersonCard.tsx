import { Avatar } from "@/components/pixel/Sprites";

/** One person, three fixed rows: identity, a single stat line, tags. Nothing wraps. */
export default function PersonCard({ name, role, stat, tags = [], action, fg, bg, className = "" }: { name: string; role: string; stat: string; tags?: string[]; action?: React.ReactNode; fg?: string; bg?: string; className?: string }) {
  return (
    <li className={`panel pcard ${className}`}>
      <div className="pcard-top"><Avatar name={name} size={44} fg={fg} bg={bg} /><div style={{ minWidth: 0 }}><strong>{name}</strong><span className="label one">{role}</span></div>{action}</div>
      <span className="pcard-stat">{stat}</span>
      {tags.length > 0 && <span className="row" style={{ "--g": "6px" } as React.CSSProperties}>{tags.map((t) => <span key={t} className="tag">{t}</span>)}</span>}
    </li>
  );
}
