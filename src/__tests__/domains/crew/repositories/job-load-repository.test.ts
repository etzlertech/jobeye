// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import { JobLoadRepository, JobLoadItem, LoadVerificationSummary } from '@/domains/crew/repositories/job-load.repository';

describe('JobLoadRepository', () => {
  let repository: JobLoadRepository;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Supabase client with proper chaining
    const chainMock = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabaseClient = chainMock;

    repository = new JobLoadRepository(mockSupabaseClient);
  });

  describe('Constructor', () => {
    it('should initialize with supabase client', () => {
      expect(repository).toBeInstanceOf(JobLoadRepository);
      expect((repository as any).supabase).toBe(mockSupabaseClient);
    });
  });

  describe('getRequiredItems', () => {
    it('should fetch items from both table and JSONB sources', async () => {
      const jobId = 'job-123';

      // Mock table items response
      const tableItems = [
        {
          id: 'assoc-1',
          quantity: 1,
          is_required: true,
          status: 'pending',
          workflow_task: {
            id: 'task-1',
            task_description: 'Load equipment'
          },
          item: {
            id: 'item-1',
            name: 'Lawn Mower',
            item_type: 'equipment'
          }
        }
      ];

      // Mock JSONB response
      const jsonbJob = {
        id: jobId,
        checklist_items: [
          {
            id: 'item-2',
            name: 'Safety Cones',
            type: 'safety',
            quantity: 4,
            loaded: false
          }
        ]
      };

      // Mock the two query paths
      let fromCallCount = 0;
      mockSupabaseClient.from = jest.fn(() => {
        fromCallCount++;
        if (fromCallCount === 1) {
          // First call: workflow_task_item_associations
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: tableItems,
                  error: null
                })
              })
            })
          };
        } else {
          // Second call: jobs table for JSONB
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: jsonbJob,
                  error: null
                })
              })
            })
          };
        }
      });

      const result = await repository.getRequiredItems(jobId);

      expect(result).toHaveLength(2);

      // Verify table item
      expect(result[0]).toEqual({
        id: 'item-1',
        name: 'Lawn Mower',
        item_type: 'equipment',
        quantity: 1,
        is_required: true,
        status: 'pending',
        task_id: 'task-1',
        task_title: 'Load equipment',
        source: 'table'
      });

      // Verify JSONB item
      expect(result[1]).toEqual({
        id: 'item-2',
        name: 'Safety Cones',
        item_type: 'safety',
        quantity: 4,
        is_required: true,
        status: 'pending',
        task_id: null,
        task_title: null,
        source: 'jsonb'
      });
    });

    it('should handle errors gracefully and return available data', async () => {
      const jobId = 'job-123';

      // Mock both queries to fail
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Query failed' }
            }),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Query failed' }
            })
          })
        })
      }));

      const result = await repository.getRequiredItems(jobId);

      // Should return empty array when both sources fail
      expect(result).toEqual([]);
    });

    it('should deduplicate items that exist in both sources (prefer table)', async () => {
      const jobId = 'job-123';

      const tableItems = [
        {
          id: 'assoc-1',
          quantity: 1,
          is_required: true,
          status: 'loaded',
          workflow_task: {
            id: 'task-1',
            task_description: 'Load equipment'
          },
          item: {
            id: 'item-1',
            name: 'Lawn Mower',
            item_type: 'equipment'
          }
        }
      ];

      const jsonbJob = {
        id: jobId,
        checklist_items: [
          {
            id: 'item-1', // Same item
            name: 'Lawn Mower',
            loaded: false // Different status
          }
        ]
      };

      let fromCallCount = 0;
      mockSupabaseClient.from = jest.fn(() => {
        fromCallCount++;
        if (fromCallCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: tableItems,
                  error: null
                })
              })
            })
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: jsonbJob,
                  error: null
                })
              })
            })
          };
        }
      });

      const result = await repository.getRequiredItems(jobId);

      // Should only have one item (from table)
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('table');
      expect(result[0].status).toBe('loaded'); // Table status preferred
    });
  });

  describe('markItemLoaded', () => {
    it('should update item status in both table and JSONB with taskId', async () => {
      const jobId = 'job-123';
      const itemId = 'item-1';
      const taskId = 'task-1';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      mockSupabaseClient.select = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              checklist_items: [
                { id: itemId, name: 'Test Item', loaded: false }
              ]
            },
            error: null
          })
        })
      });

      await repository.markItemLoaded(jobId, itemId, taskId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflow_task_item_associations');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('jobs');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ status: 'loaded' });
    });

    it('should find tasks when taskId not provided', async () => {
      const jobId = 'job-123';
      const itemId = 'item-1';

      let fromCallCount = 0;
      mockSupabaseClient.from = jest.fn(() => {
        fromCallCount++;
        if (fromCallCount === 1) {
          // First call to workflow_tasks to find tasks
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ id: 'task-1' }, { id: 'task-2' }],
                error: null
              })
            })
          };
        } else if (fromCallCount === 2) {
          // Second call to workflow_task_item_associations
          return {
            update: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          };
        } else {
          // Third call to jobs (JSONB update)
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    checklist_items: [{ id: itemId, loaded: false }]
                  },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          };
        }
      });

      await repository.markItemLoaded(jobId, itemId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflow_tasks');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflow_task_item_associations');
    });

    it('should handle JSONB update when checklist_items is null', async () => {
      const jobId = 'job-123';
      const itemId = 'item-1';
      const taskId = 'task-1';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      mockSupabaseClient.select = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { checklist_items: null },
            error: null
          })
        })
      });

      await repository.markItemLoaded(jobId, itemId, taskId);

      // Should not attempt JSONB update
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workflow_task_item_associations');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('jobs');
    });
  });

  describe('markItemVerified', () => {
    it('should update item status to verified in both sources', async () => {
      const jobId = 'job-123';
      const itemId = 'item-1';
      const taskId = 'task-1';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      mockSupabaseClient.select = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              checklist_items: [
                { id: itemId, name: 'Test Item', loaded: true, verified: false }
              ]
            },
            error: null
          })
        })
      });

      await repository.markItemVerified(jobId, itemId, taskId);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ status: 'verified' });
    });
  });

  describe('markItemMissing', () => {
    it('should update item status to missing in both sources', async () => {
      const jobId = 'job-123';
      const itemId = 'item-1';
      const taskId = 'task-1';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      mockSupabaseClient.select = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              checklist_items: [
                { id: itemId, name: 'Test Item', loaded: false, missing: false }
              ]
            },
            error: null
          })
        })
      });

      await repository.markItemMissing(jobId, itemId, taskId);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ status: 'missing' });
    });
  });

  describe('getLoadSummary', () => {
    it('should calculate summary correctly for mixed statuses', async () => {
      const jobId = 'job-123';

      const items: JobLoadItem[] = [
        {
          id: 'item-1',
          name: 'Lawn Mower',
          item_type: 'equipment',
          quantity: 1,
          is_required: true,
          status: 'loaded',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'table'
        },
        {
          id: 'item-2',
          name: 'Trimmer',
          item_type: 'equipment',
          quantity: 1,
          is_required: true,
          status: 'verified',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'table'
        },
        {
          id: 'item-3',
          name: 'Blower',
          item_type: 'equipment',
          quantity: 1,
          is_required: true,
          status: 'missing',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'table'
        },
        {
          id: 'item-4',
          name: 'Safety Gear',
          item_type: 'safety',
          quantity: 1,
          is_required: true,
          status: 'pending',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'jsonb'
        }
      ];

      // Mock getRequiredItems
      jest.spyOn(repository, 'getRequiredItems').mockResolvedValue(items);

      const summary = await repository.getLoadSummary(jobId);

      expect(summary).toEqual({
        total_required: 4,
        loaded_count: 1,
        verified_count: 1,
        missing_count: 1,
        is_ready_to_verify: false,
        is_fully_verified: false
      });
    });

    it('should mark as ready_to_verify when all items loaded', async () => {
      const jobId = 'job-123';

      const items: JobLoadItem[] = [
        {
          id: 'item-1',
          name: 'Lawn Mower',
          item_type: 'equipment',
          quantity: 1,
          is_required: true,
          status: 'loaded',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'table'
        },
        {
          id: 'item-2',
          name: 'Trimmer',
          item_type: 'equipment',
          quantity: 1,
          is_required: true,
          status: 'loaded',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'table'
        }
      ];

      jest.spyOn(repository, 'getRequiredItems').mockResolvedValue(items);

      const summary = await repository.getLoadSummary(jobId);

      expect(summary.is_ready_to_verify).toBe(true);
      expect(summary.is_fully_verified).toBe(false);
    });

    it('should mark as fully_verified when all items verified', async () => {
      const jobId = 'job-123';

      const items: JobLoadItem[] = [
        {
          id: 'item-1',
          name: 'Lawn Mower',
          item_type: 'equipment',
          quantity: 1,
          is_required: true,
          status: 'verified',
          task_id: 'task-1',
          task_title: 'Load',
          source: 'table'
        }
      ];

      jest.spyOn(repository, 'getRequiredItems').mockResolvedValue(items);

      const summary = await repository.getLoadSummary(jobId);

      expect(summary.is_fully_verified).toBe(true);
    });

    it('should handle empty item list', async () => {
      const jobId = 'job-123';

      jest.spyOn(repository, 'getRequiredItems').mockResolvedValue([]);

      const summary = await repository.getLoadSummary(jobId);

      expect(summary).toEqual({
        total_required: 0,
        loaded_count: 0,
        verified_count: 0,
        missing_count: 0,
        is_ready_to_verify: false,
        is_fully_verified: false
      });
    });
  });

  describe('updateLoadVerificationStatus', () => {
    it('should update job verification status with ai_vision method', async () => {
      const jobId = 'job-123';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      await repository.updateLoadVerificationStatus(jobId, true, 'ai_vision');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('jobs');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          load_verified: true,
          load_verification_method: 'ai_vision'
        })
      );
    });

    it('should clear verification when verified=false', async () => {
      const jobId = 'job-123';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      await repository.updateLoadVerificationStatus(jobId, false, 'manual');

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          load_verified: false,
          load_verified_at: null,
          load_verification_method: null
        })
      );
    });

    it('should update legacy tool_reload_verified for backward compatibility', async () => {
      const jobId = 'job-123';

      mockSupabaseClient.update = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      await repository.updateLoadVerificationStatus(jobId, true, 'voice');

      // Should be called twice (once for new fields, once for legacy)
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ tool_reload_verified: true });
    });

    it('should throw error on database failure', async () => {
      const jobId = 'job-123';

      const dbError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabaseClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: dbError
          })
        })
      });

      await expect(
        repository.updateLoadVerificationStatus(jobId, true, 'manual')
      ).rejects.toEqual(dbError);
    });
  });
});
