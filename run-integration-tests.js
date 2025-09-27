#!/usr/bin/env node

/**
 * Comprehensive test runner for real database integration tests
 * Executes all integration tests against the actual Supabase instance
 * 
 * Usage: node run-integration-tests.js [test-suite]
 * Examples:
 *   node run-integration-tests.js              # Run all tests
 *   node run-integration-tests.js auth         # Run only auth tests
 *   node run-integration-tests.js customer     # Run only customer tests
 */

const { spawn } = require('child_process');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Test suites
const testSuites = {
  'auth': 'src/__tests__/integration-real/auth.integration.test.ts',
  'customer': 'src/__tests__/integration-real/customer-repository.integration.test.ts',
  'property': 'src/__tests__/integration-real/property-repository.integration.test.ts',
  'multi-tenant': 'src/__tests__/integration-real/multi-tenant.integration.test.ts',
  'voice': 'src/__tests__/integration-real/voice.integration.test.ts',
};

// Get test suite from command line args
const requestedSuite = process.argv[2];

// Validate environment
function validateEnvironment() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nMake sure .env.local exists and contains all required variables.');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded successfully\n');
}

// Run a specific test suite
function runTestSuite(name, testPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running ${name} integration tests...`);
    console.log(`   File: ${testPath}\n`);

    const jest = spawn('npx', [
      'jest',
      testPath,
      '--config=jest.config.integration.js',
      '--verbose',
      '--no-coverage',
      '--runInBand', // Run tests serially to avoid conflicts
      '--testTimeout=30000' // 30 second timeout for database operations
    ], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${name} tests completed successfully`);
        resolve(true);
      } else {
        console.log(`\n❌ ${name} tests failed with code ${code}`);
        resolve(false);
      }
    });

    jest.on('error', (err) => {
      console.error(`\n❌ Failed to run ${name} tests:`, err);
      reject(err);
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log('🚀 JobEye Integration Tests (Real Database)\n');
  console.log('⚠️  Warning: These tests will create and delete real data in your Supabase instance.');
  console.log('   Make sure you\'re using a test/development database.\n');

  validateEnvironment();

  const results = {};
  let allPassed = true;

  // Run specific suite if requested
  if (requestedSuite) {
    if (testSuites[requestedSuite]) {
      const passed = await runTestSuite(requestedSuite, testSuites[requestedSuite]);
      results[requestedSuite] = passed;
      allPassed = passed;
    } else {
      console.error(`❌ Unknown test suite: ${requestedSuite}`);
      console.error(`   Available suites: ${Object.keys(testSuites).join(', ')}`);
      process.exit(1);
    }
  } else {
    // Run all test suites
    for (const [name, testPath] of Object.entries(testSuites)) {
      try {
        const passed = await runTestSuite(name, testPath);
        results[name] = passed;
        if (!passed) allPassed = false;
      } catch (error) {
        results[name] = false;
        allPassed = false;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log('='.repeat(60));
  
  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`   ${name.padEnd(15)} ${status}`);
  });

  console.log('='.repeat(60));
  
  if (allPassed) {
    console.log('\n🎉 All integration tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Check the output above for details.');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});

// Run tests
runAllTests();