/**
 * Simple Test Runner for JETSETGO
 * Runs tests without vitest dependency
 */

const testSuites: { name: string; fn: () => Promise<void> | void }[] = [];
let passed = 0;
let failed = 0;

// Simple test framework
export function describe(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

export function it(name: string, fn: () => Promise<void> | void) {
  testSuites.push({ name, fn });
}

export function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toBeGreaterThan: (expected: any) => {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeLessThan: (expected: any) => {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} < ${expected}`);
      }
    },
    toBeLessThanOrEqual: (expected: any) => {
      if (!(actual <= expected)) {
        throw new Error(`Expected ${actual} <= ${expected}`);
      }
    },
    toBeGreaterThanOrEqual: (expected: any) => {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} >= ${expected}`);
      }
    },
    toContain: (expected: any) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toMatch: (expected: RegExp) => {
      if (!expected.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${expected}`);
      }
    },
    toHaveLength: (expected: number) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected} but got ${actual.length}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy value but got ${actual}`);
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected falsy value but got ${actual}`);
      }
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    }
  };
}

export async function runTests() {
  console.log('🧪 JETSETGO Test Runner\n');

  for (const suite of testSuites) {
    process.stdout.write(`  ◦ ${suite.name}... `);
    try {
      await suite.fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL');
      console.error(`    Error: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}
