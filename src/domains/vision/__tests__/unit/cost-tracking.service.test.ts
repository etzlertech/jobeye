/**
 * @file /src/domains/vision/__tests__/unit/cost-tracking.service.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for cost tracking service
 */

import { CostTrackingService } from '../../services/cost-tracking.service';
import * as costRecordRepo from '../../repositories/cost-record.repository';

// Mock the repository
jest.mock('../../repositories/cost-record.repository');

describe('CostTrackingService', () => {
  let service: CostTrackingService;

  beforeEach(() => {
    service = new CostTrackingService();
    jest.clearAllMocks();
  });

  describe('checkBudget', () => {
    it('should allow request when within budget', async () => {
      (costRecordRepo.canMakeVlmRequest as jest.Mock).mockResolvedValue({
        data: {
          allowed: true,
          currentCost: 2.5,
          currentRequests: 25,
          remainingBudget: 7.5,
          remainingRequests: 75
        },
        error: null
      });

      const result = await service.checkBudget('company-123', 10.0, 100);

      expect(result.allowed).toBe(true);
      expect(result.alerts.length).toBe(0);
      expect(result.currentCost).toBe(2.5);
      expect(result.remainingBudget).toBe(7.5);
    });

    it('should block request when budget exceeded', async () => {
      (costRecordRepo.canMakeVlmRequest as jest.Mock).mockResolvedValue({
        data: {
          allowed: false,
          reason: 'Daily budget limit reached',
          currentCost: 10.5,
          currentRequests: 50,
          remainingBudget: -0.5,
          remainingRequests: 50
        },
        error: null
      });

      const result = await service.checkBudget('company-123', 10.0, 100);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget');
    });

    it('should generate warning alert at 80% usage', async () => {
      (costRecordRepo.canMakeVlmRequest as jest.Mock).mockResolvedValue({
        data: {
          allowed: true,
          currentCost: 8.5, // 85% of $10
          currentRequests: 50,
          remainingBudget: 1.5,
          remainingRequests: 50
        },
        error: null
      });

      const result = await service.checkBudget('company-123', 10.0, 100);

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts[0].type).toBe('warning');
      expect(result.alerts[0].percentageUsed).toBeCloseTo(0.85);
    });

    it('should generate critical alert at 95% usage', async () => {
      (costRecordRepo.canMakeVlmRequest as jest.Mock).mockResolvedValue({
        data: {
          allowed: true,
          currentCost: 9.6, // 96% of $10
          currentRequests: 50,
          remainingBudget: 0.4,
          remainingRequests: 50
        },
        error: null
      });

      const result = await service.checkBudget('company-123', 10.0, 100);

      expect(result.alerts.some(a => a.type === 'critical')).toBe(true);
    });

    it('should generate request limit alerts', async () => {
      (costRecordRepo.canMakeVlmRequest as jest.Mock).mockResolvedValue({
        data: {
          allowed: true,
          currentCost: 5.0,
          currentRequests: 85, // 85% of 100
          remainingBudget: 5.0,
          remainingRequests: 15
        },
        error: null
      });

      const result = await service.checkBudget('company-123', 10.0, 100);

      expect(result.alerts.some(a => a.message.includes('Request'))).toBe(true);
    });

    it('should throw error on repository failure', async () => {
      (costRecordRepo.canMakeVlmRequest as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      await expect(service.checkBudget('company-123', 10.0, 100)).rejects.toThrow('Failed to check budget');
    });
  });

  describe('recordCost', () => {
    it('should successfully record cost', async () => {
      (costRecordRepo.createCostRecord as jest.Mock).mockResolvedValue({
        data: { id: 'cost-123' },
        error: null
      });

      const result = await service.recordCost(
        'company-123',
        'verify-456',
        0.12,
        'openai-gpt4-vision',
        'gpt-4-vision-preview',
        450,
        1024000
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(costRecordRepo.createCostRecord).toHaveBeenCalledWith({
        company_id: 'company-123',
        verification_id: 'verify-456',
        cost_usd: 0.12,
        provider: 'openai-gpt4-vision',
        model_version: 'gpt-4-vision-preview',
        tokens_used: 450,
        image_size_bytes: 1024000
      });
    });

    it('should handle record failure', async () => {
      (costRecordRepo.createCostRecord as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const result = await service.recordCost(
        'company-123',
        'verify-456',
        0.12,
        'openai-gpt4-vision',
        'gpt-4-vision-preview'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getTodayCostSummary', () => {
    it('should return cost summary', async () => {
      (costRecordRepo.getTodaysCost as jest.Mock).mockResolvedValue({
        data: {
          totalCost: 2.5,
          requestCount: 25
        },
        error: null
      });

      (costRecordRepo.getTotalCost as jest.Mock).mockResolvedValue({
        data: {
          totalCost: 50.0,
          requestCount: 500
        },
        error: null
      });

      const result = await service.getTodayCostSummary('company-123');

      expect(result.companyId).toBe('company-123');
      expect(result.todayCost).toBe(2.5);
      expect(result.todayRequests).toBe(25);
      expect(result.totalCost).toBe(50.0);
      expect(result.totalRequests).toBe(500);
      expect(result.averageCostPerRequest).toBe(0.1);
    });

    it('should handle zero requests', async () => {
      (costRecordRepo.getTodaysCost as jest.Mock).mockResolvedValue({
        data: { totalCost: 0, requestCount: 0 },
        error: null
      });

      (costRecordRepo.getTotalCost as jest.Mock).mockResolvedValue({
        data: { totalCost: 0, requestCount: 0 },
        error: null
      });

      const result = await service.getTodayCostSummary('company-123');

      expect(result.averageCostPerRequest).toBe(0);
    });

    it('should throw on repository error', async () => {
      (costRecordRepo.getTodaysCost as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      await expect(service.getTodayCostSummary('company-123')).rejects.toThrow("Failed to get today's cost");
    });
  });

  describe('getCostBreakdownByProvider', () => {
    it('should return provider breakdown', async () => {
      (costRecordRepo.getCostStatsByProvider as jest.Mock).mockResolvedValue({
        data: [
          {
            provider: 'openai-gpt4-vision',
            totalCost: 25.0,
            requestCount: 250,
            avgCost: 0.1
          },
          {
            provider: 'anthropic-claude',
            totalCost: 15.0,
            requestCount: 300,
            avgCost: 0.05
          }
        ],
        error: null
      });

      const result = await service.getCostBreakdownByProvider('company-123');

      expect(result.length).toBe(2);
      expect(result[0].provider).toBe('openai-gpt4-vision');
      expect(result[1].provider).toBe('anthropic-claude');
    });

    it('should pass date filters', async () => {
      (costRecordRepo.getCostStatsByProvider as jest.Mock).mockResolvedValue({
        data: [],
        error: null
      });

      await service.getCostBreakdownByProvider('company-123', '2024-01-01', '2024-12-31');

      expect(costRecordRepo.getCostStatsByProvider).toHaveBeenCalledWith(
        'company-123',
        '2024-01-01',
        '2024-12-31'
      );
    });
  });

  describe('getDailyCostSummaries', () => {
    it('should return daily summaries', async () => {
      (costRecordRepo.getDailyCostSummaries as jest.Mock).mockResolvedValue({
        data: [
          {
            date: '2024-01-01',
            totalCost: 2.5,
            requestCount: 25,
            avgCostPerRequest: 0.1
          },
          {
            date: '2024-01-02',
            totalCost: 3.0,
            requestCount: 30,
            avgCostPerRequest: 0.1
          }
        ],
        error: null
      });

      const result = await service.getDailyCostSummaries(
        'company-123',
        '2024-01-01',
        '2024-01-02'
      );

      expect(result.length).toBe(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-02');
    });
  });

  describe('shouldSendAlert', () => {
    it('should return true for critical alerts', () => {
      const alerts = [
        {
          type: 'critical' as const,
          message: 'Budget exceeded',
          currentCost: 10.5,
          budgetLimit: 10.0,
          percentageUsed: 1.05
        }
      ];

      expect(service.shouldSendAlert(alerts)).toBe(true);
    });

    it('should return false for warning alerts only', () => {
      const alerts = [
        {
          type: 'warning' as const,
          message: 'Budget high',
          currentCost: 8.5,
          budgetLimit: 10.0,
          percentageUsed: 0.85
        }
      ];

      expect(service.shouldSendAlert(alerts)).toBe(false);
    });

    it('should return false for empty alerts', () => {
      expect(service.shouldSendAlert([])).toBe(false);
    });
  });
});