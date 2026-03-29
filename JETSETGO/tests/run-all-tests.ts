/**
 * Run All Tests Script for JETSETGO
 * Executes full test suite and generates report
 */

const TEST_RESULTS_FILE = './test-results/run-summary.json';

interface TestSuite {
  name: string;
  command: string;
  timeout: number;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    timeout: 60000
  },
  {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    timeout: 120000
  },
  {
    name: 'E2E Tests',
    command: 'npm run test:e2e',
    timeout: 180000
  },
  {
    name: 'Security Tests',
    command: 'npm run test:security',
    timeout: 60000
  }
];

interface TestResult {
  suite: string;
  status: 'passed' | 'failed' | 'timeout' | 'skipped';
  duration: number;
  error?: string;
}

interface RunSummary {
  timestamp: string;
  totalDuration: number;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

async function runTest(suite: TestSuite): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n🧪 Running ${suite.name}...`);

  try {
    const process = Deno.run({
      cmd: 'bash',
      args: ['-c', suite.command],
      stdout: 'piped',
      stderr: 'piped'
    });

    const timeoutId = setTimeout(() => {
      process.kill('SIGTERM');
    }, suite.timeout);

    const { code, success } = await process.status();
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    return {
      suite: suite.name,
      status: success ? 'passed' : 'failed',
      duration,
      error: !success ? `Exit code: ${code}` : undefined
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      suite: suite.name,
      status: 'failed',
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runAllTests(): Promise<RunSummary> {
  const startTime = Date.now();
  console.log('🚀 JETSETGO Test Suite');
  console.log('='.repeat(50));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Total suites: ${TEST_SUITES.length}`);

  const results: TestResult[] = [];

  for (const suite of TEST_SUITES) {
    const result = await runTest(suite);
    results.push(result);

    const icon = result.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} ${suite.name}: ${result.status} (${(result.duration / 1000).toFixed(1)}s)`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  const totalDuration = Date.now() - startTime;

  const summary = results.reduce((acc, r) => {
    acc.total++;
    if (r.status === 'passed') acc.passed++;
    else if (r.status === 'failed') acc.failed++;
    else acc.skipped++;
    return acc;
  }, { total: 0, passed: 0, failed: 0, skipped: 0 });

  const runSummary: RunSummary = {
    timestamp: new Date().toISOString(),
    totalDuration,
    results,
    summary
  };

  // Save results
  await Deno.writeTextFile(
    TEST_RESULTS_FILE,
    JSON.stringify(runSummary, null, 2)
  );

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log(`Total Tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed} ✅`);
  console.log(`Failed: ${summary.failed} ❌`);
  console.log(`Skipped: ${summary.skipped} ⊘`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Results saved to: ${TEST_RESULTS_FILE}`);
  console.log('='.repeat(50));

  // Exit with appropriate code
  Deno.exit(summary.failed > 0 ? 1 : 0);
}

// Run if executed directly
if (import.meta.main) {
  runAllTests();
}
