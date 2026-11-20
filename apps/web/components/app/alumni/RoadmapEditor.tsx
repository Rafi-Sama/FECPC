'use client';
import React, { useState } from 'react';

interface EditorNode {
  id: string;
  name: string;
  description: string;
  editorialUrl: string;
  parentId: string | null;
  x: number;
  y: number;
  problemsCount: number;
}

export function RoadmapEditor({
  initialRoadmapName = 'Data structures & algorithms',
  initialDescription = 'Core topics and problem lists for coding interviews.',
  onCancel,
  onSave,
}: {
  initialRoadmapName?: string;
  initialDescription?: string;
  onCancel: () => void;
  onSave: (data: {
    name: string;
    description: string;
    nodes: EditorNode[];
  }) => Promise<void> | void;
}) {
  const [roadmapName, setRoadmapName] = useState(initialRoadmapName);
  const [description, setDescription] = useState(initialDescription);

  const [nodes, setNodes] = useState<EditorNode[]>([
    {
      id: 'root',
      name: 'Arrays and hashing',
      description: 'Fundamental data structures and operations.',
      editorialUrl: 'https://neetcode.io/practice',
      parentId: null,
      x: 250,
      y: 200,
      problemsCount: 18,
    },
    {
      id: 'child-1',
      name: 'Two pointers',
      description: 'Techniques for linear structures and sorted lists.',
      editorialUrl: '',
      parentId: 'root',
      x: 500,
      y: 200,
      problemsCount: 12,
    },
    {
      id: 'child-2',
      name: 'Sliding window',
      description: 'Subarray and substring optimizations.',
      editorialUrl: '',
      parentId: 'root',
      x: 250,
      y: 360,
      problemsCount: 8,
    },
  ]);

  const [selectedId, setSelectedId] = useState<string>('root');
  const [saving, setSaving] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedId) || nodes[0];

  const updateSelectedField = (field: keyof EditorNode, value: any) => {
    if (!selectedNode) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, [field]: value } : n)));
  };

  const handleAddChild = (
    direction: 'above' | 'right' | 'below' | 'left',
    parentNode: EditorNode,
  ) => {
    let newX = parentNode.x;
    let newY = parentNode.y;

    if (direction === 'above') newY = Math.max(30, parentNode.y - 140);
    else if (direction === 'below') newY = Math.min(520, parentNode.y + 140);
    else if (direction === 'left') newX = Math.max(30, parentNode.x - 220);
    else if (direction === 'right') newX = Math.min(520, parentNode.x + 220);

    const newId = `node-${Date.now()}`;
    const newNode: EditorNode = {
      id: newId,
      name: 'New Topic',
      description: '',
      editorialUrl: '',
      parentId: parentNode.id,
      x: newX,
      y: newY,
      problemsCount: 0,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedId(newId);
  };

  const handleDeleteSelected = () => {
    if (!selectedNode || selectedNode.id === 'root') {
      alert('Cannot delete the root topic.');
      return;
    }

    // Find all descendants
    const toDelete = new Set<string>([selectedNode.id]);
    let added = true;
    while (added) {
      added = false;
      for (const n of nodes) {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      }
    }

    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
    setSelectedId('root');
  };

  const handleSaveRoadmap = async () => {
    if (!roadmapName.trim()) {
      alert('Roadmap name is required.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: roadmapName.trim(),
        description: description.trim(),
        nodes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header matching RoadmapEditor.dc.html */}
      <h1
        style={{
          fontSize: 48,
          margin: '0 0 24px',
          letterSpacing: '-1px',
          color: 'var(--ink, #0B0B0B)',
        }}
      >
        <span style={{ fontWeight: 500 }}>Create</span>{' '}
        <i style={{ color: 'var(--acc, #1F3BFF)', fontStyle: 'normal' }}>roadmap.</i>
      </h1>

      {/* Control row */}
      <div
        className="fl"
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <input
            aria-label="Roadmap name"
            placeholder="Roadmap name"
            value={roadmapName}
            onChange={(e) => setRoadmapName(e.target.value)}
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
        <div style={{ flex: '2 1 360px' }}>
          <input
            aria-label="Description"
            placeholder="Short description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
        <button
          type="button"
          onClick={onCancel}
          style={{
            font: '500 13px Inter, Arial, sans-serif',
            border: '2px solid var(--line2, #0B0B0B)',
            padding: '0 16px',
            background: 'var(--panel, #F6F4EE)',
            minHeight: 44,
            color: 'var(--ink, #0B0B0B)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="k"
          onClick={handleSaveRoadmap}
          disabled={saving}
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
          {saving ? 'Saving…' : 'Save roadmap'}
        </button>
      </div>

      {/* Editor Main Canvas & Sidebar layout */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left Column: Interactive Tree Canvas */}
        <div style={{ flex: '2 1 460px', minWidth: 0 }}>
          <div
            className="pn"
            style={{
              padding: 0,
              overflow: 'auto',
              margin: 0,
              background: 'var(--panel, #F6F4EE)',
              border: '2px solid var(--line2, #0B0B0B)',
            }}
          >
            <div style={{ position: 'relative', width: 700, height: 600, margin: '0 auto' }}>
              <div
                className="m"
                style={{
                  position: 'absolute',
                  left: 16,
                  top: 16,
                  font: '11px ui-monospace, Menlo, monospace',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--dim, #5F5F5F)',
                  zIndex: 2,
                }}
              >
                Click + on any side to add a child
              </div>

              {/* SVG Connectors */}
              <svg
                aria-hidden="true"
                width="700"
                height="600"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                {nodes
                  .filter((n) => n.parentId)
                  .map((child) => {
                    const parent = nodes.find((p) => p.id === child.parentId);
                    if (!parent) return null;
                    const px = parent.x + 90;
                    const py = parent.y + 32;
                    const cx = child.x + 90;
                    const cy = child.y + 32;
                    const d = `M ${px} ${py} L ${cx} ${cy}`;
                    return (
                      <path
                        key={`${parent.id}-${child.id}`}
                        d={d}
                        stroke="var(--line2, #0B0B0B)"
                        strokeWidth={2}
                        fill="none"
                      />
                    );
                  })}
              </svg>

              {/* Node Boxes with Directional '+' buttons */}
              {nodes.map((n) => {
                const isSelected = n.id === selectedId;
                return (
                  <React.Fragment key={n.id}>
                    {/* Node Box */}
                    <div
                      tabIndex={0}
                      role="button"
                      aria-label={`${n.name} topic box`}
                      onClick={() => setSelectedId(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(n.id);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: n.x,
                        top: n.y,
                        width: 180,
                        height: 64,
                        background: 'var(--panel, #F6F4EE)',
                        border: isSelected
                          ? '3px solid var(--acc, #1F3BFF)'
                          : '2px solid var(--line2, #0B0B0B)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 14,
                        color: 'var(--ink, #0B0B0B)',
                        cursor: 'pointer',
                        padding: '0 10px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        zIndex: 3,
                        boxShadow: isSelected ? '0 0 0 2px #1F3BFF33' : 'none',
                      }}
                    >
                      {n.name || '[Topic name]'}
                    </div>

                    {/* 4 '+' buttons around the box (above, right, below, left) */}
                    <button
                      type="button"
                      aria-label={`Add child above ${n.name}`}
                      onClick={() => handleAddChild('above', n)}
                      style={{
                        position: 'absolute',
                        left: n.x + 74,
                        top: n.y - 16,
                        width: 32,
                        height: 32,
                        minHeight: 32,
                        padding: 0,
                        fontSize: 20,
                        lineHeight: 1,
                        background: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                        color: isSelected ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                        border: '2px solid var(--line2, #0B0B0B)',
                        cursor: 'pointer',
                        zIndex: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label={`Add child right of ${n.name}`}
                      onClick={() => handleAddChild('right', n)}
                      style={{
                        position: 'absolute',
                        left: n.x + 164,
                        top: n.y + 16,
                        width: 32,
                        height: 32,
                        minHeight: 32,
                        padding: 0,
                        fontSize: 20,
                        lineHeight: 1,
                        background: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                        color: isSelected ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                        border: '2px solid var(--line2, #0B0B0B)',
                        cursor: 'pointer',
                        zIndex: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label={`Add child below ${n.name}`}
                      onClick={() => handleAddChild('below', n)}
                      style={{
                        position: 'absolute',
                        left: n.x + 74,
                        top: n.y + 48,
                        width: 32,
                        height: 32,
                        minHeight: 32,
                        padding: 0,
                        fontSize: 20,
                        lineHeight: 1,
                        background: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                        color: isSelected ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                        border: '2px solid var(--line2, #0B0B0B)',
                        cursor: 'pointer',
                        zIndex: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label={`Add child left of ${n.name}`}
                      onClick={() => handleAddChild('left', n)}
                      style={{
                        position: 'absolute',
                        left: n.x - 16,
                        top: n.y + 16,
                        width: 32,
                        height: 32,
                        minHeight: 32,
                        padding: 0,
                        fontSize: 20,
                        lineHeight: 1,
                        background: isSelected ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                        color: isSelected ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                        border: '2px solid var(--line2, #0B0B0B)',
                        cursor: 'pointer',
                        zIndex: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Box Panel matching RoadmapEditor.dc.html */}
        <div style={{ flex: '1 1 300px' }}>
          <div
            className="pn"
            style={{
              margin: 0,
              background: 'var(--panel, #F6F4EE)',
              border: '2px solid var(--line2, #0B0B0B)',
              padding: 24,
            }}
          >
            <div
              className="m"
              style={{
                marginBottom: 16,
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
              }}
            >
              Selected box
            </div>

            {selectedNode ? (
              <>
                <div className="f" style={{ marginBottom: 16 }}>
                  <label
                    className="m"
                    htmlFor="n1"
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      font: '11px ui-monospace, Menlo, monospace',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--dim, #5F5F5F)',
                    }}
                  >
                    Topic name
                  </label>
                  <input
                    id="n1"
                    value={selectedNode.name}
                    onChange={(e) => updateSelectedField('name', e.target.value)}
                    style={{
                      border: '2px solid var(--line2, #0B0B0B)',
                      background: 'var(--bg, #FFFFFF)',
                      padding: '12px 14px',
                      fontSize: 14,
                      minHeight: 44,
                      width: '100%',
                      color: 'var(--ink, #0B0B0B)',
                    }}
                  />
                </div>

                <div className="f" style={{ marginBottom: 16 }}>
                  <label
                    className="m"
                    htmlFor="n2"
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      font: '11px ui-monospace, Menlo, monospace',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--dim, #5F5F5F)',
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    id="n2"
                    rows={3}
                    value={selectedNode.description}
                    onChange={(e) => updateSelectedField('description', e.target.value)}
                    style={{
                      border: '2px solid var(--line2, #0B0B0B)',
                      background: 'var(--bg, #FFFFFF)',
                      padding: '12px 14px',
                      fontSize: 14,
                      width: '100%',
                      color: 'var(--ink, #0B0B0B)',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div className="f" style={{ marginBottom: 16 }}>
                  <label
                    className="m"
                    htmlFor="n3"
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      font: '11px ui-monospace, Menlo, monospace',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--dim, #5F5F5F)',
                    }}
                  >
                    Editorial playlist (link)
                  </label>
                  <input
                    id="n3"
                    type="url"
                    placeholder="https://"
                    value={selectedNode.editorialUrl}
                    onChange={(e) => updateSelectedField('editorialUrl', e.target.value)}
                    style={{
                      border: '2px solid var(--line2, #0B0B0B)',
                      background: 'var(--bg, #FFFFFF)',
                      padding: '12px 14px',
                      fontSize: 14,
                      minHeight: 44,
                      width: '100%',
                      color: 'var(--ink, #0B0B0B)',
                    }}
                  />
                  <p
                    className="t"
                    style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--dim, #5F5F5F)' }}
                  >
                    One link for the whole topic.
                  </p>
                </div>

                <div
                  className="m"
                  style={{
                    marginBottom: 8,
                    font: '11px ui-monospace, Menlo, monospace',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--dim, #5F5F5F)',
                  }}
                >
                  Problems · {selectedNode.problemsCount}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateSelectedField('problemsCount', selectedNode.problemsCount + 1)
                  }
                  style={{
                    font: '500 13px Inter, Arial, sans-serif',
                    border: '2px solid var(--line2, #0B0B0B)',
                    padding: '0 16px',
                    background: 'var(--panel, #F6F4EE)',
                    minHeight: 44,
                    color: 'var(--ink, #0B0B0B)',
                    marginBottom: 24,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  + Add problem
                </button>

                <div style={{ borderTop: '1px solid var(--line, #CFCBBF)', paddingTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    style={{
                      font: '500 13px Inter, Arial, sans-serif',
                      border: '2px solid var(--line2, #0B0B0B)',
                      padding: '0 16px',
                      background: 'var(--panel, #F6F4EE)',
                      minHeight: 44,
                      color: 'var(--acc, #C8261B)',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Delete box and children
                  </button>
                </div>
              </>
            ) : (
              <div className="m" style={{ color: 'var(--dim, #5F5F5F)' }}>
                Select a topic box to edit.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoadmapEditor;
