import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CreateKitInput,
  KitDetail,
  KitItem,
  KitItemInput,
  KitSummary,
  JsonValue,
} from '@/domains/lib/scheduling-kits/kit-types';

type KitsTable = Database['public']['Tables']['kits'];
type KitItemsTable = Database['public']['Tables']['kit_items'];
type KitRow = KitsTable['Row'] & {
  kit_items?: KitItemRow[];
};
type KitItemRow = KitItemsTable['Row'];
type KitInsert = KitsTable['Insert'];
type KitItemInsert = KitItemsTable['Insert'];

const KIT_SELECT =
  'id, tenant_id, kit_code, name, is_active, metadata, kit_items ( id, item_type, quantity, unit, is_required, metadata )';

export class KitRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listKits(tenantId: string): Promise<KitDetail[]> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(KIT_SELECT)
      .eq('tenant_id', tenantId)
      .order('kit_code', { ascending: true });

    if (error) {
      throw this.asRepositoryError('Failed to list kits', error);
    }

    return (data as KitRow[] | null)?.map((row) => this.mapKitRowToDetail(row)) ?? [];
  }

  async getKitById(kitId: string, tenantId: string): Promise<KitDetail | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(KIT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', kitId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw this.asRepositoryError('Failed to load kit', error);
    }

    if (!data) {
      return null;
    }

    return this.mapKitRowToDetail(data as KitRow);
  }

  async findActiveKitByCode(tenantId: string, kitCode: string): Promise<KitDetail | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(KIT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('kit_code', kitCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw this.asRepositoryError('Failed to find kit by code', error);
    }

    if (!data) {
      return null;
    }

    return this.mapKitRowToDetail(data as KitRow);
  }

  async createKit(input: CreateKitInput, tenantId: string): Promise<KitDetail> {
    const kitInsert: KitInsert = {
      tenant_id: tenantId,
      kit_code: input.kitCode,
      name: input.name,
      is_active: input.isActive ?? true,
      metadata: (input.metadata ?? null) as KitInsert['metadata'],
    };

    const { data: kitData, error: kitError } = await this.supabase
      .from('kits')
      .insert(kitInsert)
      .select('id')
      .single();

    if (kitError) {
      throw this.asRepositoryError('Failed to create kit', kitError);
    }

    const kitId = (kitData as { id: string }).id;

    if (input.items.length > 0) {
      const itemsPayload = this.buildItemPayloads(input.items, tenantId, kitId);
      const { error: itemError } = await this.supabase.from('kit_items').insert(itemsPayload);

      if (itemError) {
        await this.supabase.from('kits').delete().eq('id', kitId);
        throw this.asRepositoryError('Failed to create kit items', itemError);
      }
    }

    const created = await this.getKitById(kitId, tenantId);
    if (!created) {
      throw new Error('Kit created but could not be reloaded');
    }

    return created;
  }

  private buildItemPayloads(items: KitItemInput[], tenantId: string, kitId: string): KitItemInsert[] {
    return items.map((item) => ({
      tenant_id: tenantId,
      kit_id: kitId,
      item_type: item.itemType,
      quantity: item.quantity,
      unit: item.unit,
      is_required: item.isRequired,
      metadata: (item.metadata ?? null) as KitItemInsert['metadata'],
    }));
  }

  private mapKitRowToDetail(row: KitRow): KitDetail {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      kitCode: row.kit_code,
      name: row.name,
      isActive: row.is_active,
      metadata: (row.metadata ?? undefined) as JsonValue | undefined,
      items: (row.kit_items ?? []).map((item) => this.mapItemRow(item)),
    } satisfies KitDetail;
  }

  private mapItemRow(row: KitItemRow): KitItem {
    return {
      id: row.id,
      itemType: row.item_type as KitItem['itemType'],
      quantity: row.quantity,
      unit: row.unit ?? '',
      isRequired: row.is_required,
      metadata: (row.metadata ?? undefined) as JsonValue | undefined,
    } satisfies KitItem;
  }

  private asRepositoryError(message: string, error: PostgrestError): Error {
    const repositoryError = new Error(message);
    (repositoryError as Error & { cause?: unknown }).cause = error;
    return repositoryError;
  }
}
