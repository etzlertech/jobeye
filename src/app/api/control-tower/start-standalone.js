#!/usr/bin/env node

// Standalone server startup script for Railway deployment
// This ensures the correct server.js is used from the .next/standalone directory

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
const serverPath = path.join(standaloneDir, 'server.js');

// Check if standalone server exists
if (!fs.existsSync(serverPath)) {
  console.error('Standalone server not found at:', serverPath);
  console.error('Make sure the build completed successfully with output: "standalone"');
  process.exit(1);
}

console.log('Starting Next.js standalone server...');
console.log('Server path:', serverPath);
console.log('Working directory:', standaloneDir);

// Change to standalone directory and start server
process.chdir(standaloneDir);

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.PORT || '3000',
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});