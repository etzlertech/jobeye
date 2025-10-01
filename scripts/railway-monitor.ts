#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { RailwayAPI } from './railway-api';

// Load environment variables
dotenv.config({ path: '.env.local' });

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

if (!RAILWAY_TOKEN) {
  console.error('❌ RAILWAY_TOKEN not found in .env.local');
  process.exit(1);
}

async function monitorDeployment(deploymentId: string) {
  const api = new RailwayAPI(RAILWAY_TOKEN);

  console.log(`\n🚂 Monitoring Railway deployment: ${deploymentId}\n`);

  try {
    // Wait for deployment to complete
    const deployment = await api.waitForDeployment(deploymentId);
    
    console.log('\n📊 Final deployment status:');
    console.log(`   Status: ${deployment.status}`);
    console.log(`   URL: ${deployment.url || 'N/A'}`);
    console.log(`   Created: ${deployment.createdAt}`);

    if (deployment.status !== 'SUCCESS') {
      console.log('\n❌ Deployment failed! Fetching error logs...\n');
      
      const { buildErrors, deployErrors } = await api.getErrorLogs(deploymentId);
      
      if (buildErrors.length > 0) {
        console.log('🔨 Build Errors:');
        console.log('================');
        buildErrors.forEach(log => {
          console.log(`[${log.timestamp}] ${log.message}`);
        });
      }

      if (deployErrors.length > 0) {
        console.log('\n🚀 Deploy/Runtime Errors:');
        console.log('=========================');
        deployErrors.forEach(log => {
          console.log(`[${log.timestamp}] ${log.message}`);
        });
      }

      if (buildErrors.length === 0 && deployErrors.length === 0) {
        console.log('\n📜 All Build Logs:');
        console.log('==================');
        const allBuildLogs = await api.getBuildLogs(deploymentId, 50);
        allBuildLogs.slice(-20).forEach(log => {
          console.log(`[${log.timestamp}] ${log.message}`);
        });
      }
    } else {
      console.log('\n✅ Deployment successful!');
    }

  } catch (error) {
    console.error('❌ Error monitoring deployment:', error);
    process.exit(1);
  }
}

async function getLatestDeployment() {
  const api = new RailwayAPI(RAILWAY_TOKEN);
  
  // You'll need to replace this with your actual service ID
  // You can find this in your Railway dashboard URL
  const serviceId = process.env.RAILWAY_SERVICE_ID;
  
  if (!serviceId) {
    console.log('ℹ️  RAILWAY_SERVICE_ID not set. Please provide a deployment ID directly.');
    return null;
  }

  const deployments = await api.getRecentDeployments(serviceId, 1);
  return deployments[0]?.id;
}

async function showBuildLogs(deploymentId: string, limit: number = 100) {
  const api = new RailwayAPI(RAILWAY_TOKEN);

  console.log(`\n📜 Fetching build logs for deployment: ${deploymentId}\n`);

  try {
    const logs = await api.getBuildLogs(deploymentId, limit);
    
    if (logs.length === 0) {
      console.log('No build logs found.');
      return;
    }

    logs.forEach(log => {
      const severity = log.severity === 'ERROR' ? '❌' : 
                      log.severity === 'WARN' ? '⚠️' : '📝';
      console.log(`${severity} [${log.timestamp}] ${log.message}`);
    });

  } catch (error) {
    console.error('❌ Error fetching build logs:', error);
    process.exit(1);
  }
}

async function showDeployLogs(deploymentId: string, limit: number = 100) {
  const api = new RailwayAPI(RAILWAY_TOKEN);

  console.log(`\n🚀 Fetching deployment logs for: ${deploymentId}\n`);

  try {
    const logs = await api.getDeploymentLogs(deploymentId, limit);
    
    if (logs.length === 0) {
      console.log('No deployment logs found.');
      return;
    }

    logs.forEach(log => {
      const severity = log.severity === 'ERROR' ? '❌' : 
                      log.severity === 'WARN' ? '⚠️' : '📝';
      console.log(`${severity} [${log.timestamp}] ${log.message}`);
    });

  } catch (error) {
    console.error('❌ Error fetching deployment logs:', error);
    process.exit(1);
  }
}

// Main CLI
const command = process.argv[2];
const deploymentId = process.argv[3];

switch (command) {
  case 'monitor':
    if (!deploymentId) {
      console.error('Usage: npm run railway:monitor <deployment-id>');
      process.exit(1);
    }
    monitorDeployment(deploymentId);
    break;

  case 'build-logs':
    if (!deploymentId) {
      console.error('Usage: npm run railway:build-logs <deployment-id>');
      process.exit(1);
    }
    showBuildLogs(deploymentId, parseInt(process.argv[4]) || 100);
    break;

  case 'deploy-logs':
    if (!deploymentId) {
      console.error('Usage: npm run railway:deploy-logs <deployment-id>');
      process.exit(1);
    }
    showDeployLogs(deploymentId, parseInt(process.argv[4]) || 100);
    break;

  case 'latest':
    getLatestDeployment().then(id => {
      if (id) {
        console.log(`Latest deployment ID: ${id}`);
        monitorDeployment(id);
      }
    });
    break;

  default:
    console.log(`
Railway Monitoring CLI
======================

Commands:
  monitor <deployment-id>     Monitor a deployment until it completes
  build-logs <deployment-id>  Show build logs for a deployment
  deploy-logs <deployment-id> Show deployment/runtime logs
  latest                      Monitor the latest deployment

Examples:
  npm run railway:monitor abc123
  npm run railway:build-logs abc123 50
  npm run railway:deploy-logs abc123
  npm run railway:latest
`);
}