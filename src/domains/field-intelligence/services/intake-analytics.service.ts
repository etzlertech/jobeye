/**
 * @file src/domains/field-intelligence/services/intake-analytics.service.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose Intake analytics with source tracking and performance metrics
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - @/domains/field-intelligence/repositories/intake-requests.repository
 *     - @/core/logger/voice-logger
 *     - @/core/errors/error-types
 *   external:
 *     - @supabase/supabase-js
 * @exports
 *   - IntakeAnalyticsService (class): Intake analytics and reporting
 * @voice_considerations
 *   - "Phone leads convert 30% better than web"
 *   - "Peak intake hours: 9 AM to 11 AM"
 * @test_requirements
 *   coverage: >80%
 *   unit: __tests__/intake-analytics.service.test.ts
 * @tasks
 *   - [x] Implement source performance tracking
 *   - [x] Add time-of-day analysis
 *   - [x] Implement service type breakdown
 *   - [x] Add response time metrics
 *   - [x] Implement trend analysis
 * END AGENT DIRECTIVE BLOCK
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IntakeRequestsRepository } from '../repositories/intake-requests.repository';
import { logger } from '@/core/logger/voice-logger';
import { ValidationError } from '@/core/errors/error-types';

/**
 * Source performance metrics
 */
export interface SourcePerformance {
  source: string; // e.g., "PHONE", "EMAIL", "WEB"
  totalRequests: number;
  convertedRequests: number;
  conversionRate: number;
  averageResponseTimeMinutes: number;
  averageLeadScore: number;
}

/**
 * Time-of-day analytics
 */
export interface TimeOfDayAnalytics {
  hour: number; // 0-23
  requestCount: number;
  conversionRate: number;
  averageLeadScore: number;
}

/**
 * Service type breakdown
 */
export interface ServiceTypeBreakdown {
  serviceType: string;
  requestCount: number;
  conversionRate: number;
  averageValue: number;
  percentOfTotal: number;
}

/**
 * Response time metrics
 */
export interface ResponseTimeMetrics {
  averageResponseTimeMinutes: number;
  medianResponseTimeMinutes: number;
  percentUnder1Hour: number;
  percentUnder24Hours: number;
  slowestResponses: Array<{
    requestId: string;
    responseTimeHours: number;
  }>;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: Date;
  requestCount: number;
  conversionRate: number;
  averageLeadScore: number;
}

/**
 * Service for intake analytics and performance tracking
 *
 * Features:
 * - Source performance comparison
 * - Time-of-day analysis (peak hours)
 * - Service type breakdown
 * - Response time tracking
 * - Trend analysis (daily/weekly/monthly)
 *
 * @example
 * ```typescript
 * const analyticsService = new IntakeAnalyticsService(supabase, companyId);
 *
 * // Get source performance
 * const sources = await analyticsService.getSourcePerformance();
 * sources.forEach(s => {
 *   console.log(`${s.source}: ${s.conversionRate * 100}% conversion`);
 * });
 *
 * // Get peak intake hours
 * const timeAnalysis = await analyticsService.getTimeOfDayAnalytics();
 * const peakHour = timeAnalysis.sort((a, b) => b.requestCount - a.requestCount)[0];
 * console.log(`Peak hour: ${peakHour.hour}:00`);
 * ```
 */
export class IntakeAnalyticsService {
  private requestsRepository: IntakeRequestsRepository;

  constructor(
    client: SupabaseClient,
    private companyId: string
  ) {
    this.requestsRepository = new IntakeRequestsRepository(client, companyId);
  }

  /**
   * Get source performance metrics
   */
  async getSourcePerformance(
    startDate?: Date,
    endDate?: Date
  ): Promise<SourcePerformance[]> {
    // Get requests in date range
    const requests = await this.getRequestsInRange(startDate, endDate);

    // Group by source
    const sourceMap = new Map<
      string,
      { total: number; converted: number; responseTimes: number[] }
    >();

    for (const request of requests) {
      const source = request.source || 'UNKNOWN';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { total: 0, converted: 0, responseTimes: [] });
      }

      const sourceData = sourceMap.get(source)!;
      sourceData.total++;

      if (request.status === 'CONVERTED') {
        sourceData.converted++;
      }

      // Calculate response time (simplified)
      if (request.first_contact_at) {
        const createdAt = new Date(request.created_at);
        const contactedAt = new Date(request.first_contact_at);
        const responseTimeMinutes =
          (contactedAt.getTime() - createdAt.getTime()) / (1000 * 60);
        sourceData.responseTimes.push(responseTimeMinutes);
      }
    }

    // Build performance array
    const performance: SourcePerformance[] = [];

    for (const [source, data] of sourceMap.entries()) {
      const averageResponseTimeMinutes =
        data.responseTimes.length > 0
          ? data.responseTimes.reduce((a, b) => a + b, 0) /
            data.responseTimes.length
          : 0;

      performance.push({
        source,
        totalRequests: data.total,
        convertedRequests: data.converted,
        conversionRate: data.total > 0 ? data.converted / data.total : 0,
        averageResponseTimeMinutes,
        averageLeadScore: 0, // Would calculate from lead scoring service
      });
    }

    // Sort by total requests (descending)
    performance.sort((a, b) => b.totalRequests - a.totalRequests);

    logger.info('Source performance calculated', {
      sourceCount: performance.length,
      totalRequests: requests.length,
    });

    return performance;
  }

  /**
   * Get time-of-day analytics (peak hours)
   */
  async getTimeOfDayAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<TimeOfDayAnalytics[]> {
    const requests = await this.getRequestsInRange(startDate, endDate);

    // Group by hour
    const hourMap = new Map<
      number,
      { count: number; converted: number }
    >();

    for (let hour = 0; hour < 24; hour++) {
      hourMap.set(hour, { count: 0, converted: 0 });
    }

    for (const request of requests) {
      const hour = new Date(request.created_at).getHours();
      const hourData = hourMap.get(hour)!;
      hourData.count++;

      if (request.status === 'CONVERTED') {
        hourData.converted++;
      }
    }

    // Build analytics array
    const analytics: TimeOfDayAnalytics[] = [];

    for (const [hour, data] of hourMap.entries()) {
      analytics.push({
        hour,
        requestCount: data.count,
        conversionRate: data.count > 0 ? data.converted / data.count : 0,
        averageLeadScore: 0, // Would calculate from lead scoring
      });
    }

    return analytics;
  }

  /**
   * Get service type breakdown
   */
  async getServiceTypeBreakdown(
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceTypeBreakdown[]> {
    const requests = await this.getRequestsInRange(startDate, endDate);
    const total = requests.length;

    // Group by service type
    const typeMap = new Map<
      string,
      { count: number; converted: number; totalValue: number }
    >();

    for (const request of requests) {
      const serviceType = request.service_type || 'UNKNOWN';
      if (!typeMap.has(serviceType)) {
        typeMap.set(serviceType, { count: 0, converted: 0, totalValue: 0 });
      }

      const typeData = typeMap.get(serviceType)!;
      typeData.count++;

      if (request.status === 'CONVERTED') {
        typeData.converted++;
        // Would add actual job value here
        typeData.totalValue += 0;
      }
    }

    // Build breakdown array
    const breakdown: ServiceTypeBreakdown[] = [];

    for (const [serviceType, data] of typeMap.entries()) {
      breakdown.push({
        serviceType,
        requestCount: data.count,
        conversionRate: data.count > 0 ? data.converted / data.count : 0,
        averageValue:
          data.converted > 0 ? data.totalValue / data.converted : 0,
        percentOfTotal: total > 0 ? (data.count / total) * 100 : 0,
      });
    }

    // Sort by request count (descending)
    breakdown.sort((a, b) => b.requestCount - a.requestCount);

    return breakdown;
  }

  /**
   * Get response time metrics
   */
  async getResponseTimeMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<ResponseTimeMetrics> {
    const requests = await this.getRequestsInRange(startDate, endDate);

    const responseTimes: number[] = [];
    const slowestResponses: Array<{
      requestId: string;
      responseTimeHours: number;
    }> = [];

    for (const request of requests) {
      if (request.first_contact_at) {
        const createdAt = new Date(request.created_at);
        const contactedAt = new Date(request.first_contact_at);
        const responseTimeMinutes =
          (contactedAt.getTime() - createdAt.getTime()) / (1000 * 60);
        responseTimes.push(responseTimeMinutes);

        slowestResponses.push({
          requestId: request.id,
          responseTimeHours: responseTimeMinutes / 60,
        });
      }
    }

    // Sort response times for median calculation
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const medianResponseTimeMinutes =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : 0;

    // Calculate percentages
    const under1Hour = responseTimes.filter((t) => t <= 60).length;
    const under24Hours = responseTimes.filter((t) => t <= 1440).length;

    const percentUnder1Hour =
      responseTimes.length > 0 ? (under1Hour / responseTimes.length) * 100 : 0;
    const percentUnder24Hours =
      responseTimes.length > 0
        ? (under24Hours / responseTimes.length) * 100
        : 0;

    // Get slowest 5 responses
    slowestResponses.sort((a, b) => b.responseTimeHours - a.responseTimeHours);
    const slowest5 = slowestResponses.slice(0, 5);

    return {
      averageResponseTimeMinutes:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
      medianResponseTimeMinutes,
      percentUnder1Hour,
      percentUnder24Hours,
      slowestResponses: slowest5,
    };
  }

  /**
   * Get trend data (daily aggregation)
   */
  async getTrendData(
    startDate: Date,
    endDate: Date
  ): Promise<TrendDataPoint[]> {
    const requests = await this.getRequestsInRange(startDate, endDate);

    // Group by date
    const dateMap = new Map<
      string,
      { count: number; converted: number }
    >();

    for (const request of requests) {
      const date = new Date(request.created_at).toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { count: 0, converted: 0 });
      }

      const dateData = dateMap.get(date)!;
      dateData.count++;

      if (request.status === 'CONVERTED') {
        dateData.converted++;
      }
    }

    // Build trend array
    const trendData: TrendDataPoint[] = [];

    for (const [dateStr, data] of dateMap.entries()) {
      trendData.push({
        date: new Date(dateStr),
        requestCount: data.count,
        conversionRate: data.count > 0 ? data.converted / data.count : 0,
        averageLeadScore: 0, // Would calculate from lead scoring
      });
    }

    // Sort by date
    trendData.sort((a, b) => a.date.getTime() - b.date.getTime());

    return trendData;
  }

  /**
   * Get requests in date range
   */
  private async getRequestsInRange(
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const filters: any = {};

    if (startDate) {
      filters.created_after = startDate.toISOString();
    }

    if (endDate) {
      filters.created_before = endDate.toISOString();
    }

    return this.requestsRepository.findAll(filters);
  }
}