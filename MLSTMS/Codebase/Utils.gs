/**
 * MLSTMS - Utility Functions
 *
 * Modernized utility functions with ES6+ features
 */

// ============================================
// LOGGING UTILITIES
// ============================================

/**
 * Smart logging based on configured level
 * @param {string} message - Message to log
 * @param {string} level - Log level ('MINIMAL', 'NORMAL', 'VERBOSE', 'DEBUG')
 */
function smartLog(message, level = 'NORMAL') {
  const config = configManager.getAll();
  const levels = { MINIMAL: 0, NORMAL: 1, VERBOSE: 2, DEBUG: 3 };
  const currentLevel = levels[level] ?? 1;
  const configLevel = levels[config.logLevel] ?? 1;

  if (currentLevel <= configLevel) {
    Logger.log(message);
  }
}

// ============================================
// RATE LIMITING UTILITIES
// ============================================

/**
 * Adaptive sleep based on API response time
 * @param {number} lastResponseTime - Last API response time in ms
 */
function adaptiveSleep(lastResponseTime) {
  const config = configManager.getAll();

  if (config.fastMode) return;

  if (!config.adaptiveRateLimit) {
    Utilities.sleep(config.rateLimitMs);
    return;
  }

  // Adaptive: if API is fast, use minimum delay
  const delay = lastResponseTime < config.targetResponseTimeMs
    ? config.minRateLimitMs
    : config.rateLimitMs;

  Utilities.sleep(delay);
}

/**
 * Calculate optimal batch size
 * @returns {number} Optimal batch size
 */
function calculateOptimalBatchSize() {
  const config = configManager.getAll();
  const TIME_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
  const avgRequestTimeMs = 500;
  const rateLimitMs = config.fastMode
    ? 0
    : (config.adaptiveRateLimit ? config.minRateLimitMs : config.rateLimitMs);
  const totalTimePerTrip = avgRequestTimeMs + rateLimitMs;

  const optimalBatchSize = Math.floor((TIME_LIMIT_MS * 0.8) / totalTimePerTrip);

  return Math.max(20, Math.min(100, optimalBatchSize));
}

// ============================================
// DATA EXTRACTION UTILITIES
// ============================================

/**
 * Get value from object using multiple possible field names
 * @param {Object} obj - Object to extract from
 * @param {string[]} possibleFields - Array of field names to try
 * @returns {*} Extracted value or empty string
 */
function getTripField(obj, possibleFields) {
  if (!obj || typeof obj !== 'object') return '';

  for (const field of possibleFields) {
    // Support nested paths like 'data.trip.id'
    const value = field.split('.').reduce((current, key) => current?.[key], obj);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return '';
}

/**
 * Log all keys in trip object for debugging
 * @param {Object} trip - Trip object
 */
function logTripFields(trip) {
  if (!trip || typeof trip !== 'object') {
    Logger.log('⚠️ Invalid trip object');
    return;
  }

  const keys = Object.keys(trip);
  Logger.log(`🔍 Trip object keys (${keys.length}): ${JSON.stringify(keys)}`);

  // Log important keys
  const importantKeys = [
    'tripId', 'id', 'tripCode', 'tripName', 'name',
    'licenseNo', 'plateNo', 'tripStatus'
  ];

  importantKeys.forEach(key => {
    if (trip[key] !== undefined) {
      const value = trip[key];
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      Logger.log(`   → ${key}: ${valueStr}`);
    }
  });
}

/**
 * Filter trips by openDateTime (client-side filter)
 * @param {Array} trips - Array of trip objects
 * @param {string} startDateTime - Start datetime in ISO format
 * @param {string} endDateTime - End datetime in ISO format
 * @returns {Array} Filtered trips
 */
function filterTripsByOpenDateTime(trips, startDateTime, endDateTime) {
  if (!trips?.length) return trips;

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  smartLog(`🔍 Filtering ${trips.length} trips by openDateTime...`, 'DEBUG');

  const filtered = trips.filter(trip => {
    const openDateTime = getTripField(trip, [
      'openDateTime',
      'tripOpenDateTime',
      'createdAt',
      'created_at'
    ]);

    if (!openDateTime) return false;

    const tripDate = new Date(openDateTime);
    return tripDate >= startDate && tripDate <= endDate;
  });

  smartLog(`✅ Filtered result: ${filtered.length} trips (from ${trips.length})`, 'NORMAL');

  return filtered;
}

// ============================================
// DATE/TIME UTILITIES
// ============================================

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date = new Date()) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Format datetime to ISO format
 * @param {Date} date - Date object
 * @param {string} time - Time string (HH:MM)
 * @returns {string} ISO formatted datetime
 */
function formatDateTime(date = new Date(), time = '00:00') {
  const dateStr = formatDate(date);
  return `${dateStr}T${time}:00`;
}

/**
 * Get today's date string
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function getTodayString() {
  return formatDate();
}

/**
 * Get yesterday's date string
 * @returns {string} Yesterday's date in YYYY-MM-DD format
 */
function getYesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
}

/**
 * Get start of week date string
 * @returns {string} Start of week date in YYYY-MM-DD format
 */
function getStartOfWeekString() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  return formatDate(startOfWeek);
}

// ============================================
// PERFORMANCE UTILITIES
// ============================================

/**
 * Create a delay promise (for async operations)
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Delay promise
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Measure execution time of a function
 * @param {Function} fn - Function to measure
 * @returns {[*, number]} [result, duration in ms]
 */
function measureTime(fn) {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  return [result, duration];
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {*} Function result
 */
function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error;
      const delayTime = baseDelay * Math.pow(2, attempt);
      Logger.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delayTime}ms...`);
      Utilities.sleep(delayTime);
    }
  }

  throw lastError;
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate trip ID
 * @param {*} tripId - Value to validate
 * @returns {boolean} True if valid
 */
function isValidTripId(tripId) {
  return tripId && typeof tripId === 'string' && tripId.trim().length > 0;
}

/**
 * Validate date string
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validate performance mode
 * @param {string} mode - Performance mode to validate
 * @returns {boolean} True if valid
 */
function isValidPerformanceMode(mode) {
  return ['SAFE', 'BALANCED', 'TURBO'].includes(mode?.toUpperCase());
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Truncate string to max length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength, suffix = '...') {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(html) {
  if (!html) return '';

  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// ARRAY UTILITIES
// ============================================

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array[]} Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array based on key
 * @param {Array} array - Array of objects
 * @param {string} key - Key to check for duplicates
 * @returns {Array} Array with duplicates removed
 */
function uniqueBy(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const keyValue = item[key];
    if (seen.has(keyValue)) return false;
    seen.add(keyValue);
    return true;
  });
}

/**
 * Group array by key
 * @param {Array} array - Array of objects
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
    return result;
  }, {});
}

// ============================================
// OBJECT UTILITIES
// ============================================

/**
 * Deep clone object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects (deep merge)
 * @param {Object} target - Target object
 * @param {...Object} sources - Source objects
 * @returns {Object} Merged object
 */
function deepMerge(target, ...sources) {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    });
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is object
 * @param {*} item - Item to check
 * @returns {boolean} True if object
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Pick specific keys from object
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to pick
 * @returns {Object} Object with picked keys
 */
function pick(obj, keys) {
  return keys.reduce((result, key) => {
    if (obj && obj.hasOwnProperty(key)) {
      result[key] = obj[key];
    }
    return result;
  }, {});
}

/**
 * Omit specific keys from object
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to omit
 * @returns {Object} Object without omitted keys
 */
function omit(obj, keys) {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}
