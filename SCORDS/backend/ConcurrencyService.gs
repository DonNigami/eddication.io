/**
 * ConcurrencyService - Thread Safety & Batch Operations
 *
 * Purpose: Handle concurrent writes and optimize spreadsheet operations
 * for 100+ simultaneous users
 *
 * Features:
 * - LockService for critical sections
 * - Batch write operations
 * - Retry logic with exponential backoff
 * - Deadlock prevention
 */

const LOCK_TIMEOUT = 30 * 1000; // 30 seconds max lock time
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 100; // 100ms

/**
 * Execute operation with lock protection
 * @param {string} lockKey - Unique lock identifier
 * @param {Function} operation - Function to execute under lock
 * @returns {*} Operation result
 */
function withLock(lockKey, operation) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    console.log(`🔒 [LOCK] Acquiring: ${lockKey}`);

    // Try to acquire lock with timeout
    lockAcquired = lock.tryLock(LOCK_TIMEOUT);

    if (!lockAcquired) {
      throw new Error(`Could not acquire lock for ${lockKey} - Server is busy, please try again`);
    }

    console.log(`✅ [LOCK] Acquired: ${lockKey}`);
    return operation();

  } catch (error) {
    console.error(`❌ [LOCK] Error in ${lockKey}: ${error.message}`);
    throw error;
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
      console.log(`🔓 [LOCK] Released: ${lockKey}`);
    }
  }
}

/**
 * Execute operation with retry logic
 * @param {Function} operation - Function to execute
 * @param {string} operationName - Name for logging
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {*} Operation result
 */
function withRetry(operation, operationName = 'operation', maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [RETRY] ${operationName} - Attempt ${attempt}/${maxRetries}`);
      return operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = error.message.includes('Service invoked too many times') ||
                         error.message.includes('Exception') ||
                         error.message.includes('Lock');

      if (!isRetryable || attempt === maxRetries) {
        console.error(`❌ [RETRY] ${operationName} failed after ${attempt} attempts: ${error.message}`);
        throw error;
      }

      // Exponential backoff
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.warn(`⚠️ [RETRY] ${operationName} failed (${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      Utilities.sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Batch append rows to sheet (more efficient than multiple appendRow)
 * @param {string} sheetName - Sheet name
 * @param {Array<Array>} rows - Array of row arrays to append
 * @returns {Object} Result with success status
 */
function batchAppendRows(sheetName, rows) {
  if (!rows || rows.length === 0) {
    return { success: true, rowsAdded: 0 };
  }

  const lockKey = `batch_append_${sheetName}`;

  return withLock(lockKey, () => {
    return withRetry(() => {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
      }

      // Get current last row
      const lastRow = sheet.getLastRow();
      const startRow = lastRow + 1;

      // Write all rows at once (more efficient than multiple appendRow)
      if (rows.length === 1) {
        sheet.appendRow(rows[0]);
      } else {
        // For multiple rows, use setValues for better performance
        const range = sheet.getRange(startRow, 1, rows.length, rows[0].length);
        range.setValues(rows);
      }

      // Invalidate relevant cache
      if (sheetName === SHEET_NAMES.USERS) {
        invalidateCache(CACHE_KEYS.USERS);
      } else if (sheetName === SHEET_NAMES.ACTIVITIES) {
        invalidateCache(CACHE_KEYS.ACTIVITIES);
      } else if (sheetName === SHEET_NAMES.LOG) {
        invalidateCachePattern(CACHE_KEYS.DASHBOARD_PREFIX);
      } else if (sheetName === SHEET_NAMES.POINTS) {
        invalidateCache(CACHE_KEYS.POINTS_LEADERBOARD);
      }

      console.log(`✅ [BATCH] Added ${rows.length} rows to ${sheetName}`);
      return { success: true, rowsAdded: rows.length };
    }, `batchAppendRows_${sheetName}`);
  });
}

/**
 * Optimized check-in with concurrent write protection
 * @param {Object} data - Check-in data
 * @returns {Object} Result
 */
function concurrentCheckIn(data) {
  const { userId, activityId } = data;
  const lockKey = `checkin_${userId}_${activityId}`;

  return withLock(lockKey, () => {
    // Double-check if already checked in (race condition protection)
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const existing = findCheckInRecord(ss, userId, activityId);

    if (existing) {
      return { success: false, message: "คุณได้เช็คชื่อสำหรับกิจกรรมนี้ไปแล้ว" };
    }

    // Process check-in normally
    return processCheckIn(data);
  });
}

/**
 * Optimized points update with concurrent write protection
 * @param {string} userId - User ID
 * @param {number} points - Points to add
 * @param {string} activity - Activity description
 * @returns {Object} Result
 */
function concurrentPointsUpdate(userId, points, activity) {
  const lockKey = `points_update_${userId}`;

  return withLock(lockKey, () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return addPointsToUser(ss, userId, points, activity);
  });
}

/**
 * Batch user registration for multiple users
 * @param {Array<Object>} users - Array of user registration data
 * @returns {Object} Result with success/failure details
 */
function batchRegisterUsers(users) {
  const results = {
    success: 0,
    failed: 0,
    details: []
  };

  return withLock('batch_register_users', () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);

    users.forEach((userData, index) => {
      try {
        // Check if userId already exists
        if (findRow(userSheet, 'UserID', userData.userId)) {
          results.details.push({
            index: index,
            userId: userData.userId,
            success: false,
            message: "LINE User ID นี้ลงทะเบียนแล้ว"
          });
          results.failed++;
          return;
        }

        // Check if employeeId already exists
        if (findRow(userSheet, 'EmployeeID', userData.employeeId)) {
          results.details.push({
            index: index,
            userId: userData.userId,
            success: false,
            message: "รหัสพนักงานนี้ถูกใช้งานแล้ว"
          });
          results.failed++;
          return;
        }

        // Append user
        userSheet.appendRow([
          userData.userId,
          userData.displayName || '',
          userData.firstName || '',
          userData.lastName || '',
          userData.employeeId || '',
          userData.position || '',
          userData.group || '',
          'user',
          userData.pictureUrl || '',
          new Date()
        ]);

        results.details.push({
          index: index,
          userId: userData.userId,
          success: true,
          message: "ลงทะเบียนสำเร็จ"
        });
        results.success++;

      } catch (error) {
        results.details.push({
          index: index,
          userId: userData.userId || 'unknown',
          success: false,
          message: `Error: ${error.message}`
        });
        results.failed++;
      }
    });

    // Invalidate users cache
    invalidateCache(CACHE_KEYS.USERS);

    return results;
  });
}

/**
 * Get or create distributed counter (for rate limiting, etc.)
 * @param {string} counterKey - Counter key
 * @param {number} increment - Amount to increment
 * @returns {number} Current counter value
 */
function incrementCounter(counterKey, increment = 1) {
  const lockKey = `counter_${counterKey}`;

  return withLock(lockKey, () => {
    const props = PropertiesService.getScriptProperties();
    const current = parseInt(props.getProperty(counterKey) || '0');
    const newValue = current + increment;
    props.setProperty(counterKey, newValue.toString());
    return newValue;
  });
}

/**
 * Check if operation should be rate limited
 * @param {string} operationKey - Operation identifier
 * @param {number} limit - Max operations per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if rate limited
 */
function checkRateLimit(operationKey, limit, windowMs) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();

  // Get current counter data
  const counterData = JSON.parse(props.getProperty(`rate_limit_${operationKey}`) || '{"count":0,"resetTime":0}');

  // Reset if window expired
  if (now > counterData.resetTime) {
    counterData.count = 0;
    counterData.resetTime = now + windowMs;
  }

  // Check limit
  if (counterData.count >= limit) {
    console.warn(`⚠️ [RATE LIMIT] ${operationKey} exceeded limit (${limit})`);
    return true; // Rate limited
  }

  // Increment counter
  counterData.count++;
  props.setProperty(`rate_limit_${operationKey}`, JSON.stringify(counterData));
  return false; // Not rate limited
}
