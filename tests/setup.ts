/**
 * Vitest global setup file
 * Runs before all tests
 */

// Add any global test setup here
// Example: Mock environment variables, set up test database, etc.

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// jest-mock-extended uses `jest` as a global for creating/resetting mocks.
// In Vitest, `vi` is the equivalent. This shim lets jest-mock-extended's
// internal helpers (CalledWithFn, mockReset, etc.) find what they need.
// See: https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
Object.assign(globalThis, { jest: vi });

// Example: Clean up after each test
afterEach(() => {
  // Reset mocks, clear test data, etc.
});

// Example: Setup before all tests
beforeAll(() => {
  // Initialize test environment
});

// Example: Cleanup after all tests
afterAll(() => {
  // Close database connections, clean up resources
});
