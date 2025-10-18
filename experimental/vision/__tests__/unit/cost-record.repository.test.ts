/**
 * @file /src/domains/vision/__tests__/unit/cost-record.repository.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for cost record repository with budget enforcement
 */

import * as repo from '../../repositories/cost-record.repository';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    then: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Cost Record Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (mockSupabase.from as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.select as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.insert as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.eq as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.gte as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.lte as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.range as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.order as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.single as jest.Mock).mockReturnValue(mockSupabase);

    // Make it thenable - by default resolve with empty result
    (mockSupabase.then as jest.Mock).mockImplementation((resolve: any) => {
      return Promise.resolve({ data: null, error: null }).then(resolve);
    });
  });

  describe('findCostRecordById', () => {
    it('should find record by ID', async () => {
      const mockRecord = {
        id: 'cost-123',
        tenant_id: 'company-456',
        cost_usd: 0.12,
        provider: 'openai-gpt4-vision'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRecord,
        error: null
      });

      const result = await repo.findCostRecordById('cost-123');

      expect(result.data).toEqual(mockRecord);
      expect(result.error).toBeNull();
    });
  });

  describe('findCostRecords', () => {
    it('should find records with filters', async () => {
      const mockData = [
        { id: '1', cost_usd: 0.10, provider: 'openai-gpt4-vision' },
        { id: '2', cost_usd: 0.12, provider: 'openai-gpt4-vision' }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockData,
        error: null,
        count: 2
      });

      const result = await repo.findCostRecords({
        tenantId: 'company-123',
        provider: 'openai-gpt4-vision'
      });

      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(2);
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'company-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('provider', 'openai-gpt4-vision');
    });

    it('should apply date range', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findCostRecords({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
    });
  });

  describe('createCostRecord', () => {
    it('should create cost record', async () => {
      const newRecord = {
        tenant_id: 'company-123',
        verification_id: 'verify-456',
        cost_usd: 0.12,
        provider: 'openai-gpt4-vision',
        model_version: 'gpt-4-vision-preview',
        tokens_used: 450
      };

      const mockCreated = { id: 'cost-new', ...newRecord };

      mockSupabase.single.mockResolvedValue({
        data: mockCreated,
        error: null
      });

      const result = await repo.createCostRecord(newRecord);

      expect(result.data).toEqual(mockCreated);
      expect(mockSupabase.insert).toHaveBeenCalledWith(newRecord);
    });
  });

  describe('getTodaysCost', () => {
    it('should calculate todays cost', async () => {
      const mockRecords = [
        { cost_usd: '0.10' },
        { cost_usd: '0.12' },
        { cost_usd: '0.08' }
      ];

      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: mockRecords, error: null }).then(resolve);
      });

      const result = await repo.getTodaysCost('company-123');

      expect(result.data).toEqual({
        totalCost: 0.30,
        requestCount: 3
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'company-123');
      expect(mockSupabase.gte).toHaveBeenCalled(); // Date filter applied
    });

    it('should handle no records today', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      const result = await repo.getTodaysCost('company-123');

      expect(result.data).toEqual({
        totalCost: 0,
        requestCount: 0
      });
    });

    it('should handle errors', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: null, error: { message: 'Database error' } }).then(resolve);
      });

      const result = await repo.getTodaysCost('company-123');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('getDailyCostSummaries', () => {
    it('should group costs by day', async () => {
      const mockData = [
        { created_at: '2024-01-01T10:00:00Z', cost_usd: '0.10' },
        { created_at: '2024-01-01T14:00:00Z', cost_usd: '0.12' },
        { created_at: '2024-01-02T09:00:00Z', cost_usd: '0.08' },
        { created_at: '2024-01-02T15:00:00Z', cost_usd: '0.15' }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await repo.getDailyCostSummaries(
        'company-123',
        '2024-01-01',
        '2024-01-02'
      );

      expect(result.data.length).toBe(2);
      expect(result.data[0].date).toBe('2024-01-01');
      expect(result.data[0].totalCost).toBeCloseTo(0.22);
      expect(result.data[0].requestCount).toBe(2);
      expect(result.data[0].avgCostPerRequest).toBeCloseTo(0.11);

      expect(result.data[1].date).toBe('2024-01-02');
      expect(result.data[1].totalCost).toBeCloseTo(0.23);
      expect(result.data[1].requestCount).toBe(2);
      expect(result.data[1].avgCostPerRequest).toBeCloseTo(0.115);
    });

    it('should handle empty date range', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repo.getDailyCostSummaries(
        'company-123',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.data).toEqual([]);
    });
  });

  describe('getTotalCost', () => {
    it('should calculate total cost', async () => {
      const mockRecords = [
        { cost_usd: '0.10' },
        { cost_usd: '0.12' },
        { cost_usd: '0.08' },
        { cost_usd: '0.15' }
      ];

      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: mockRecords, error: null }).then(resolve);
      });

      const result = await repo.getTotalCost('company-123');

      expect(result.data?.totalCost).toBeCloseTo(0.45);
      expect(result.data?.requestCount).toBe(4);
    });

    it('should apply date filters', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      await repo.getTotalCost('company-123', '2024-01-01', '2024-12-31');

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
    });
  });

  describe('canMakeVlmRequest', () => {
    it('should allow request within budget', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({
          data: [
            { cost_usd: '0.10' },
            { cost_usd: '0.12' }
          ],
          error: null
        }).then(resolve);
      });

      const result = await repo.canMakeVlmRequest('company-123', 10.0, 100);

      expect(result.data?.allowed).toBe(true);
      expect(result.data?.currentCost).toBe(0.22);
      expect(result.data?.currentRequests).toBe(2);
      expect(result.data?.remainingBudget).toBeCloseTo(9.78);
      expect(result.data?.remainingRequests).toBe(98);
      expect(result.data?.reason).toBeUndefined();
    });

    it('should block when budget exceeded', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({
          data: Array(95).fill({ cost_usd: '0.11' }), // 95 * 0.11 = 10.45
          error: null
        }).then(resolve);
      });

      const result = await repo.canMakeVlmRequest('company-123', 10.0, 100);

      expect(result.data?.allowed).toBe(false);
      expect(result.data?.reason).toContain('Daily budget limit reached');
      expect(result.data?.currentCost).toBeCloseTo(10.45);
    });

    it('should block when request limit reached', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({
          data: Array(100).fill({ cost_usd: '0.05' }),
          error: null
        }).then(resolve);
      });

      const result = await repo.canMakeVlmRequest('company-123', 10.0, 100);

      expect(result.data?.allowed).toBe(false);
      expect(result.data?.reason).toContain('Daily request limit reached');
      expect(result.data?.currentRequests).toBe(100);
    });

    it('should use default limits', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      const result = await repo.canMakeVlmRequest('company-123');

      expect(result.data?.remainingBudget).toBe(10.0);
      expect(result.data?.remainingRequests).toBe(100);
    });

    it('should handle errors', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({
          data: null,
          error: { message: 'Database error' }
        }).then(resolve);
      });

      const result = await repo.canMakeVlmRequest('company-123');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('getCostStatsByProvider', () => {
    it('should group costs by provider', async () => {
      const mockData = [
        { provider: 'openai-gpt4-vision', cost_usd: '0.10' },
        { provider: 'openai-gpt4-vision', cost_usd: '0.12' },
        { provider: 'anthropic-claude', cost_usd: '0.08' }
      ];

      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: mockData, error: null }).then(resolve);
      });

      const result = await repo.getCostStatsByProvider('company-123');

      expect(result.data.length).toBe(2);

      const openaiStats = result.data.find(s => s.provider === 'openai-gpt4-vision');
      expect(openaiStats).toEqual({
        provider: 'openai-gpt4-vision',
        totalCost: 0.22,
        requestCount: 2,
        avgCost: 0.11
      });

      const anthropicStats = result.data.find(s => s.provider === 'anthropic-claude');
      expect(anthropicStats).toEqual({
        provider: 'anthropic-claude',
        totalCost: 0.08,
        requestCount: 1,
        avgCost: 0.08
      });
    });

    it('should handle single provider', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({
          data: [
            { provider: 'openai-gpt4-vision', cost_usd: '0.10' },
            { provider: 'openai-gpt4-vision', cost_usd: '0.12' }
          ],
          error: null
        }).then(resolve);
      });

      const result = await repo.getCostStatsByProvider('company-123');

      expect(result.data.length).toBe(1);
      expect(result.data[0].totalCost).toBeCloseTo(0.22);
    });

    it('should apply date filters', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      await repo.getCostStatsByProvider(
        'company-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
    });

    it('should handle empty results', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      const result = await repo.getCostStatsByProvider('company-123');

      expect(result.data).toEqual([]);
    });
  });
});