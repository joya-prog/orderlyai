import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
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
            <span
              style={{
                backgroundColor: bgColor,
                fontSize: '12px',
                lineHeight: '1',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
                maxWidth: '160px',
                display: 'inline-block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 500,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                userSelect: 'none',
              }}
            >
              {truncated}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
