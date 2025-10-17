/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/crew/LoadStatusBadge.tsx
 * phase: 3
 * domain: crew-job-assignment
 * purpose: Display load status with color coding
 * spec_ref: 010-job-assignment-and
 * complexity_budget: 100
 * task: T024
 */

import React from 'react';

interface LoadStatusBadgeProps {
  total_items: number;
  loaded_items: number;
}

export function LoadStatusBadge({ total_items, loaded_items }: LoadStatusBadgeProps) {
  // Don't render if no items
  if (total_items === 0) {
    return null;
  }

  const percentage = Math.round((loaded_items / total_items) * 100);

  // Color coding: red (0%), yellow (<100%), green (100%)
  let colorClasses = '';
  if (percentage === 0) {
    colorClasses = 'bg-red-100 text-red-800 border-red-200';
  } else if (percentage < 100) {
    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-200';
  } else {
    colorClasses = 'bg-green-100 text-green-800 border-green-200';
  }

  return (
    <div
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}
      data-testid="load-status-badge"
    >
      <span>{loaded_items}/{total_items} items loaded</span>
      {percentage > 0 && (
        <span className="ml-1">({percentage}%)</span>
      )}
    </div>
  );
}
