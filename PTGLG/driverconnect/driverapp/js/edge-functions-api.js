// ============================================
// API CLIENT - EDGE FUNCTIONS WRAPPER
// ============================================
// Purpose: Frontend client สำหรับเรียก Supabase Edge Functions
// แทนการเรียก Supabase โดยตรง
// ============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../shared/config.js';

/**
 * API Configuration
 */
const API_CONFIG = {
  baseUrl: `${SUPABASE_URL}/functions/v1`,
  anonKey: SUPABASE_ANON_KEY,
  timeout: 30000, // 30 seconds
};

/**
 * Base API call function
 */
async function callEdgeFunction(functionName, data, options = {}) {
  const {
    timeout = API_CONFIG.timeout,
    retries = 3,
    retryDelay = 1000,
  } = options;

  const url = `${API_CONFIG.baseUrl}/${functionName}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.anonKey}`,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success && result.error) {
      throw new Error(result.error);
    }

    return result;

  } catch (err) {
    clearTimeout(timeoutId);
    
    // Handle timeout
    if (err.name === 'AbortError') {
      throw new Error('Request timeout');
    }

    // Handle network errors with retry
    if (err.message.includes('fetch') || err.message.includes('network')) {
      if (retries > 0) {
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return callEdgeFunction(functionName, data, { 
          ...options, 
          retries: retries - 1,
          retryDelay: retryDelay * 2 // exponential backoff
        });
      }
    }

    throw err;
  }
}

/**
 * API Client Object
 */
const EdgeFunctionsAPI = {
  
  /**
   * Search Job
   * @param {string} reference - Job reference number
   * @param {string} userId - LINE user ID
   * @returns {Promise<Object>} Job data
   */
  async searchJob(reference, userId) {
    console.log('🔍 [API] Searching job:', reference);
    
    try {
      const result = await callEdgeFunction('search-job', {
        reference,
        userId,
      });

      if (result.success) {
        console.log('✅ [API] Job found:', result.data.totalStops, 'stops');
        return { success: true, data: result.data };
      } else {
        return { success: false, message: result.message || 'ค้นหางานไม่สำเร็จ' };
      }
    } catch (err) {
      console.error('❌ [API] Search error:', err);
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการค้นหา' };
    }
  },

  /**
   * Update Stop Status
   * @param {Object} params - Update parameters
   * @returns {Promise<Object>} Updated stop data
   */
  async updateStop(params) {
    const { rowIndex, status, type, userId, lat, lng, odo, receiverName, receiverType, hasPumping, hasTransfer } = params;
    
    console.log(`🔄 [API] Updating stop ${rowIndex}:`, type);
    
    try {
      const result = await callEdgeFunction('update-stop', {
        rowIndex,
        status,
        type,
        userId,
        lat,
        lng,
        odo,
        receiverName,
        receiverType,
        hasPumping,
        hasTransfer,
      });

      if (result.success) {
        console.log('✅ [API] Stop updated successfully');
        return { success: true, message: result.message, stop: result.data.stop };
      } else {
        return { success: false, message: result.message || 'อัปเดตไม่สำเร็จ' };
      }
    } catch (err) {
      console.error('❌ [API] Update stop error:', err);
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการอัปเดต' };
    }
  },

  /**
   * Upload Alcohol Check
   * @param {Object} params - Alcohol check data
   * @returns {Promise<Object>} Result with checked drivers list
   */
  async uploadAlcohol(params) {
    const { reference, driverName, userId, alcoholValue, imageBase64, lat, lng } = params;
    
    console.log('🍺 [API] Uploading alcohol check for:', driverName);
    
    try {
      const result = await callEdgeFunction('upload-alcohol', {
        reference,
        driverName,
        userId,
        alcoholValue,
        imageBase64,
        lat,
        lng,
      });

      if (result.success) {
        console.log('✅ [API] Alcohol check uploaded');
        return { 
          success: true, 
          checkedDrivers: result.data.checkedDrivers,
          imageUrl: result.data.imageUrl 
        };
      } else {
        return { success: false, message: result.message || 'บันทึกไม่สำเร็จ' };
      }
    } catch (err) {
      console.error('❌ [API] Upload alcohol error:', err);
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการบันทึก' };
    }
  },

  /**
   * Close Job
   * @param {Object} params - Close job data
   * @returns {Promise<Object>} Result
   */
  async closeJob(params) {
    const { reference, userId, driverCount, driver1Name, driver2Name, vehicleStatus, vehicleDesc, hillFee, bkkFee, repairFee, isHolidayWork, holidayWorkNotes } = params;

    console.log('📋 [API] Closing job:', reference, 'with drivers:', { driver1Name, driver2Name });

    try {
      const result = await callEdgeFunction('close-job', {
        reference,
        userId,
        driverCount,
        driver1Name,
        driver2Name,
        vehicleStatus,
        vehicleDesc,
        hillFee,
        bkkFee,
        repairFee,
        isHolidayWork,
        holidayWorkNotes,
      });

      if (result.success) {
        console.log('✅ [API] Job closed successfully');
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || 'ปิดงานไม่สำเร็จ' };
      }
    } catch (err) {
      console.error('❌ [API] Close job error:', err);
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการปิดงาน' };
    }
  },

  /**
   * End Trip
   * @param {Object} params - End trip data
   * @returns {Promise<Object>} Result
   */
  async endTrip(params) {
    const { reference, userId, endOdo, endPointName, lat, lng } = params;
    
    console.log('🏁 [API] Ending trip:', reference);
    
    try {
      const result = await callEdgeFunction('end-trip', {
        reference,
        userId,
        endOdo,
        endPointName,
        lat,
        lng,
      });

      if (result.success) {
        console.log('✅ [API] Trip ended successfully');
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || 'จบทริปไม่สำเร็จ' };
      }
    } catch (err) {
      console.error('❌ [API] End trip error:', err);
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการจบทริป' };
    }
  },

};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EdgeFunctionsAPI, API_CONFIG };
}
