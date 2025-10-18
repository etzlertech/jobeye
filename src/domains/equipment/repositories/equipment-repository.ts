import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type EquipmentRecord = Database['public']['Tables']['items']['Row'];

export interface EquipmentCreateInput {
  name: string;
  type?: string;
  category?: string;
  manufacturer?: { name?: string | null; model?: string | null };
  serialNumber?: string | null;
  purchaseDate?: Date | null;
  purchasePrice?: number | null;
  location?: { id?: string | null; name?: string | null; type?: string | null };
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  voiceMetadata?: Record<string, unknown> | null;
}

export class EquipmentRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private baseInsertPayload(
    data: EquipmentCreateInput,
    tenantId: string,
    equipmentNumber: string
  ): Database['public']['Tables']['items']['Insert'] {
    return {
      tenant_id: tenantId,
      item_type: 'equipment',
      category: data.category ?? 'general',
      tracking_mode: 'individual',
      name: data.name,
      description: data.notes ?? null,
      manufacturer: data.manufacturer?.name ?? null,
      model: data.manufacturer?.model ?? null,
      serial_number: data.serialNumber ?? null,
      purchase_date: data.purchaseDate?.toISOString() ?? null,
      purchase_price: data.purchasePrice ?? null,
      current_location_id: data.location?.id ?? null,
      status: 'active',
      attributes: {
        equipmentNumber,
        voiceMetadata: data.voiceMetadata ?? null,
      },
      tags: data.tags ?? null,
      custom_fields: data.customFields ?? null,
    } as Database['public']['Tables']['items']['Insert'];
  }

  async createEquipment(data: EquipmentCreateInput, tenantId: string): Promise<EquipmentRecord> {
    const equipmentNumber = await this.generateEquipmentNumber(tenantId);
    const payload = this.baseInsertPayload(data, tenantId, equipmentNumber);

    const { data: created, error } = await (this.supabase as any)
      .from('items')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return created as EquipmentRecord;
  }

  async findBySerialNumber(serialNumber: string, tenantId: string): Promise<EquipmentRecord | null> {
    const { data, error } = await (this.supabase as any)
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('serial_number', serialNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? (data as EquipmentRecord) : null;
  }

  private async generateEquipmentNumber(tenantId: string): Promise<string> {
    const { count, error } = await (this.supabase as any)
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('item_type', 'equipment');

    if (error) {
      throw error;
    }

    const next = (count ?? 0) + 1;
    return `EQ-${next.toString().padStart(5, '0')}`;
  }
}
