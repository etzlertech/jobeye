#!/usr/bin/env tsx

import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

if (!RAILWAY_TOKEN) {
  console.error('❌ RAILWAY_TOKEN not found in .env.local');
  process.exit(1);
}

console.log('🚂 Testing Railway CLI with token...\n');

try {
  // First, check if Railway CLI is installed
  try {
    execSync('railway --version', { stdio: 'inherit' });
  } catch {
    console.log('Railway CLI not installed. Installing...');
    execSync('npm install -g @railway/cli', { stdio: 'inherit' });
  }

  // Try to use the token with Railway CLI
  console.log('\n📋 Getting Railway status...\n');
  
  // Set token and try to get project info
  const result = execSync('railway status --json', {
    env: {
      ...process.env,
      RAILWAY_TOKEN
    }
  }).toString();

  console.log('Railway CLI output:', result);

  try {
    const data = JSON.parse(result);
    console.log('\nParsed data:', JSON.stringify(data, null, 2));
  } catch {
    console.log('Could not parse as JSON');
  }

} catch (error: any) {
  console.error('\n❌ Railway CLI error:', error.message);
  console.error('\nThis suggests the token might be:');
  console.error('1. Invalid or expired');
  console.error('2. A project token (not a personal token)');
  console.error('3. Missing required permissions');
  console.error('\nTo get a valid token:');
  console.error('1. Go to https://railway.app/account/tokens');
  console.error('2. Create a new personal API token');
  console.error('3. Make sure it has access to your projects');
}