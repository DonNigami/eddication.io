/**
 * MLSTMS - API Client
 *
 * Modernized API client with ES6+ features
 */

// ============================================
// API CLIENT CLASS
// ============================================

class ApiClient {
  constructor(configManager) {
    this.configManager = configManager;
    this.config = configManager.getAll();
  }

  /**
   * Refresh configuration
   */
  refreshConfig() {
    this.config = this.configManager.getAll();
  }

  /**
   * Login and get access token
   * @returns {string} Access token
   */
  login() {
    const { baseUrl, username, password, deviceId, deviceName, deviceType, os } = this.config;
    const url = `${baseUrl}/v1/login`;

    const payload = {
      username,
      password,
      deviceInfo: {
        deviceId,
        deviceName,
        deviceType,
        os,
      },
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode !== 200) {
        throw new Error(`Login failed with status ${responseCode}: ${responseBody}`);
      }

      const result = JSON.parse(responseBody);

      if (!result?.data?.accessToken) {
        throw new Error('Invalid response format: missing accessToken');
      }

      // Save tokens
      const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();

      this.configManager.set('ACCESS_TOKEN', result.data.accessToken);
      this.configManager.set('REFRESH_TOKEN', result.data.refreshToken);
      this.configManager.set('TOKEN_EXPIRES_AT', expiresAt);

      Logger.log('✅ Login successful!');
      return result.data.accessToken;
    } catch (error) {
      Logger.log(`❌ Login error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get access token (with auto-refresh)
   * @returns {string} Access token
   */
  getAccessToken() {
    const expiresAt = this.configManager.get('TOKEN_EXPIRES_AT');

    if (expiresAt && new Date(expiresAt) > new Date()) {
      const token = this.configManager.get('ACCESS_TOKEN');
      if (token) return token;
    }

    return this.login();
  }

  /**
   * Refresh access token
   * @returns {string} New access token
   */
  refreshToken() {
    const { baseUrl } = this.config;
    const currentRefreshToken = this.configManager.get('REFRESH_TOKEN');

    if (!currentRefreshToken) {
      throw new Error('No refresh token available. Please login again.');
    }

    const url = `${baseUrl}/v1/refresh-token`;
    const payload = { refreshToken: currentRefreshToken };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode !== 200) {
        throw new Error(`Refresh token failed with status ${responseCode}: ${responseBody}`);
      }

      const result = JSON.parse(responseBody);

      if (!result?.data?.accessToken) {
        throw new Error('Invalid response format: missing accessToken');
      }

      const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();

      this.configManager.set('ACCESS_TOKEN', result.data.accessToken);
      this.configManager.set('REFRESH_TOKEN', result.data.refreshToken);
      this.configManager.set('TOKEN_EXPIRES_AT', expiresAt);

      Logger.log('✅ Token refreshed successfully!');
      return result.data.accessToken;
    } catch (error) {
      Logger.log(`❌ Refresh token error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Object} Response data
   */
  request(endpoint, options = {}) {
    const token = this.getAccessToken();
    const { baseUrl } = this.config;
    const url = `${baseUrl}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      muteHttpExceptions: true,
      ...options,
    };

    try {
      let response = UrlFetchApp.fetch(url, defaultOptions);
      let responseCode = response.getResponseCode();

      // Try refresh on 401
      if (responseCode === 401) {
        const newToken = this.refreshToken();
        defaultOptions.headers.Authorization = `Bearer ${newToken}`;
        response = UrlFetchApp.fetch(url, defaultOptions);
        responseCode = response.getResponseCode();
      }

      if (responseCode !== 200) {
        const responseBody = response.getContentText();
        throw new Error(`Request failed with status ${responseCode}: ${responseBody}`);
      }

      return JSON.parse(response.getContentText());
    } catch (error) {
      Logger.log(`❌ API request error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get trips list
   * @param {Object} params - Query parameters
   * @returns {Object} Trips response
   */
  getTrips(params = {}) {
    const {
      statusId = this.config.statusId,
      startDate = this.config.startDate,
      endDate = this.config.endDate,
      limit = this.config.limit,
    } = params;

    const queryParams = new URLSearchParams();

    if (statusId) queryParams.append('statusId', statusId);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (limit) queryParams.append('limit', limit);

    const endpoint = `/v1/trips${queryParams.toString() ? `?${queryParams}` : ''}`;

    return this.request(endpoint, { method: 'get' });
  }

  /**
   * Get trips with pagination
   * @param {number} offset - Pagination offset
   * @param {number} limit - Number of results
   * @returns {Object} Paginated trips response
   */
  getTripsPaginated(offset = 0, limit = 50) {
    const {
      baseUrl,
      statusId,
      startDate,
      endDate,
      startDateTime,
      endDateTime,
    } = this.config;

    const queryParams = new URLSearchParams();

    if (statusId) queryParams.append('statusId', statusId);

    // Use datetime filter if available, otherwise use date filter
    if (startDateTime && endDateTime) {
      queryParams.append('openDateTimeStart', startDateTime);
      queryParams.append('openDateTimeEnd', endDateTime);
      Logger.log(`📅 Filtering by openDateTime: ${startDateTime} to ${endDateTime}`);
    } else {
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
    }

    queryParams.append('limit', limit);
    queryParams.append('offset', offset);

    const endpoint = `/v1/trips?${queryParams.toString()}`;

    return this.request(endpoint, { method: 'get' });
  }

  /**
   * Get trip details by ID
   * @param {string} tripId - Trip ID
   * @returns {Object|null} Trip details
   */
  getTripDetails(tripId) {
    try {
      Logger.log(`   → Fetching: /v1/trips/${tripId}`);

      const result = this.request(`/v1/trips/${tripId}`, { method: 'get' });

      Logger.log(`   ← Response received successfully`);
      Logger.log(`   ✅ Parsed response type: ${typeof result}, keys: ${Object.keys(result).join(', ')}`);

      return result;
    } catch (error) {
      Logger.log(`   ❌ Get trip details error for trip ${tripId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Test API connection
   * @returns {boolean} Connection status
   */
  testConnection() {
    try {
      const token = this.login();

      if (token) {
        Logger.log('✅ API connection successful!');
        Logger.log(`Access Token: ${token.substring(0, 20)}...`);
        return true;
      }

      return false;
    } catch (error) {
      Logger.log(`❌ Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Benchmark API response time
   * @returns {Object} Benchmark results
   */
  benchmark() {
    const startTime = Date.now();
    this.getTripsPaginated(0, 1);
    const responseTime = Date.now() - startTime;

    let recommendedRateLimit;
    let performanceMode;

    if (responseTime < 200) {
      recommendedRateLimit = 200;
      performanceMode = 'TURBO';
    } else if (responseTime < 500) {
      recommendedRateLimit = 500;
      performanceMode = 'BALANCED';
    } else {
      recommendedRateLimit = 1000;
      performanceMode = 'SAFE';
    }

    this.configManager.set('RATE_LIMIT_MS', String(recommendedRateLimit));
    this.configManager.set('PERFORMANCE_MODE', performanceMode);
    this.refreshConfig();

    return {
      responseTime,
      recommendedRateLimit,
      performanceMode,
    };
  }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

const apiClient = new ApiClient(configManager);

// Backward compatibility functions
function login() {
  return apiClient.login();
}

function getAccessToken() {
  return apiClient.getAccessToken();
}

function refreshToken() {
  return apiClient.refreshToken();
}

function getTrips() {
  return apiClient.getTrips();
}

function getTripsPaginated(offset, limit) {
  return apiClient.getTripsPaginated(offset, limit);
}

function getTripDetails(tripId) {
  return apiClient.getTripDetails(tripId);
}

function getTripById(tripId) {
  return apiClient.getTripDetails(tripId);
}

function testConnection() {
  return apiClient.testConnection();
}
