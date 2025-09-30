/**
 * Test setup and global configuration
 */

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { Request, Response, Headers } from 'node-fetch';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill for Next.js web APIs
if (!global.Request) {
  global.Request = Request as any;
}
if (!global.Response) {
  global.Response = Response as any;
}
if (!global.Headers) {
  global.Headers = Headers as any;
}

// Mock environment variables (only if not already set)
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
}

// Mock window.localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  writable: true,
});

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
} as any;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});