/**
 * T066: SafetyAnalyticsService
 * Service for safety analytics, reporting, and compliance tracking
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { SafetyCompletionRepository } from '../repositories/safety-completion.repository';
import { SafetyChecklistRepository } from '../repositories/safety-checklist.repository';

export interface SafetyTrend {
  date: string;
  completions: number;
  passed: number;
  failed: number;
  pass_rate: number;
}

export interface ComplianceReport {
  period_start: string;
  period_end: string;
  total_required_checklists: number;
  total_completed: number;
  compliance_rate: number;
  by_frequency: Record<string, { required: number; completed: number; rate: number }>;
  by_user: Array<{ user_id: string; completed: number; compliance_rate: number }>;
  critical_failures: number;
}

export class SafetyAnalyticsService {
  private completionRepo: SafetyCompletionRepository;
  private checklistRepo: SafetyChecklistRepository;

  constructor(private supabase: SupabaseClient) {
    this.completionRepo = new SafetyCompletionRepository(supabase);
    this.checklistRepo = new SafetyChecklistRepository(supabase);
  }

  /**
   * Get overall safety statistics
   */
  async getOverallStats(startDate?: string, endDate?: string): Promise<{
    total_completions: number;
    completed: number;
    failed: number;
    in_progress: number;
    pass_rate: number;
    avg_completion_time_hours: number;
    vision_verification_rate: number;
    critical_failure_rate: number;
  }> {
    const completions = await this.completionRepo.findByDateRange(startDate, endDate);

    const total_completions = completions.length;
    const completed = completions.filter((c) => c.status === 'completed').length;
    const failed = completions.filter((c) => c.status === 'failed').length;
    const in_progress = completions.filter((c) => c.status === 'in_progress').length;

    const finishedCompletions = completions.filter((c) => c.completed_at);
    const totalCompletionTime = finishedCompletions.reduce((sum, c) => {
      const start = new Date(c.created_at).getTime();
      const end = new Date(c.completed_at!).getTime();
      return sum + (end - start) / (1000 * 60 * 60); // hours
    }, 0);

    const vision_verified = completions.reduce((sum, c) => {
      return sum + c.item_completions.filter((ic) => ic.vision_verified).length;
    }, 0);

    const total_items = completions.reduce((sum, c) => sum + c.total_items, 0);

    const critical_failures = completions.filter((c) => c.status === 'failed').length;

    return {
      total_completions,
      completed,
      failed,
      in_progress,
      pass_rate: total_completions > 0 ? (completed / total_completions) * 100 : 0,
      avg_completion_time_hours:
        finishedCompletions.length > 0 ? totalCompletionTime / finishedCompletions.length : 0,
      vision_verification_rate: total_items > 0 ? (vision_verified / total_items) * 100 : 0,
      critical_failure_rate: total_completions > 0 ? (critical_failures / total_completions) * 100 : 0,
    };
  }

  /**
   * Get safety trends over time
   */
  async getSafetyTrends(startDate: string, endDate: string, groupBy: 'day' | 'week' | 'month'): Promise<SafetyTrend[]> {
    const completions = await this.completionRepo.findByDateRange(startDate, endDate);

    // Group completions by date
    const groupedData = new Map<string, { completions: number; passed: number; failed: number }>();

    completions.forEach((completion) => {
      const date = new Date(completion.created_at);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        // month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = groupedData.get(key) || { completions: 0, passed: 0, failed: 0 };
      existing.completions++;

      if (completion.status === 'completed') {
        existing.passed++;
      } else if (completion.status === 'failed') {
        existing.failed++;
      }

      groupedData.set(key, existing);
    });

    // Convert to array and calculate pass rates
    return Array.from(groupedData.entries())
      .map(([date, data]) => ({
        date,
        completions: data.completions,
        passed: data.passed,
        failed: data.failed,
        pass_rate: data.completions > 0 ? (data.passed / data.completions) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get compliance report for a period
   */
  async getComplianceReport(startDate: string, endDate: string): Promise<ComplianceReport> {
    const checklists = await this.checklistRepo.findAll({ active: true });
    const completions = await this.completionRepo.findByDateRange(startDate, endDate);

    // Calculate required checklists based on frequency
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const by_frequency: Record<string, { required: number; completed: number; rate: number }> = {};

    checklists.forEach((checklist) => {
      let required = 0;

      if (checklist.frequency === 'daily') {
        required = days;
      } else if (checklist.frequency === 'weekly') {
        required = Math.ceil(days / 7);
      } else if (checklist.frequency === 'monthly') {
        required = Math.ceil(days / 30);
      } else if (checklist.frequency === 'per-job') {
        // Per-job frequency depends on job count, skip for now
        required = 0;
      }

      const completed = completions.filter(
        (c) => c.checklist_id === checklist.id && c.status === 'completed'
      ).length;

      if (!by_frequency[checklist.frequency]) {
        by_frequency[checklist.frequency] = { required: 0, completed: 0, rate: 0 };
      }

      by_frequency[checklist.frequency].required += required;
      by_frequency[checklist.frequency].completed += completed;
    });

    // Calculate rates
    Object.keys(by_frequency).forEach((freq) => {
      const data = by_frequency[freq];
      data.rate = data.required > 0 ? (data.completed / data.required) * 100 : 0;
    });

    // Group by user
    const userMap = new Map<string, { completed: number; total: number }>();

    completions.forEach((completion) => {
      const existing = userMap.get(completion.user_id) || { completed: 0, total: 0 };
      existing.total++;
      if (completion.status === 'completed') {
        existing.completed++;
      }
      userMap.set(completion.user_id, existing);
    });

    const by_user = Array.from(userMap.entries()).map(([user_id, data]) => ({
      user_id,
      completed: data.completed,
      compliance_rate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
    }));

    const total_required = Object.values(by_frequency).reduce((sum, f) => sum + f.required, 0);
    const total_completed = completions.filter((c) => c.status === 'completed').length;
    const critical_failures = completions.filter((c) => c.status === 'failed').length;

    return {
      period_start: startDate,
      period_end: endDate,
      total_required_checklists: total_required,
      total_completed,
      compliance_rate: total_required > 0 ? (total_completed / total_required) * 100 : 0,
      by_frequency,
      by_user,
      critical_failures,
    };
  }

  /**
   * Get checklist performance report
   */
  async getChecklistPerformance(): Promise<
    Array<{
      checklist_id: string;
      checklist_name: string;
      total_uses: number;
      pass_rate: number;
      avg_completion_time_mins: number;
      most_failed_items: Array<{ item_id: string; task: string; fail_count: number }>;
    }>
  > {
    const checklists = await this.checklistRepo.findAll({ active: true });
    const allCompletions = await this.completionRepo.findAll();

    const performance = await Promise.all(
      checklists.map(async (checklist) => {
        const completions = allCompletions.filter((c) => c.checklist_id === checklist.id);
        const total_uses = completions.length;
        const passed = completions.filter((c) => c.status === 'completed').length;

        const finishedCompletions = completions.filter((c) => c.completed_at);
        const totalTime = finishedCompletions.reduce((sum, c) => {
          const start = new Date(c.created_at).getTime();
          const end = new Date(c.completed_at!).getTime();
          return sum + (end - start) / (1000 * 60); // minutes
        }, 0);

        // Find most failed items
        const itemFailures = new Map<string, number>();

        completions.forEach((completion) => {
          completion.item_completions.forEach((ic) => {
            if (!ic.completed) {
              itemFailures.set(ic.item_id, (itemFailures.get(ic.item_id) || 0) + 1);
            }
          });
        });

        const most_failed_items = Array.from(itemFailures.entries())
          .map(([item_id, fail_count]) => {
            const item = checklist.items.find((i) => i.id === item_id);
            return {
              item_id,
              task: item?.task || 'Unknown',
              fail_count,
            };
          })
          .sort((a, b) => b.fail_count - a.fail_count)
          .slice(0, 5);

        return {
          checklist_id: checklist.id,
          checklist_name: checklist.name,
          total_uses,
          pass_rate: total_uses > 0 ? (passed / total_uses) * 100 : 0,
          avg_completion_time_mins: finishedCompletions.length > 0 ? totalTime / finishedCompletions.length : 0,
          most_failed_items,
        };
      })
    );

    return performance.sort((a, b) => b.total_uses - a.total_uses);
  }

  /**
   * Get user safety leaderboard
   */
  async getUserLeaderboard(
    startDate?: string,
    endDate?: string,
    limit: number = 10
  ): Promise<
    Array<{
      user_id: string;
      total_completions: number;
      pass_rate: number;
      avg_completion_time_mins: number;
      vision_verification_rate: number;
    }>
  > {
    const completions = await this.completionRepo.findByDateRange(startDate, endDate);

    const userStats = new Map<
      string,
      {
        total: number;
        passed: number;
        total_time_mins: number;
        vision_verified: number;
        total_items: number;
      }
    >();

    completions.forEach((completion) => {
      const existing = userStats.get(completion.user_id) || {
        total: 0,
        passed: 0,
        total_time_mins: 0,
        vision_verified: 0,
        total_items: 0,
      };

      existing.total++;
      if (completion.status === 'completed') existing.passed++;

      if (completion.completed_at) {
        const start = new Date(completion.created_at).getTime();
        const end = new Date(completion.completed_at).getTime();
        existing.total_time_mins += (end - start) / (1000 * 60);
      }

      existing.vision_verified += completion.item_completions.filter((ic) => ic.vision_verified).length;
      existing.total_items += completion.total_items;

      userStats.set(completion.user_id, existing);
    });

    return Array.from(userStats.entries())
      .map(([user_id, stats]) => ({
        user_id,
        total_completions: stats.total,
        pass_rate: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0,
        avg_completion_time_mins: stats.passed > 0 ? stats.total_time_mins / stats.passed : 0,
        vision_verification_rate: stats.total_items > 0 ? (stats.vision_verified / stats.total_items) * 100 : 0,
      }))
      .sort((a, b) => b.pass_rate - a.pass_rate)
      .slice(0, limit);
  }
}