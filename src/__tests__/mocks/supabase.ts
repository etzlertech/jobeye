/**
 * Supabase client mocks for testing
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export const mockSupabaseClient = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
      },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    }),
    signInWithPassword: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
        session: {
          access_token: 'test-token',
          refresh_token: 'test-refresh-token',
        },
      },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
} as unknown as SupabaseClient;

// Helper to create a mock Supabase client with custom responses
export function createMockSupabaseClient(overrides?: Partial<typeof mockSupabaseClient>) {
  return {
    ...mockSupabaseClient,
    ...overrides,
  } as unknown as SupabaseClient;
}

// Mock data generators
export const mockCustomer = (overrides = {}) => ({
  id: 'customer-123',
  tenant_id: 'tenant-123',
  customer_number: 'C0001',
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '123-456-7890',
  mobile_phone: '987-654-3210',
  billing_address: { street: '123 Main St', city: 'Testville', state: 'TS', zip: '12345' },
  service_address: { street: '456 Service Rd', city: 'Testville', state: 'TS', zip: '12345' },
  notes: 'Test notes',
  tags: ['test', 'customer'],
  voice_notes: 'Voice note test',
  is_active: true,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'test-user-id',
  ...overrides,
});

export const mockJob = (overrides = {}) => ({
  id: 'job-123',
  tenant_id: 'tenant-123',
  job_number: 'J0001',
  template_id: null,
  customer_id: 'customer-123',
  property_id: 'property-123',
  title: 'Test Job',
  description: 'Test job description',
  status: 'scheduled' as const,
  priority: 'normal' as const,
  scheduled_start: new Date().toISOString(),
  scheduled_end: null,
  actual_start: null,
  actual_end: null,
  assigned_to: 'test-user-id',
  assigned_team: [],
  estimated_duration: 60,
  actual_duration: null,
  completion_notes: null,
  voice_notes: null,
  voice_created: false,
  voice_session_id: null,
  checklist_items: [],
  materials_used: [],
  equipment_used: [],
  photos_before: [],
  photos_after: [],
  signature_required: false,
  signature_data: null,
  billing_info: null,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'test-user-id',
  ...overrides,
});

export const mockVoiceTranscript = (overrides = {}) => ({
  id: 'transcript-123',
  tenant_id: 'tenant-123',
  user_id: 'test-user-id',
  session_id: null,
  job_id: null,
  audio_url: 'https://example.com/audio.mp3',
  audio_duration: 5.2,
  transcript: 'Test voice transcript',
  confidence_score: 0.95,
  status: 'completed' as const,
  language_code: 'en-US',
  provider: 'openai',
  provider_transcript_id: 'provider-123',
  cost: 0.05,
  metadata: {},
  created_at: new Date().toISOString(),
  processed_at: new Date().toISOString(),
  ...overrides,
});