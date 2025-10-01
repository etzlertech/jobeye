#!/usr/bin/env tsx

import fetch from 'node-fetch';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

export interface DeploymentStatus {
  id: string;
  status: string;
  url?: string;
  serviceId: string;
  environmentId: string;
  createdAt: string;
}

export interface LogEntry {
  timestamp: string;
  severity: string;
  message: string;
}

export class RailwayAPI {
  constructor(private token: string) {}

  private async query<T>(query: string, variables: any = {}): Promise<T> {
    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json() as any;
    
    if (result.errors) {
      throw new Error(`Railway API Error: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  async getDeployment(deploymentId: string): Promise<DeploymentStatus | null> {
    const query = `
      query GetDeployment($id: String!) {
        deployment(id: $id) {
          id
          status
          url
          serviceId
          environmentId
          createdAt
        }
      }
    `;

    const data = await this.query<{ deployment: DeploymentStatus }>(query, { id: deploymentId });
    return data.deployment;
  }

  async getBuildLogs(deploymentId: string, limit: number = 100): Promise<LogEntry[]> {
    const query = `
      query BuildLogs($deploymentId: String!, $limit: Int) {
        buildLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          severity
          message
        }
      }
    `;

    const data = await this.query<{ buildLogs: LogEntry[] }>(query, { deploymentId, limit });
    return data.buildLogs || [];
  }

  async getDeploymentLogs(deploymentId: string, limit: number = 100): Promise<LogEntry[]> {
    const query = `
      query DeployLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          severity
          message
        }
      }
    `;

    const data = await this.query<{ deploymentLogs: LogEntry[] }>(query, { deploymentId, limit });
    return data.deploymentLogs || [];
  }

  async waitForDeployment(deploymentId: string, timeoutMs: number = 600000): Promise<DeploymentStatus> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const deployment = await this.getDeployment(deploymentId);
      
      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      console.log(`Deployment status: ${deployment.status}`);

      if (['SUCCESS', 'FAILED', 'CANCELLED', 'CRASHED', 'REMOVED'].includes(deployment.status)) {
        return deployment;
      }

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Deployment ${deploymentId} timed out after ${timeoutMs}ms`);
  }

  async getErrorLogs(deploymentId: string): Promise<{ buildErrors: LogEntry[], deployErrors: LogEntry[] }> {
    // Get build logs
    const buildLogs = await this.getBuildLogs(deploymentId, 200);
    const buildErrors = buildLogs.filter(log => 
      log.severity === 'ERROR' || 
      log.message.toLowerCase().includes('error') ||
      log.message.toLowerCase().includes('failed')
    );

    // Get deployment logs
    const deployLogs = await this.getDeploymentLogs(deploymentId, 200);
    const deployErrors = deployLogs.filter(log => 
      log.severity === 'ERROR' || 
      log.message.toLowerCase().includes('error') ||
      log.message.toLowerCase().includes('failed')
    );

    return { buildErrors, deployErrors };
  }

  async getRecentDeployments(serviceId: string, limit: number = 5): Promise<any[]> {
    const query = `
      query RecentDeployments($serviceId: String!, $first: Int!) {
        deployments(serviceId: $serviceId, first: $first) {
          edges {
            node {
              id
              status
              createdAt
              url
            }
          }
        }
      }
    `;

    const data = await this.query<any>(query, { serviceId, first: limit });
    return data.deployments?.edges?.map((edge: any) => edge.node) || [];
  }
}