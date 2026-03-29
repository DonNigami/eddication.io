/**
 * Vitest Configuration for JETSETGO
 * Unit and Integration Testing
 */

/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/performance/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/tests/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/migrations/**'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    },
    reporters: ['verbose', 'json'],
    outputFile: './test-results/unit-results.json',
    testTimeout: 30000, // 30 seconds for slow OCR tests
    hookTimeout: 60000
  },
  resolve: {
    alias: {
      '@shared': './shared',
      '@tests': './tests'
    }
  }
});
