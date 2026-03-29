/**
 * DatabaseService - Optimized Data Access Layer
 *
 * Purpose: Abstract spreadsheet operations with optimized queries
 * and indexing strategies for high concurrency
 *
 * Features:
 * - O(1) lookups using indexed data
 * - Batch read operations
 * - Memory-efficient data structures
 * - Automatic cache management
 */

/**
 * Optimized user lookup with O(1) complexity
 * @param {string} userId - User ID to find
 * @returns {Object|null} User object or null
 */
function findUserById(userId) {
  const users = getCachedUsers();

  // Create indexed lookup if not exists
  if (!users._indexedById) {
    users._indexedById = {};
    users.forEach(user => {
      users._indexedById[user.UserID] = user;
    });
  }

  const user = users._indexedById[userId];
  return user ? mapUserObject(user) : null;
}

/**
 * Find user by employee ID
 * @param {string} employeeId - Employee ID to find
 * @returns {Object|null} User object or null
 */
function findUserByEmployeeId(employeeId) {
  const users = getCachedUsers();

  // Create indexed lookup if not exists
  if (!users._indexedByEmployeeId) {
    users._indexedByEmployeeId = {};
    users.forEach(user => {
      if (user.EmployeeID) {
        users._indexedByEmployeeId[user.EmployeeID] = user;
      }
    });
  }

  return users._indexedByEmployeeId[employeeId] || null;
}

/**
 * Get all users by group with O(n) pre-filtered by cache
 * @param {string} group - Group name or 'all'
 * @returns {Array<Object>} Array of user objects
 */
function getUsersByGroup(group) {
  const users = getCachedUsers();

  if (group === 'all') {
    return users.map(mapUserObject);
  }

  return users
    .filter(user => user.Group === group)
    .map(mapUserObject);
}

/**
 * Optimized activity lookup
 * @param {string} activityId - Activity ID
 * @returns {Object|null} Activity object or null
 */
function findActivityById(activityId) {
  const activityMap = getCachedActivityMap();
  const activity = activityMap[activityId];

  if (!activity) return null;

  return {
    id: activity.ID,
    name: activity.Name,
    date: activity.Date,
    startTime: activity.StartTime,
    endTime: activity.EndTime,
    qrCode: activity.QRCode,
    latitude: activity.Latitude,
    longitude: activity.Longitude,
    radius: activity.Radius,
    status: activity.Status
  };
}

/**
 * Get active activities for today (optimized)
 * @returns {Array<Object>} Active activities
 */
function getActiveActivitiesForToday() {
  const activities = getCachedActivities();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return activities
    .filter(activity => {
      const activityDate = new Date(activity.Date);
      activityDate.setHours(0, 0, 0, 0);
      return activity.Status === 'Active' && activityDate.getTime() === today.getTime();
    })
    .map(activity => ({
      id: activity.ID,
      name: activity.Name,
      time: `${activity.StartTime} - ${activity.EndTime}`,
      startTime: activity.StartTime,
      endTime: activity.EndTime,
      qrCode: activity.QRCode,
      latitude: activity.Latitude,
      longitude: activity.Longitude,
      radius: activity.Radius
    }));
}

/**
 * Optimized check-in lookup using binary search
 * @param {string} userId - User ID
 * @param {string} activityId - Activity ID
 * @returns {Object|null} Check-in record or null
 */
function findCheckInOptimized(userId, activityId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);

  // Use indexed search if available
  const cacheKey = `checkin_index_${userId}`;
  let checkinIndex = CacheService.getScriptCache().get(cacheKey);

  if (checkinIndex) {
    checkinIndex = JSON.parse(checkinIndex);

    // Check if activity exists in index
    if (checkinIndex[activityId]) {
      return checkinIndex[activityId];
    }
  }

  // Fallback to full sheet scan (expensive, but cached after)
  const data = getSheetData(logSheet);

  for (const row of data) {
    if (row.UserID === userId && row.ActivityID === activityId) {
      // Build index for future lookups
      if (!checkinIndex) checkinIndex = {};
      checkinIndex[activityId] = row;

      try {
        CacheService.getScriptCache().put(cacheKey, JSON.stringify(checkinIndex), 300); // 5 min
      } catch (e) {
        // Index too large, skip caching
      }

      return row;
    }
  }

  return null;
}

/**
 * Batch read check-ins for multiple users (for dashboard)
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Date} startDate - Start date filter
 * @param {Date} endDate - End date filter
 * @returns {Array<Object>} Check-in records
 */
function batchGetCheckIns(userIds, startDate, endDate) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  const data = getSheetData(logSheet);

  // Filter in memory (faster than sheet queries)
  return data.filter(row => {
    if (!userIds.includes(row.UserID)) return false;

    const rowDate = new Date(row.Timestamp);
    return rowDate >= startDate && rowDate <= endDate;
  });
}

/**
 * Get leaderboard with pre-computed scores (optimized)
 * @param {string} days - Time period ('7', '30', 'all')
 * @returns {Array<Object>} Leaderboard entries
 */
function getLeaderboardOptimized(days) {
  const cacheKey = `leaderboard_${days}`;

  return getCached(cacheKey, () => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const users = getCachedUsers();
    const logData = getSheetData(ss.getSheetByName(SHEET_NAMES.LOG));

    // Calculate date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysNum = days === 'all' ? Infinity : parseInt(days);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Count check-ins per user (pre-computed)
    const userCheckIns = {};
    logData.forEach(row => {
      const rowDate = new Date(row.Timestamp);
      if (rowDate >= cutoffDate) {
        if (!userCheckIns[row.UserID]) {
          userCheckIns[row.UserID] = 0;
        }
        userCheckIns[row.UserID]++;
      }
    });

    // Build leaderboard
    const leaderboard = users
      .map(user => ({
        userId: user.UserID,
        name: user.FirstName && user.LastName ?
              `${user.FirstName} ${user.LastName}` : user.DisplayName,
        group: user.Group,
        checkIns: userCheckIns[user.UserID] || 0,
        profilePicture: user.ProfilePicture || null
      }))
      .filter(entry => entry.checkIns > 0)
      .sort((a, b) => b.checkIns - a.checkIns)
      .slice(0, 100); // Limit to top 100

    return leaderboard;
  }, CACHE_DURATIONS.SHORT); // Cache for 5 minutes
}

/**
 * Map raw sheet data to user object
 * @param {Object} rawUser - Raw user data from sheet
 * @returns {Object} Formatted user object
 */
function mapUserObject(rawUser) {
  return {
    userId: rawUser.UserID,
    displayName: rawUser.DisplayName,
    firstName: rawUser.FirstName,
    lastName: rawUser.LastName,
    employeeId: rawUser.EmployeeID,
    position: rawUser.Position,
    name: rawUser.FirstName && rawUser.LastName ?
          `${rawUser.FirstName} ${rawUser.LastName}` : rawUser.DisplayName,
    group: rawUser.Group,
    role: rawUser.Role,
    profilePicture: rawUser.ProfilePicture || null
  };
}

/**
 * Get all unique groups (cached)
 * @returns {Array<string>} Array of group names
 */
function getAllGroups() {
  const users = getCachedUsers();
  const groupsSet = new Set();

  users.forEach(user => {
    if (user.Group) {
      groupsSet.add(user.Group);
    }
  });

  return Array.from(groupsSet).sort();
}

/**
 * Search users by name or employee ID (for admin features)
 * @param {string} query - Search query
 * @returns {Array<Object>} Matching users
 */
function searchUsers(query) {
  const users = getCachedUsers();
  const lowerQuery = query.toLowerCase();

  return users
    .filter(user => {
      const fullName = user.FirstName && user.LastName ?
                      `${user.FirstName} ${user.LastName}`.toLowerCase() : '';
      const displayName = (user.DisplayName || '').toLowerCase();
      const employeeId = (user.EmployeeID || '').toLowerCase();

      return fullName.includes(lowerQuery) ||
             displayName.includes(lowerQuery) ||
             employeeId.includes(lowerQuery);
    })
    .map(mapUserObject)
    .slice(0, 20); // Limit results
}

/**
 * Get user statistics (for analytics)
 * @param {string} userId - User ID
 * @param {number} days - Number of days to analyze
 * @returns {Object} User statistics
 */
function getUserStatistics(userId, days = 30) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logData = getSheetData(ss.getSheetByName(SHEET_NAMES.LOG));
  const activities = getCachedActivities();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Filter check-ins for user
  const userCheckIns = logData.filter(row => {
    const rowDate = new Date(row.Timestamp);
    return row.UserID === userId && rowDate >= cutoffDate;
  });

  // Calculate statistics
  const onTimeCount = userCheckIns.filter(row => row.Status === 'ตรงเวลา').length;
  const lateCount = userCheckIns.filter(row => row.Status === 'สาย').length;
  const totalCount = userCheckIns.length;

  // Calculate on-time percentage
  const onTimePercentage = totalCount > 0 ?
    Math.round((onTimeCount / totalCount) * 100) : 0;

  return {
    period: `${days} days`,
    totalCheckIns: totalCount,
    onTimeCount: onTimeCount,
    lateCount: lateCount,
    onTimePercentage: onTimePercentage,
    averageCheckInsPerDay: totalCount > 0 ? (totalCount / days).toFixed(1) : 0
  };
}
