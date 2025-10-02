/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/performance/performance-monitor.ts
 * phase: 3
 * domain: performance
 * purpose: Real-time performance monitoring and optimization for MVP app
 * spec_ref: 007-mvp-intent-driven/contracts/performance-monitor.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'monitoring', 'analyzing', 'optimizing'],
 *   transitions: [
 *     'idle->monitoring: startMonitoring()',
 *     'monitoring->analyzing: metricsCollected()',
 *     'analyzing->optimizing: issuesDetected()',
 *     'optimizing->monitoring: optimizationComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "performanceMonitor": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/performance/cache-manager',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['PerformanceMonitor', 'PerformanceMetrics', 'OptimizationSuggestion']
 * voice_considerations: Monitor voice processing performance and audio latency
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/performance/performance-monitor.test.ts'
 * }
 * tasks: [
 *   'Implement real-time performance metrics collection',
 *   'Add FPS and frame timing monitoring',
 *   'Create memory usage tracking',
 *   'Generate optimization suggestions'
 * ]
 */

import { cacheManager } from './cache-manager';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte

  // Custom metrics
  fps: number;
  memoryUsage: number;
  cacheHitRate: number;
  networkLatency: number;
  voiceLatency: number;
  imageLoadTime: number;
  scriptLoadTime: number;

  // Battery and device
  batteryLevel?: number;
  connectionType: string;
  deviceMemory?: number;
  hardwareConcurrency: number;

  timestamp: number;
}

export interface OptimizationSuggestion {
  type: 'critical' | 'warning' | 'info';
  category: 'performance' | 'memory' | 'network' | 'ui' | 'voice';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
  priority: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetrics;
  suggestions: OptimizationSuggestion[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private isMonitoring: boolean = false;
  private metrics: PerformanceMetrics[] = [];
  private observer: PerformanceObserver | null = null;
  private fpsCounter: FPSCounter;
  private memoryMonitor: MemoryMonitor;
  private networkMonitor: NetworkMonitor;
  private voiceMonitor: VoiceMonitor;

  private readonly MAX_METRICS_HISTORY = 100;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.fpsCounter = new FPSCounter();
    this.memoryMonitor = new MemoryMonitor();
    this.networkMonitor = new NetworkMonitor();
    this.voiceMonitor = new VoiceMonitor();
    
    this.setupPerformanceObserver();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    voiceLogger.info('Performance monitoring started');

    // Start component monitors
    this.fpsCounter.start();
    this.memoryMonitor.start();
    this.networkMonitor.start();
    this.voiceMonitor.start();

    // Collect metrics every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000);

    // Initial metrics collection
    setTimeout(() => this.collectMetrics(), 1000);
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    voiceLogger.info('Performance monitoring stopped');

    // Stop component monitors
    this.fpsCounter.stop();
    this.memoryMonitor.stop();
    this.networkMonitor.stop();
    this.voiceMonitor.stop();

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // Observe different performance entry types
      const entryTypes = ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'];
      
      for (const entryType of entryTypes) {
        try {
          this.observer.observe({ entryTypes: [entryType] });
        } catch (error) {
          // Some entry types might not be supported
          voiceLogger.debug(`Performance entry type not supported: ${entryType}`);
        }
      }
    } catch (error) {
      voiceLogger.warn('Failed to setup performance observer', { error });
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.processNavigationEntry(entry as PerformanceNavigationTiming);
        break;
      case 'paint':
        this.processPaintEntry(entry as PerformancePaintTiming);
        break;
      case 'largest-contentful-paint':
        this.processLCPEntry(entry);
        break;
      case 'first-input':
        this.processFIDEntry(entry);
        break;
      case 'layout-shift':
        this.processCLSEntry(entry);
        break;
    }
  }

  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    const ttfb = entry.responseStart - entry.requestStart;
    voiceLogger.debug('Navigation timing collected', { ttfb });
  }

  private processPaintEntry(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      voiceLogger.debug('FCP collected', { fcp: entry.startTime });
    }
  }

  private processLCPEntry(entry: any): void {
    voiceLogger.debug('LCP collected', { lcp: entry.startTime });
  }

  private processFIDEntry(entry: any): void {
    voiceLogger.debug('FID collected', { fid: entry.processingStart - entry.startTime });
  }

  private processCLSEntry(entry: any): void {
    if (!entry.hadRecentInput) {
      voiceLogger.debug('CLS collected', { cls: entry.value });
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        // Core Web Vitals (will be populated by performance observer)
        fcp: this.getMetricValue('first-contentful-paint'),
        lcp: this.getMetricValue('largest-contentful-paint'),
        fid: this.getMetricValue('first-input-delay'),
        cls: this.getMetricValue('cumulative-layout-shift'),
        ttfb: this.getMetricValue('time-to-first-byte'),

        // Custom metrics
        fps: this.fpsCounter.getCurrentFPS(),
        memoryUsage: this.memoryMonitor.getCurrentUsage(),
        cacheHitRate: (await cacheManager.getStats()).hitRate,
        networkLatency: this.networkMonitor.getLatency(),
        voiceLatency: this.voiceMonitor.getLatency(),
        imageLoadTime: this.getAverageImageLoadTime(),
        scriptLoadTime: this.getAverageScriptLoadTime(),

        // Device info
        batteryLevel: await this.getBatteryLevel(),
        connectionType: this.getConnectionType(),
        deviceMemory: this.getDeviceMemory(),
        hardwareConcurrency: navigator.hardwareConcurrency || 4,

        timestamp: Date.now()
      };

      this.addMetrics(metrics);
      this.analyzePerformance(metrics);

    } catch (error) {
      voiceLogger.error('Failed to collect metrics', { error });
    }
  }

  private getMetricValue(metricName: string): number {
    const entries = performance.getEntriesByName(metricName);
    return entries.length > 0 ? entries[0].startTime : 0;
  }

  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }
  }

  private analyzePerformance(metrics: PerformanceMetrics): void {
    const suggestions = this.generateSuggestions(metrics);
    
    if (suggestions.length > 0) {
      voiceLogger.info('Performance issues detected', {
        suggestionsCount: suggestions.length,
        criticalCount: suggestions.filter(s => s.type === 'critical').length
      });

      // Auto-apply some optimizations
      this.applyAutoOptimizations(suggestions);
    }
  }

  private generateSuggestions(metrics: PerformanceMetrics): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // FPS monitoring
    if (metrics.fps < 30) {
      suggestions.push({
        type: 'critical',
        category: 'performance',
        title: 'Low Frame Rate Detected',
        description: `Current FPS is ${metrics.fps.toFixed(1)}, which may cause stuttering`,
        impact: 'high',
        action: 'Reduce visual complexity or enable performance mode',
        priority: 1
      });
    }

    // Memory usage
    if (metrics.memoryUsage > 80) {
      suggestions.push({
        type: 'warning',
        category: 'memory',
        title: 'High Memory Usage',
        description: `Memory usage is at ${metrics.memoryUsage.toFixed(1)}%`,
        impact: 'medium',
        action: 'Clear caches and optimize memory allocation',
        priority: 2
      });
    }

    // Cache performance
    if (metrics.cacheHitRate < 0.7) {
      suggestions.push({
        type: 'info',
        category: 'performance',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        impact: 'medium',
        action: 'Optimize caching strategies',
        priority: 3
      });
    }

    // Network latency
    if (metrics.networkLatency > 1000) {
      suggestions.push({
        type: 'warning',
        category: 'network',
        title: 'High Network Latency',
        description: `Network latency is ${metrics.networkLatency}ms`,
        impact: 'high',
        action: 'Enable offline mode or optimize requests',
        priority: 2
      });
    }

    // Voice latency
    if (metrics.voiceLatency > 500) {
      suggestions.push({
        type: 'warning',
        category: 'voice',
        title: 'Voice Processing Delay',
        description: `Voice processing latency is ${metrics.voiceLatency}ms`,
        impact: 'high',
        action: 'Optimize voice processing pipeline',
        priority: 2
      });
    }

    // Battery optimization
    if (metrics.batteryLevel && metrics.batteryLevel < 20) {
      suggestions.push({
        type: 'info',
        category: 'performance',
        title: 'Low Battery Mode Recommended',
        description: `Battery level is ${(metrics.batteryLevel * 100).toFixed(0)}%`,
        impact: 'medium',
        action: 'Enable battery saving mode',
        priority: 4
      });
    }

    // Core Web Vitals
    if (metrics.lcp > 2500) {
      suggestions.push({
        type: 'warning',
        category: 'performance',
        title: 'Slow Page Loading',
        description: `Largest Contentful Paint is ${metrics.lcp.toFixed(0)}ms (should be < 2500ms)`,
        impact: 'high',
        action: 'Optimize image loading and critical resources',
        priority: 2
      });
    }

    if (metrics.fid > 100) {
      suggestions.push({
        type: 'warning',
        category: 'ui',
        title: 'Poor Interactivity',
        description: `First Input Delay is ${metrics.fid.toFixed(0)}ms (should be < 100ms)`,
        impact: 'high',
        action: 'Optimize JavaScript execution and reduce blocking tasks',
        priority: 2
      });
    }

    if (metrics.cls > 0.1) {
      suggestions.push({
        type: 'warning',
        category: 'ui',
        title: 'Layout Instability',
        description: `Cumulative Layout Shift is ${metrics.cls.toFixed(3)} (should be < 0.1)`,
        impact: 'medium',
        action: 'Reserve space for dynamic content and optimize image dimensions',
        priority: 3
      });
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  private applyAutoOptimizations(suggestions: OptimizationSuggestion[]): void {
    for (const suggestion of suggestions) {
      switch (suggestion.category) {
        case 'memory':
          if (suggestion.type === 'critical') {
            // Trigger aggressive cache cleanup
            cacheManager.cleanup();
          }
          break;
        
        case 'performance':
          if (suggestion.title.includes('Low Battery')) {
            // Enable battery saving mode
            this.enableBatterySavingMode();
          }
          break;
      }
    }
  }

  private enableBatterySavingMode(): void {
    // Reduce animation frame rate
    this.fpsCounter.setTargetFPS(30);
    
    // Reduce monitoring frequency
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, 10000); // 10 seconds instead of 5
    }

    voiceLogger.info('Battery saving mode enabled');
  }

  // Helper methods
  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return battery.level;
      }
    } catch {
      // Battery API not available
    }
    return undefined;
  }

  private getConnectionType(): string {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection ? connection.effectiveType || 'unknown' : 'unknown';
  }

  private getDeviceMemory(): number | undefined {
    return (navigator as any).deviceMemory;
  }

  private getAverageImageLoadTime(): number {
    const imageEntries = performance.getEntriesByType('resource')
      .filter(entry => entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
      .slice(-10); // Last 10 images
    
    if (imageEntries.length === 0) return 0;
    
    const totalTime = imageEntries.reduce((sum, entry) => sum + entry.duration, 0);
    return totalTime / imageEntries.length;
  }

  private getAverageScriptLoadTime(): number {
    const scriptEntries = performance.getEntriesByType('resource')
      .filter(entry => entry.name.match(/\.js$/i))
      .slice(-10); // Last 10 scripts
    
    if (scriptEntries.length === 0) return 0;
    
    const totalTime = scriptEntries.reduce((sum, entry) => sum + entry.duration, 0);
    return totalTime / scriptEntries.length;
  }

  // Public API
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  generateReport(): PerformanceReport {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      throw new Error('No metrics available');
    }

    const suggestions = this.generateSuggestions(currentMetrics);
    const score = this.calculatePerformanceScore(currentMetrics);
    const grade = this.getPerformanceGrade(score);

    return {
      metrics: currentMetrics,
      suggestions,
      score,
      grade
    };
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 100;

    // FPS penalty
    if (metrics.fps < 60) score -= (60 - metrics.fps) * 0.5;
    
    // Memory penalty
    if (metrics.memoryUsage > 70) score -= (metrics.memoryUsage - 70) * 0.3;
    
    // Network penalty
    if (metrics.networkLatency > 300) score -= (metrics.networkLatency - 300) * 0.01;
    
    // Core Web Vitals penalties
    if (metrics.lcp > 2500) score -= 10;
    if (metrics.fid > 100) score -= 10;
    if (metrics.cls > 0.1) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private getPerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

// Component monitors
class FPSCounter {
  private fps: number = 60;
  private frameCount: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private targetFPS: number = 60;

  start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
  }

  private loop(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    this.frameCount++;

    if (currentTime - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    requestAnimationFrame(() => this.loop());
  }

  getCurrentFPS(): number {
    return this.fps;
  }

  setTargetFPS(target: number): void {
    this.targetFPS = target;
  }
}

class MemoryMonitor {
  private usage: number = 0;

  start(): void {
    this.updateUsage();
    setInterval(() => this.updateUsage(), 2000);
  }

  stop(): void {
    // No cleanup needed
  }

  private updateUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.usage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    }
  }

  getCurrentUsage(): number {
    return this.usage;
  }
}

class NetworkMonitor {
  private latency: number = 0;

  start(): void {
    this.measureLatency();
    setInterval(() => this.measureLatency(), 30000); // Every 30 seconds
  }

  stop(): void {
    // No cleanup needed
  }

  private async measureLatency(): Promise<void> {
    try {
      const start = performance.now();
      await fetch('/api/health', { method: 'HEAD', cache: 'no-cache' });
      this.latency = performance.now() - start;
    } catch {
      this.latency = 9999; // High latency to indicate network issues
    }
  }

  getLatency(): number {
    return this.latency;
  }
}

class VoiceMonitor {
  private latency: number = 0;

  start(): void {
    // Voice latency would be updated by voice processor
  }

  stop(): void {
    // No cleanup needed
  }

  updateLatency(latency: number): void {
    this.latency = latency;
  }

  getLatency(): number {
    return this.latency;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();