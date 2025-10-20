/**
 * EntityTileGrid - Grid wrapper for EntityTile components
 *
 * Provides consistent 2-column grid layout with empty state support
 */

'use client';

import React from 'react';

export interface EntityTileGridProps {
  children: React.ReactNode;
  emptyState?: {
    icon: React.ReactNode;
    message: string;
  };
  className?: string;
}

export function EntityTileGrid({
  children,
  emptyState,
  className = ''
}: EntityTileGridProps) {
  // Check if children is empty
  const hasChildren = React.Children.count(children) > 0;

  if (!hasChildren && emptyState) {
    return (
      <div className={`entity-grid-empty ${className}`}>
        <div className="entity-grid-empty-icon">{emptyState.icon}</div>
        <p className="entity-grid-empty-message">{emptyState.message}</p>

        <style jsx>{`
          .entity-grid-empty {
            text-align: center;
            padding: 3rem 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 0.75rem;
          }

          .entity-grid-empty-icon {
            color: #6b7280;
            margin: 0 auto 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .entity-grid-empty-icon :global(svg) {
            width: 3rem;
            height: 3rem;
          }

          .entity-grid-empty-message {
            color: #9CA3AF;
            font-size: 0.875rem;
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`entity-tile-grid ${className}`}>
      {children}

      <style jsx>{`
        .entity-tile-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
      `}</style>
    </div>
  );
}
