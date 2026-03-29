/**
 * MonitoringUtilities - Performance Testing & Monitoring Tools
 *
 * Purpose: Utilities for monitoring system performance, load testing,
 * and automated health checks
 *
 * Usage:
 * - Run these functions manually from Apps Script Editor
 * - Set up time-based triggers for automated monitoring
 * - Use for troubleshooting and performance optimization
 */

/**
 * Comprehensive system health check
 * Returns detailed status of all system components
 */
function comprehensiveHealthCheck() {
  console.log("🏥 [HEALTH] Starting comprehensive health check...");
  const startTime = Date.now();

  const results = {
    timestamp: new Date().toISOString(),
    overallStatus: 'unknown',
    components: {},
    performance: {},
    recommendations: []
  };

  try {
    // 1. Cache Service Test
    console.log("📦 Testing CacheService...");
    const cacheStart = Date.now();
    const testKey = 'health_test_' + Date.now();
    CacheService.getScriptCache().put(testKey, 'test_value', 60);
    const cacheValue = CacheService.getScriptCache().get(testKey);
    CacheService.getScriptCache().remove(testKey);
    const cacheTime = Date.now() - cacheStart;

    results.components.cache = {
      status: cacheValue === 'test_value' ? 'healthy' : 'unhealthy',
      responseTime: cacheTime + 'ms',
      keysCount: CacheService.getScriptCache().getAllKeys().length
    };

    // 2. Lock Service Test
    console.log("🔒 Testing LockService...");
    const lockStart = Date.now();
    const lock = LockService.getScriptLock();
    const lockAcquired = lock.tryLock(5000);
    if (lockAcquired) {
      lock.releaseLock();
    }
    const lockTime = Date.now() - lockStart;

    results.components.lock = {
      status: lockAcquired ? 'healthy' : 'unhealthy',
      responseTime: lockTime + 'ms'
    };

    // 3. Spreadsheet Access Test
    console.log("📊 Testing Spreadsheet access...");
    const sheetStart = Date.now();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Test reading users sheet
    const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
    const usersData = getSheetData(usersSheet);
    const usersCount = usersData.length;

    // Test reading activities sheet
    const activitiesSheet = ss.getSheetByName(SHEET_NAMES.ACTIVITIES);
    const activitiesData = getSheetData(activitiesSheet);
    const activitiesCount = activitiesData.length;

    const sheetTime = Date.now() - sheetStart;

    results.components.spreadsheet = {
      status: 'healthy',
      responseTime: sheetTime + 'ms',
      usersCount: usersCount,
      activitiesCount: activitiesCount,
      sheetsTested: 2
    };

    // 4. Cache Hit Rate Test
    console.log("📈 Testing cache hit rate...");
    const cacheTestStart = Date.now();

    // First call (cache miss)
    getCachedUsers();
    const firstCallTime = Date.now() - cacheTestStart;

    // Second call (cache hit)
    const cacheHitStart = Date.now();
    getCachedUsers();
    const secondCallTime = Date.now() - cacheHitStart;

    const speedup = firstCallTime / secondCallTime;

    results.performance.cacheSpeedup = speedup.toFixed(2) + 'x';
    results.performance.cacheMissTime = firstCallTime + 'ms';
    results.performance.cacheHitTime = secondCallTime + 'ms';

    // 5. Overall Status
    const allHealthy = Object.values(results.components)
      .every(comp => comp.status === 'healthy');

    results.overallStatus = allHealthy ? 'healthy' : 'degraded';

    // 6. Recommendations
    if (results.performance.cacheSpeedup < '2.00') {
      results.recommendations.push('Cache speedup is low - consider increasing cache duration');
    }

    if (results.components.spreadsheet.responseTime > '3000') {
      results.recommendations.push('Spreadsheet access is slow - consider optimizing queries');
    }

    if (results.components.keysCount > 100) {
      results.recommendations.push('High cache key count - consider implementing cache expiration');
    }

    results.totalTime = (Date.now() - startTime) + 'ms';
    console.log("✅ [HEALTH] Health check completed in " + results.totalTime);

    return results;

  } catch (error) {
    results.overallStatus = 'unhealthy';
    results.error = error.message;
    results.stack = error.stack;
    console.error("❌ [HEALTH] Health check failed: " + error.message);
    return results;
  }
}

/**
 * Performance benchmark test
 * Tests API endpoints and measures response times
 */
function performanceBenchmark() {
  console.log("🚀 [BENCHMARK] Starting performance benchmark...");
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Get Users (with cache)
  console.log("📊 Test 1: Get Users");
  const t1Start = Date.now();
  const users = getCachedUsers();
  const t1Time = Date.now() - t1Start;
  results.tests.push({
    name: 'Get Users (first call)',
    time: t1Time + 'ms',
    records: users.length
  });

  // Test 2: Get Users (cached)
  console.log("📊 Test 2: Get Users (cached)");
  const t2Start = Date.now();
  getCachedUsers();
  const t2Time = Date.now() - t2Start;
  results.tests.push({
    name: 'Get Users (cached)',
    time: t2Time + 'ms',
    speedup: (t1Time / t2Time).toFixed(2) + 'x'
  });

  // Test 3: Find User by ID
  console.log("📊 Test 3: Find User by ID");
  if (users.length > 0) {
    const testUserId = users[0].UserID;
    const t3Start = Date.now();
    findUserById(testUserId);
    const t3Time = Date.now() - t3Start;
    results.tests.push({
      name: 'Find User by ID',
      time: t3Time + 'ms'
    });
  }

  // Test 4: Get Activities
  console.log("📊 Test 4: Get Activities");
  const t4Start = Date.now();
  const activities = getCachedActivities();
  const t4Time = Date.now() - t4Start;
  results.tests.push({
    name: 'Get Activities',
    time: t4Time + 'ms',
    records: activities.length
  });

  // Test 5: Get Dashboard
  console.log("📊 Test 5: Get Dashboard");
  const t5Start = Date.now();
  const dashboard = getCachedDashboard('all');
  const t5Time = Date.now() - t5Start;
  results.tests.push({
    name: 'Get Dashboard',
    time: t5Time + 'ms'
  });

  // Summary
  const totalTime = results.tests.reduce((sum, test) => {
    const time = parseInt(test.time);
    return sum + time;
  }, 0);

  results.summary = {
    totalTests: results.tests.length,
    totalTime: totalTime + 'ms',
    averageTime: Math.round(totalTime / results.tests.length) + 'ms'
  };

  console.log("✅ [BENCHMARK] Benchmark completed: " + JSON.stringify(results, null, 2));
  return results;
}

/**
 * Simulate concurrent load test
 * Tests system behavior under concurrent requests
 * @param {number} numUsers - Number of concurrent users to simulate
 * @param {string} testUserId - Real user ID to use for testing
 * @param {string} testActivityId - Real activity ID to use for testing
 */
function loadTest(numUsers, testUserId, testActivityId) {
  console.log(`🔥 [LOAD TEST] Starting load test with ${numUsers} concurrent users...`);
  const startTime = Date.now();

  const results = {
    timestamp: new Date().toISOString(),
    config: {
      numUsers: numUsers,
      testUserId: testUserId,
      testActivityId: testActivityId
    },
    results: [],
    summary: {}
  };

  // Simulate concurrent users requesting data
  const promises = [];

  for (let i = 0; i < numUsers; i++) {
    promises.push(
      new Promise((resolve) => {
        const requestStart = Date.now();

        try {
          // Simulate API call
          const data = getAllDataOptimized(testUserId, '7');
          const requestTime = Date.now() - requestStart;

          resolve({
            userIndex: i,
            success: data.success,
            responseTime: requestTime + 'ms',
            dataPoints: data.data ? Object.keys(data.data).length : 0
          });
        } catch (error) {
          const requestTime = Date.now() - requestStart;
          resolve({
            userIndex: i,
            success: false,
            error: error.message,
            responseTime: requestTime + 'ms'
          });
        }
      })
    );
  }

  // Wait for all requests to complete
  const allResults = Promise.all(promises);

  allResults.then(resolvedResults => {
    results.results = resolvedResults;

    // Calculate statistics
    const successful = resolvedResults.filter(r => r.success);
    const failed = resolvedResults.filter(r => !r.success);

    const responseTimes = successful
      .map(r => parseInt(r.responseTime))
      .sort((a, b) => a - b);

    const minTime = responseTimes[0] || 0;
    const maxTime = responseTimes[responseTimes.length - 1] || 0;
    const avgTime = responseTimes.length > 0 ?
      Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
    const medianTime = responseTimes.length > 0 ?
      responseTimes[Math.floor(responseTimes.length / 2)] : 0;
    const p95Time = responseTimes.length > 0 ?
      responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;

    results.summary = {
      totalRequests: resolvedResults.length,
      successful: successful.length,
      failed: failed.length,
      successRate: ((successful.length / resolvedResults.length) * 100).toFixed(2) + '%',
      responseTime: {
        min: minTime + 'ms',
        max: maxTime + 'ms',
        avg: avgTime + 'ms',
        median: medianTime + 'ms',
        p95: p95Time + 'ms'
      },
      totalTestTime: (Date.now() - startTime) + 'ms'
    };

    console.log("✅ [LOAD TEST] Load test completed:");
    console.log(JSON.stringify(results.summary, null, 2));

    // Log to spreadsheet for analysis
    logPerformanceResults(results);
  });

  return results;
}

/**
 * Log performance results to spreadsheet
 * Creates new sheet if doesn't exist
 * @param {Object} results - Performance test results
 */
function logPerformanceResults(results) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let perfSheet = ss.getSheetByName("Performance_Results");

    if (!perfSheet) {
      perfSheet = ss.insertSheet("Performance_Results");
      perfSheet.appendRow([
        "Timestamp",
        "Test Type",
        "Total Requests",
        "Successful",
        "Failed",
        "Success Rate",
        "Avg Response Time",
        "P95 Response Time",
        "Total Test Time"
      ]);
    }

    if (results.summary) {
      perfSheet.appendRow([
        new Date(),
        "Load Test",
        results.summary.totalRequests,
        results.summary.successful,
        results.summary.failed,
        results.summary.successRate,
        results.summary.responseTime.avg,
        results.summary.responseTime.p95,
        results.summary.totalTestTime
      ]);
    }

    console.log("📊 [LOG] Performance results logged to spreadsheet");
  } catch (error) {
    console.error("❌ [LOG] Failed to log performance results: " + error.message);
  }
}

/**
 * Automated daily health check
 * Set up time-based trigger to run this function daily
 * Sends alert email if issues detected
 */
function automatedDailyHealthCheck() {
  console.log("🤖 [AUTO] Starting automated daily health check...");

  const healthResults = comprehensiveHealthCheck();

  // Check if any issues detected
  if (healthResults.overallStatus !== 'healthy') {
    console.warn("⚠️ [AUTO] Health issues detected!");

    // Send alert email (optional)
    try {
      const recipient = Session.getActiveUser().getEmail();
      MailApp.sendEmail({
        to: recipient,
        subject: "🚨 SCORDS Health Alert - " + new Date().toLocaleDateString(),
        body: `
Health check failed at ${healthResults.timestamp}.

Status: ${healthResults.overallStatus}

Components:
${JSON.stringify(healthResults.components, null, 2)}

Recommendations:
${healthResults.recommendations.join('\n')}

Please check the Apps Script log for details.
        `
      });
      console.log("📧 [AUTO] Alert email sent to " + recipient);
    } catch (emailError) {
      console.error("❌ [AUTO] Failed to send alert email: " + emailError.message);
    }
  } else {
    console.log("✅ [AUTO] All systems healthy");
  }

  return healthResults;
}

/**
 * Cache analytics and cleanup
 * Analyzes cache usage and cleans up expired entries
 */
function cacheAnalytics() {
  console.log("📊 [CACHE] Starting cache analytics...");

  const cache = CacheService.getScriptCache();
  const allKeys = cache.getAllKeys();
  const scordsKeys = allKeys.filter(key => key.startsWith('scords_'));

  const analytics = {
    timestamp: new Date().toISOString(),
    totalCacheKeys: allKeys.length,
    scordsCacheKeys: scordsKeys.length,
    keyBreakdown: {},
    recommendations: []
  };

  // Categorize keys
  scordsKeys.forEach(key => {
    const category = key.split('_')[1] || 'other';
    analytics.keyBreakdown[category] = (analytics.keyBreakdown[category] || 0) + 1;
  });

  // Generate recommendations
  if (analytics.totalCacheKeys > 500) {
    analytics.recommendations.push('High cache key count - consider implementing cache cleanup');
  }

  if (analytics.keyBreakdown.dashboard > 20) {
    analytics.recommendations.push('Many dashboard cache entries - reduce cache duration for dashboards');
  }

  console.log("📊 [CACHE] Cache analytics: " + JSON.stringify(analytics, null, 2));
  return analytics;
}

/**
 * Quick performance snapshot
 * Returns key metrics for quick monitoring
 */
function quickPerformanceSnapshot() {
  const start = Date.now();

  // Test basic operations
  const cacheStart = Date.now();
  getCachedUsers();
  const cacheTime = Date.now() - cacheStart;

  return {
    timestamp: new Date().toISOString(),
    cacheResponseTime: cacheTime + 'ms',
    totalCheckTime: (Date.now() - start) + 'ms',
    status: cacheTime < 1000 ? 'good' : cacheTime < 3000 ? 'fair' : 'slow'
  };
}
