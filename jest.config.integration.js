/**
 * Jest configuration for integration tests
 * Uses real environment variables and database connections
 */

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration-real/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Don't use the default setup file that mocks environment
  setupFilesAfterEnv: [],
  // Increase timeout for database operations
  testTimeout: 30000,
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  // Don't collect coverage for integration tests
  collectCoverage: false,
};

module.exports = config;