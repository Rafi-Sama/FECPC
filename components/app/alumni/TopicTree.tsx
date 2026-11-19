"use client";
import React from "react";
import type { InterviewTopic, InterviewTip } from "@/lib/state";

export function TopicTree({
  topics,
  activeTopicId,
  onSelectTopic,
  experiences,
  onSelectExperience,
  onAddTopic,
  onAddExperience,
  canManage,
}: {
  topics: InterviewTopic[];
  activeTopicId: number | null;
  onSelectTopic: (id: number) => void;
  experiences: InterviewTip[];
  onSelectExperience: (tip: InterviewTip) => void;
  onAddTopic?: () => void;
  onAddExperience?: () => void;
  canManage: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Topics Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--mute, #6B6B6B)",
          }}
        >
          TOPICS ({topics.length})
        </span>

        {canManage && (
          <button
            type="button"
            className="btn line sm"
            onClick={onAddTopic}
            style={{
              padding: "4px 8px",
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add topic
          </button>
        )}
      </div>

      {/* Topics List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {topics.map((t) => {
          const isActive = t.id === activeTopicId;
          const total = Number(t.totalCount || 0);
          const solved = Number(t.solvedCount || 0);
          const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTopic(t.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                background: isActive ? "var(--bg, #ECE9E1)" : "var(--panel, #F6F4EE)",
                border: "2px solid var(--line2, #0B0B0B)",
                borderLeft: isActive
                  ? "5px solid var(--acc, #1F3BFF)"
                  : "2px solid var(--line2, #0B0B0B)",
                cursor: "pointer",
                transition: "background 0.15s, border-left 0.15s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: isActive ? "var(--acc, #1F3BFF)" : "var(--ink, #0B0B0B)",
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--dim, #6B6B6B)",
                  }}
                >
                  {solved}/{total}
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 4,
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
            </button>
          );
        })}
      </div>

      {/* Experiences Divider */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--dim, #6B6B6B)",
            }}
          >
            INTERVIEW EXPERIENCES
          </span>

          {canManage && (
            <button
              type="button"
              className="btn line sm"
              onClick={onAddExperience}
              style={{
                padding: "4px 8px",
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Share
            </button>
          )}
        </div>

        {experiences.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {experiences.map((exp) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => onSelectExperience(exp)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "var(--panel, #F6F4EE)",
                  border: "2px solid var(--line2, #0B0B0B)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "var(--ink, #0B0B0B)",
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {exp.title}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--dim, #6B6B6B)",
                  }}
                >
                  by {exp.author_name || "Alumnus"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--dim, #6B6B6B)",
              padding: "12px 0",
            }}
          >
            No experiences shared yet.
          </div>
        )}
      </div>
    </div>
  );
}
