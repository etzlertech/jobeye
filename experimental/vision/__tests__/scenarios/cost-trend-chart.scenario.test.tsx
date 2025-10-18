/**
 * @file /src/domains/vision/__tests__/scenarios/cost-trend-chart.scenario.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose End-to-end scenario tests for cost trend chart feature
 * @test_coverage Full scenario coverage
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostTrendChart from '../../../components/CostTrendChart';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn().mockReturnValue('mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
(global as any).localStorage = mockLocalStorage;

describe('Cost Trend Chart - End-to-End Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario 1: Display 30-day cost trend', () => {
    it('should fetch and render cost data for 30 days', async () => {
      // Arrange
      const mockDailyData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalCost: 0.5 + Math.random() * 0.5,
        requestCount: 10 + Math.floor(Math.random() * 20)
      }));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            dailyBreakdown: mockDailyData
          }
        })
      });

      // Act
      render(<CostTrendChart tenantId="company-123" days={30} />);

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/vision/cost/summary'),
          expect.objectContaining({
            headers: {
              'Authorization': 'Bearer mock-token'
            }
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Cost Trends - Last 30 Days')).toBeInTheDocument();
      });

      // Verify statistics cards are rendered
      await waitFor(() => {
        expect(screen.getByText('Total Cost')).toBeInTheDocument();
        expect(screen.getByText('Avg Daily Cost')).toBeInTheDocument();
        expect(screen.getByText('Total Requests')).toBeInTheDocument();
        expect(screen.getByText('Avg Daily Requests')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 2: Toggle between cost and request metrics', () => {
    it('should switch chart data when toggling metrics', async () => {
      // Arrange
      const mockDailyData = [
        { date: '2025-01-01', totalCost: 0.75, requestCount: 25 },
        { date: '2025-01-02', totalCost: 0.92, requestCount: 31 },
        { date: '2025-01-03', totalCost: 0.68, requestCount: 22 }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: mockDailyData }
        })
      });

      // Act
      render(<CostTrendChart tenantId="company-123" days={30} />);

      await waitFor(() => {
        expect(screen.getByText('Cost ($)')).toBeInTheDocument();
        expect(screen.getByText('Requests (#)')).toBeInTheDocument();
      });

      // Click Requests button
      const requestsButton = screen.getByText('Requests (#)');
      fireEvent.click(requestsButton);

      // Assert
      await waitFor(() => {
        expect(requestsButton).toHaveClass('bg-blue-600');
      });
    });
  });

  describe('Scenario 3: Handle empty data gracefully', () => {
    it('should display message when no data is available', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: [] }
        })
      });

      // Act
      render(<CostTrendChart tenantId="company-123" days={30} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No cost data available for the selected period')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 4: Display loading state', () => {
    it('should show loading skeleton while fetching data', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, data: { dailyBreakdown: [] } })
        }), 100))
      );

      // Act
      render(<CostTrendChart tenantId="company-123" days={30} />);

      // Assert
      expect(screen.getByTestId('loading-skeleton') || document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  describe('Scenario 5: Handle API errors', () => {
    it('should display error message on fetch failure', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      // Act
      render(<CostTrendChart tenantId="company-123" days={30} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Error loading cost trends/i)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 6: Calculate statistics correctly', () => {
    it('should compute accurate statistics from data', async () => {
      // Arrange
      const mockDailyData = [
        { date: '2025-01-01', totalCost: 1.00, requestCount: 20 },
        { date: '2025-01-02', totalCost: 1.50, requestCount: 30 },
        { date: '2025-01-03', totalCost: 2.00, requestCount: 40 }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: mockDailyData }
        })
      });

      // Act
      render(<CostTrendChart tenantId="company-123" days={3} />);

      // Assert
      await waitFor(() => {
        // Total cost = 1.00 + 1.50 + 2.00 = $4.50
        expect(screen.getByText('$4.50')).toBeInTheDocument();

        // Avg daily cost = 4.50 / 3 = $1.50
        expect(screen.getByText('$1.50')).toBeInTheDocument();

        // Total requests = 20 + 30 + 40 = 90
        expect(screen.getByText('90')).toBeInTheDocument();

        // Avg daily requests = 90 / 3 = 30
        expect(screen.getByText('30')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 7: Render SVG chart elements', () => {
    it('should generate SVG with line and area paths', async () => {
      // Arrange
      const mockDailyData = [
        { date: '2025-01-01', totalCost: 0.50, requestCount: 15 },
        { date: '2025-01-02', totalCost: 0.75, requestCount: 22 },
        { date: '2025-01-03', totalCost: 0.60, requestCount: 18 }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: mockDailyData }
        })
      });

      // Act
      const { container } = render(<CostTrendChart tenantId="company-123" days={3} />);

      // Assert
      await waitFor(() => {
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();

        const paths = container.querySelectorAll('path');
        expect(paths.length).toBeGreaterThan(0); // Line and area paths

        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(3); // One per data point
      });
    });
  });

  describe('Scenario 8: Display date labels on x-axis', () => {
    it('should show formatted dates on chart axis', async () => {
      // Arrange
      const mockDailyData = [
        { date: '2025-01-15', totalCost: 0.50, requestCount: 15 },
        { date: '2025-01-16', totalCost: 0.75, requestCount: 22 },
        { date: '2025-01-17', totalCost: 0.60, requestCount: 18 }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: mockDailyData }
        })
      });

      // Act
      const { container } = render(<CostTrendChart tenantId="company-123" days={3} />);

      // Assert
      await waitFor(() => {
        const texts = container.querySelectorAll('text');
        const textContents = Array.from(texts).map(t => t.textContent);

        // Should contain formatted dates like "1/15", "1/16", "1/17"
        expect(textContents.some(t => t?.includes('/15'))).toBe(true);
      });
    });
  });

  describe('Scenario 9: Display grid lines and value labels', () => {
    it('should render grid lines with value labels', async () => {
      // Arrange
      const mockDailyData = [
        { date: '2025-01-01', totalCost: 1.00, requestCount: 20 }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: mockDailyData }
        })
      });

      // Act
      const { container } = render(<CostTrendChart tenantId="company-123" days={1} />);

      // Assert
      await waitFor(() => {
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBeGreaterThan(0); // Grid lines

        const texts = container.querySelectorAll('text');
        const textContents = Array.from(texts).map(t => t.textContent);

        // Should have value labels on y-axis
        expect(textContents.some(t => t?.startsWith('$'))).toBe(true);
      });
    });
  });

  describe('Scenario 10: Retry on error', () => {
    it('should refetch data when retry button is clicked', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { dailyBreakdown: [{ date: '2025-01-01', totalCost: 0.5, requestCount: 10 }] }
        })
      });

      // Act
      render(<CostTrendChart tenantId="company-123" days={30} />);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Cost Trends - Last 30 Days')).toBeInTheDocument();
      });
    });
  });
});