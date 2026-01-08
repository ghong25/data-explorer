import type { JoinType } from '../../types';

interface JoinDiagramProps {
  joinType: JoinType;
  leftLabel: string;
  rightLabel: string;
}

export function JoinDiagram({ joinType, leftLabel, rightLabel }: JoinDiagramProps) {
  // Define which parts are highlighted based on join type
  const leftOnly = joinType === 'LEFT' || joinType === 'FULL OUTER';
  const rightOnly = joinType === 'RIGHT' || joinType === 'FULL OUTER';
  const center = true; // Always show center for all join types

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="80" viewBox="0 0 120 80">
        {/* Left circle */}
        <circle
          cx="40"
          cy="40"
          r="30"
          fill={leftOnly ? '#3b82f6' : 'transparent'}
          stroke="#3b82f6"
          strokeWidth="2"
          opacity={leftOnly ? 0.3 : 0.5}
        />
        {/* Right circle */}
        <circle
          cx="80"
          cy="40"
          r="30"
          fill={rightOnly ? '#10b981' : 'transparent'}
          stroke="#10b981"
          strokeWidth="2"
          opacity={rightOnly ? 0.3 : 0.5}
        />
        {/* Center intersection - use clipPath for proper overlap */}
        <defs>
          <clipPath id="leftClip">
            <circle cx="40" cy="40" r="30" />
          </clipPath>
          <clipPath id="rightClip">
            <circle cx="80" cy="40" r="30" />
          </clipPath>
        </defs>
        {center && (
          <circle
            cx="80"
            cy="40"
            r="30"
            fill="#8b5cf6"
            opacity="0.5"
            clipPath="url(#leftClip)"
          />
        )}
      </svg>
      <div className="flex gap-8 text-xs">
        <span className="text-blue-600">{leftLabel}</span>
        <span className="text-green-600">{rightLabel}</span>
      </div>
      <div className="text-xs text-gray-500">
        {joinType === 'INNER' && 'Only matching rows from both tables'}
        {joinType === 'LEFT' && 'All rows from left, matching from right'}
        {joinType === 'RIGHT' && 'All rows from right, matching from left'}
        {joinType === 'FULL OUTER' && 'All rows from both tables'}
      </div>
    </div>
  );
}
