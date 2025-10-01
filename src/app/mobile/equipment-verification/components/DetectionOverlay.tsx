/**
 * @file DetectionOverlay.tsx
 * @phase 3.3
 * @domain Mobile PWA
 * @purpose SVG overlay showing detected equipment bounding boxes
 * @complexity_budget 200
 */

'use client';

import type { DetectedItem } from '@/domains/vision/types';

export interface DetectionOverlayProps {
  /** Detected items with bounding boxes */
  detectedItems: DetectedItem[];
  /** Video element width */
  videoWidth: number;
  /** Video element height */
  videoHeight: number;
}

const EDGE_MARGIN = 50; // pixels from edge for partial detection

/**
 * Check if bounding box is at frame edge (partial detection)
 */
function isAtEdge(
  box: { x: number; y: number; width: number; height: number },
  videoWidth: number,
  videoHeight: number
): boolean {
  return (
    box.x < EDGE_MARGIN ||
    box.y < EDGE_MARGIN ||
    box.x + box.width > videoWidth - EDGE_MARGIN ||
    box.y + box.height > videoHeight - EDGE_MARGIN
  );
}

/**
 * Get color based on confidence score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#10b981'; // green
  if (confidence >= 0.5) return '#fbbf24'; // yellow
  return '#ef4444'; // red
}

/**
 * Detection overlay component showing bounding boxes over video feed
 */
export function DetectionOverlay({
  detectedItems,
  videoWidth,
  videoHeight,
}: DetectionOverlayProps) {
  // Check if any items at edge
  const hasPartialDetection = detectedItems.some(item =>
    isAtEdge(item.bounding_box, videoWidth, videoHeight)
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* SVG layer for bounding boxes */}
      <svg
        width={videoWidth}
        height={videoHeight}
        viewBox={`0 0 ${videoWidth} ${videoHeight}`}
        className="w-full h-full"
      >
        {detectedItems.map((item, index) => {
          const { x, y, width, height } = item.bounding_box;
          const color = getConfidenceColor(item.confidence_score);
          const atEdge = isAtEdge(item.bounding_box, videoWidth, videoHeight);

          return (
            <g key={`${item.class_name}-${index}`}>
              {/* Bounding box rectangle */}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="none"
                stroke={atEdge ? '#ef4444' : color}
                strokeWidth={atEdge ? 3 : 2}
                strokeDasharray={atEdge ? '5,5' : undefined}
              />

              {/* Label background */}
              <rect
                x={x}
                y={Math.max(y - 24, 0)}
                width={item.class_name.length * 8 + 16}
                height={24}
                fill={atEdge ? '#ef4444' : color}
                opacity={0.8}
              />

              {/* Label text */}
              <text
                x={x + 8}
                y={Math.max(y - 8, 16)}
                fill="white"
                fontSize={14}
                fontWeight="bold"
              >
                {item.class_name} {Math.round(item.confidence_score * 100)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Reposition prompt for partial detections */}
      {hasPartialDetection && (
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-auto">
          <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>Reposition camera to capture full item</span>
          </div>
        </div>
      )}
    </div>
  );
}
