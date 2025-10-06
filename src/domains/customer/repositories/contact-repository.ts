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
//     - /src/types/database
//   external:
//     - @supabase/supabase-js
//
// exports:
//   - ContactRepository: class - Customer contact data access
//   - createContactRepository: factory helper
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

import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { BaseRepository } from '@/lib/repositories/base.repository';
import type { Database, ContactRoleDb } from '@/types/database';
import {
  Contact,
  ContactRole,
  contactSchema
} from '../types/customer-types';
import {
  createAppError,
  ErrorSeverity,
  ErrorCategory
} from '@/core/errors/error-types';


type ContactPayload = z.infer<typeof contactSchema>;

type ContactsRow = Database['public']['Tables']['contacts']['Row'];
type ContactsInsert = Database['public']['Tables']['contacts']['Insert'];
type ContactsUpdate = Database['public']['Tables']['contacts']['Update'];

interface ContactSearchFilters {
  role?: ContactRole;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export class ContactRepository extends BaseRepository<'contacts'> {
  constructor(supabaseClient: SupabaseClient<Database>) {
    super('contacts', supabaseClient);
  }

  /**
   * Create a new contact for a customer
   */
  async createContact(
    customerId: string,
    contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId: string
  ): Promise<Contact> {
    try {
      const validated = contactSchema.parse(contactData);

      if (validated.isPrimary) {
        await this.clearPrimaryContact(customerId, tenantId);
      }

      const insertPayload = this.buildInsertPayload(
        customerId,
        tenantId,
        validated,
        contactData.voiceRecognitionId
      );

      const { data, error } = await this.supabase
        .from('contacts')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error || !data) {
        throw error;
      }

      return this.mapRowToContact(data);
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_CREATE_FAILED',
        message: 'Failed to create contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
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
      if (updates.isPrimary) {
        const existing = await this.getContactById(contactId, tenantId);
        if (existing) {
          await this.clearPrimaryContact(existing.customer_id, tenantId, contactId);
        }
      }

      const updatePayload = this.buildUpdatePayload(updates);

      if (Object.keys(updatePayload).length === 0) {
        return await this.findContactById(contactId, tenantId);
      }

      const { data, error } = await this.supabase
        .from('contacts')
        .update(updatePayload)
        .eq('id', contactId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return data ? this.mapRowToContact(data) : null;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_UPDATE_FAILED',
        message: 'Failed to update contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
      });
    }
  }

  /**
   * Retrieve all contacts for a customer
   */
  async findContactsByCustomer(
    customerId: string,
    tenantId: string,
    filters: ContactSearchFilters = {}
  ): Promise<Contact[]> {
    try {
      let query = this.supabase
        .from('contacts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false })
        .order('updated_at', { ascending: false });

      if (filters.role) {
        query = query.eq('role', filters.role);
      }
      if (filters.email) {
        query = query.ilike('email', filters.email);
      }
      if (filters.phone) {
        const normalized = this.normalizePhoneNumber(filters.phone);
        query = query.or(`phone.eq.${normalized},mobile_phone.eq.${normalized}`);
      }
      if (filters.isPrimary !== undefined) {
        query = query.eq('is_primary', filters.isPrimary);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => this.mapRowToContact(row));
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_FETCH_FAILED',
        message: 'Failed to load contacts',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
      });
    }
  }

  /**
   * Retrieve the primary contact for a customer
   */
  async findPrimaryContact(
    customerId: string,
    tenantId: string
  ): Promise<Contact | null> {
    try {
      const { data, error } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .eq('is_primary', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? this.mapRowToContact(data) : null;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_PRIMARY_FETCH_FAILED',
        message: 'Failed to find primary contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
      });
    }
  }

  /**
   * Retrieve contacts by role
   */
  async findContactsByRole(
    customerId: string,
    tenantId: string,
    role: ContactRole
  ): Promise<Contact[]> {
    try {
      const { data, error } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .eq('role', role)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => this.mapRowToContact(row));
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_ROLE_FETCH_FAILED',
        message: 'Failed to find contacts by role',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
      });
    }
  }

  /**
   * Find contact by phone number (phone or mobile)
   */
  async findContactByPhone(
    phone: string,
    tenantId: string
  ): Promise<Contact | null> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);

      const { data, error } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${normalizedPhone},mobile_phone.eq.${normalizedPhone}`)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? this.mapRowToContact(data) : null;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_PHONE_SEARCH_FAILED',
        message: 'Failed to search contact by phone',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
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
      const { error } = await this.supabase
        .from('contacts')
        .update({
          voice_recognition_id: voiceRecognitionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw createAppError({
        code: 'VOICE_ID_UPDATE_FAILED',
        message: 'Failed to set voice recognition ID',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
      });
    }
  }

  /**
   * Delete a contact (hard delete)
   */
  async deleteContact(
    contactId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw createAppError({
        code: 'CONTACT_DELETE_FAILED',
        message: 'Failed to delete contact',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error
      });
    }
  }

  /**
   * Internal: fetch a contact row by id/tenant
   */
  private async getContactById(
    contactId: string,
    tenantId: string
  ): Promise<ContactsRow | null> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Internal: clear other primary contacts for tenant/customer
   */
  private async clearPrimaryContact(
    customerId: string,
    tenantId: string,
    excludeContactId?: string
  ): Promise<void> {
    const query = this.supabase
      .from('contacts')
      .update({
        is_primary: false,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('is_primary', true);

    if (excludeContactId) {
      query.neq('id', excludeContactId);
    }

    const { error } = await query;

    if (error) {
      throw error;
    }
  }

  private mapRowToContact(row: ContactsRow): Contact {
    return {
      id: row.id,
      customerId: row.customer_id,
      role: row.role as ContactRole,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      mobilePhone: row.mobile_phone ?? undefined,
      isPrimary: row.is_primary,
      canReceiveSMS: row.can_receive_sms,
      canReceiveEmail: row.can_receive_email,
      preferredContactMethod: row.preferred_contact_method,
      voiceRecognitionId: row.voice_recognition_id ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private buildInsertPayload(
    customerId: string,
    tenantId: string,
    data: ContactPayload,
    voiceRecognitionId?: string
  ): ContactsInsert {
    const timestamp = new Date().toISOString();
    return {
      tenant_id: tenantId,
      customer_id: customerId,
      role: data.role as ContactRoleDb,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      mobile_phone: data.mobilePhone ?? null,
      is_primary: data.isPrimary,
      can_receive_sms: data.canReceiveSMS,
      can_receive_email: data.canReceiveEmail,
      preferred_contact_method: data.preferredContactMethod,
      voice_recognition_id: voiceRecognitionId ?? null,
      notes: data.notes ?? null,
      metadata: null,
      created_at: timestamp,
      updated_at: timestamp
    };
  }

  private buildUpdatePayload(updates: Partial<Contact>): ContactsUpdate {
    const payload: ContactsUpdate = {
      updated_at: new Date().toISOString()
    };

    if (updates.role) {
      payload.role = updates.role as ContactRoleDb;
    }
    if (updates.firstName !== undefined) {
      payload.first_name = updates.firstName;
    }
    if (updates.lastName !== undefined) {
      payload.last_name = updates.lastName;
    }
    if (updates.email !== undefined) {
      payload.email = updates.email ?? null;
    }
    if (updates.phone !== undefined) {
      payload.phone = updates.phone ?? null;
    }
    if (updates.mobilePhone !== undefined) {
      payload.mobile_phone = updates.mobilePhone ?? null;
    }
    if (updates.isPrimary !== undefined) {
      payload.is_primary = updates.isPrimary;
    }
    if (updates.canReceiveSMS !== undefined) {
      payload.can_receive_sms = updates.canReceiveSMS;
    }
    if (updates.canReceiveEmail !== undefined) {
      payload.can_receive_email = updates.canReceiveEmail;
    }
    if (updates.preferredContactMethod) {
      payload.preferred_contact_method = updates.preferredContactMethod;
    }
    if (updates.voiceRecognitionId !== undefined) {
      payload.voice_recognition_id = updates.voiceRecognitionId ?? null;
    }
    if (updates.notes !== undefined) {
      payload.notes = updates.notes ?? null;
    }

    return payload;
  }

  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  private async findContactById(
    contactId: string,
    tenantId: string
  ): Promise<Contact | null> {
    const row = await this.getContactById(contactId, tenantId);
    return row ? this.mapRowToContact(row) : null;
  }
}

// Convenience exports
export const createContactRepository = (
  supabase: SupabaseClient<Database>
): ContactRepository => {
  return new ContactRepository(supabase);
};
