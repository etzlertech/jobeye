import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { CreateKitVariantInput, KitVariant } from '@/domains/lib/scheduling-kits/kit-types';

type KitVariantRow = {
  id: string;
  company_id: string;
  kit_id: string;
  variant_code: string;
  name: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
};

export class KitVariantRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listVariantsForKit(companyId: string, kitId: string): Promise<KitVariant[]> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('*')
      .eq('company_id', companyId)
      .eq('kit_id', kitId)
      .order('is_default', { ascending: false })
      .order('variant_code', { ascending: true });

    if (error) {
      throw this.asRepositoryError('Failed to load kit variants', error);
    }

    return (data as KitVariantRow[] | null)?.map((row) => this.mapRow(row)) ?? [];
  }

  async createVariant(input: CreateKitVariantInput): Promise<KitVariant> {
    const insertPayload = {
      kit_id: input.kitId,
      company_id: input.companyId,
      variant_code: input.variantCode,
      name: input.name,
      is_default: input.isDefault ?? false,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from('kit_variants')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw this.asRepositoryError('Failed to create kit variant', error);
    }

    return this.mapRow(data as KitVariantRow);
  }

  private mapRow(row: KitVariantRow): KitVariant {
    return {
      id: row.id,
      kitId: row.kit_id,
      companyId: row.company_id,
      variantCode: row.variant_code,
      name: row.name,
      isDefault: row.is_default,
      metadata: row.metadata ?? undefined,
    } satisfies KitVariant;
  }

  private asRepositoryError(message: string, error: PostgrestError): Error {
    const repositoryError = new Error(message);
    (repositoryError as Error & { cause?: unknown }).cause = error;
    return repositoryError;
  }
}
