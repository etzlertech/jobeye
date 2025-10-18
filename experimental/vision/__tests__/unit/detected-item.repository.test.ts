/**
 * @file /src/domains/vision/__tests__/unit/detected-item.repository.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for detected item repository
 */

import * as repo from '../../repositories/detected-item.repository';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    then: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Detected Item Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (mockSupabase.from as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.select as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.insert as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.update as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.delete as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.eq as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.gte as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.range as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.order as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.single as jest.Mock).mockReturnValue(mockSupabase);

    // Make it thenable - by default resolve with empty result
    (mockSupabase.then as jest.Mock).mockImplementation((resolve: any) => {
      return Promise.resolve({ data: null, error: null }).then(resolve);
    });
  });

  describe('findDetectedItemById', () => {
    it('should find item by ID', async () => {
      const mockItem = {
        id: 'item-123',
        verification_id: 'verify-456',
        item_type: 'wrench',
        confidence_score: 0.85,
        match_status: 'matched'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockItem,
        error: null
      });

      const result = await repo.findDetectedItemById('item-123');

      expect(result.data).toEqual(mockItem);
      expect(result.error).toBeNull();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'item-123');
    });
  });

  describe('findDetectedItems', () => {
    it('should find items with filters', async () => {
      const mockData = [
        { id: '1', item_type: 'wrench', confidence_score: 0.85 },
        { id: '2', item_type: 'hammer', confidence_score: 0.92 }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockData,
        error: null,
        count: 2
      });

      const result = await repo.findDetectedItems({
        verificationId: 'verify-123',
        minConfidence: 0.7
      });

      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(2);
      expect(mockSupabase.eq).toHaveBeenCalledWith('verification_id', 'verify-123');
      expect(mockSupabase.gte).toHaveBeenCalledWith('confidence_score', 0.7);
    });

    it('should filter by item type', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findDetectedItems({
        itemType: 'wrench'
      });

      expect(mockSupabase.eq).toHaveBeenCalledWith('item_type', 'wrench');
    });

    it('should filter by match status', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findDetectedItems({
        matchStatus: 'unmatched'
      });

      expect(mockSupabase.eq).toHaveBeenCalledWith('match_status', 'unmatched');
    });

    it('should apply pagination', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findDetectedItems({
        limit: 20,
        offset: 40
      });

      expect(mockSupabase.range).toHaveBeenCalledWith(40, 59);
    });

    it('should order by confidence descending', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findDetectedItems({});

      expect(mockSupabase.order).toHaveBeenCalledWith('confidence_score', { ascending: false });
    });
  });

  describe('findItemsForVerification', () => {
    it('should find all items for verification', async () => {
      const mockItems = [
        { id: '1', verification_id: 'verify-123', confidence_score: 0.92 },
        { id: '2', verification_id: 'verify-123', confidence_score: 0.85 }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockItems,
        error: null
      });

      const result = await repo.findItemsForVerification('verify-123');

      expect(result.data).toEqual(mockItems);
      expect(mockSupabase.eq).toHaveBeenCalledWith('verification_id', 'verify-123');
    });
  });

  describe('createDetectedItem', () => {
    it('should create single item', async () => {
      const newItem = {
        verification_id: 'verify-123',
        item_type: 'wrench',
        confidence_score: 0.85,
        match_status: 'matched' as const
      };

      const mockCreated = { id: 'new-id', ...newItem };

      mockSupabase.single.mockResolvedValue({
        data: mockCreated,
        error: null
      });

      const result = await repo.createDetectedItem(newItem);

      expect(result.data).toEqual(mockCreated);
      expect(mockSupabase.insert).toHaveBeenCalledWith(newItem);
    });
  });

  describe('createDetectedItems', () => {
    it('should bulk insert items', async () => {
      const newItems = [
        { verification_id: 'verify-123', item_type: 'wrench', confidence_score: 0.85, match_status: 'matched' as const },
        { verification_id: 'verify-123', item_type: 'hammer', confidence_score: 0.92, match_status: 'matched' as const }
      ];

      const mockCreated = newItems.map((item, i) => ({ id: `item-${i}`, ...item }));

      mockSupabase.select.mockResolvedValue({
        data: mockCreated,
        error: null
      });

      const result = await repo.createDetectedItems(newItems);

      expect(result.data).toEqual(mockCreated);
      expect(result.data.length).toBe(2);
      expect(mockSupabase.insert).toHaveBeenCalledWith(newItems);
    });

    it('should handle empty array', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repo.createDetectedItems([]);

      expect(result.data).toEqual([]);
    });
  });

  describe('updateDetectedItem', () => {
    it('should update item', async () => {
      const updates = {
        match_status: 'matched' as const,
        matched_kit_item_id: 'kit-item-789'
      };

      const mockUpdated = { id: 'item-123', ...updates };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdated,
        error: null
      });

      const result = await repo.updateDetectedItem('item-123', updates);

      expect(result.data).toEqual(mockUpdated);
      expect(mockSupabase.update).toHaveBeenCalledWith(updates);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'item-123');
    });
  });

  describe('deleteDetectedItem', () => {
    it('should delete single item', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ error: null }).then(resolve);
      });

      const result = await repo.deleteDetectedItem('item-123');

      expect(result.error).toBeNull();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'item-123');
    });
  });

  describe('deleteItemsForVerification', () => {
    it('should delete all items for verification', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ error: null }).then(resolve);
      });

      const result = await repo.deleteItemsForVerification('verify-123');

      expect(result.error).toBeNull();
      expect(mockSupabase.eq).toHaveBeenCalledWith('verification_id', 'verify-123');
    });
  });

  describe('getItemStatsForVerification', () => {
    it('should calculate item statistics', async () => {
      const mockItems = [
        { item_type: 'wrench', confidence_score: 0.85, match_status: 'matched' },
        { item_type: 'hammer', confidence_score: 0.92, match_status: 'matched' },
        { item_type: 'wrench', confidence_score: 0.75, match_status: 'unmatched' },
        { item_type: 'screwdriver', confidence_score: 0.68, match_status: 'uncertain' }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockItems,
        error: null
      });

      const result = await repo.getItemStatsForVerification('verify-123');

      expect(result.data).toEqual({
        total: 4,
        matched: 2,
        unmatched: 1,
        uncertain: 1,
        avgConfidence: 0.8,
        itemTypes: [
          { itemType: 'wrench', count: 2 },
          { itemType: 'hammer', count: 1 },
          { itemType: 'screwdriver', count: 1 }
        ]
      });
    });

    it('should handle empty results', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await repo.getItemStatsForVerification('verify-123');

      expect(result.data).toEqual({
        total: 0,
        matched: 0,
        unmatched: 0,
        uncertain: 0,
        avgConfidence: 0,
        itemTypes: []
      });
    });

    it('should sort item types by count descending', async () => {
      const mockItems = [
        { item_type: 'wrench', confidence_score: 0.85, match_status: 'matched' },
        { item_type: 'wrench', confidence_score: 0.80, match_status: 'matched' },
        { item_type: 'wrench', confidence_score: 0.75, match_status: 'matched' },
        { item_type: 'hammer', confidence_score: 0.90, match_status: 'matched' },
        { item_type: 'hammer', confidence_score: 0.85, match_status: 'matched' },
        { item_type: 'screwdriver', confidence_score: 0.70, match_status: 'matched' }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockItems,
        error: null
      });

      const result = await repo.getItemStatsForVerification('verify-123');

      // wrench: 3, hammer: 2, screwdriver: 1
      expect(result.data?.itemTypes[0]).toEqual({ itemType: 'wrench', count: 3 });
      expect(result.data?.itemTypes[1]).toEqual({ itemType: 'hammer', count: 2 });
      expect(result.data?.itemTypes[2]).toEqual({ itemType: 'screwdriver', count: 1 });
    });

    it('should handle errors from findItemsForVerification', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: null, error: { message: 'Database error' } }).then(resolve);
      });

      const result = await repo.getItemStatsForVerification('verify-123');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Database error');
    });
  });
});