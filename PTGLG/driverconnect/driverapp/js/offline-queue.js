/**
 * Driver Tracking App - Offline Queue System
 */

import { APP_CONFIG } from './config.js';
import { showInlineFlexCustom } from './ui.js';

// Queue state
let offlineQueue = [];
let isSyncing = false;

// Reference to API (will be set by app.js)
let SupabaseAPI = null;
let searchFn = null;
let currentReference = '';

/**
 * Initialize queue with dependencies
 */
export function initOfflineQueue(api, search, getReference) {
  SupabaseAPI = api;
  searchFn = search;
  currentReference = getReference;
}

/**
 * Update current reference
 */
export function setCurrentReference(ref) {
  currentReference = ref;
}

/**
 * Get online status
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Get syncing status
 */
export function isSyncingNow() {
  return isSyncing;
}

/**
 * Offline Queue Manager
 */
export const OfflineQueue = {
  /**
   * Load queue from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(APP_CONFIG.OFFLINE_QUEUE_KEY);
      offlineQueue = stored ? JSON.parse(stored) : [];
      this.updateUI();
      console.log('📦 Loaded offline queue:', offlineQueue.length, 'items');
    } catch (err) {
      console.error('Failed to load offline queue:', err);
      offlineQueue = [];
    }
  },

  /**
   * Save queue to localStorage
   */
  save() {
    try {
      localStorage.setItem(APP_CONFIG.OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
      this.updateUI();
    } catch (err) {
      console.error('Failed to save offline queue:', err);
    }
  },

  /**
   * Add action to queue
   */
  add(action) {
    const queueItem = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: action.type,
      data: action.data,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    offlineQueue.push(queueItem);
    this.save();
    console.log('📥 Added to offline queue:', queueItem.type);
    return queueItem;
  },

  /**
   * Remove item from queue
   */
  remove(id) {
    offlineQueue = offlineQueue.filter(item => item.id !== id);
    this.save();
  },

  /**
   * Increment retry count
   */
  incrementRetry(id) {
    const item = offlineQueue.find(i => i.id === id);
    if (item) {
      item.retries++;
      this.save();
    }
  },

  /**
   * Get queue count
   */
  getCount() {
    return offlineQueue.length;
  },

  /**
   * Update UI badge
   */
  updateUI() {
    const badge = document.getElementById('queueBadge');
    const count = this.getCount();
    if (badge) {
      if (count > 0) {
        badge.textContent = count + ' รายการรอส่ง';
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  /**
   * Sync queue when online
   */
  async sync() {
    if (isSyncing || !isOnline() || offlineQueue.length === 0) return;

    isSyncing = true;
    console.log('🔄 Starting offline queue sync...');

    const itemsToSync = [...offlineQueue];
    let successCount = 0;
    let failCount = 0;

    for (const item of itemsToSync) {
      if (!isOnline()) break;

      try {
        const result = await this.processItem(item);
        if (result.success) {
          this.remove(item.id);
          successCount++;
          console.log('✅ Synced:', item.type);
        } else {
          this.incrementRetry(item.id);
          failCount++;
          console.warn('⚠️ Failed to sync:', item.type, result.message);

          if (item.retries >= APP_CONFIG.MAX_RETRIES) {
            this.remove(item.id);
            console.error('❌ Removed after max retries:', item.type);
          }
        }
      } catch (err) {
        this.incrementRetry(item.id);
        failCount++;
        console.error('❌ Sync error:', err);
      }
    }

    isSyncing = false;

    if (successCount > 0 || failCount > 0) {
      this.showSyncResult(successCount, failCount);
    }

    // Refresh data if sync successful
    if (successCount > 0 && currentReference && searchFn) {
      searchFn(true);
    }
  },

  /**
   * Process single queue item
   */
  async processItem(item) {
    if (!SupabaseAPI) {
      return { success: false, message: 'API not initialized' };
    }

    switch (item.type) {
      case 'updateStop':
        return await SupabaseAPI.updateStop(item.data);
      case 'uploadAlcohol':
        return await SupabaseAPI.uploadAlcohol(item.data);
      case 'closeJob':
        return await SupabaseAPI.closeJob(item.data);
      case 'endTrip':
        return await SupabaseAPI.endTrip(item.data);
      default:
        return { success: false, message: 'Unknown action type' };
    }
  },

  /**
   * Show sync result notification
   */
  showSyncResult(success, fail) {
    if (success > 0 && fail === 0) {
      showInlineFlexCustom('sync', `ซิงค์ข้อมูล ${success} รายการสำเร็จ`, 'ข้อมูลที่บันทึกขณะออฟไลน์ได้ส่งเรียบร้อย');
    } else if (success > 0 && fail > 0) {
      showInlineFlexCustom('sync', `ซิงค์สำเร็จ ${success} รายการ`, `ยังมี ${fail} รายการรอส่ง`);
    } else if (fail > 0) {
      showInlineFlexCustom('error', 'ซิงค์ไม่สำเร็จ', `${fail} รายการรอส่งใหม่`);
    }
  },

  /**
   * Clear all queue (for debug)
   */
  clear() {
    offlineQueue = [];
    this.save();
    console.log('🗑️ Offline queue cleared');
  }
};

/**
 * Execute or queue action based on online status
 */
export async function executeOrQueue(actionType, data, executeFn) {
  if (isOnline()) {
    try {
      return await executeFn();
    } catch (err) {
      // If network error, queue it
      if (err.message.includes('network') || err.message.includes('fetch') || !navigator.onLine) {
        document.getElementById('offlineBar')?.classList.add('show');
        const queueItem = OfflineQueue.add({ type: actionType, data: data });
        return {
          success: true,
          queued: true,
          message: 'บันทึกไว้แล้ว จะส่งเมื่อมีสัญญาณ',
          queueId: queueItem.id
        };
      }
      throw err;
    }
  } else {
    // Offline: queue it
    const queueItem = OfflineQueue.add({ type: actionType, data: data });
    return {
      success: true,
      queued: true,
      message: 'บันทึกไว้แล้ว จะส่งเมื่อมีสัญญาณ',
      queueId: queueItem.id
    };
  }
}
