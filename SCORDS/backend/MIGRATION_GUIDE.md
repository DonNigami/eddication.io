# 🔄 Code.gs Migration Guide

## Overview

This guide shows how to migrate existing `Code.gs` functions to use the new optimized services.

---

## 📋 Migration Checklist

### Phase 1: Add New Files (Day 1)
- [ ] Add `CacheService.gs` to Apps Script project
- [ ] Add `ConcurrencyService.gs` to Apps Script project
- [ ] Add `DatabaseService.gs` to Apps Script project
- [ ] Add `APIHandlers.gs` to Apps Script project
- [ ] Deploy and test `healthCheck` endpoint

### Phase 2: Test Migration (Day 2-3)
- [ ] Migrate `getAllData()` function
- [ ] Test with 5-10 users
- [ ] Monitor cache hit rate
- [ ] Check response times

### Phase 3: Full Migration (Day 4-5)
- [ ] Migrate all API functions
- [ ] Load test with 100 users
- [ ] Set up cache pre-warming trigger
- [ ] Update production webhook URL

---

## 🔧 Function-by-Function Migration

### 1. doGet() Function

**Before:**
```javascript
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getAllData") {
      const userId = e.parameter.userId;
      if (!userId) throw new Error("User ID is required.");
      const days = e.parameter.days || "7";
      return createJsonResponse(getAllData(userId, days));
    }
    // ... other actions
  } catch (error) {
    // ... error handling
  }
}
```

**After:**
```javascript
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getAllData") {
      const userId = e.parameter.userId;
      if (!userId) throw new Error("User ID is required.");
      const days = e.parameter.days || "7";
      return createJsonResponse(getAllDataOptimized(userId, days)); // ✅ Changed
    }

    if (action === "getDashboard") {
      const group = e.parameter.group;
      if (!group) throw new Error("Group is required.");
      return createJsonResponse(getDashboardOptimized(group)); // ✅ Changed
    }

    if (action === "getHistory") {
      const userId = e.parameter.userId;
      const days = e.parameter.days || "7";
      if (!userId) throw new Error("User ID is required.");
      return createJsonResponse({
        success: true,
        data: { history: getHistoryOptimized(userId, days) } // ✅ Changed
      });
    }

    if (action === "getLeaderboard") {
      const days = e.parameter.days || "7";
      return createJsonResponse(getLeaderboardOptimized(days)); // ✅ Changed
    }

    if (action === "getPointsLeaderboard") {
      return createJsonResponse(getPointsLeaderboardOptimized()); // ✅ Changed
    }

    if (action === "getUserPoints") {
      const userId = e.parameter.userId;
      if (!userId) throw new Error("User ID is required.");
      return createJsonResponse(getUserPointsOptimized(userId)); // ✅ Changed
    }

    // ✅ NEW: Health check endpoint
    if (action === "healthCheck") {
      return createJsonResponse(healthCheck());
    }

    // ✅ NEW: System metrics endpoint
    if (action === "getSystemMetrics") {
      return createJsonResponse(getSystemMetrics());
    }

    return createJsonResponse({
      success: true,
      message: "Check-in API is running."
    });

  } catch (error) {
    console.error("doGet Error: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.message
    });
  }
}
```

---

### 2. doPost() Function

**Before:**
```javascript
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    switch (action) {
      case "registerUser":
        return createJsonResponse(registerUser(requestData));
      case "checkIn":
        return createJsonResponse(processCheckIn(requestData));
      case "syncLocalHistory":
        return createJsonResponse(syncLocalHistory(requestData));
      // ... other cases
    }
  } catch (error) {
    // ... error handling
  }
}
```

**After:**
```javascript
function doPost(e) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔴 CRITICAL: Log EVERYTHING from the start
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║ 🔴 doPost() CALLED - WEBHOOK RECEIVED              ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("Timestamp: " + new Date().toISOString());
  console.log("");

  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📥 [doPost] Request received");
    console.log("📥 [doPost] postData exists: " + (e.postData ? "YES" : "NO"));

    if (!e.postData) {
      console.error("❌ [doPost] NO postData found!");
      return createJsonResponse({
        success: false,
        error: "No postData received"
      });
    }

    if (!e.postData.contents) {
      console.error("❌ [doPost] postData exists but NO contents!");
      return createJsonResponse({
        success: false,
        error: "postData has no contents"
      });
    }

    console.log("✅ [doPost] postData.contents found, parsing...");
    const requestData = JSON.parse(e.postData.contents);
    console.log("✅ [doPost] Parsed successfully");
    console.log("");

    // Detect LINE Webhook
    const isLineWebhook = requestData.events || requestData.destination;

    if (isLineWebhook) {
      console.log("📱 [WEBHOOK] LINE Webhook detected!");
      console.log("📱 [WEBHOOK] Number of events: " + (requestData.events ? requestData.events.length : 0));

      const result = handleLineWebhook(requestData);
      return createJsonResponse(result);
    }

    // Handle other requests with 'action' parameter
    const action = requestData.action;
    console.log("🔧 [ACTION] Action: " + (action || "none"));

    switch (action) {
      case "registerUser":
        return createJsonResponse(registerUserOptimized(requestData)); // ✅ Changed
      case "checkIn":
        return createJsonResponse(processCheckInOptimized(requestData)); // ✅ Changed
      case "redeemPointsQR":
        return createJsonResponse(redeemPointsQR(requestData)); // Keep existing
      case "addGamePoints":
        return createJsonResponse(addGamePoints(requestData)); // Keep existing
      case "syncLocalHistory":
        return createJsonResponse(syncLocalHistoryOptimized(requestData)); // ✅ Changed
      case "logQRGeneration":
        return createJsonResponse(logQRGeneration(requestData)); // Keep existing
      case "askAI":
        return createJsonResponse(askAI(requestData)); // Keep existing
      case "lineAIChat":
        return createJsonResponse(handleLineAIChat(requestData)); // Keep existing
      default:
        console.log("⚠️ [ACTION] Unknown or no action specified");
        throw new Error("Invalid action specified: " + action);
    }
  } catch (error) {
    console.error("❌ [doPost] Error: " + error.toString());
    console.error("❌ [doPost] Stack: " + error.stack);
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.message
    });
  }
}
```

---

### 3. getAllData() Function

**Before:**
```javascript
function getAllData(userId, days) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userInfo = getUserInfo(ss, userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activities = getSheetData(ss.getSheetByName(SHEET_NAMES.ACTIVITIES))
    .filter(activity => {
      const activityDate = new Date(activity.Date);
      activityDate.setHours(0, 0, 0, 0);
      return activity.Status === 'Active' && activityDate.getTime() === today.getTime();
    })
    .map(activity => {
      const checkInRecord = findCheckInRecord(ss, userId, activity.ID);
      return {
        id: activity.ID,
        name: activity.Name,
        time: `${activity.StartTime} - ${activity.EndTime}`,
        checkedIn: !!checkInRecord,
        status: checkInRecord ? checkInRecord.Status : null
      };
    });

  return {
    success: true,
    data: {
      userInfo: userInfo,
      activities: activities,
      history: getHistory(ss, userId, days),
      dashboardData: getDashboardData(ss, userInfo ? userInfo.group : 'all', false),
      groups: getGroups(ss)
    }
  };
}
```

**After:**
```javascript
function getAllData(userId, days) {
  // Simply delegate to optimized version
  return getAllDataOptimized(userId, days);
}

// ✅ NEW: Optimized implementation is in APIHandlers.gs
// No need to repeat code here - better separation of concerns
```

---

## 🧪 Testing After Migration

### Test 1: Health Check
```javascript
// In Apps Script Editor
function test_healthCheck() {
  const result = healthCheck();
  console.log(result);
  // Expected: { success: true, status: "healthy", ... }
}
```

### Test 2: Cache Performance
```javascript
function test_cachePerformance() {
  const userId = "YOUR_TEST_USER_ID";

  // First call - cache miss (slower)
  const start1 = Date.now();
  getAllDataOptimized(userId, "7");
  const time1 = Date.now() - start1;
  console.log(`First call: ${time1}ms (cache miss)`);

  // Second call - cache hit (faster)
  const start2 = Date.now();
  getAllDataOptimized(userId, "7");
  const time2 = Date.now() - start2;
  console.log(`Second call: ${time2}ms (cache hit)`);

  console.log(`Speedup: ${(time1/time2).toFixed(2)}x`);
}
```

### Test 3: Concurrent Check-ins
```javascript
function test_concurrentCheckIns() {
  const activityId = "YOUR_ACTIVITY_ID";
  const numUsers = 10;

  const promises = [];
  for (let i = 0; i < numUsers; i++) {
    const userId = `test_user_${i}`;
    promises.push(
      new Promise((resolve) => {
        const result = processCheckInOptimized({
          userId: userId,
          displayName: `Test User ${i}`,
          activityId: activityId,
          qrCode: "YOUR_QR_CODE",
          timestamp: new Date().toISOString(),
          latitude: 13.7563,
          longitude: 100.5018
        });
        resolve(result);
      })
    );
  }

  const results = Promise.all(promises);
  console.log(`Processed ${numUsers} concurrent check-ins`);
  return results;
}
```

---

## 📊 Performance Monitoring

### Add Monitoring Function

```javascript
/**
 * Monitor system performance over time
 * Results stored in Google Sheets for analysis
 */
function monitorPerformance() {
  const startTime = Date.now();

  // Test health check
  const healthResult = healthCheck();
  const healthTime = Date.now() - startTime;

  // Test cache hit
  const cacheStart = Date.now();
  getCachedUsers();
  const cacheTime = Date.now() - cacheStart;

  // Log to spreadsheet (create new sheet if needed)
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let monitorSheet = ss.getSheetByName("Performance_Monitor");

  if (!monitorSheet) {
    monitorSheet = ss.insertSheet("Performance_Monitor");
    monitorSheet.appendRow(["Timestamp", "HealthCheck(ms)", "CacheHit(ms)", "Status"]);
  }

  monitorSheet.appendRow([
    new Date(),
    healthTime,
    cacheTime,
    healthResult.status
  ]);

  console.log(`Performance: Health=${healthTime}ms, Cache=${cacheTime}ms`);
}
```

---

## 🚨 Rollback Procedure

If issues occur after migration:

### Option 1: Function-level Rollback
```javascript
// Temporary revert specific function
function getAllData(userId, days) {
  // Comment out optimized version
  // return getAllDataOptimized(userId, days);

  // Use original implementation (keep backup in code)
  // ... original code here ...
}
```

### Option 2: Complete Rollback
1. Go to Apps Script **Deployments**
2. Select previous version from version history
3. Click **Deploy**
4. Update webhook URLs to old deployment URL

---

## ✅ Validation Checklist

After migration, verify:

- [ ] Health check returns `"status": "healthy"`
- [ ] All existing tests pass
- [ ] Load test shows improved response times
- [ ] No increase in error rate
- [ ] Cache hit rate > 70%
- [ ] No race conditions in concurrent operations
- [ ] All API endpoints return correct data
- [ ] LINE webhook still works

---

**Next Steps:**
1. Complete Phase 1 (Add new files)
2. Test thoroughly with small user group
3. Gradually migrate to Phase 3 (Full migration)
4. Monitor metrics for 1 week before removing old code

---

**Questions?** Refer to [README.md](README.md) for architecture details.
