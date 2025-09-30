/**
 * @file /src/domains/vision/__tests__/unit/cost-record.repository.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for cost record repository with budget enforcement
 */

import * as repo from '../../repositories/cost-record.repository';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn()
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Cost Record Repository', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
      select: jest.fn(),
      insert: jest.fn(),
      eq: jest.fn(),
      gte: jest.fn(),
      lte: jest.fn(),
      range: jest.fn(),
      order: jest.fn(),
      single: jest.fn()
    };

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.gte.mockReturnValue(mockSupabase);
    mockSupabase.lte.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);

    mockCreateClient.mockReturnValue(mockSupabase);
  });

  describe('findCostRecordById', () => {
    it('should find record by ID', async () => {
      const mockRecord = {
        id: 'cost-123',
        company_id: 'company-456',
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
        companyId: 'company-123',
        provider: 'openai-gpt4-vision'
      });

      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(2);
      expect(mockSupabase.eq).toHaveBeenCalledWith('company_id', 'company-123');
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
        company_id: 'company-123',
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

      mockSupabase.select.mockResolvedValue({
        data: mockRecords,
        error: null
      });

      const result = await repo.getTodaysCost('company-123');

      expect(result.data).toEqual({
        totalCost: 0.30,
        requestCount: 3
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('company_id', 'company-123');
      expect(mockSupabase.gte).toHaveBeenCalled(); // Date filter applied
    });

    it('should handle no records today', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repo.getTodaysCost('company-123');

      expect(result.data).toEqual({
        totalCost: 0,
        requestCount: 0
      });
    });

    it('should handle errors', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
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
      expect(result.data[0]).toEqual({
        date: '2024-01-01',
        totalCost: 0.22,
        requestCount: 2,
        avgCostPerRequest: 0.11
      });
      expect(result.data[1]).toEqual({
        date: '2024-01-02',
        totalCost: 0.23,
        requestCount: 2,
        avgCostPerRequest: 0.115
      });
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

      mockSupabase.select.mockResolvedValue({
        data: mockRecords,
        error: null
      });

      const result = await repo.getTotalCost('company-123');

      expect(result.data).toEqual({
        totalCost: 0.45,
        requestCount: 4
      });
    });

    it('should apply date filters', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      await repo.getTotalCost('company-123', '2024-01-01', '2024-12-31');

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
    });
  });

  describe('canMakeVlmRequest', () => {
    it('should allow request within budget', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [
          { cost_usd: '0.10' },
          { cost_usd: '0.12' }
        ],
        error: null
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
      mockSupabase.select.mockResolvedValue({
        data: Array(95).fill({ cost_usd: '0.11' }), // 95 * 0.11 = 10.45
        error: null
      });

      const result = await repo.canMakeVlmRequest('company-123', 10.0, 100);

      expect(result.data?.allowed).toBe(false);
      expect(result.data?.reason).toContain('Daily budget limit reached');
      expect(result.data?.currentCost).toBeCloseTo(10.45);
    });

    it('should block when request limit reached', async () => {
      mockSupabase.select.mockResolvedValue({
        data: Array(100).fill({ cost_usd: '0.05' }),
        error: null
      });

      const result = await repo.canMakeVlmRequest('company-123', 10.0, 100);

      expect(result.data?.allowed).toBe(false);
      expect(result.data?.reason).toContain('Daily request limit reached');
      expect(result.data?.currentRequests).toBe(100);
    });

    it('should use default limits', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repo.canMakeVlmRequest('company-123');

      expect(result.data?.remainingBudget).toBe(10.0);
      expect(result.data?.remainingRequests).toBe(100);
    });

    it('should handle errors', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
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

      mockSupabase.select.mockResolvedValue({
        data: mockData,
        error: null
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
      mockSupabase.select.mockResolvedValue({
        data: [
          { provider: 'openai-gpt4-vision', cost_usd: '0.10' },
          { provider: 'openai-gpt4-vision', cost_usd: '0.12' }
        ],
        error: null
      });

      const result = await repo.getCostStatsByProvider('company-123');

      expect(result.data.length).toBe(1);
      expect(result.data[0].totalCost).toBeCloseTo(0.22);
    });

    it('should apply date filters', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
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
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repo.getCostStatsByProvider('company-123');

      expect(result.data).toEqual([]);
    });
  });
});