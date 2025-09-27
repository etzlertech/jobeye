// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import {
  Job,
  JobStatus,
  JobType,
  JobPriority,
  JobRecurrence,
  jobCreateSchema,
  jobUpdateSchema,
  isJobStatus,
  isJobType,
  isJobPriority,
  getValidStatusTransitions,
  isValidStatusTransition,
} from '@/domains/job/types/job-types';

describe('Job Types', () => {
  describe('Type Guards', () => {
    it('should correctly identify valid job statuses', () => {
      expect(isJobStatus('draft')).toBe(true);
      expect(isJobStatus('completed')).toBe(true);
      expect(isJobStatus('invalid')).toBe(false);
      expect(isJobStatus('')).toBe(false);
    });

    it('should correctly identify valid job types', () => {
      expect(isJobType('lawn_care')).toBe(true);
      expect(isJobType('irrigation_repair')).toBe(true);
      expect(isJobType('invalid')).toBe(false);
    });

    it('should correctly identify valid job priorities', () => {
      expect(isJobPriority('low')).toBe(true);
      expect(isJobPriority('emergency')).toBe(true);
      expect(isJobPriority('invalid')).toBe(false);
    });
  });

  describe('Job Create Schema', () => {
    const validJobData = {
      title: 'Lawn Maintenance Service',
      description: 'Weekly lawn mowing and edging',
      type: JobType.LAWN_CARE,
      priority: JobPriority.NORMAL,
      customerId: 'customer-123',
      location: {
        type: 'property' as const,
        propertyId: 'property-123',
        propertyName: 'Main Office Building',
      },
      schedule: {
        scheduledDate: new Date('2024-06-15'),
        estimatedStartTime: '09:00',
        estimatedDuration: 120,
      },
      estimatedCost: 150.00,
      currency: 'USD',
    };

    it('should validate valid job creation data', () => {
      expect(() => jobCreateSchema.parse(validJobData)).not.toThrow();
    });

    it('should require mandatory fields', () => {
      expect(() => jobCreateSchema.parse({})).toThrow();
      expect(() => jobCreateSchema.parse({
        title: 'Test Job',
        // missing description
      })).toThrow();
    });

    it('should validate location structure', () => {
      const withAddressLocation = {
        ...validJobData,
        location: {
          type: 'address' as const,
          address: {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
          },
        },
      };
      
      expect(() => jobCreateSchema.parse(withAddressLocation)).not.toThrow();
    });

    it('should validate schedule requirements', () => {
      const withTimeWindow = {
        ...validJobData,
        schedule: {
          scheduledDate: new Date('2024-06-15'),
          timeWindow: {
            start: '08:00',
            end: '12:00',
          },
        },
      };
      
      expect(() => jobCreateSchema.parse(withTimeWindow)).not.toThrow();
    });

    it('should validate materials allocation', () => {
      const withMaterials = {
        ...validJobData,
        materialsAllocated: [
          {
            materialId: 'mat-123',
            quantity: 10,
            unit: 'lb',
          },
        ],
      };
      
      expect(() => jobCreateSchema.parse(withMaterials)).not.toThrow();
    });

    it('should validate voice metadata when provided', () => {
      const withVoiceMetadata = {
        ...validJobData,
        voiceMetadata: {
          createdViaVoice: true,
          voiceInstructions: [
            {
              timestamp: new Date(),
              transcription: 'Schedule lawn service for Friday morning',
              userId: 'user-123',
            },
          ],
        },
      };
      
      expect(() => jobCreateSchema.parse(withVoiceMetadata)).not.toThrow();
    });
  });

  describe('Job Update Schema', () => {
    it('should validate partial updates', () => {
      const partialUpdate = {
        title: 'Updated Job Title',
        priority: JobPriority.HIGH,
      };
      
      expect(() => jobUpdateSchema.parse(partialUpdate)).not.toThrow();
    });

    it('should validate status updates', () => {
      const statusUpdate = {
        status: JobStatus.IN_PROGRESS,
      };
      
      expect(() => jobUpdateSchema.parse(statusUpdate)).not.toThrow();
    });

    it('should validate completion data', () => {
      const completionUpdate = {
        completion: {
          completedAt: new Date(),
          completedBy: 'user-123',
          qualityScore: 8,
          customerSatisfaction: 4,
          notes: 'Job completed successfully',
          afterPhotos: ['photo1.jpg', 'photo2.jpg'],
          workPerformed: ['Mowed lawn', 'Edged borders', 'Cleaned up debris'],
        },
      };
      
      expect(() => jobUpdateSchema.parse(completionUpdate)).not.toThrow();
    });

    it('should validate pricing updates', () => {
      const pricingUpdate = {
        pricing: {
          actualCost: 140.00,
          finalPrice: 150.00,
          laborHours: 2.5,
          laborRate: 50.00,
          materialCosts: 15.00,
        },
      };
      
      expect(() => jobUpdateSchema.parse(pricingUpdate)).not.toThrow();
    });
  });

  describe('Job Status State Machine', () => {
    it('should return valid transitions from DRAFT', () => {
      const validTransitions = getValidStatusTransitions(JobStatus.DRAFT);
      expect(validTransitions).toContain(JobStatus.SCHEDULED);
      expect(validTransitions).toContain(JobStatus.CANCELLED);
      expect(validTransitions).not.toContain(JobStatus.COMPLETED);
    });

    it('should return valid transitions from SCHEDULED', () => {
      const validTransitions = getValidStatusTransitions(JobStatus.SCHEDULED);
      expect(validTransitions).toContain(JobStatus.ASSIGNED);
      expect(validTransitions).toContain(JobStatus.CANCELLED);
      expect(validTransitions).toContain(JobStatus.DRAFT);
    });

    it('should return valid transitions from IN_PROGRESS', () => {
      const validTransitions = getValidStatusTransitions(JobStatus.IN_PROGRESS);
      expect(validTransitions).toContain(JobStatus.COMPLETED);
      expect(validTransitions).toContain(JobStatus.ON_HOLD);
      expect(validTransitions).toContain(JobStatus.REQUIRES_FOLLOWUP);
      expect(validTransitions).not.toContain(JobStatus.CANCELLED);
    });

    it('should validate specific status transitions', () => {
      expect(isValidStatusTransition(JobStatus.DRAFT, JobStatus.SCHEDULED)).toBe(true);
      expect(isValidStatusTransition(JobStatus.SCHEDULED, JobStatus.ASSIGNED)).toBe(true);
      expect(isValidStatusTransition(JobStatus.IN_PROGRESS, JobStatus.COMPLETED)).toBe(true);
      
      // Invalid transitions
      expect(isValidStatusTransition(JobStatus.DRAFT, JobStatus.COMPLETED)).toBe(false);
      expect(isValidStatusTransition(JobStatus.COMPLETED, JobStatus.DRAFT)).toBe(false);
      expect(isValidStatusTransition(JobStatus.CANCELLED, JobStatus.IN_PROGRESS)).toBe(false);
    });

    it('should allow transition from COMPLETED to REQUIRES_FOLLOWUP', () => {
      expect(isValidStatusTransition(JobStatus.COMPLETED, JobStatus.REQUIRES_FOLLOWUP)).toBe(true);
    });

    it('should allow recreation from CANCELLED to DRAFT', () => {
      expect(isValidStatusTransition(JobStatus.CANCELLED, JobStatus.DRAFT)).toBe(true);
    });
  });

  describe('Job Entity Structure', () => {
    it('should have all required properties defined in interface', () => {
      // This test verifies the Job interface structure
      const mockJob: Job = {
        id: 'job-123',
        tenant_id: 'tenant-1',
        job_number: 'JOB-240615-001',
        title: 'Test Lawn Service',
        description: 'Weekly lawn maintenance',
        type: JobType.LAWN_CARE,
        priority: JobPriority.NORMAL,
        status: JobStatus.DRAFT,
        customerId: 'customer-123',
        customerName: 'John Doe',
        location: {
          type: 'property',
          propertyId: 'property-123',
          propertyName: 'Main Office',
        },
        schedule: {
          scheduledDate: new Date(),
          estimatedDuration: 120,
        },
        assignment: {
          teamMembers: [],
          equipmentAssigned: [],
          materialsAllocated: [],
        },
        pricing: {
          estimatedCost: 150.00,
          currency: 'USD',
        },
        tags: [],
        customFields: {},
        is_active: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: 'user-1',
      };

      expect(mockJob.id).toBeDefined();
      expect(mockJob.type).toBe(JobType.LAWN_CARE);
      expect(mockJob.status).toBe(JobStatus.DRAFT);
      expect(mockJob.priority).toBe(JobPriority.NORMAL);
    });
  });

  describe('Enums', () => {
    it('should have correct job statuses', () => {
      expect(JobStatus.DRAFT).toBe('draft');
      expect(JobStatus.SCHEDULED).toBe('scheduled');
      expect(JobStatus.IN_PROGRESS).toBe('in_progress');
      expect(JobStatus.COMPLETED).toBe('completed');
      expect(JobStatus.CANCELLED).toBe('cancelled');
    });

    it('should have correct job types', () => {
      expect(JobType.LAWN_CARE).toBe('lawn_care');
      expect(JobType.IRRIGATION_REPAIR).toBe('irrigation_repair');
      expect(JobType.LANDSCAPING).toBe('landscaping');
      expect(JobType.PEST_CONTROL).toBe('pest_control');
    });

    it('should have correct job priorities', () => {
      expect(JobPriority.LOW).toBe('low');
      expect(JobPriority.NORMAL).toBe('normal');
      expect(JobPriority.HIGH).toBe('high');
      expect(JobPriority.URGENT).toBe('urgent');
      expect(JobPriority.EMERGENCY).toBe('emergency');
    });

    it('should have correct recurrence patterns', () => {
      expect(JobRecurrence.NONE).toBe('none');
      expect(JobRecurrence.WEEKLY).toBe('weekly');
      expect(JobRecurrence.MONTHLY).toBe('monthly');
      expect(JobRecurrence.QUARTERLY).toBe('quarterly');
    });
  });
});