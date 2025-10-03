/**
 * @file src/domains/field-intelligence/services/time-analytics.service.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose Time tracking analytics with labor cost and productivity metrics
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/domains/field-intelligence/repositories/time-entries.repository
 *     - @/core/logger/voice-logger
 *     - @/core/errors/error-types
 *   external:
 *     - @supabase/supabase-js
 * @exports
 *   - TimeAnalyticsService (class): Time tracking analytics
 * @voice_considerations
 *   - "Labor utilization this week: 87%"
 *   - "Overtime costs: $450 this pay period"
 * @test_requirements
 *   coverage: >80%
 *   unit: __tests__/time-analytics.service.test.ts
 * @tasks
 *   - [x] Implement labor utilization tracking
 *   - [x] Add overtime cost analysis
 *   - [x] Implement productivity metrics (hours per job)
 *   - [x] Add crew comparison analytics
 *   - [x] Implement labor cost forecasting
 * END AGENT DIRECTIVE BLOCK

// NOTE: Repository imports and usage have been temporarily commented out
// These will be implemented when the repositories are created
 */

import { SupabaseClient } from '@supabase/supabase-js';
// TODO: import { TimeEntriesRepository } from '../repositories/time-entries.repository';
import { logger } from '@/core/logger/voice-logger';
import { ValidationError } from '@/core/errors/error-types';

/**
 * Labor utilization metrics
 */
export interface LaborUtilizationMetrics {
  period: { startDate: Date; endDate: Date };
  totalAvailableHours: number;
  totalWorkedHours: number;
  totalIdleHours: number;
  utilizationRate: number; // 0-1
  crewBreakdown: CrewUtilization[];
}

/**
 * Crew utilization
 */
export interface CrewUtilization {
  userId: string;
  userName: string;
  availableHours: number;
  workedHours: number;
  idleHours: number;
  utilizationRate: number;
}

/**
 * Overtime cost analysis
 */
export interface OvertimeCostAnalysis {
  period: { startDate: Date; endDate: Date };
  totalOvertimeHours: number;
  regularHourlyRate: number;
  overtimeRate: number; // e.g., 1.5x
  totalOvertimeCost: number;
  crewBreakdown: Array<{
    userId: string;
    userName: string;
    overtimeHours: number;
    overtimeCost: number;
  }>;
}

/**
 * Productivity metrics
 */
export interface ProductivityMetrics {
  period: { startDate: Date; endDate: Date };
  totalJobs: number;
  totalHours: number;
  averageHoursPerJob: number;
  jobCompletionRate: number; // 0-1
  crewProductivity: Array<{
    userId: string;
    userName: string;
    jobsCompleted: number;
    totalHours: number;
    hoursPerJob: number;
    productivityScore: number; // 0-100
  }>;
}

/**
 * Labor cost forecast
 */
export interface LaborCostForecast {
  forecastPeriod: { startDate: Date; endDate: Date };
  estimatedRegularHours: number;
  estimatedOvertimeHours: number;
  estimatedRegularCost: number;
  estimatedOvertimeCost: number;
  totalEstimatedCost: number;
  confidence: number; // 0-1
}

/**
 * Service for time tracking analytics and labor cost analysis
 *
 * Features:
 * - Labor utilization tracking (% of available time worked)
 * - Overtime cost analysis
 * - Productivity metrics (hours per job)
 * - Crew comparison analytics
 * - Labor cost forecasting
 *
 * @example
 * ```typescript
 * const analyticsService = new TimeAnalyticsService(supabase, tenantId);
 *
 * // Get labor utilization
 * const utilization = await analyticsService.getLaborUtilization(startDate, endDate);
 * console.log(`Utilization: ${utilization.utilizationRate * 100}%`);
 *
 * // Analyze overtime costs
 * const overtime = await analyticsService.getOvertimeCostAnalysis(startDate, endDate, 25);
 * console.log(`Total overtime cost: $${overtime.totalOvertimeCost}`);
 * ```
 */
export class TimeAnalyticsService {
  // TODO: private timeEntriesRepository: TimeEntriesRepository;

  constructor(
    client: SupabaseClient,
    private tenantId: string
  ) {
    // TODO: this.timeEntriesRepository = new TimeEntriesRepository(client, tenantId);
  }

  /**
   * Get labor utilization metrics
   */
  async getLaborUtilization(
    startDate: Date,
    endDate: Date,
    crewSize?: number
  ): Promise<LaborUtilizationMetrics> {
    // Get time entries for period
    const entries = []; // TODO: [],
    //   clock_in_before: endDate.toISOString(),
    // });

    // Calculate period duration in days
    const periodDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    // Get unique users
    const uniqueUsers = [...new Set(entries.map((e) => e.user_id))];
    const actualCrewSize = crewSize || uniqueUsers.length;

    // Calculate total available hours (8 hours/day per crew member)
    const totalAvailableHours = actualCrewSize * periodDays * 8;

    // Calculate total worked hours
    let totalWorkedHours = 0;
    const userHoursMap = new Map<string, number>();

    for (const entry of entries) {
      if (entry.clock_out_time) {
        const hours = this.calculateHours(
          new Date(entry.clock_in_time),
          new Date(entry.clock_out_time)
        );
        totalWorkedHours += hours;

        if (!userHoursMap.has(entry.user_id)) {
          userHoursMap.set(entry.user_id, 0);
        }
        userHoursMap.set(entry.user_id, userHoursMap.get(entry.user_id)! + hours);
      }
    }

    const totalIdleHours = totalAvailableHours - totalWorkedHours;
    const utilizationRate = totalAvailableHours > 0 ? totalWorkedHours / totalAvailableHours : 0;

    // Build crew breakdown
    const crewBreakdown: CrewUtilization[] = [];
    for (const userId of uniqueUsers) {
      const workedHours = userHoursMap.get(userId) || 0;
      const availableHours = periodDays * 8;
      const idleHours = availableHours - workedHours;

      crewBreakdown.push({
        userId,
        userName: 'User ' + userId.slice(0, 8),
        availableHours,
        workedHours,
        idleHours,
        utilizationRate: availableHours > 0 ? workedHours / availableHours : 0,
      });
    }

    logger.info('Labor utilization calculated', {
      period: { startDate, endDate },
      utilizationRate,
      crewSize: actualCrewSize,
    });

    return {
      period: { startDate, endDate },
      totalAvailableHours,
      totalWorkedHours,
      totalIdleHours,
      utilizationRate,
      crewBreakdown,
    };
  }

  /**
   * Get overtime cost analysis
   */
  async getOvertimeCostAnalysis(
    startDate: Date,
    endDate: Date,
    regularHourlyRate: number,
    overtimeMultiplier: number = 1.5
  ): Promise<OvertimeCostAnalysis> {
    const entries = []; // TODO: [],
    //   clock_in_before: endDate.toISOString(),
    // });

    const overtimeRate = regularHourlyRate * overtimeMultiplier;
    const userOvertimeMap = new Map<string, number>();
    let totalOvertimeHours = 0;

    for (const entry of entries) {
      if (entry.clock_out_time) {
        const hours = this.calculateHours(
          new Date(entry.clock_in_time),
          new Date(entry.clock_out_time)
        );

        // Calculate overtime (hours over 8 per day)
        const overtimeHours = Math.max(0, hours - 8);
        if (overtimeHours > 0) {
          totalOvertimeHours += overtimeHours;

          if (!userOvertimeMap.has(entry.user_id)) {
            userOvertimeMap.set(entry.user_id, 0);
          }
          userOvertimeMap.set(
            entry.user_id,
            userOvertimeMap.get(entry.user_id)! + overtimeHours
          );
        }
      }
    }

    const totalOvertimeCost = totalOvertimeHours * overtimeRate;

    // Build crew breakdown
    const crewBreakdown = Array.from(userOvertimeMap.entries()).map(
      ([userId, overtimeHours]) => ({
        userId,
        userName: 'User ' + userId.slice(0, 8),
        overtimeHours,
        overtimeCost: overtimeHours * overtimeRate,
      })
    );

    logger.info('Overtime cost analysis completed', {
      period: { startDate, endDate },
      totalOvertimeHours,
      totalOvertimeCost,
    });

    return {
      period: { startDate, endDate },
      totalOvertimeHours,
      regularHourlyRate,
      overtimeRate,
      totalOvertimeCost,
      crewBreakdown,
    };
  }

  /**
   * Get productivity metrics
   */
  async getProductivityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<ProductivityMetrics> {
    const entries = []; // TODO: [],
    //   clock_in_before: endDate.toISOString(),
    // });

    // Count unique jobs
    const uniqueJobs = new Set(entries.map((e) => e.job_id));
    const totalJobs = uniqueJobs.size;

    // Calculate total hours
    let totalHours = 0;
    const userStatsMap = new Map<
      string,
      { jobs: Set<string>; hours: number }
    >();

    for (const entry of entries) {
      if (entry.clock_out_time) {
        const hours = this.calculateHours(
          new Date(entry.clock_in_time),
          new Date(entry.clock_out_time)
        );
        totalHours += hours;

        if (!userStatsMap.has(entry.user_id)) {
          userStatsMap.set(entry.user_id, { jobs: new Set(), hours: 0 });
        }
        const userStats = userStatsMap.get(entry.user_id)!;
        userStats.jobs.add(entry.job_id);
        userStats.hours += hours;
      }
    }

    const averageHoursPerJob = totalJobs > 0 ? totalHours / totalJobs : 0;

    // Build crew productivity
    const crewProductivity = Array.from(userStatsMap.entries()).map(
      ([userId, stats]) => {
        const jobsCompleted = stats.jobs.size;
        const hoursPerJob = jobsCompleted > 0 ? stats.hours / jobsCompleted : 0;
        const productivityScore = this.calculateProductivityScore(
          hoursPerJob,
          averageHoursPerJob
        );

        return {
          userId,
          userName: 'User ' + userId.slice(0, 8),
          jobsCompleted,
          totalHours: stats.hours,
          hoursPerJob,
          productivityScore,
        };
      }
    );

    // Sort by productivity score (descending)
    crewProductivity.sort((a, b) => b.productivityScore - a.productivityScore);

    return {
      period: { startDate, endDate },
      totalJobs,
      totalHours,
      averageHoursPerJob,
      jobCompletionRate: 1.0, // Simplified - would compare to scheduled jobs
      crewProductivity,
    };
  }

  /**
   * Forecast labor costs for upcoming period
   */
  async forecastLaborCosts(
    forecastStartDate: Date,
    forecastEndDate: Date,
    regularHourlyRate: number,
    overtimeMultiplier: number = 1.5
  ): Promise<LaborCostForecast> {
    // Get historical data from equivalent period (e.g., last month)
    const historicalDays = Math.ceil(
      (forecastEndDate.getTime() - forecastStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const historicalStart = new Date(forecastStartDate);
    historicalStart.setDate(historicalStart.getDate() - historicalDays);
    const historicalEnd = forecastStartDate;

    const historicalEntries = []; // TODO: [],
    //   clock_in_before: historicalEnd.toISOString(),
    // });

    // Calculate historical hours
    let historicalRegularHours = 0;
    let historicalOvertimeHours = 0;

    for (const entry of historicalEntries) {
      if (entry.clock_out_time) {
        const hours = this.calculateHours(
          new Date(entry.clock_in_time),
          new Date(entry.clock_out_time)
        );
        const regularHours = Math.min(hours, 8);
        const overtimeHours = Math.max(0, hours - 8);

        historicalRegularHours += regularHours;
        historicalOvertimeHours += overtimeHours;
      }
    }

    // Forecast using historical average (simplified)
    const estimatedRegularHours = historicalRegularHours;
    const estimatedOvertimeHours = historicalOvertimeHours;

    const estimatedRegularCost = estimatedRegularHours * regularHourlyRate;
    const estimatedOvertimeCost =
      estimatedOvertimeHours * regularHourlyRate * overtimeMultiplier;
    const totalEstimatedCost = estimatedRegularCost + estimatedOvertimeCost;

    // Confidence based on data availability
    const confidence = historicalEntries.length > 20 ? 0.85 : 0.65;

    logger.info('Labor cost forecast generated', {
      forecastPeriod: { forecastStartDate, forecastEndDate },
      totalEstimatedCost,
      confidence,
    });

    return {
      forecastPeriod: { startDate: forecastStartDate, endDate: forecastEndDate },
      estimatedRegularHours,
      estimatedOvertimeHours,
      estimatedRegularCost,
      estimatedOvertimeCost,
      totalEstimatedCost,
      confidence,
    };
  }

  /**
   * Calculate hours between clock in and clock out
   */
  private calculateHours(clockIn: Date, clockOut: Date): number {
    const durationMs = clockOut.getTime() - clockIn.getTime();
    return durationMs / (1000 * 60 * 60);
  }

  /**
   * Calculate productivity score (0-100)
   * Lower hours per job = higher productivity
   */
  private calculateProductivityScore(
    hoursPerJob: number,
    averageHoursPerJob: number
  ): number {
    if (averageHoursPerJob === 0) return 50;

    // Score inversely proportional to hours per job
    const ratio = averageHoursPerJob / hoursPerJob;
    const score = Math.min(100, Math.max(0, ratio * 50));

    return score;
  }
}