import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EdgeFunction {
  name: string;
  path: string;
  deployed: boolean;
  deployedAt?: string;
  region?: string;
  runtime?: string;
  size?: number;
  lastModified?: string;
  hasSecrets?: boolean;
  cors?: {
    enabled: boolean;
    origins?: string[];
  };
  imports?: string[];
  description?: string;
  invocationCount?: number;
  errorRate?: number;
  avgDuration?: number;
}

export interface EdgeFunctionSecret {
  name: string;
  functions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EdgeFunctionAnalysis {
  functions: EdgeFunction[];
  secrets: EdgeFunctionSecret[];
  statistics: {
    total_functions: number;
    deployed_functions: number;
    total_secrets: number;
    avg_function_size: number;
    total_invocations: number;
    avg_error_rate: number;
  };
  issues: EdgeFunctionIssue[];
  recommendations: string[];
}

export interface EdgeFunctionIssue {
  type: 'not_deployed' | 'high_error_rate' | 'missing_cors' | 'large_function' | 'unused_secret' | 'no_description';
  severity: 'high' | 'medium' | 'low';
  function?: string;
  secret?: string;
  description: string;
  recommendation: string;
}

export class EdgeFunctionsAnalyzer {
  private functionsPath: string;
  
  constructor(
    private client: SupabaseClient,
    private projectRef?: string,
    private managementApiKey?: string
  ) {
    this.functionsPath = path.join(process.cwd(), 'supabase', 'functions');
  }

  async analyze(): Promise<EdgeFunctionAnalysis> {
    console.log('⚡ Analyzing Edge Functions...');

    // Check if functions directory exists
    const functionsExist = await this.checkFunctionsDirectory();
    if (!functionsExist) {
      console.log('  ℹ️  No Edge Functions directory found');
      return this.getEmptyAnalysis();
    }

    // Analyze local functions
    const localFunctions = await this.analyzeLocalFunctions();
    
    // If we have management API access, get deployment info
    let deploymentInfo: any = {};
    let secrets: EdgeFunctionSecret[] = [];
    
    if (this.projectRef && this.managementApiKey) {
      deploymentInfo = await this.getDeploymentInfo();
      secrets = await this.getSecrets();
    }

    // Merge local and deployment data
    const functions = this.mergeFunctionData(localFunctions, deploymentInfo);
    
    // Identify issues
    const issues = this.identifyIssues(functions, secrets);
    
    // Generate statistics
    const statistics = this.generateStatistics(functions);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, functions);

    return {
      functions,
      secrets,
      statistics,
      issues,
      recommendations
    };
  }

  private async checkFunctionsDirectory(): Promise<boolean> {
    try {
      await fs.access(this.functionsPath);
      return true;
    } catch {
      return false;
    }
  }

  private async analyzeLocalFunctions(): Promise<EdgeFunction[]> {
    const functions: EdgeFunction[] = [];
    
    try {
      const entries = await fs.readdir(this.functionsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const functionPath = path.join(this.functionsPath, entry.name);
          const indexPath = path.join(functionPath, 'index.ts');
          
          try {
            await fs.access(indexPath);
            
            const stats = await fs.stat(indexPath);
            const content = await fs.readFile(indexPath, 'utf-8');
            
            functions.push({
              name: entry.name,
              path: functionPath,
              deployed: false,
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              imports: this.extractImports(content),
              cors: this.detectCorsConfig(content),
              description: this.extractDescription(content)
            });
          } catch {
            // Skip if no index.ts
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing local functions:', error);
    }
    
    return functions;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return [...new Set(imports)];
  }

  private detectCorsConfig(content: string): EdgeFunction['cors'] {
    const corsEnabled = content.includes('cors(') || content.includes('Access-Control-Allow-Origin');
    
    return {
      enabled: corsEnabled,
      origins: corsEnabled ? this.extractCorsOrigins(content) : undefined
    };
  }

  private extractCorsOrigins(content: string): string[] | undefined {
    const originMatch = content.match(/['"]Access-Control-Allow-Origin['"]\s*:\s*['"](.+?)['"]/);
    if (originMatch) {
      const origin = originMatch[1];
      return origin === '*' ? ['*'] : [origin];
    }
    return undefined;
  }

  private extractDescription(content: string): string | undefined {
    // Look for JSDoc comment at the top of the file
    const jsdocMatch = content.match(/^\/\*\*\s*\n\s*\*\s*(.+?)\n/m);
    if (jsdocMatch) {
      return jsdocMatch[1].trim();
    }
    
    // Look for a comment on the first line
    const commentMatch = content.match(/^\/\/\s*(.+)/);
    if (commentMatch) {
      return commentMatch[1].trim();
    }
    
    return undefined;
  }

  private async getDeploymentInfo(): Promise<Record<string, any>> {
    // This would call the Supabase Management API
    // For now, return empty object as API access requires additional setup
    console.log('  ℹ️  Management API not configured - skipping deployment info');
    return {};
  }

  private async getSecrets(): Promise<EdgeFunctionSecret[]> {
    // This would query Edge Function secrets via Management API
    return [];
  }

  private mergeFunctionData(
    localFunctions: EdgeFunction[],
    deploymentInfo: Record<string, any>
  ): EdgeFunction[] {
    return localFunctions.map(func => {
      const deployment = deploymentInfo[func.name];
      
      if (deployment) {
        return {
          ...func,
          deployed: true,
          deployedAt: deployment.created_at,
          region: deployment.region,
          runtime: deployment.runtime,
          invocationCount: deployment.invocations_count || 0,
          errorRate: deployment.error_rate || 0,
          avgDuration: deployment.avg_duration || 0
        };
      }
      
      return func;
    });
  }

  private identifyIssues(
    functions: EdgeFunction[],
    secrets: EdgeFunctionSecret[]
  ): EdgeFunctionIssue[] {
    const issues: EdgeFunctionIssue[] = [];
    
    // Check for functions not deployed
    functions.forEach(func => {
      if (!func.deployed) {
        issues.push({
          type: 'not_deployed',
          severity: 'medium',
          function: func.name,
          description: `Function "${func.name}" exists locally but is not deployed`,
          recommendation: 'Deploy the function using: supabase functions deploy ' + func.name
        });
      }
      
      // Check for missing descriptions
      if (!func.description) {
        issues.push({
          type: 'no_description',
          severity: 'low',
          function: func.name,
          description: `Function "${func.name}" has no description`,
          recommendation: 'Add a JSDoc comment or description to document the function purpose'
        });
      }
      
      // Check for large functions
      if (func.size && func.size > 1024 * 1024) { // 1MB
        issues.push({
          type: 'large_function',
          severity: 'medium',
          function: func.name,
          description: `Function "${func.name}" is ${(func.size / 1024 / 1024).toFixed(2)}MB`,
          recommendation: 'Consider splitting the function or optimizing bundle size'
        });
      }
      
      // Check for high error rates
      if (func.errorRate && func.errorRate > 5) {
        issues.push({
          type: 'high_error_rate',
          severity: 'high',
          function: func.name,
          description: `Function "${func.name}" has ${func.errorRate}% error rate`,
          recommendation: 'Review function logs and fix errors'
        });
      }
      
      // Check for missing CORS
      if (func.deployed && !func.cors?.enabled) {
        issues.push({
          type: 'missing_cors',
          severity: 'low',
          function: func.name,
          description: `Function "${func.name}" may need CORS configuration`,
          recommendation: 'Add CORS headers if the function is called from browsers'
        });
      }
    });
    
    // Check for unused secrets
    const usedSecrets = new Set<string>();
    // In a real implementation, we'd parse function code to find secret usage
    
    secrets.forEach(secret => {
      if (!usedSecrets.has(secret.name)) {
        issues.push({
          type: 'unused_secret',
          severity: 'low',
          secret: secret.name,
          description: `Secret "${secret.name}" appears to be unused`,
          recommendation: 'Remove unused secrets to reduce attack surface'
        });
      }
    });
    
    return issues;
  }

  private generateStatistics(functions: EdgeFunction[]): EdgeFunctionAnalysis['statistics'] {
    const deployedFunctions = functions.filter(f => f.deployed);
    const totalSize = functions.reduce((sum, f) => sum + (f.size || 0), 0);
    const totalInvocations = deployedFunctions.reduce((sum, f) => sum + (f.invocationCount || 0), 0);
    const totalErrorRate = deployedFunctions.reduce((sum, f) => sum + (f.errorRate || 0), 0);
    
    return {
      total_functions: functions.length,
      deployed_functions: deployedFunctions.length,
      total_secrets: 0, // Would be populated from secrets analysis
      avg_function_size: functions.length > 0 ? Math.round(totalSize / functions.length) : 0,
      total_invocations: totalInvocations,
      avg_error_rate: deployedFunctions.length > 0 ? 
        Math.round(totalErrorRate / deployedFunctions.length * 100) / 100 : 0
    };
  }

  private generateRecommendations(
    issues: EdgeFunctionIssue[],
    functions: EdgeFunction[]
  ): string[] {
    const recommendations: string[] = [];
    
    // High priority issues
    const highPriorityIssues = issues.filter(i => i.severity === 'high');
    if (highPriorityIssues.length > 0) {
      recommendations.push(
        `🚨 Address ${highPriorityIssues.length} high-priority Edge Function issues`
      );
    }
    
    // Deployment recommendations
    const undeployedCount = functions.filter(f => !f.deployed).length;
    if (undeployedCount > 0) {
      recommendations.push(
        `🚀 Deploy ${undeployedCount} local Edge Functions to production`
      );
    }
    
    // Documentation
    const undocumentedCount = functions.filter(f => !f.description).length;
    if (undocumentedCount > 0) {
      recommendations.push(
        `📝 Add descriptions to ${undocumentedCount} Edge Functions for better documentation`
      );
    }
    
    // Performance
    const slowFunctions = functions.filter(f => f.avgDuration && f.avgDuration > 1000);
    if (slowFunctions.length > 0) {
      recommendations.push(
        `⚡ Optimize ${slowFunctions.length} Edge Functions with high latency (>1s average)`
      );
    }
    
    // Best practices
    if (functions.length > 0 && functions.every(f => !f.cors?.enabled)) {
      recommendations.push(
        '🌐 Configure CORS for Edge Functions that will be called from browsers'
      );
    }
    
    return recommendations;
  }

  private getEmptyAnalysis(): EdgeFunctionAnalysis {
    return {
      functions: [],
      secrets: [],
      statistics: {
        total_functions: 0,
        deployed_functions: 0,
        total_secrets: 0,
        avg_function_size: 0,
        total_invocations: 0,
        avg_error_rate: 0
      },
      issues: [],
      recommendations: ['💡 Consider using Edge Functions for serverless API endpoints']
    };
  }
}