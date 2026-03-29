/**
 * Global Test Setup for JETSETGO
 * Runs before all tests
 */

import { load } from 'dotenv-std';

// Load test environment variables
const env = load({ allowEmptyValues: true });

// Set required environment variables with defaults
Deno.env.set('SUPABASE_URL', env.get('SUPABASE_URL') || 'http://localhost:54321');
Deno.env.set('SUPABASE_ANON_KEY', env.get('SUPABASE_ANON_KEY') || 'test-anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', env.get('SUPABASE_SERVICE_ROLE_KEY') || 'test-service-role-key');
Deno.env.set('GROQ_API_KEY', env.get('GROQ_API_KEY') || 'test-groq-key');

// Global test utilities
(globalThis as any).assert = {
  equal: (actual: unknown, expected: unknown, message?: string) => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected} but got ${actual}`);
    }
  },

  deepEqual: (actual: unknown, expected: unknown, message?: string) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(message || `Objects not equal:\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
  },

  hasThaiText: (text: string, message?: string) => {
    const thaiRegex = /[\u0E00-\u0E7F]/;
    if (!thaiRegex.test(text)) {
      throw new Error(message || `Expected Thai text but got: ${text}`);
    }
  },

  hasPartNumber: (text: string, message?: string) => {
    const partNumberRegex = /[A-Z0-9]{2,}-\d{2,}/;
    if (!partNumberRegex.test(text)) {
      throw new Error(message || `Expected part number format but got: ${text}`);
    }
  },

  isArrayOfLength: (arr: unknown, length: number, message?: string) => {
    if (!Array.isArray(arr)) {
      throw new Error(message || `Expected array but got ${typeof arr}`);
    }
    if (arr.length !== length) {
      throw new Error(message || `Expected array length ${length} but got ${arr.length}`);
    }
  },

  isWithinRange: (value: number, min: number, max: number, message?: string) => {
    if (value < min || value > max) {
      throw new Error(message || `Value ${value} not in range [${min}, ${max}]`);
    }
  },

  containsKeywords: (text: string, keywords: string[], message?: string) => {
    const missing = keywords.filter(k => !text.toLowerCase().includes(k.toLowerCase()));
    if (missing.length > 0) {
      throw new Error(message || `Missing keywords: ${missing.join(', ')}`);
    }
  }
};

console.log('✅ Test environment initialized');
