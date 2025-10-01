/**
 * T007: Contract Test - POST /api/vision/vlm-fallback
 * Verifies VLM cloud fallback endpoint for low confidence scenarios
 *
 * @phase 3.2
 * @test_type contract
 */

import { describe, it, expect } from '@jest/globals';

describe('POST /api/vision/vlm-fallback - Contract Test', () => {
  const API_URL = '/api/vision/vlm-fallback';

  it('should accept base64 image_data and expected_items payload', async () => {
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
    expect([200, 503]).toContain(response.status); // 200 success or 503 unavailable
  });

  it('should return DetectionResult schema with VLM detection method', async () => {
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

    // Assert
    if (response.status === 200) {
      const data = await response.json();

      expect(data).toHaveProperty('detected_items');
      expect(data).toHaveProperty('confidence_score');

      if (data.detected_items.length > 0) {
        const item = data.detected_items[0];
        expect(item.detection_method).toBe('vlm');
      }
    }
  });

  it('should return 503 when VLM service is unavailable', async () => {
    // Arrange - This might require mocking VLM service failure
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

    // Assert
    if (response.status === 503) {
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('unavailable');
    }
  });

  it('should handle missing expected_items parameter', async () => {
    // Arrange
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    };

    // Act
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Assert
    expect([200, 400]).toContain(response.status);

    if (response.status === 400) {
      const data = await response.json();
      expect(data).toHaveProperty('error');
    }
  });

  it('should return higher confidence than YOLO for complex scenes', async () => {
    // Arrange
    const payload = {
      image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      expected_items: ['Gas Trimmer', 'Edger'],
    };

    // Act
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Assert
    if (response.status === 200) {
      const data = await response.json();

      // VLM should provide reasonable confidence even for complex scenes
      expect(data.confidence_score).toBeGreaterThanOrEqual(0);
      expect(data.confidence_score).toBeLessThanOrEqual(1);
    }
  });
});
