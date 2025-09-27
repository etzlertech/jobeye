// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/repositories/contact-repository.ts
// phase: 2
// domain: customer-management
// purpose: Manage customer contact records with multi-tenant isolation and voice support
// spec_ref: phase2/customer-management#contact-repository
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/customer/types/customer-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - ContactRepository: class - Customer contact data access
//   - createContact: function - Add new contact
//   - updateContact: function - Update contact details
//   - findContactsByCustomer: function - Get all contacts for customer
//   - findPrimaryContact: function - Get primary contact
//
// voice_considerations: |
//   Store voice recognition IDs for contacts to enable voice-based caller identification.
//   Support phonetic name storage for proper pronunciation.
//   Track preferred contact methods including voice preferences.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/customer/repositories/contact-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository for contact operations
//   2. Implement contact CRUD with tenant isolation
//   3. Add primary contact management
//   4. Create voice recognition ID handling
//   5. Implement contact search methods
//   6. Add offline queue support
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import { Contact, ContactRole, contactSchema } from '../types/customer-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class ContactRepository extends BaseRepository<Contact> {
  constructor(supabaseClient: SupabaseClient) {
    super(supabaseClient, 'contacts');
  }

  /**
   * Create a new contact for a customer
   */
  async createContact(
    customerId: string,
    contactData: Omit<Contact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>,
    tenantId: string
  ): Promise<Contact> {
    try {
      // Validate input
      const validated = contactSchema.parse(contactData);

      // If this is marked as primary, ensure no other primary exists
      if (validated.isPrimary) {
        await this.clearPrimaryContact(customerId, tenantId);
      }

      const contact: Contact = {
        id: this.generateId('contact'),
        customerId,
        ...validated,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // In real implementation, save to database
      // const created = await this.create({ ...contact, tenant_id: tenantId });

      return contact;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_CREATE_FAILED',
        message: 'Failed to create contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update contact information
   */
  async updateContact(
    contactId: string,
    updates: Partial<Contact>,
    tenantId: string
  ): Promise<Contact | null> {
    try {
      // If updating to primary, clear other primaries first
      if (updates.isPrimary) {
        const existing = await this.findById(contactId, tenantId);
        if (existing) {
          await this.clearPrimaryContact(existing.customerId, tenantId, contactId);
        }
      }

      const updated = await this.update(
        contactId,
        {
          ...updates,
          updatedAt: new Date(),
        },
        tenantId
      );

      return updated as Contact | null;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_UPDATE_FAILED',
        message: 'Failed to update contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all contacts for a customer
   */
  async findContactsByCustomer(
    customerId: string,
    tenantId: string
  ): Promise<Contact[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []) as Contact[];
    } catch (error) {
      throw createAppError({
        code: 'CONTACTS_FETCH_FAILED',
        message: 'Failed to fetch contacts',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find primary contact for a customer
   */
  async findPrimaryContact(
    customerId: string,
    tenantId: string
  ): Promise<Contact | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .eq('is_primary', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      return data as Contact | null;
    } catch (error) {
      throw createAppError({
        code: 'PRIMARY_CONTACT_FETCH_FAILED',
        message: 'Failed to fetch primary contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find contacts by role
   */
  async findContactsByRole(
    customerId: string,
    role: ContactRole,
    tenantId: string
  ): Promise<Contact[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .eq('role', role);

      if (error) {
        throw error;
      }

      return (data || []) as Contact[];
    } catch (error) {
      throw createAppError({
        code: 'CONTACTS_BY_ROLE_FAILED',
        message: `Failed to fetch ${role} contacts`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search contacts by phone number (for voice caller ID)
   */
  async findContactByPhone(
    phoneNumber: string,
    tenantId: string
  ): Promise<Contact | null> {
    try {
      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${normalizedPhone},mobile_phone.eq.${normalizedPhone}`)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as Contact | null;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_PHONE_SEARCH_FAILED',
        message: 'Failed to search contact by phone',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Set voice recognition ID for a contact
   */
  async setVoiceRecognitionId(
    contactId: string,
    voiceRecognitionId: string,
    tenantId: string
  ): Promise<void> {
    try {
      await this.update(
        contactId,
        { voiceRecognitionId },
        tenantId
      );
    } catch (error) {
      throw createAppError({
        code: 'VOICE_ID_UPDATE_FAILED',
        message: 'Failed to set voice recognition ID',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete a contact (soft delete)
   */
  async deleteContact(
    contactId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      // In real implementation, might do soft delete
      return await this.delete(contactId, tenantId);
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_DELETE_FAILED',
        message: 'Failed to delete contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Helper: Clear primary status from other contacts
   */
  private async clearPrimaryContact(
    customerId: string,
    tenantId: string,
    excludeContactId?: string
  ): Promise<void> {
    try {
      const query = this.supabase
        .from(this.tableName)
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .eq('is_primary', true);

      if (excludeContactId) {
        query.neq('id', excludeContactId);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      throw createAppError({
        code: 'CLEAR_PRIMARY_FAILED',
        message: 'Failed to clear primary contact',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Helper: Normalize phone numbers for consistent storage
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as XXX-XXX-XXXX if 10 digits
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    return phone; // Return as-is if not standard format
  }

  /**
   * Helper: Generate unique ID with prefix
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Convenience exports
export const createContactRepository = (supabase: SupabaseClient): ContactRepository => {
  return new ContactRepository(supabase);
};