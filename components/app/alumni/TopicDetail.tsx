"use client";
import React from "react";
import type { InterviewTopic, InterviewProblem, InterviewTip } from "@/lib/state";
import { TierAvatar, TierName } from "@/components/app/shared/TierBadge";
import { MarkdownBody, relTime } from "@/components/app/shared/MarkdownEditor";
import { useStore } from "@/components/app/Store";
import { isAdmin } from "@/lib/permissions";

export function TopicDetail({
  topic,
  problems,
  tips,
  onToggleProblem,
  onDeleteProblem,
  onDeleteTip,
  onAddProblem,
  onAddTip,
  canManage,
}: {
  topic: InterviewTopic;
  problems: InterviewProblem[];
  tips: InterviewTip[];
  onToggleProblem: (problemId: number, currentlySolved: boolean) => Promise<void>;
  onDeleteProblem: (problemId: number) => Promise<void>;
  onDeleteTip: (tipId: number) => Promise<void>;
  onAddProblem: () => void;
  onAddTip: () => void;
  canManage: boolean;
}) {
  const { me, s } = useStore();

  const total = Number(topic.totalCount || problems.length);
  const solved = problems.filter((p) => p.solved).length;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <div
      style={{
        background: "var(--panel, #F6F4EE)",
        border: "2px solid var(--line2, #0B0B0B)",
        padding: "28px 24px",
      }}
    >
      {/* Topic Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--acc, #1F3BFF)",
            marginBottom: 6,
          }}
        >
          INTERVIEW PREP TOPIC
        </div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "0 0 8px",
            color: "var(--ink, #0B0B0B)",
          }}
        >
          {topic.name}
        </h2>
        {topic.description && (
          <p
            style={{
              fontSize: 14,
              color: "var(--dim, #6B6B6B)",
              margin: "0 0 16px",
              lineHeight: 1.5,
            }}
          >
            {topic.description}
          </p>
        )}

        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "var(--mono)",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          <span>
            {solved} of {total} solved
          </span>
          <span style={{ color: "var(--acc, #1F3BFF)" }}>{pct}%</span>
        </div>
        <div
          style={{
            height: 8,
            background: "var(--line, #DCD8CC)",
            width: "100%",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--ink, #0B0B0B)",
              transition: "width 0.25s ease",
            }}
          />
        </div>
      </div>

      {/* PROBLEMS SECTION */}
      <section style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 8,
            borderBottom: "1px solid var(--line, #CFCCBF)",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink, #0B0B0B)",
            }}
          >
            · PROBLEMS ({problems.length})
          </span>

          {canManage && (
            <button
              type="button"
              className="btn line sm"
              onClick={onAddProblem}
              style={{
                padding: "4px 10px",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Add problem
            </button>
          )}
        </div>

        {problems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {problems.map((prob) => {
              const diff = (prob.difficulty || "medium").toLowerCase();
              const canDelete = prob.created_by === me.id || isAdmin(s.role);

              let diffStyle: React.CSSProperties = {
                fontFamily: "var(--mono)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "3px 8px",
                border: "1px solid var(--line2, #0B0B0B)",
                color: "var(--ink, #0B0B0B)",
              };
              if (diff === "medium") {
                diffStyle = {
                  ...diffStyle,
                  border: "1px solid var(--acc, #1F3BFF)",
                  color: "var(--acc, #1F3BFF)",
                };
              } else if (diff === "hard") {
                diffStyle = {
                  ...diffStyle,
                  background: "var(--ink, #0B0B0B)",
                  color: "var(--on, #FFFFFF)",
                };
              }

              return (
                <div
                  key={prob.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--line, #CFCCBF)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(prob.solved)}
                    onChange={() => onToggleProblem(prob.id, Boolean(prob.solved))}
                    aria-label={`Mark ${prob.title} as ${prob.solved ? "unsolved" : "solved"}`}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: "pointer",
                      accentColor: "var(--acc, #1F3BFF)",
                    }}
                  />

                  <div
                    style={{
                      flex: 1,
                      fontWeight: 600,
                      fontSize: 14,
                      textDecoration: prob.solved ? "line-through" : "none",
                      color: prob.solved ? "var(--dim, #6B6B6B)" : "var(--ink, #0B0B0B)",
                    }}
                  >
                    {prob.title}
                  </div>

                  <span style={diffStyle}>
                    {diff === "easy" ? "EASY" : diff === "hard" ? "HARD" : "MED"}
                  </span>

                  {prob.url && (
                    <a
                      href={prob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open external problem link"
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--acc, #1F3BFF)",
                        textDecoration: "none",
                        padding: "2px 6px",
                      }}
                    >
                      ↗
                    </a>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteProblem(prob.id)}
                      title="Delete problem"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent2, #FF5A1F)",
                        cursor: "pointer",
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        padding: "2px 6px",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "20px 0",
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--dim, #6B6B6B)",
            }}
          >
            No problems added to this topic yet.
          </div>
        )}
      </section>

      {/* TIPS SECTION */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 8,
            borderBottom: "1px solid var(--line, #CFCCBF)",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink, #0B0B0B)",
            }}
          >
            · TIPS FROM ALUMNI ({tips.length})
          </span>

          {canManage && (
            <button
              type="button"
              className="btn line sm"
              onClick={onAddTip}
              style={{
                padding: "4px 10px",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Add tip
            </button>
          )}
        </div>

        {tips.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {tips.map((tip) => {
              const canDelete = tip.author_id === me.id || isAdmin(s.role);
              return (
                <article
                  key={tip.id}
                  style={{
                    background: "var(--bg, #FFFFFF)",
                    border: "2px solid var(--line2, #0B0B0B)",
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <TierAvatar
                      name={tip.author_name || "Alumnus"}
                      solved={tip.author_rating ?? 0}
                      avatarUrl={tip.author_avatar}
                      size={28}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        <TierName
                          name={tip.author_name || "Alumnus"}
                          solved={tip.author_rating ?? 0}
                        />
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: "var(--dim, #6B6B6B)",
                        }}
                      >
                        {tip.created_at ? relTime(tip.created_at) : "Recently"}
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDeleteTip(tip.id)}
                        title="Delete tip"
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          color: "var(--accent2, #FF5A1F)",
                          cursor: "pointer",
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <h4
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      margin: "0 0 8px",
                      color: "var(--ink, #0B0B0B)",
                    }}
                  >
                    {tip.title}
                  </h4>

                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                    <MarkdownBody markdown={tip.body_md} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "20px 0",
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--dim, #6B6B6B)",
            }}
          >
            No alumni tips for this topic yet.
          </div>
        )}
      </section>
    </div>
  );
}
