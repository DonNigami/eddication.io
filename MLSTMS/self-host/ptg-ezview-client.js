#!/usr/bin/env node

/**
 * MLSTMS - PTG eZView Integration Client (Node.js)
 * =================================================
 *
 * ระบบดึงข้อมูล Trips และ Trip Details จาก PTG eZView API
 * สามารถรันเป็น service บน server หรือใช้งานแบบ standalone
 *
 * ขั้นตอนการติดตั้ง:
 * 1. npm install
 * 2. cp .env.example .env
 * 3. แก้ไขค่า config ใน .env
 * 4. npm start
 *
 * หรือรันแบบ service:
 * node ptg-ezview-client.js --daemon
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// ============================================
// CONFIGURATION
// ============================================

class Config {
  constructor() {
    // API Configuration
    this.baseURL = process.env.PTG_BASE_URL || 'http://203.151.215.230:9000/eZViewIntegrationService/web-service/api';
    this.username = process.env.PTG_USERNAME || '';
    this.password = process.env.PTG_PASSWORD || '';

    // Device Info
    this.deviceId = process.env.PTG_DEVICE_ID || 'nodejs-integration';
    this.deviceName = process.env.PTG_DEVICE_NAME || 'Node.js Integration Client';
    this.deviceType = process.env.PTG_DEVICE_TYPE || 'server';
    this.os = process.env.PTG_OS || 'Node.js';

    // Query Parameters
    this.statusId = process.env.PTG_STATUS_ID || '';
    this.startDate = process.env.PTG_START_DATE || '';
    this.endDate = process.env.PTG_END_DATE || '';
    this.limit = parseInt(process.env.PTG_LIMIT || '50');

    // Rate Limiting
    this.rateLimitMs = parseInt(process.env.PTG_RATE_LIMIT_MS || '1000');
    this.fastMode = process.env.PTG_FAST_MODE === 'true';

    // Performance
    this.adaptiveRateLimit = process.env.PTG_ADAPTIVE_RATE_LIMIT !== 'false';
    this.minRateLimitMs = parseInt(process.env.PTG_MIN_RATE_LIMIT_MS || '100');
    this.maxRateLimitMs = parseInt(process.env.PTG_MAX_RATE_LIMIT_MS || '1000');
    this.targetResponseTimeMs = parseInt(process.env.PTG_TARGET_RESPONSE_TIME_MS || '500');
    this.logLevel = process.env.PTG_LOG_LEVEL || 'INFO';

    // Storage
    this.storageType = process.env.PTG_STORAGE_TYPE || 'sqlite'; // sqlite, json
    this.sqlitePath = process.env.PTG_SQLITE_PATH || 'ptg_data.db';
    this.jsonPath = process.env.PTG_JSON_PATH || 'json_output';

    // Schedule
    this.scheduleIntervalMinutes = parseInt(process.env.PTG_SCHEDULE_MINUTES || '60');
    this.daemonMode = false;
  }

  validate() {
    if (!this.username || !this.password) {
      throw new Error('PTG_USERNAME and PTG_PASSWORD must be set');
    }
  }
}

// ============================================
// LOGGER
// ============================================

class Logger {
  constructor(level = 'INFO') {
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.level = this.levels[level] || this.levels.INFO;
  }

  log(level, message, ...args) {
    if (this.levels[level] >= this.level) {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const prefix = {
        DEBUG: '🔍',
        INFO: 'ℹ️',
        WARN: '⚠️',
        ERROR: '❌'
      }[level] || '';

      console.log(`${timestamp} - ${prefix} ${message}`, ...args);
    }
  }

  debug(message, ...args) { this.log('DEBUG', message, ...args); }
  info(message, ...args) { this.log('INFO', message, ...args); }
  warn(message, ...args) { this.log('WARN', message, ...args); }
  error(message, ...args) { this.log('ERROR', message, ...args); }
}

// ============================================
// HTTP CLIENT
// ============================================

class HttpClient {
  constructor(logger) {
    this.logger = logger;
  }

  async request(method, url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: options.headers || {},
        timeout: options.timeout || 30000
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : null;
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: jsonData,
              raw: data
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: null,
              raw: data
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async get(url, headers = {}) {
    return this.request('GET', url, { headers });
  }

  async post(url, body, headers = {}) {
    return this.request('POST', url, {
      headers,
      body
    });
  }
}

// ============================================
// API CLIENT
// ============================================

class PTGeZViewClient {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.httpClient = new HttpClient(logger);
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.currentDelay = config.rateLimitMs / 1000;
  }

  async login() {
    const url = `${this.config.baseURL}/v1/login`;
    const payload = {
      username: this.config.username,
      password: this.config.password,
      deviceInfo: {
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        deviceType: this.config.deviceType,
        os: this.config.os
      }
    };

    try {
      const response = await this.httpClient.post(url, payload, {
        'Content-Type': 'application/json'
      });

      if (response.statusCode !== 200) {
        throw new Error(`Login failed with status ${response.statusCode}: ${JSON.stringify(response.data)}`);
      }

      if (response.data?.data?.accessToken) {
        this.accessToken = response.data.data.accessToken;
        this.refreshToken = response.data.data.refreshToken;
        this.tokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000);
        this.logger.info('✅ Login successful!');
        return true;
      } else {
        throw new Error('Invalid response format: missing accessToken');
      }
    } catch (error) {
      this.logger.error(`❌ Login error: ${error.message}`);
      throw error;
    }
  }

  async ensureAuthenticated() {
    if (!this.accessToken || !this.tokenExpiresAt) {
      return this.login();
    }

    if (new Date() >= this.tokenExpiresAt) {
      return this.login();
    }

    return true;
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      return this.login();
    }

    const url = `${this.config.baseURL}/v1/refresh-token`;
    const payload = { refreshToken: this.refreshToken };

    try {
      const response = await this.httpClient.post(url, payload, {
        'Content-Type': 'application/json'
      });

      if (response.statusCode === 200 && response.data?.data?.accessToken) {
        this.accessToken = response.data.data.accessToken;
        this.refreshToken = response.data.data.refreshToken;
        this.tokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000);
        this.logger.info('✅ Token refreshed!');
        return true;
      } else {
        return this.login();
      }
    } catch (error) {
      this.logger.error(`❌ Refresh token error: ${error.message}`);
      return this.login();
    }
  }

  async adaptiveSleep(responseTime) {
    if (this.config.fastMode || !this.config.adaptiveRateLimit) {
      return;
    }

    const responseTimeMs = responseTime * 1000;

    if (responseTimeMs < this.config.targetResponseTimeMs) {
      this.currentDelay = Math.max(
        this.config.minRateLimitMs / 1000,
        this.currentDelay * 0.9
      );
    } else {
      this.currentDelay = Math.min(
        this.config.maxRateLimitMs / 1000,
        this.currentDelay * 1.1
      );
    }

    this.logger.debug(`⏱️  Sleeping ${this.currentDelay.toFixed(2)}s (response: ${responseTimeMs.toFixed(0)}ms)`);
    await new Promise(resolve => setTimeout(resolve, this.currentDelay * 1000));
  }

  async getTrips(options = {}) {
    await this.ensureAuthenticated();

    const {
      statusId = this.config.statusId,
      startDate = this.config.startDate,
      endDate = this.config.endDate,
      limit = this.config.limit,
      offset = 0
    } = options;

    const url = new URL(`${this.config.baseURL}/v1/trips`);
    if (statusId) url.searchParams.append('statusId', statusId);
    if (startDate) url.searchParams.append('startDate', startDate);
    if (endDate) url.searchParams.append('endDate', endDate);
    if (limit) url.searchParams.append('limit', limit.toString());
    if (offset) url.searchParams.append('offset', offset.toString());

    try {
      const startTime = Date.now();
      const response = await this.httpClient.get(url.toString(), {
        'Authorization': `Bearer ${this.accessToken}`
      });
      const responseTime = (Date.now() - startTime) / 1000;

      if (response.statusCode === 401) {
        await this.refreshAccessToken();
        return this.getTrips(options);
      }

      if (response.statusCode !== 200) {
        throw new Error(`Get trips failed with status ${response.statusCode}: ${JSON.stringify(response.data)}`);
      }

      await this.adaptiveSleep(responseTime);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Get trips error: ${error.message}`);
      throw error;
    }
  }

  async getAllTrips() {
    const allTrips = [];
    let offset = 0;
    const limit = 100;
    let page = 0;

    this.logger.info('🔄 Fetching all trips (paginated)...');

    while (true) {
      page++;
      this.logger.info(`📄 Fetching page ${page}...`);

      const result = await this.getTrips({
        limit,
        offset
      });

      if (!result || !result.data) {
        this.logger.error(`❌ Failed to fetch page ${page}`);
        break;
      }

      const trips = result.data;
      if (trips.length === 0) {
        this.logger.info(`✅ No more trips (total: ${allTrips.length})`);
        break;
      }

      allTrips.push(...trips);
      this.logger.info(`📦 Page ${page}: ${trips.length} trips (total: ${allTrips.length})`);

      if (trips.length < limit) {
        break;
      }

      offset += limit;
    }

    return allTrips;
  }

  async getTripDetails(tripId) {
    await this.ensureAuthenticated();

    const url = `${this.config.baseURL}/v1/trips/${tripId}`;

    try {
      const startTime = Date.now();
      const response = await this.httpClient.get(url, {
        'Authorization': `Bearer ${this.accessToken}`
      });
      const responseTime = (Date.now() - startTime) / 1000;

      if (response.statusCode === 401) {
        await this.refreshAccessToken();
        return this.getTripDetails(tripId);
      }

      if (response.statusCode !== 200) {
        this.logger.warn(`⚠️  Trip ${tripId}: status ${response.statusCode}`);
        return null;
      }

      await this.adaptiveSleep(responseTime);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Get trip details error for ${tripId}: ${error.message}`);
      return null;
    }
  }

  async fetchAllData() {
    const trips = await this.getAllTrips();

    if (!trips || trips.length === 0) {
      return { trips: [], tripDetails: [] };
    }

    this.logger.info(`🔄 Fetching details for ${trips.length} trips...`);

    const tripDetails = [];
    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      const tripId = trip.tripId || trip.id;

      if (!tripId) continue;

      this.logger.info(`📦 [${i + 1}/${trips.length}] Fetching details for trip ${tripId}...`);

      const details = await this.getTripDetails(tripId);
      if (details) {
        tripDetails.push(details);
      }
    }

    this.logger.info(`✅ Fetched ${tripDetails.length} trip details`);

    return { trips, tripDetails };
  }
}

// ============================================
// STORAGE HANDLERS
// ============================================

class JSONStorage {
  constructor(jsonPath, logger) {
    this.jsonPath = jsonPath;
    this.logger = logger;
    fs.mkdirSync(jsonPath, { recursive: true });
  }

  saveTrips(trips) {
    if (!trips || trips.length === 0) return 0;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = path.join(this.jsonPath, `trips_${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(trips, null, 2), 'utf-8');
    this.logger.info(`✅ Saved ${trips.length} trips to ${filename}`);
    return trips.length;
  }

  saveTripDetails(tripDetails) {
    if (!tripDetails || tripDetails.length === 0) return 0;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = path.join(this.jsonPath, `trip_details_${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(tripDetails, null, 2), 'utf-8');
    this.logger.info(`✅ Saved ${tripDetails.length} trip details to ${filename}`);
    return tripDetails.length;
  }
}

// ============================================
// MAIN APPLICATION
// ============================================

class PTGeZViewApp {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.client = new PTGeZViewClient(config, this.logger);
    this.storage = this.initStorage();
    this.running = false;
  }

  initStorage() {
    if (this.config.storageType === 'json') {
      return new JSONStorage(this.config.jsonPath, this.logger);
    }
    // Add more storage types here (PostgreSQL, etc.)
    throw new Error(`Unknown storage type: ${this.config.storageType}`);
  }

  async runOnce() {
    this.logger.info('='.repeat(50));
    this.logger.info('🚀 Starting data fetch...');

    try {
      const { trips, tripDetails } = await this.client.fetchAllData();

      if (trips && trips.length > 0) {
        this.storage.saveTrips(trips);
      }

      if (tripDetails && tripDetails.length > 0) {
        this.storage.saveTripDetails(tripDetails);
      }

      this.logger.info('✅ Data fetch completed!');
      return true;
    } catch (error) {
      this.logger.error(`❌ Error during data fetch: ${error.message}`);
      return false;
    }
  }

  async runScheduled() {
    this.running = true;
    this.logger.info(`🔄 Scheduled mode: running every ${this.config.scheduleIntervalMinutes} minutes`);

    while (this.running) {
      await this.runOnce();

      this.logger.info(`⏳ Next run in ${this.config.scheduleIntervalMinutes} minutes...`);

      // Wait for next interval
      const waitMs = this.config.scheduleIntervalMinutes * 60 * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));

      if (!this.running) break;
    }

    this.logger.info('🛑 Scheduled mode stopped');
  }

  shutdown() {
    this.logger.info('🛑 Shutting down...');
    this.running = false;
  }
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);

  const showHelp = args.includes('--help') || args.includes('-h');
  if (showHelp) {
    console.log(`
PTG eZView API Integration Client
=================================

Usage: node ptg-ezview-client.js [options]

Options:
  --daemon, -d       Run as daemon (scheduled mode)
  --once, -o         Run once and exit
  --help, -h         Show this help message

Environment Variables:
  PTG_BASE_URL          API base URL
  PTG_USERNAME          Username
  PTG_PASSWORD          Password
  PTG_STATUS_ID         Filter by status ID (optional)
  PTG_START_DATE        Start date YYYY-MM-DD (optional)
  PTG_END_DATE          End date YYYY-MM-DD (optional)
  PTG_LIMIT             Limit per page (default: 50)
  PTG_STORAGE_TYPE      Storage type: json (default: json)
  PTG_LOG_LEVEL         Log level: DEBUG, INFO, WARN, ERROR (default: INFO)
  PTG_SCHEDULE_MINUTES  Schedule interval in minutes (default: 60)

Examples:
  # Run once
  node ptg-ezview-client.js --once

  # Run as daemon
  node ptg-ezview-client.js --daemon
    `);
    process.exit(0);
  }

  const config = new Config();

  // Override with CLI args
  if (args.includes('--daemon') || args.includes('-d')) {
    config.daemonMode = true;
  }

  const runOnce = args.includes('--once') || args.includes('-o');

  try {
    config.validate();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    console.error('💡 Set them in .env file or environment variables');
    process.exit(1);
  }

  const app = new PTGeZViewApp(config);

  // Handle shutdown signals
  process.on('SIGINT', () => {
    app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    app.shutdown();
    process.exit(0);
  });

  try {
    if (runOnce || !config.daemonMode) {
      const success = await app.runOnce();
      process.exit(success ? 0 : 1);
    } else {
      await app.runScheduled();
    }
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { PTGeZViewClient, PTGeZViewApp, Config };
