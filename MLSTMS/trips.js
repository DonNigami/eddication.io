/**
 * MLSTMS - PTG eZView API Client (Node.js)
 *
 * สคริปต์สำหรับดึงข้อมูล Trips และ Trip Details จาก PTG eZView API
 * ใช้งานได้กับ Node.js
 *
 * การติดตั้ง:
 * npm install axios
 *
 * การใช้งาน:
 * node trips.js
 */

const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // API Base URL
  BASE_URL: 'http://203.151.215.230:9000/eZViewIntegrationService/web-service/api',

  // Login Credentials
  USERNAME: 'your_username',
  PASSWORD: 'your_password',

  // Device Info
  DEVICE_ID: 'nodejs-client',
  DEVICE_NAME: 'Node.js Integration',
  DEVICE_TYPE: 'server',
  OS: 'Node.js',

  // Query Parameters
  STATUS_ID: '4',          // สถานะ trip (ว่างเปล่า = ทั้งหมด)
  START_DATE: '',          // รูปแบบ: YYYY-MM-DD
  END_DATE: '',            // รูปแบบ: YYYY-MM-DD
  LIMIT: '50',             // จำนวน trips ต่อครั้ง

  // Rate Limiting (ไม่เกิน 5 รอบต่อนาที)
  REQUEST_DELAY: 12000,    // 12,000 milliseconds = 12 วินาที (60/5 = 12)
};

// ============================================
// API CLIENT
// ============================================

class PTGClient {
  constructor(config) {
    this.config = config;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;

    this.api = axios.create({
      baseURL: config.BASE_URL,
      timeout: 30000,
    });
  }

  /**
   * Login และรับ Access Token
   */
  async login() {
    try {
      const response = await this.api.post('/v1/login', {
        username: this.config.USERNAME,
        password: this.config.PASSWORD,
        deviceInfo: {
          deviceId: this.config.DEVICE_ID,
          deviceName: this.config.DEVICE_NAME,
          deviceType: this.config.DEVICE_TYPE,
          os: this.config.OS
        }
      });

      if (response.data && response.data.data) {
        const { accessToken, refreshToken } = response.data.data;

        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiresAt = Date.now() + (55 * 60 * 1000); // 55 minutes

        console.log('✅ Login successful!');
        return accessToken;
      }

      throw new Error('Invalid login response');
    } catch (error) {
      console.error('❌ Login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * รีเฟรช Access Token
   */
  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.api.post('/v1/refresh-token', {
        refreshToken: this.refreshToken
      });

      if (response.data && response.data.data) {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        this.accessToken = accessToken;
        this.refreshToken = newRefreshToken;
        this.tokenExpiresAt = Date.now() + (55 * 60 * 1000);

        console.log('✅ Token refreshed!');
        return accessToken;
      }

      throw new Error('Invalid refresh response');
    } catch (error) {
      console.error('❌ Refresh token failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * ดึง Access Token ที่ใช้งานได้
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (this.refreshToken) {
      return await this.refreshToken();
    }

    return await this.login();
  }

  /**
   * สร้าง request พร้อม Authorization header
   */
  async authenticatedRequest(method, url, data = null) {
    const token = await this.getAccessToken();

    try {
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await this.api.request(config);
      return response.data;
    } catch (error) {
      // ถ้า Token หมดอายุ ลองรีเฟรชแล้วลองใหม่
      if (error.response?.status === 401) {
        console.log('⚠️ Token expired, refreshing...');
        await this.refreshToken();

        const retryConfig = {
          method,
          url,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        };

        if (data) {
          retryConfig.data = data;
        }

        const retryResponse = await this.api.request(retryConfig);
        return retryResponse.data;
      }

      throw error;
    }
  }

  /**
   * ดึงรายการ Trips
   */
  async getTrips() {
    try {
      const params = new URLSearchParams();

      if (this.config.STATUS_ID) params.append('statusId', this.config.STATUS_ID);
      if (this.config.START_DATE) params.append('startDate', this.config.START_DATE);
      if (this.config.END_DATE) params.append('endDate', this.config.END_DATE);
      if (this.config.LIMIT) params.append('limit', this.config.LIMIT);

      const url = `/v1/trips${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.authenticatedRequest('GET', url);

      console.log(`✅ Fetched trips`);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch trips:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * ดึง Trip Details ตาม Trip ID
   */
  async getTripDetails(tripId) {
    try {
      const response = await this.authenticatedRequest('GET', `/v1/trips/${tripId}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to fetch trip ${tripId}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * ดึง Trip Details ทั้งหมด (พร้อม waypoints)
   */
  async getAllTripDetails(trips) {
    const results = [];
    let processed = 0;
    const total = trips.length;

    console.log(`📋 Fetching ${total} trip details...`);

    for (const trip of trips) {
      const tripId = trip.id;

      if (!tripId) {
        console.log('⚠️ Skipping trip without ID');
        continue;
      }

      processed++;
      process.stdout.write(`\r⏳ Processing: ${processed}/${total} (${Math.round((processed / total) * 100)}%)`);

      const detail = await this.getTripDetails(tripId);

      if (detail) {
        results.push(detail);
      }

      // Rate limiting (ไม่เกิน 5 รอบต่อนาที)
      if (processed < total) {
        await this.delay(this.config.REQUEST_DELAY); // 12 วินาที
      }
    }

    console.log(); // New line after progress
    return results;
  }

  /**
   * ดึง Waypoints ทั้งหมด
   */
  async getWaypoints(categoryId = null) {
    try {
      let url = '/v1/waypoints';

      if (categoryId) {
        url += `?categoryId=${categoryId}`;
      }

      const response = await this.authenticatedRequest('GET', url);
      console.log('✅ Fetched waypoints');
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch waypoints:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * สร้าง Trips แบบ Bulk
   */
  async createTripsBulk(trips) {
    try {
      const response = await this.authenticatedRequest('POST', '/v1/trips/bulk', {
        trips
      });

      console.log(`✅ Created ${trips.length} trips`);
      return response;
    } catch (error) {
      console.error('❌ Failed to create trips:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * อัปเดต Trip
   */
  async updateTrip(tripId, tripData) {
    try {
      const response = await this.authenticatedRequest('PUT', `/v1/trips/${tripId}`, tripData);
      console.log(`✅ Updated trip ${tripId}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to update trip ${tripId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.authenticatedRequest('POST', '/v1/logout');
      console.log('✅ Logged out');

      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiresAt = null;
    } catch (error) {
      console.error('❌ Logout failed:', error.response?.data || error.message);
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ทดสอบการเชื่อมต่อ
   */
  async testConnection() {
    try {
      console.log('🔍 Testing connection...');
      await this.login();
      console.log('✅ Connection successful!');
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
  }
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * ฟังก์ชันหลัก: ดึงข้อมูล Trips และ TripDetails
 */
async function pullTripsData() {
  const client = new PTGClient(CONFIG);

  try {
    console.log('🚀 Starting to pull trips data...\n');

    // 1. Login
    await client.login();

    // 2. ดึงรายการ Trips
    console.log('📋 Fetching trips list...');
    const tripsResponse = await client.getTrips();

    let trips = [];
    if (tripsResponse?.data?.trips) {
      trips = tripsResponse.data.trips;
    } else if (Array.isArray(tripsResponse)) {
      trips = tripsResponse;
    }

    console.log(`Found ${trips.length} trips\n`);

    if (trips.length === 0) {
      console.log('⚠️ No trips found');
      return;
    }

    // 3. ดึง Trip Details แต่ละ trip
    const tripDetails = await client.getAllTripDetails(trips);

    console.log(`✅ Completed! ${tripDetails.length} trip details fetched\n`);

    // 4. แสดงผล
    console.log('📊 Summary:');
    console.log(`- Total Trips: ${trips.length}`);
    console.log(`- Trip Details: ${tripDetails.length}`);

    // 5. บันทึกเป็น JSON file
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    fs.writeFileSync(
      `trips-${timestamp}.json`,
      JSON.stringify({ trips, tripDetails }, null, 2)
    );

    fs.writeFileSync(
      `trips-${timestamp}.csv`,
      convertToCSV(trips)
    );

    console.log(`\n💾 Saved to:`);
    console.log(`  - trips-${timestamp}.json`);
    console.log(`  - trips-${timestamp}.csv`);

    return { trips, tripDetails };
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.logout();
  }
}

/**
 * แปลงข้อมูลเป็น CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * ดึง Trip เดี่ยว
 */
async function pullSingleTrip(tripId) {
  const client = new PTGClient(CONFIG);

  try {
    console.log(`🚀 Pulling single trip: ${tripId}\n`);

    await client.login();

    const detail = await client.getTripDetails(tripId);

    if (detail) {
      console.log('✅ Trip details fetched:');
      console.log(JSON.stringify(detail, null, 2));

      const fs = require('fs');
      fs.writeFileSync(
        `trip-${tripId}.json`,
        JSON.stringify(detail, null, 2)
      );

      console.log(`\n💾 Saved to trip-${tripId}.json`);
    }

    return detail;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.logout();
  }
}

// ============================================
// CLI
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'test':
      const client = new PTGClient(CONFIG);
      client.testConnection()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    case 'single':
      const tripId = args[1];
      if (!tripId) {
        console.error('Usage: node trips.js single <tripId>');
        process.exit(1);
      }
      pullSingleTrip(tripId)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    case 'pull':
    default:
      pullTripsData()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  PTGClient,
  pullTripsData,
  pullSingleTrip,
  convertToCSV
};
