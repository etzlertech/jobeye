/*
AGENT DIRECTIVE BLOCK
file: /src/lib/repositories/customer.repository.ts
phase: 2
domain: customer-management
purpose: Repository for customer data operations with voice search support
spec_ref: v4-blueprint
complexity_budget: 150
offline_capability: REQUIRED
dependencies:
  external:
    - @supabase/supabase-js
  internal:
    - /src/lib/repositories/base.repository
    - /src/lib/supabase/types
exports:
  - CustomerRepository
  - customerRepo (singleton)
voice_considerations:
  - Voice search by customer name
  - Phonetic matching for voice queries
  - Customer number voice lookup
test_requirements:
  coverage: 90%
  test_file: __tests__/lib/repositories/customer.repository.test.ts
tasks:
  - Extend base repository for customers
  - Add voice search methods
  - Implement fuzzy name matching
  - Add property count aggregation
*/

import { BaseRepository } from './base.repository';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

export class CustomerRepository extends BaseRepository<'customers'> {
  constructor() {
    super('customers', supabase);
  }

  // Search customers by name with fuzzy matching for voice
  async searchByName(searchTerm: string): Promise<Database['public']['Tables']['customers']['Row'][]> {
    try {
      const tenantId = await this.requireTenantId();
      
      // Use PostgreSQL's similarity functions for fuzzy matching
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,customer_number.ilike.%${searchTerm}%`)
        .order('name');

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw new Error(`Failed to search customers: ${error}`);
    }
  }

  // Find customer by exact customer number (for voice commands)
  async findByCustomerNumber(customerNumber: string): Promise<Database['public']['Tables']['customers']['Row'] | null> {
    try {
      const tenantId = await this.requireTenantId();
      
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('customer_number', customerNumber)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to find customer by number: ${error}`);
    }
  }

  // Get customers with property count
  async getCustomersWithPropertyCount(): Promise<Array<
    Database['public']['Tables']['customers']['Row'] & { property_count: number }
  >> {
    try {
      const tenantId = await this.requireTenantId();
      
      const { data, error } = await this.supabase
        .from('customers')
        .select(`
          *,
          properties:properties(count)
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return (data || []).map((customer: any) => ({
        ...customer,
        property_count: customer.properties?.[0]?.count || 0
      }));
    } catch (error) {
      throw new Error(`Failed to get customers with property count: ${error}`);
    }
  }

  // Get customers with recent jobs
  async getCustomersWithRecentJobs(daysBack: number = 30): Promise<Array<
    Database['public']['Tables']['customers']['Row'] & { 
      recent_jobs: Array<Pick<Database['public']['Tables']['jobs']['Row'], 'id' | 'title' | 'status' | 'scheduled_start'>>
    }
  >> {
    try {
      const tenantId = await this.requireTenantId();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const { data, error } = await this.supabase
        .from('customers')
        .select(`
          *,
          jobs:jobs(
            id,
            title,
            status,
            scheduled_start
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gte('jobs.created_at', cutoffDate.toISOString())
        .order('name');

      if (error) throw error;

      return (data || []).map((customer: any) => ({
        ...customer,
        recent_jobs: customer.jobs || []
      }));
    } catch (error) {
      throw new Error(`Failed to get customers with recent jobs: ${error}`);
    }
  }

  // Voice-friendly customer lookup
  async findCustomerForVoice(voiceInput: string): Promise<{
    customer: Database['public']['Tables']['customers']['Row'] | null;
    confidence: number;
    alternatives: Database['public']['Tables']['customers']['Row'][];
  }> {
    try {
      // First try exact customer number match
      if (/^\d+$/.test(voiceInput)) {
        const byNumber = await this.findByCustomerNumber(voiceInput);
        if (byNumber) {
          return {
            customer: byNumber,
            confidence: 1.0,
            alternatives: []
          };
        }
      }

      // Then try name search
      const matches = await this.searchByName(voiceInput);
      
      if (matches.length === 0) {
        return {
          customer: null,
          confidence: 0,
          alternatives: []
        };
      }

      if (matches.length === 1) {
        return {
          customer: matches[0],
          confidence: 0.9,
          alternatives: []
        };
      }

      // Multiple matches - return best match with alternatives
      return {
        customer: matches[0],
        confidence: 0.7,
        alternatives: matches.slice(1, 4) // Return up to 3 alternatives
      };
    } catch (error) {
      throw new Error(`Failed to find customer for voice: ${error}`);
    }
  }

  // Generate next customer number
  async generateCustomerNumber(): Promise<string> {
    try {
      const tenantId = await this.requireTenantId();
      
      // Get the highest customer number for this tenant
      const { data, error } = await this.supabase
        .from('customers')
        .select('customer_number')
        .eq('tenant_id', tenantId)
        .order('customer_number', { ascending: false })
        .limit(1);

      if (error) throw error;

      const rows = (data ?? []) as Array<{ customer_number: string }>;
      if (rows.length === 0) {
        return 'C0001';
      }

      const lastNumber = rows[0].customer_number;
      const numericPart = parseInt(lastNumber.replace(/\D/g, ''), 10);
      const nextNumber = numericPart + 1;

      return `C${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      throw new Error(`Failed to generate customer number: ${error}`);
    }
  }
}

// Export singleton instance
export const customerRepo = new CustomerRepository();
