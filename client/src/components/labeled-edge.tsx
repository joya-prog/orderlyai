import { useState, useRef, useCallback } from 'react';
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

export type EdgeData = { color?: string };

export interface FlowTransition {
  id: string;
  label?: string;
  condition?: string;
  color?: string;
}

export interface FlowConnectionRecord {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  label?: string;
}

export interface FlowNodeRecord {
  id: string;
  config?: { transitions?: FlowTransition[] };
}

export const transitionColorHex: Record<string, string> = {
  emerald: '#10b981',
  rose: '#f43f5e',
  blue: '#3b82f6',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  orange: '#f59e0b',
  teal: '#14b8a6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#6b7280',
};

export function LabeledEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const { setEdges, setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Track explicit Escape cancels so onBlur doesn't commit after Escape
  const cancelledRef = useRef(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  const rawLabel = (label as string) || (data?.label as string) || '';
  const truncated = rawLabel.length > 24 ? rawLabel.slice(0, 24) + '\u2026' : rawLabel;
  const colorName = (data?.color as string) || 'indigo';
  const bgColor = transitionColorHex[colorName] ?? transitionColorHex.indigo;

  const handlePillClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraftLabel(rawLabel);
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    },
    [rawLabel],
  );

  const commitEdit = useCallback(() => {
    // Escape was pressed — skip commit; reset cancel flag
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setIsEditing(false);
      return;
    }
    setIsEditing(false);

    const trimmed = draftLabel.trim();
    if (!trimmed || trimmed === rawLabel) return;

    // Update all edges that share the same source handle (fan-out support)
    setEdges((eds) =>
      eds.map((e) => {
        const sameHandle = e.source === source && e.sourceHandle === sourceHandleId;
        if (e.id === id || sameHandle) {
          return { ...e, label: trimmed };
        }
        return e;
      }),
    );

    // Update source node's matching transition condition
    if (source && sourceHandleId) {
      const prefix = `${source}-`;
      if (sourceHandleId.startsWith(prefix)) {
        const transitionId = sourceHandleId.slice(prefix.length);
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== source) return n;
            const transitions = (n.data.transitions as FlowTransition[]) || [];
            const updated = transitions.map((t) =>
              t.id === transitionId
                ? { ...t, condition: trimmed, label: trimmed }
                : t,
            );
            return { ...n, data: { ...n.data, transitions: updated } };
          }),
        );
      }
    }
  }, [draftLabel, rawLabel, id, source, sourceHandleId, setEdges, setNodes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') {
        // Mark cancelled so subsequent onBlur skips the commit
        cancelledRef.current = true;
        inputRef.current?.blur();
      }
    },
    [commitEdit],
  );

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {truncated && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                style={{
                  backgroundColor: bgColor,
                  fontSize: '12px',
                  lineHeight: '1',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  minWidth: '60px',
                  maxWidth: '180px',
                  width: `${Math.max(60, draftLabel.length * 7 + 16)}px`,
                  display: 'inline-block',
                  fontWeight: 500,
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.6), 0 1px 4px rgba(0,0,0,0.25)',
                  outline: 'none',
                  border: 'none',
                  caretColor: '#ffffff',
                }}
                data-testid={`input-edge-label-${id}`}
              />
            ) : (
              <span
                onClick={handlePillClick}
                title="Click to edit condition"
                style={{
                  backgroundColor: bgColor,
                  fontSize: '12px',
                  lineHeight: '1',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  maxWidth: '160px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: 500,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  userSelect: 'none',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s ease, filter 0.15s ease',
                }}
                className="edge-label-pill"
                data-testid={`label-edge-${id}`}
              >
                {truncated}
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, opacity: 0.7 }}
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
