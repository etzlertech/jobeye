#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

if (!RAILWAY_TOKEN) {
  console.error('❌ RAILWAY_TOKEN not found in .env.local');
  process.exit(1);
}

console.log('🚂 Checking latest Railway deployment...\n');

try {
  // Get the latest commit hash
  const latestCommit = execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
  console.log(`📍 Latest commit: ${latestCommit}`);

  // Check if there are uncommitted changes
  const status = execSync('git status --porcelain').toString();
  if (status) {
    console.log('⚠️  Warning: You have uncommitted changes');
  }

  // Get recent Railway deployments from GitHub Actions artifacts
  console.log('\n🔍 Looking for recent Railway deployments...');
  
  // Note: In a real implementation, you would:
  // 1. Query GitHub Actions API for recent workflow runs
  // 2. Download the railway-up.json artifact
  // 3. Extract the deployment ID
  
  console.log(`
To manually check a deployment:
  npm run railway:monitor <deployment-id>

To view build logs:
  npm run railway:build-logs <deployment-id>

To view runtime logs:
  npm run railway:deploy-logs <deployment-id>

Pro tip: You can find deployment IDs in:
- Railway dashboard: https://railway.app
- GitHub Actions logs
- Railway CLI output when deploying
`);

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}