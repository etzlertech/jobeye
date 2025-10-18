import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { EquipmentRepository, EquipmentCreateInput, EquipmentRecord } from '../repositories/equipment-repository';

export class EquipmentService {
  private readonly repository: EquipmentRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repository = new EquipmentRepository(this.supabase);
  }

  async createEquipment(data: EquipmentCreateInput, tenantId: string): Promise<EquipmentRecord> {
    return this.repository.createEquipment(data, tenantId);
  }
}

export const createEquipmentService = (supabaseClient: SupabaseClient<Database>): EquipmentService => {
  return new EquipmentService(supabaseClient);
};
