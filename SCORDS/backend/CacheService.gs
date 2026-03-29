/**
 * CacheService - High-Performance Caching Layer
 *
 * Purpose: Reduce spreadsheet operations by caching frequently accessed data
 * Cache Strategy:
 * - SHORT (5 min): Real-time data (check-ins, dashboard)
 * - MEDIUM (30 min): User data, activities
 * - LONG (4 hours): Static config (groups, points rules)
 *
 * Performance Impact: Reduces API calls by ~80% for read-heavy operations
 */

const CACHE_KEYS = {
  USERS: 'scords_users',
  ACTIVITIES: 'scords_activities',
  GROUPS: 'scords_groups',
  ACTIVITY_MAP: 'scords_activity_map',
  DASHBOARD_PREFIX: 'scords_dashboard_',
  USER_INFO_PREFIX: 'scords_user_',
  POINTS_LEADERBOARD: 'scords_points_leaderboard'
};

const CACHE_DURATIONS = {
  SHORT: 5 * 60,      // 5 minutes
  MEDIUM: 30 * 60,    // 30 minutes
  LONG: 4 * 60 * 60   // 4 hours
};

/**
 * Get cached data or fetch from source
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} duration - Cache duration in seconds
 * @returns {*} Cached or fetched data
 */
function getCached(key, fetchFn, duration = CACHE_DURATIONS.MEDIUM) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);

  if (cached !== null) {
    console.log(`📦 [CACHE HIT] ${key}`);
    return JSON.parse(cached);
  }

  console.log(`📥 [CACHE MISS] ${key} - Fetching...`);
  const data = fetchFn();

  if (data !== null && data !== undefined) {
    try {
      cache.put(key, JSON.stringify(data), duration);
      console.log(`✅ [CACHE SET] ${key} (${duration}s)`);
    } catch (e) {
      console.warn(`⚠️ [CACHE FAIL] ${key} - Data too large: ${e.message}`);
    }
  }

  return data;
}

/**
 * Invalidate cache entry
 * @param {string} key - Cache key to invalidate
 */
function invalidateCache(key) {
  const cache = CacheService.getScriptCache();
  cache.remove(key);
  console.log(`🗑️ [CACHE INVALIDATE] ${key}`);
}

/**
 * Invalidate all cache entries matching pattern
 * @param {string} pattern - Pattern to match (prefix)
 */
function invalidateCachePattern(pattern) {
  const cache = CacheService.getScriptCache();
  const allKeys = cache.getAllKeys();

  let invalidated = 0;
  allKeys.forEach(key => {
    if (key.startsWith(pattern)) {
      cache.remove(key);
      invalidated++;
    }
  });

  console.log(`🗑️ [CACHE INVALIDATE] ${pattern}* - ${invalidated} entries`);
}

/**
 * Invalidate all SCORDS cache (call after data updates)
 */
function invalidateAllCache() {
  const cache = CacheService.getScriptCache();
  const allKeys = cache.getAllKeys();

  let invalidated = 0;
  allKeys.forEach(key => {
    if (key.startsWith('scords_')) {
      cache.remove(key);
      invalidated++;
    }
  });

  console.log(`🗑️ [CACHE FLUSH] All SCORDS cache - ${invalidated} entries`);
  return invalidated;
}

/**
 * Get cached users data
 */
function getCachedUsers() {
  return getCached(CACHE_KEYS.USERS, () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
    return getSheetData(sheet);
  }, CACHE_DURATIONS.MEDIUM);
}

/**
 * Get cached activities data
 */
function getCachedActivities() {
  return getCached(CACHE_KEYS.ACTIVITIES, () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.ACTIVITIES);
    return getSheetData(sheet);
  }, CACHE_DURATIONS.MEDIUM);
}

/**
 * Get cached groups data
 */
function getCachedGroups() {
  return getCached(CACHE_KEYS.GROUPS, () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.GROUPS);
    return getSheetData(sheet);
  }, CACHE_DURATIONS.LONG);
}

/**
 * Get cached activity map (ID -> Name lookup)
 */
function getCachedActivityMap() {
  return getCached(CACHE_KEYS.ACTIVITY_MAP, () => {
    const activities = getCachedActivities();
    return activities.reduce((map, act) => {
      map[act.ID] = act;
      return map;
    }, {});
  }, CACHE_DURATIONS.MEDIUM);
}

/**
 * Get cached dashboard data (with group-specific cache)
 */
function getCachedDashboard(group) {
  const cacheKey = CACHE_KEYS.DASHBOARD_PREFIX + group;
  return getCached(cacheKey, () => {
    // Call original getDashboardData without caching
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return getDashboardData(ss, group, false);
  }, CACHE_DURATIONS.SHORT);
}

/**
 * Get cached user info
 */
function getCachedUserInfo(userId) {
  const cacheKey = CACHE_KEYS.USER_INFO_PREFIX + userId;
  return getCached(cacheKey, () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return getUserInfo(ss, userId);
  }, CACHE_DURATIONS.MEDIUM);
}

/**
 * Pre-warm cache for common operations
 * Call this periodically via time-based trigger
 */
function preWarmCache() {
  console.log('🔥 [PRE-WARM] Starting cache pre-warming...');

  // Pre-warm static data
  getCachedUsers();
  getCachedActivities();
  getCachedGroups();
  getCachedActivityMap();

  console.log('✅ [PRE-WARM] Cache pre-warming completed');
}
