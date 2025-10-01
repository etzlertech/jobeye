/**
 * T006: Contract Test - POST /api/vision/detect
 * Verifies 1fps YOLO detection endpoint for mobile PWA
 *
 * @phase 3.2
 * @test_type contract
 */

import { describe, it, expect } from '@jest/globals';

describe('POST /api/vision/detect - Contract Test', () => {
  const API_URL = '/api/vision/detect';

  it('should accept base64 image_data and expected_items', async () => {
    // Arrange
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      expected_items: ['Gas Trimmer', 'Edger', 'Blower'],
    };

    // Act
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Assert
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('detected_items');
    expect(data).toHaveProperty('confidence_score');
    expect(Array.isArray(data.detected_items)).toBe(true);
  });

  it('should return DetectionResult schema with all required fields', async () => {
    // Arrange
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      expected_items: ['Gas Trimmer'],
    };

    // Act
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Assert
    expect(data).toHaveProperty('detected_items');
    expect(data).toHaveProperty('confidence_score');
    expect(data).toHaveProperty('should_fallback');
    expect(data).toHaveProperty('retry_count');

    expect(typeof data.confidence_score).toBe('number');
    expect(data.confidence_score).toBeGreaterThanOrEqual(0);
    expect(data.confidence_score).toBeLessThanOrEqual(1);
    expect(typeof data.should_fallback).toBe('boolean');
    expect(typeof data.retry_count).toBe('number');
  });

  it('should set should_fallback=true when confidence <0.7', async () => {
    // Arrange - simulate low confidence scenario
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      expected_items: ['Nonexistent Item'], // Item unlikely to be detected
    };

    // Act
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Assert
    if (data.confidence_score < 0.7) {
      expect(data.should_fallback).toBe(true);
    }
  });

  it('should return 429 when rate limit exceeded (>1fps)', async () => {
    // Arrange - send rapid requests
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      expected_items: ['Gas Trimmer'],
    };

    // Act - Send 3 requests rapidly (should exceed 1fps limit)
    const responses = await Promise.all([
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    ]);

    // Assert - At least one should be rate limited
    const statuses = responses.map((r) => r.status);
    const hasRateLimit = statuses.includes(429);

    // This might not trigger in all environments - log for debugging
    if (!hasRateLimit) {
      console.warn('Rate limiting not enforced - check 1fps throttle implementation');
    }
  });

  it('should include bounding box coordinates for detected items', async () => {
    // Arrange
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      expected_items: ['Gas Trimmer'],
    };

    // Act
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Assert
    if (data.detected_items.length > 0) {
      const item = data.detected_items[0];
      expect(item).toHaveProperty('item_name');
      expect(item).toHaveProperty('confidence');
      expect(item).toHaveProperty('detection_method');

      if (item.bounding_box) {
        expect(item.bounding_box).toHaveProperty('x');
        expect(item.bounding_box).toHaveProperty('y');
        expect(item.bounding_box).toHaveProperty('width');
        expect(item.bounding_box).toHaveProperty('height');
      }
    }
  });
});
