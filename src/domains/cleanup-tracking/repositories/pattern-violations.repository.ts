/**
 * @file /src/domains/cleanup-tracking/repositories/pattern-violations.repository.ts
 * @phase 3
 * @domain cleanup-tracking
 * @purpose Repository for tracking code pattern violations
 * @complexity_budget 300
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface PatternViolation {
  id: string;
  file_path: string;
  line_number: number;
  column_number: number;
  pattern_type: 'tenant_id_usage' | 'functional_repository' | 'missing_rls' | 'direct_db_access' | 'wrong_rls_path';
  violation_text: string;
  suggested_fix: string;
  is_fixed: boolean;
  fixed_at?: Date;
  created_at: Date;
}

export interface CreatePatternViolation {
  file_path: string;
  line_number: number;
  column_number: number;
  pattern_type: PatternViolation['pattern_type'];
  violation_text: string;
  suggested_fix: string;
}

export interface UpdatePatternViolation {
  violation_text?: string;
  suggested_fix?: string;
  is_fixed?: boolean;
  fixed_at?: Date;
}

export class PatternViolationsRepository {
  constructor(private client: SupabaseClient) {}

  async create(data: CreatePatternViolation): Promise<PatternViolation> {
    const { data: result, error } = await this.client
      .from('code_pattern_violations')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create pattern violation: ${error.message}`);
    }

    return result;
  }

  async createMany(violations: CreatePatternViolation[]): Promise<PatternViolation[]> {
    if (violations.length === 0) return [];

    const { data, error } = await this.client
      .from('code_pattern_violations')
      .insert(violations)
      .select();

    if (error) {
      throw new Error(`Failed to create pattern violations: ${error.message}`);
    }

    return data || [];
  }

  async findById(id: string): Promise<PatternViolation | null> {
    const { data, error } = await this.client
      .from('code_pattern_violations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find pattern violation: ${error.message}`);
    }

    return data;
  }

  async findAll(filters?: {
    patternType?: PatternViolation['pattern_type'];
    isFixed?: boolean;
    filePath?: string;
    filePathPrefix?: string;
  }): Promise<PatternViolation[]> {
    let query = this.client.from('code_pattern_violations').select('*');

    if (filters?.patternType) {
      query = query.eq('pattern_type', filters.patternType);
    }

    if (filters?.isFixed !== undefined) {
      query = query.eq('is_fixed', filters.isFixed);
    }

    if (filters?.filePath) {
      query = query.eq('file_path', filters.filePath);
    }

    if (filters?.filePathPrefix) {
      query = query.like('file_path', `${filters.filePathPrefix}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find pattern violations: ${error.message}`);
    }

    return data || [];
  }

  async update(id: string, data: UpdatePatternViolation): Promise<PatternViolation> {
    const { data: result, error } = await this.client
      .from('code_pattern_violations')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update pattern violation: ${error.message}`);
    }

    return result;
  }

  async markAsFixed(id: string): Promise<PatternViolation> {
    return this.update(id, {
      is_fixed: true,
      fixed_at: new Date()
    });
  }

  async markManyAsFixed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await this.client
      .from('code_pattern_violations')
      .update({
        is_fixed: true,
        fixed_at: new Date()
      })
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to mark violations as fixed: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('code_pattern_violations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete pattern violation: ${error.message}`);
    }
  }

  async deleteByFilePath(filePath: string): Promise<void> {
    const { error } = await this.client
      .from('code_pattern_violations')
      .delete()
      .eq('file_path', filePath);

    if (error) {
      throw new Error(`Failed to delete violations for file: ${error.message}`);
    }
  }

  async getSummary(): Promise<{
    total: number;
    fixed: number;
    pending: number;
    byType: Record<PatternViolation['pattern_type'], number>;
  }> {
    const { data, error } = await this.client
      .from('code_pattern_violations')
      .select('pattern_type, is_fixed');

    if (error) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }

    const summary: {
      total: number;
      fixed: number;
      pending: number;
      byType: Record<PatternViolation['pattern_type'], number>;
    } = {
      total: data.length,
      fixed: 0,
      pending: 0,
      byType: {
        tenant_id_usage: 0,
        functional_repository: 0,
        missing_rls: 0,
        direct_db_access: 0,
        wrong_rls_path: 0
      }
    };

    (data ?? []).forEach((item) => {
      const violation = item as Pick<PatternViolation, 'pattern_type' | 'is_fixed'>;
      if (item.is_fixed) {
        summary.fixed++;
      } else {
        summary.pending++;
      }
      summary.byType[violation.pattern_type] += 1;
    });

    return summary;
  }

  async findUnfixedByType(patternType: PatternViolation['pattern_type']): Promise<PatternViolation[]> {
    return this.findAll({
      patternType,
      isFixed: false
    });
  }

  async getViolationsByFile(): Promise<Record<string, PatternViolation[]>> {
    const violations = await this.findAll({ isFixed: false });
    const byFile: Record<string, PatternViolation[]> = {};

    violations.forEach(violation => {
      if (!byFile[violation.file_path]) {
        byFile[violation.file_path] = [];
      }
      byFile[violation.file_path].push(violation);
    });

    return byFile;
  }

  async clearAllViolations(): Promise<void> {
    const { error } = await this.client
      .from('code_pattern_violations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw new Error(`Failed to clear violations: ${error.message}`);
    }
  }
}
