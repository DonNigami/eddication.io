/**
 * MLSTMS - Configuration Management
 *
 * Modernized with ES6+ features
 */

// ============================================
// CONSTANTS
// ============================================

const CONFIG_KEYS = {
  // API Configuration
  BASE_URL: 'BASE_URL',
  DEVICE_ID: 'DEVICE_ID',
  DEVICE_NAME: 'DEVICE_NAME',
  DEVICE_TYPE: 'DEVICE_TYPE',
  OS: 'OS',

  // Authentication
  USERNAME: 'USERNAME',
  PASSWORD: 'PASSWORD',
  ACCESS_TOKEN: 'ACCESS_TOKEN',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  TOKEN_EXPIRES_AT: 'TOKEN_EXPIRES_AT',

  // Query Parameters
  STATUS_ID: 'STATUS_ID',
  START_DATE: 'START_DATE',
  END_DATE: 'END_DATE',
  START_DATETIME: 'START_DATETIME',
  END_DATETIME: 'END_DATETIME',
  LIMIT: 'LIMIT',

  // Sheet Names
  TRIPS_SHEET_NAME: 'TRIPS_SHEET_NAME',
  TRIP_DETAILS_SHEET_NAME: 'TRIP_DETAILS_SHEET_NAME',

  // Performance Settings
  RATE_LIMIT_MS: 'RATE_LIMIT_MS',
  FAST_MODE: 'FAST_MODE',
  ADAPTIVE_RATE_LIMIT: 'ADAPTIVE_RATE_LIMIT',
  MIN_RATE_LIMIT_MS: 'MIN_RATE_LIMIT_MS',
  MAX_RATE_LIMIT_MS: 'MAX_RATE_LIMIT_MS',
  TARGET_RESPONSE_TIME_MS: 'TARGET_RESPONSE_TIME_MS',
  LOG_LEVEL: 'LOG_LEVEL',
  LOG_BATCH_SIZE: 'LOG_BATCH_SIZE',
  OPTIMAL_BATCH_SIZE: 'OPTIMAL_BATCH_SIZE',
  PERFORMANCE_MODE: 'PERFORMANCE_MODE',

  // Batch Processing
  BATCH_STATE_KEY: 'BATCH_PULL_STATE',
};

// Performance presets
const PERFORMANCE_PRESETS = {
  SAFE: {
    rateLimitMs: 2000,
    limit: 30,
    adaptiveRateLimit: false,
    logLevel: 'VERBOSE',
  },
  BALANCED: {
    rateLimitMs: 500,
    limit: 75,
    adaptiveRateLimit: true,
    logLevel: 'NORMAL',
  },
  TURBO: {
    rateLimitMs: 100,
    limit: 150,
    adaptiveRateLimit: true,
    logLevel: 'MINIMAL',
  },
};

// Logging levels
const LOG_LEVELS = {
  MINIMAL: 0,
  NORMAL: 1,
  VERBOSE: 2,
  DEBUG: 3,
};

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
  [CONFIG_KEYS.BASE_URL]: 'http://203.151.215.230:9000/eZViewIntegrationService/web-service/api',

  // Device Info
  [CONFIG_KEYS.DEVICE_ID]: 'google-sheets-integration',
  [CONFIG_KEYS.DEVICE_NAME]: 'Google Sheets Integration',
  [CONFIG_KEYS.DEVICE_TYPE]: 'web',
  [CONFIG_KEYS.OS]: 'Google Apps Script',

  // Sheet Names
  [CONFIG_KEYS.TRIPS_SHEET_NAME]: 'Trips',
  [CONFIG_KEYS.TRIP_DETAILS_SHEET_NAME]: 'TripDetails',

  // Query Parameters
  [CONFIG_KEYS.STATUS_ID]: '',
  [CONFIG_KEYS.START_DATE]: '',
  [CONFIG_KEYS.END_DATE]: '',
  [CONFIG_KEYS.LIMIT]: '50',

  // Rate Limiting
  [CONFIG_KEYS.RATE_LIMIT_MS]: '1000',
  [CONFIG_KEYS.FAST_MODE]: 'false',

  // Performance Optimization
  [CONFIG_KEYS.ADAPTIVE_RATE_LIMIT]: 'true',
  [CONFIG_KEYS.MIN_RATE_LIMIT_MS]: '100',
  [CONFIG_KEYS.MAX_RATE_LIMIT_MS]: '1000',
  [CONFIG_KEYS.TARGET_RESPONSE_TIME_MS]: '500',
  [CONFIG_KEYS.LOG_LEVEL]: 'NORMAL',
  [CONFIG_KEYS.LOG_BATCH_SIZE]: '10',
  [CONFIG_KEYS.OPTIMAL_BATCH_SIZE]: 'auto',
  [CONFIG_KEYS.PERFORMANCE_MODE]: 'BALANCED',
};

// ============================================
// CONFIG MANAGER CLASS
// ============================================

class ConfigManager {
  constructor() {
    this.properties = PropertiesService.getScriptProperties();
  }

  /**
   * Initialize default configuration (run once)
   */
  initialize() {
    this.properties.setProperties(DEFAULT_CONFIG);
    Logger.log('✅ Initial configuration saved!');
    Logger.log('📝 Username is hardcoded as "LPG_Bulk"');
    Logger.log('📝 Default STATUS_ID is empty (pulls ALL statuses)');
    Logger.log('⚡ Performance optimizations enabled');
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = null) {
    return this.properties.getProperty(key) ?? defaultValue;
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   */
  set(key, value) {
    this.properties.setProperty(key, String(value));
  }

  /**
   * Get all configuration as an object
   * @returns {Object} Configuration object
   */
  getAll() {
    const config = {
      // API
      baseUrl: this.get(CONFIG_KEYS.BASE_URL),

      // Authentication (username is hardcoded)
      username: 'LPG_Bulk',
      password: this.get(CONFIG_KEYS.PASSWORD),
      deviceId: this.get(CONFIG_KEYS.DEVICE_ID),
      deviceName: this.get(CONFIG_KEYS.DEVICE_NAME),
      deviceType: this.get(CONFIG_KEYS.DEVICE_TYPE),
      os: this.get(CONFIG_KEYS.OS),

      // Sheets
      tripsSheetName: this.get(CONFIG_KEYS.TRIPS_SHEET_NAME) ?? 'Trips',
      tripDetailsSheetName: this.get(CONFIG_KEYS.TRIP_DETAILS_SHEET_NAME) ?? 'TripDetails',

      // Query Parameters
      statusId: this.get(CONFIG_KEYS.STATUS_ID) ?? '',
      startDate: this.get(CONFIG_KEYS.START_DATE) ?? '',
      endDate: this.get(CONFIG_KEYS.END_DATE) ?? '',
      startDateTime: this.get(CONFIG_KEYS.START_DATETIME) ?? '',
      endDateTime: this.get(CONFIG_KEYS.END_DATETIME) ?? '',
      limit: this.get(CONFIG_KEYS.LIMIT) ?? '50',

      // Performance
      rateLimitMs: parseInt(this.get(CONFIG_KEYS.RATE_LIMIT_MS) ?? '1000'),
      fastMode: this.get(CONFIG_KEYS.FAST_MODE) === 'true',
      adaptiveRateLimit: this.get(CONFIG_KEYS.ADAPTIVE_RATE_LIMIT) === 'true',
      minRateLimitMs: parseInt(this.get(CONFIG_KEYS.MIN_RATE_LIMIT_MS) ?? '100'),
      maxRateLimitMs: parseInt(this.get(CONFIG_KEYS.MAX_RATE_LIMIT_MS) ?? '1000'),
      targetResponseTimeMs: parseInt(this.get(CONFIG_KEYS.TARGET_RESPONSE_TIME_MS) ?? '500'),
      logLevel: this.get(CONFIG_KEYS.LOG_LEVEL) ?? 'NORMAL',
      logBatchSize: parseInt(this.get(CONFIG_KEYS.LOG_BATCH_SIZE) ?? '10'),
      optimalBatchSize: this.get(CONFIG_KEYS.OPTIMAL_BATCH_SIZE) ?? 'auto',
      performanceMode: this.get(CONFIG_KEYS.PERFORMANCE_MODE) ?? 'BALANCED',
    };

    return config;
  }

  /**
   * Apply a performance preset
   * @param {string} mode - 'SAFE', 'BALANCED', or 'TURBO'
   */
  applyPerformancePreset(mode) {
    const preset = PERFORMANCE_PRESETS[mode];

    if (!preset) {
      throw new Error(`Invalid performance mode: ${mode}`);
    }

    const { rateLimitMs, limit, adaptiveRateLimit, logLevel } = preset;

    this.set(CONFIG_KEYS.RATE_LIMIT_MS, rateLimitMs);
    this.set(CONFIG_KEYS.LIMIT, limit);
    this.set(CONFIG_KEYS.ADAPTIVE_RATE_LIMIT, String(adaptiveRateLimit));
    this.set(CONFIG_KEYS.LOG_LEVEL, logLevel);
    this.set(CONFIG_KEYS.PERFORMANCE_MODE, mode);

    Logger.log(`✅ Applied ${mode} performance preset`);
  }

  /**
   * Check if saved credentials exist
   * @returns {boolean}
   */
  hasCredentials() {
    const username = this.get(CONFIG_KEYS.USERNAME);
    const password = this.get(CONFIG_KEYS.PASSWORD);
    return !!(username && password);
  }

  /**
   * Clear all credentials
   */
  clearCredentials() {
    const keysToClear = [
      CONFIG_KEYS.USERNAME,
      CONFIG_KEYS.PASSWORD,
      CONFIG_KEYS.ACCESS_TOKEN,
      CONFIG_KEYS.REFRESH_TOKEN,
      CONFIG_KEYS.TOKEN_EXPIRES_AT,
    ];

    keysToClear.forEach(key => this.properties.deleteProperty(key));

    Logger.log('✅ All credentials cleared');
  }

  /**
   * Save batch processing state
   * @param {Object} state - State object
   */
  saveBatchState(state) {
    this.properties.setProperty(CONFIG_KEYS.BATCH_STATE_KEY, JSON.stringify(state));
    Logger.log(`💾 Batch state saved: offset=${state.offset}, processed=${state.processedCount}/${state.totalCount || '?'}`);
  }

  /**
   * Load batch processing state
   * @returns {Object|null}
   */
  loadBatchState() {
    const stateJson = this.get(CONFIG_KEYS.BATCH_STATE_KEY);
    return stateJson ? JSON.parse(stateJson) : null;
  }

  /**
   * Clear batch processing state
   */
  clearBatchState() {
    this.properties.deleteProperty(CONFIG_KEYS.BATCH_STATE_KEY);
    Logger.log('🗑️ Batch state cleared');
  }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

const configManager = new ConfigManager();

// Backward compatibility functions
function setupConfig() {
  configManager.initialize();
}

function getConfig() {
  return configManager.getAll();
}
