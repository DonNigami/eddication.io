/**
 * Enhanced Offline Queue Manager for DriverConnect
 * Handles actions when offline and syncs when connection restored
 *
 * Optimized for Supabase Free Plan
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  window.CONFIG.SUPABASE_URL,
  window.CONFIG.SUPABASE_KEY
);

/**
 * Offline Queue Manager
 */
class OfflineQueueManager {
  constructor() {
    this.queue = [];
    this.syncInProgress = false;
    this.syncFailedCount = 0;

    this.init();
  }

  /**
   * Initialize Queue Manager
   */
  async init() {
    console.log('📦 Initializing Offline Queue Manager...');

    // Load queue from localStorage
    this.loadQueueFromStorage();

    // Setup online/offline listeners
    this.setupConnectionListeners();

    // Setup periodic sync
    this.setupPeriodicSync();

    // Try to sync immediately if online
    if (navigator.onLine) {
      setTimeout(() => this.sync(), 1000);
    }

    this.updateQueueBadge();
    console.log('✅ Offline Queue Manager initialized');
  }

  /**
   * Load Queue from Storage
   */
  loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('offlineQueue');
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📦 Loaded ${this.queue.length} queued actions`);
      }
    } catch (error) {
      console.error('❌ Failed to load queue from storage:', error);
      this.queue = [];
    }
  }

  /**
   * Save Queue to Storage
   */
  async saveQueueToStorage() {
    try {
      localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('❌ Failed to save queue to storage:', error);
    }
  }

  /**
   * Setup Connection Listeners
   */
  setupConnectionListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored');
      showNotification('🌐 อินเทอร์เน็ตเชื่อมต่อแล้ว กำลังซิงค์ข้อมูล...', 'info');
      this.sync();
    });

    window.addEventListener('offline', () => {
      console.log('📵 Connection lost');
      showNotification('📵 ไม่มีสัญญาณอินเทอร์เน็ต บันทึกงานลงคิวแล้ว', 'warning');
      this.showOfflineBar();
    });
  }

  /**
   * Setup Periodic Sync
   */
  setupPeriodicSync() {
    // Sync every 30 seconds when online
    setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.sync();
      }
    }, 30000);
  }

  /**
   * Add Action to Queue
   */
  async enqueue(action) {
    const queuedAction = {
      id: this.generateId(),
      type: action.type,
      payload: action.payload,
      timestamp: new Date().toISOString(),
      retries: 0,
      maxRetries: 3,
      priority: action.priority || 'normal'
    };

    // Insert based on priority
    if (queuedAction.priority === 'critical') {
      this.queue.unshift(queuedAction);
    } else {
      this.queue.push(queuedAction);
    }

    await this.saveQueueToStorage();
    this.updateQueueBadge();

    console.log(`📦 Enqueued action: ${queuedAction.type} (${queuedAction.id})`);

    // Try to sync immediately if online
    if (navigator.onLine && !this.syncInProgress) {
      await this.sync();
    }

    return queuedAction.id;
  }

  /**
   * Sync Queue with Server
   */
  async sync() {
    if (this.syncInProgress || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.showSyncingBar(true);

    console.log(`🔄 Syncing ${this.queue.length} queued actions...`);

    const synced = [];
    const failed = [];

    for (const action of this.queue) {
      try {
        await this.executeAction(action);
        synced.push(action.id);
        console.log(`✅ Synced: ${action.type} (${action.id})`);
      } catch (error) {
        console.error(`❌ Failed to sync ${action.type}:`, error);

        action.retries++;

        if (action.retries >= action.maxRetries) {
          failed.push(action);
          console.error(`💀 Max retries exceeded for ${action.id}`);
        } else {
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, action.retries) * 1000);
        }
      }
    }

    // Remove synced actions from queue
    this.queue = this.queue.filter(action =>
      !synced.includes(action.id) && !failed.includes(action)
    );

    await this.saveQueueToStorage();
    this.updateQueueBadge();

    this.syncInProgress = false;
    this.showSyncingBar(false);

    if (synced.length > 0) {
      showNotification(`✅ ซิงค์สำเร็จ ${synced.length} รายการ`, 'success');
    }

    if (failed.length > 0) {
      this.syncFailedCount++;
      showNotification(
        `⚠️  ${failed.length} รายการซิงค์ไม่สำเร็จ (ลองใหม่อีกครั้ง)`,
        'warning'
      );

      // Store failed actions separately
      this.saveFailedActions(failed);
    }
  }

  /**
   * Execute Queued Action
   */
  async executeAction(action) {
    switch (action.type) {
      case 'check_in':
        return await this.executeCheckIn(action.payload);

      case 'check_out':
        return await this.executeCheckOut(action.payload);

      case 'location_update':
        return await this.executeLocationUpdate(action.payload);

      case 'photo_upload':
        return await this.executePhotoUpload(action.payload);

      case 'alcohol_test':
        return await this.executeAlcoholTest(action.payload);

      case 'profile_update':
        return await this.executeProfileUpdate(action.payload);

      case 'emergency':
        return await this.executeEmergency(action.payload);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute Check-In
   */
  async executeCheckIn(payload) {
    const { data, error } = await supabase
      .from('driver_logs')
      .insert({
        reference: payload.reference,
        driver_liff_id: payload.driverLiffId,
        action: 'check_in',
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        timestamp: payload.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Execute Check-Out
   */
  async executeCheckOut(payload) {
    const { data, error } = await supabase
      .from('driver_logs')
      .insert({
        reference: payload.reference,
        driver_liff_id: payload.driverLiffId,
        action: 'check_out',
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        timestamp: payload.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Execute Location Update
   */
  async executeLocationUpdate(payload) {
    const { data, error } = await supabase
      .from('driver_locations')
      .upsert({
        driver_id: payload.driverId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        speed: payload.speed,
        battery: payload.battery,
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Execute Photo Upload
   */
  async executePhotoUpload(payload) {
    // Upload to Supabase Storage
    const fileName = `${payload.jobId}_${payload.stopId}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('delivery-photos')
      .upload(fileName, payload.file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('delivery-photos')
      .getPublicUrl(fileName);

    // Save photo record
    const { data, error } = await supabase
      .from('job_photos')
      .insert({
        job_id: payload.jobId,
        stop_id: payload.stopId,
        photo_url: publicUrl,
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Execute Alcohol Test
   */
  async executeAlcoholTest(payload) {
    const { data, error } = await supabase
      .from('alcohol_tests')
      .insert({
        driver_id: payload.driverId,
        job_id: payload.jobId,
        result: payload.result,
        photo_url: payload.photoUrl,
        tested_at: payload.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Execute Profile Update
   */
  async executeProfileUpdate(payload) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(payload.updates)
      .eq('id', payload.profileId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Execute Emergency Alert
   */
  async executeEmergency(payload) {
    // Emergency has highest priority - try multiple times
    const { data, error } = await supabase
      .from('job_exceptions')
      .insert({
        driver_id: payload.driverId,
        rule_id: 'emergency_button',
        severity: 'critical',
        message_th: '🆘 ฉุกเฉิน! ต้องการความช่วยเหลือด่วน',
        message_en: '🆘 EMERGENCY! Immediate assistance required',
        location: payload.location,
        telemetry: payload.telemetry,
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Show Offline Bar
   */
  showOfflineBar() {
    const offlineBar = document.getElementById('offlineBar');
    if (offlineBar) {
      offlineBar.classList.remove('hidden');
    }
  }

  /**
   * Show/Hide Syncing Bar
   */
  showSyncingBar(showing) {
    const syncingBar = document.getElementById('syncingBar');
    if (syncingBar) {
      if (showing) {
        syncingBar.classList.remove('hidden');
      } else {
        syncingBar.classList.add('hidden');
      }
    }
  }

  /**
   * Update Queue Badge
   */
  updateQueueBadge() {
    const queueBadge = document.getElementById('queueBadge');
    if (queueBadge) {
      if (this.queue.length > 0) {
        queueBadge.textContent = `${this.queue.length} รายการรอส่ง`;
        queueBadge.style.display = 'inline';
      } else {
        queueBadge.style.display = 'none';
      }
    }
  }

  /**
   * Save Failed Actions
   */
  saveFailedActions(failedActions) {
    try {
      const failed = JSON.parse(localStorage.getItem('failedActions') || '[]');
      failed.push(...failedActions);
      localStorage.setItem('failedActions', JSON.stringify(failed));
    } catch (error) {
      console.error('❌ Failed to save failed actions:', error);
    }
  }

  /**
   * Get Queue Status
   */
  getQueueStatus() {
    return {
      total: this.queue.length,
      byType: this.queue.reduce((acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      }, {}),
      failed: this.syncFailedCount
    };
  }

  /**
   * Clear Queue (use with caution)
   */
  async clearQueue() {
    if (confirm('⚠️  ต้องการล้างคิวทั้งหมดใช่หรือไม่? ข้อมูลที่ยังไม่ได้ซิงค์จะหายไป')) {
      this.queue = [];
      await this.saveQueueToStorage();
      this.updateQueueBadge();
      console.log('🗑️  Queue cleared');
    }
  }

  /**
   * Generate ID
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create global instance
const offlineQueue = new OfflineQueueManager();

// Export for use in other modules
window.offlineQueue = offlineQueue;

export default offlineQueue;
