#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

// Set up environment
process.env.NODE_PATH = path.join(__dirname, 'node_modules');

try {
  // Run the TypeScript file using the globally installed npx tsx
  execSync('npx tsx@latest scripts/apply-orphaned-tables-cleanup.ts', { 
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname
  });
} catch (error) {
  console.error('Failed to run cleanup script:', error.message);
  process.exit(1);
}