/**
 * @fileoverview Unit tests for Task Definition Zod schemas
 * @module tests/unit/task-definition/schemas
 *
 * @ai-context
 * Purpose: Test Zod validation schemas for task definitions
 * Pattern: Unit testing with Vitest
 * Dependencies: Zod schemas from domain layer
 * Status: TDD - These tests validate schema behavior
 */

import {
  CreateTaskDefinitionSchema,
  UpdateTaskDefinitionSchema,
} from '@/domains/task-definition/schemas/task-definition-schemas';

describe('CreateTaskDefinitionSchema', () => {
  describe('name validation', () => {
    it('should accept valid name', () => {
      const input = {
        name: 'Check brake fluid level',
        description: 'Inspect brake fluid reservoir',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        description: 'Inspect brake fluid reservoir',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Name is required');
      }
    });

    it('should reject whitespace-only name', () => {
      const input = {
        name: '   ',
        description: 'Inspect brake fluid reservoir',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('empty or whitespace');
      }
    });

    it('should reject name exceeding 255 characters', () => {
      const input = {
        name: 'a'.repeat(256),
        description: 'Test description',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('255 characters');
      }
    });

    it('should trim name whitespace', () => {
      const input = {
        name: '  Check brake fluid  ',
        description: 'Test description',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Check brake fluid');
      }
    });
  });

  describe('description validation', () => {
    it('should accept valid description', () => {
      const input = {
        name: 'Test task',
        description: 'Inspect brake fluid reservoir and verify fluid is between MIN and MAX marks',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty description', () => {
      const input = {
        name: 'Test task',
        description: '',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Description is required');
      }
    });

    it('should reject whitespace-only description', () => {
      const input = {
        name: 'Test task',
        description: '   ',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('empty or whitespace');
      }
    });

    it('should reject description exceeding 2000 characters', () => {
      const input = {
        name: 'Test task',
        description: 'a'.repeat(2001),
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('2000 characters');
      }
    });

    it('should accept description at 2000 characters (boundary)', () => {
      const input = {
        name: 'Test task',
        description: 'a'.repeat(2000),
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('acceptance_criteria validation', () => {
    it('should accept null acceptance_criteria', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
        acceptance_criteria: null,
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept undefined acceptance_criteria (optional)', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid acceptance_criteria', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
        acceptance_criteria: 'Fluid level at or above MIN mark',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject acceptance_criteria exceeding 2000 characters', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
        acceptance_criteria: 'a'.repeat(2001),
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('2000 characters');
      }
    });

    it('should accept empty string acceptance_criteria', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
        acceptance_criteria: '',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('boolean flags with defaults', () => {
    it('should apply default false to requires_photo_verification', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requires_photo_verification).toBe(false);
      }
    });

    it('should apply default false to requires_supervisor_approval', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requires_supervisor_approval).toBe(false);
      }
    });

    it('should apply default true to is_required', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_required).toBe(true);
      }
    });

    it('should accept explicit boolean values', () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
        requires_photo_verification: true,
        requires_supervisor_approval: true,
        is_required: false,
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requires_photo_verification).toBe(true);
        expect(result.data.requires_supervisor_approval).toBe(true);
        expect(result.data.is_required).toBe(false);
      }
    });
  });

  describe('complete valid input', () => {
    it('should accept fully populated valid input', () => {
      const input = {
        name: 'Check brake fluid level',
        description: 'Inspect brake fluid reservoir and verify fluid is between MIN and MAX marks. Check for leaks or contamination.',
        acceptance_criteria: 'Fluid level at or above MIN mark, no discoloration, cap properly sealed',
        requires_photo_verification: true,
        requires_supervisor_approval: false,
        is_required: true,
      };
      const result = CreateTaskDefinitionSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });
  });
});

describe('UpdateTaskDefinitionSchema', () => {
  it('should accept partial updates (name only)', () => {
    const input = {
      name: 'Updated task name',
    };
    const result = UpdateTaskDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept partial updates (description only)', () => {
    const input = {
      description: 'Updated description',
    };
    const result = UpdateTaskDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept partial updates (boolean flags only)', () => {
    const input = {
      requires_photo_verification: true,
    };
    const result = UpdateTaskDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept empty object (no updates)', () => {
    const input = {};
    const result = UpdateTaskDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate fields when provided', () => {
    const input = {
      name: '', // Invalid
    };
    const result = UpdateTaskDefinitionSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept multiple partial fields', () => {
    const input = {
      name: 'Updated name',
      description: 'Updated description',
      requires_supervisor_approval: true,
    };
    const result = UpdateTaskDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated name');
      expect(result.data.description).toBe('Updated description');
      expect(result.data.requires_supervisor_approval).toBe(true);
    }
  });
});
