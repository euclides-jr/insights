import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 20000,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/api/ai.test.ts',
      'tests/api/events.test.ts',
      'tests/api/quality.test.ts',
      'tests/api/query.test.ts',
      'tests/api/schemas.test.ts',
      'tests/api/segments.test.ts',
      'tests/api/users.test.ts',
      'tests/api/webhooks.test.ts',
    ],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
