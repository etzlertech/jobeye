/**
 * EntityTile - Standardized tile component for all management screens
 *
 * Design spec: Square image top, title, subtitle, tags
 * Used across: Users, Customers, Properties, Jobs, Templates, Task Definitions
 */

'use client';

import React from 'react';

export interface EntityTileTag {
  label: string;
  color?: 'gold' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
  icon?: React.ReactNode;
}

export interface EntityTileProps {
  // Required
  title: string;
  onClick: () => void;

  // Optional
  image?: string | null;
  fallbackIcon?: React.ReactNode;
  subtitle?: string;
  tags?: EntityTileTag[];
  className?: string;
}

const colorMap = {
  gold: {
    bg: 'rgba(255, 215, 0, 0.2)',
    color: '#FFD700',
    border: 'rgba(255, 215, 0, 0.4)'
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    border: 'rgba(59, 130, 246, 0.4)'
  },
  green: {
    bg: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    border: 'rgba(34, 197, 94, 0.4)'
  },
  orange: {
    bg: 'rgba(251, 146, 60, 0.2)',
    color: '#fb923c',
    border: 'rgba(251, 146, 60, 0.4)'
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.4)'
  },
  purple: {
    bg: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
    border: 'rgba(168, 85, 247, 0.4)'
  },
  gray: {
    bg: 'rgba(107, 114, 128, 0.2)',
    color: '#6b7280',
    border: 'rgba(107, 114, 128, 0.4)'
  }
};

export function EntityTile({
  title,
  onClick,
  image,
  fallbackIcon,
  subtitle,
  tags = [],
  className = ''
}: EntityTileProps) {
  return (
    <div className={`entity-tile ${className}`} onClick={onClick}>
      {/* Image Container */}
      <div className="entity-tile-image">
        {image ? (
          <img
            src={image}
            alt={title}
            className="entity-tile-img"
          />
        ) : (
          <div className="entity-tile-icon">
            {fallbackIcon}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="entity-tile-content">
        {/* Title */}
        <h3 className="entity-tile-title">{title}</h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="entity-tile-subtitle">{subtitle}</p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="entity-tile-tags">
            {tags.map((tag, index) => {
              const colors = colorMap[tag.color || 'gray'];
              return (
                <span
                  key={index}
                  className="entity-tile-tag"
                  style={{
                    background: colors.bg,
                    color: colors.color,
                    border: `1px solid ${colors.border}`
                  }}
                >
                  {tag.icon && <span className="entity-tile-tag-icon">{tag.icon}</span>}
                  {tag.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .entity-tile {
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }

        .entity-tile:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
          transform: translateY(-2px);
        }

        .entity-tile-image {
          width: 100%;
          height: 6rem;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        .entity-tile-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .entity-tile-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: rgba(255, 215, 0, 0.5);
        }

        .entity-tile-icon :global(svg) {
          width: 3rem;
          height: 3rem;
        }

        .entity-tile-content {
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }

        .entity-tile-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-tile-subtitle {
          font-size: 0.75rem;
          color: #9CA3AF;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entity-tile-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-top: auto;
        }

        .entity-tile-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          font-size: 0.625rem;
          font-weight: 600;
          border-radius: 0.25rem;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .entity-tile-tag-icon {
          display: inline-flex;
          align-items: center;
        }

        .entity-tile-tag-icon :global(svg) {
          width: 0.75rem;
          height: 0.75rem;
        }
      `}</style>
    </div>
  );
}
