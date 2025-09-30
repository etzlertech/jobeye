import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import {
  CreateKitInput,
  KitDetail,
  KitItem,
  KitItemInput,
  KitSummary,
} from '@/domains/lib/scheduling-kits/kit-types';

type Json = Record<string, unknown> | null;

type KitItemRow = {
  id: string;
  item_type: KitItem['itemType'];
  quantity: number;
  unit: string;
  is_required: boolean;
  metadata: Json;
};

type KitRow = {
  id: string;
  company_id: string;
  kit_code: string;
  name: string;
  is_active: boolean;
  metadata: Json;
  kit_items?: KitItemRow[];
};

const KIT_SELECT =
  'id, company_id, kit_code, name, is_active, metadata, kit_items ( id, item_type, quantity, unit, is_required, metadata )';

export class KitRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listKits(companyId: string): Promise<KitDetail[]> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(KIT_SELECT)
      .eq('tenant_id', companyId)
      .order('kit_code', { ascending: true });

    if (error) {
      throw this.asRepositoryError('Failed to list kits', error);
    }

    return (data as KitRow[] | null)?.map((row) => this.mapKitRowToDetail(row)) ?? [];
  }

  async getKitById(kitId: string, companyId: string): Promise<KitDetail | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(KIT_SELECT)
      .eq('tenant_id', companyId)
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

  async findActiveKitByCode(companyId: string, kitCode: string): Promise<KitDetail | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(KIT_SELECT)
      .eq('tenant_id', companyId)
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

  async createKit(input: CreateKitInput, companyId: string): Promise<KitDetail> {
    const kitInsert = {
      company_id: companyId,
      kit_code: input.kitCode,
      name: input.name,
      is_active: input.isActive ?? true,
      metadata: input.metadata ?? {},
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
      const itemsPayload = this.buildItemPayloads(input.items, companyId, kitId);
      const { error: itemError } = await this.supabase.from('kit_items').insert(itemsPayload);

      if (itemError) {
        await this.supabase.from('kits').delete().eq('id', kitId);
        throw this.asRepositoryError('Failed to create kit items', itemError);
      }
    }

    const created = await this.getKitById(kitId, companyId);
    if (!created) {
      throw new Error('Kit created but could not be reloaded');
    }

    return created;
  }

  private buildItemPayloads(items: KitItemInput[], companyId: string, kitId: string) {
    return items.map((item) => ({
      company_id: companyId,
      kit_id: kitId,
      item_type: item.itemType,
      quantity: item.quantity,
      unit: item.unit,
      is_required: item.isRequired,
      metadata: item.metadata ?? {},
    }));
  }

  private mapKitRowToDetail(row: KitRow): KitDetail {
    return {
      id: row.id,
      companyId: row.company_id,
      kitCode: row.kit_code,
      name: row.name,
      isActive: row.is_active,
      metadata: row.metadata ?? undefined,
      items: (row.kit_items ?? []).map((item) => this.mapItemRow(item)),
    } satisfies KitDetail;
  }

  private mapItemRow(row: KitItemRow): KitItem {
    return {
      id: row.id,
      itemType: row.item_type,
      quantity: row.quantity,
      unit: row.unit,
      isRequired: row.is_required,
      metadata: row.metadata ?? undefined,
    } satisfies KitItem;
  }

  private asRepositoryError(message: string, error: PostgrestError): Error {
    const repositoryError = new Error(message);
    (repositoryError as Error & { cause?: unknown }).cause = error;
    return repositoryError;
  }
}
