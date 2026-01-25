/**
 * Driver Tracking App - Centralized State Manager
 *
 * Provides a single source of truth for application state,
 * with change notifications and persistence.
 */

import { APP_CONFIG } from './config.js';

/**
 * Error Codes for recovery guidance
 */
export const ErrorCodes = {
  // Network Errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  SUPABASE_CONNECTION_FAILED: 'SUPABASE_CONNECTION_FAILED',

  // GPS Errors
  GPS_PERMISSION_DENIED: 'GPS_PERMISSION_DENIED',
  GPS_TIMEOUT: 'GPS_TIMEOUT',
  GPS_POSITION_UNAVAILABLE: 'GPS_POSITION_UNAVAILABLE',

  // Auth Errors
  AUTH_NOT_LOGGED_IN: 'AUTH_NOT_LOGGED_IN',
  AUTH_NOT_APPROVED: 'AUTH_NOT_APPROVED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',

  // Data Errors
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_ALREADY_CLOSED: 'JOB_ALREADY_CLOSED',
  STOP_OUT_OF_RADIUS: 'STOP_OUT_OF_RADIUS',

  // Validation Errors
  VALIDATION_INVALID_REFERENCE: 'VALIDATION_INVALID_REFERENCE',
  VALIDATION_INVALID_ODO: 'VALIDATION_INVALID_ODO',
  VALIDATION_INVALID_ALCOHOL: 'VALIDATION_INVALID_ALCOHOL',
  VALIDATION_MISSING_REQUIRED: 'VALIDATION_MISSING_REQUIRED',

  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Error Recovery Actions
 */
export const RecoveryActions = {
  RETRY: 'retry',
  CHECK_INTERNET: 'check_internet',
  ENABLE_GPS: 'enable_gps',
  CONTACT_ADMIN: 'contact_admin',
  RELOAD_APP: 'reload_app',
  NONE: 'none'
};

/**
 * Error Messages and Recovery Guidance (Thai)
 */
const ErrorMessages = {
  [ErrorCodes.NETWORK_OFFLINE]: {
    title: 'ไม่มีสัญญาณอินเทอร์เน็ต',
    message: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
    recovery: RecoveryActions.CHECK_INTERNET,
    retryable: true
  },
  [ErrorCodes.NETWORK_TIMEOUT]: {
    title: 'การเชื่อมต่อหมดเวลา',
    message: 'เซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองใหม่',
    recovery: RecoveryActions.RETRY,
    retryable: true
  },
  [ErrorCodes.SUPABASE_CONNECTION_FAILED]: {
    title: 'ไม่สามารถเชื่อมต่อฐานข้อมูล',
    message: 'กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
    recovery: RecoveryActions.RETRY,
    retryable: true
  },
  [ErrorCodes.GPS_PERMISSION_DENIED]: {
    title: 'ไม่ได้รับอนุญาตให้เข้าถึง GPS',
    message: 'กรุณาอนุญาตให้เข้าถึงตำแหน่งในการตั้งค่าเบราว์เซอร์',
    recovery: RecoveryActions.ENABLE_GPS,
    retryable: false
  },
  [ErrorCodes.GPS_TIMEOUT]: {
    title: 'ไม่สามารถรับพิกัด GPS',
    message: 'กรุณาเปิด GPS และลองใหม่',
    recovery: RecoveryActions.ENABLE_GPS,
    retryable: true
  },
  [ErrorCodes.GPS_POSITION_UNAVAILABLE]: {
    title: 'ไม่สามารถระบุตำแหน่ง',
    message: 'กรุณาไปยังที่โล่งและลองใหม่',
    recovery: RecoveryActions.ENABLE_GPS,
    retryable: true
  },
  [ErrorCodes.AUTH_NOT_LOGGED_IN]: {
    title: 'กรุณาเข้าสู่ระบบ',
    message: 'ระบบจะนำคุณไปยังหน้าล็อกอิน',
    recovery: RecoveryActions.RELOAD_APP,
    retryable: false
  },
  [ErrorCodes.AUTH_NOT_APPROVED]: {
    title: 'บัญชียังไม่ได้รับอนุมัติ',
    message: 'กรุณาติดต่อผู้ดูแลระบบเพื่อขออนุมัติ',
    recovery: RecoveryActions.CONTACT_ADMIN,
    retryable: false
  },
  [ErrorCodes.AUTH_UNAUTHORIZED]: {
    title: 'ไม่มีสิทธิ์ดำเนินการ',
    message: 'คุณไม่มีสิทธิ์ดำเนินการกับงานนี้ กรุณาติดต่อผู้ดูแลระบบ',
    recovery: RecoveryActions.CONTACT_ADMIN,
    retryable: false
  },
  [ErrorCodes.JOB_NOT_FOUND]: {
    title: 'ไม่พบงาน',
    message: 'ไม่พบเลขอ้างอิงงานนี้ในระบบ',
    recovery: RecoveryActions.NONE,
    retryable: false
  },
  [ErrorCodes.JOB_ALREADY_CLOSED]: {
    title: 'งานนี้ถูกปิดแล้ว',
    message: 'ไม่สามารถดำเนินการกับงานที่ปิดแล้วได้',
    recovery: RecoveryActions.NONE,
    retryable: false
  },
  [ErrorCodes.STOP_OUT_OF_RADIUS]: {
    title: 'อยู่นอกพื้นที่',
    message: 'คุณอยู่นอกรัศมีที่กำหนด กรุณาเข้าใกล้ปลายทาง',
    recovery: RecoveryActions.ENABLE_GPS,
    retryable: true
  },
  [ErrorCodes.VALIDATION_INVALID_REFERENCE]: {
    title: 'เลข Reference ไม่ถูกต้อง',
    message: 'กรุณากรอกเลข Reference ที่มี 3-50 ตัวอักษร',
    recovery: RecoveryActions.NONE,
    retryable: false
  },
  [ErrorCodes.VALIDATION_INVALID_ODO]: {
    title: 'เลขไมล์ไม่ถูกต้อง',
    message: 'กรุณากรอกเลขไมล์เป็นตัวเลขเท่านั้น (0-9,999,999)',
    recovery: RecoveryActions.NONE,
    retryable: false
  },
  [ErrorCodes.VALIDATION_INVALID_ALCOHOL]: {
    title: 'ค่าแอลกอฮอล์ไม่ถูกต้อง',
    message: 'กรุณากรอกค่าแอลกอฮอล์ระหว่าง 0-5',
    recovery: RecoveryActions.NONE,
    retryable: false
  },
  [ErrorCodes.VALIDATION_MISSING_REQUIRED]: {
    title: 'กรอกข้อมูลไม่ครบ',
    message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
    recovery: RecoveryActions.NONE,
    retryable: false
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    title: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    message: 'กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ',
    recovery: RecoveryActions.RETRY,
    retryable: true
  }
};

/**
 * Get error information by code or create from unknown error
 */
export function getErrorInfo(codeOrError, fallbackMessage = null) {
  let code = ErrorCodes.UNKNOWN_ERROR;

  // If it's an Error object, try to determine code
  if (codeOrError instanceof Error) {
    const msg = codeOrError.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      code = ErrorCodes.NETWORK_OFFLINE;
    } else if (msg.includes('timeout')) {
      code = ErrorCodes.NETWORK_TIMEOUT;
    } else if (msg.includes('gps') || msg.includes('geolocation')) {
      code = ErrorCodes.GPS_POSITION_UNAVAILABLE;
    }
  } else if (Object.values(ErrorCodes).includes(codeOrError)) {
    code = codeOrError;
  }

  const info = ErrorMessages[code] || ErrorMessages[ErrorCodes.UNKNOWN_ERROR];

  return {
    code,
    ...info,
    message: fallbackMessage || info.message
  };
}

/**
 * Application State Keys
 */
const StateKeys = {
  USER_ID: 'userId',
  USER_PROFILE: 'userProfile',
  IS_ADMIN_MODE: 'isAdminMode',
  CURRENT_REFERENCE: 'currentReference',
  CURRENT_VEHICLE_DESC: 'currentVehicleDesc',
  LAST_STOPS: 'lastStops',
  CURRENT_DRIVERS: 'currentDrivers',
  CURRENT_CHECKED_DRIVERS: 'currentCheckedDrivers',
  ALCOHOL_ALL_DONE: 'alcoholAllDone',
  JOB_CLOSED: 'jobClosed',
  TRIP_ENDED: 'tripEnded',
  IS_ONLINE: 'isOnline',
  GPS_STATUS: 'gpsStatus'
};

/**
 * State Manager Class
 */
class StateManager {
  constructor() {
    this._state = new Map();
    this._listeners = new Map();
    this._batchDepth = 0;
    this._batchedChanges = new Set();

    // Initialize with default values
    this._initializeDefaults();
  }

  /**
   * Initialize default state values
   */
  _initializeDefaults() {
    this._state.set(StateKeys.IS_ONLINE, navigator.onLine);
    this._state.set(StateKeys.IS_ADMIN_MODE, false);
    this._state.set(StateKeys.ALCOHOL_ALL_DONE, false);
    this._state.set(StateKeys.JOB_CLOSED, false);
    this._state.set(StateKeys.TRIP_ENDED, false);
    this._state.set(StateKeys.LAST_STOPS, []);
    this._state.set(StateKeys.CURRENT_DRIVERS, []);
    this._state.set(StateKeys.CURRENT_CHECKED_DRIVERS, []);
  }

  /**
   * Get a state value
   */
  get(key) {
    return this._state.get(key);
  }

  /**
   * Get multiple state values
   */
  getMany(keys) {
    const result = {};
    keys.forEach(key => {
      result[key] = this._state.get(key);
    });
    return result;
  }

  /**
   * Set a state value and notify listeners
   */
  set(key, value) {
    const oldValue = this._state.get(key);

    // Only update if value changed
    if (oldValue !== value) {
      this._state.set(key, value);

      // If batching, add to batched changes
      if (this._batchDepth > 0) {
        this._batchedChanges.add(key);
      } else {
        this._notify(key, value, oldValue);
      }

      // Persist to localStorage if needed
      this._persist(key, value);
    }

    return value;
  }

  /**
   * Set multiple state values atomically
   */
  setMany(updates) {
    const entries = Object.entries(updates);
    const changes = [];

    for (const [key, value] of entries) {
      const oldValue = this._state.get(key);
      if (oldValue !== value) {
        this._state.set(key, value);
        changes.push({ key, value, oldValue });
        this._persist(key, value);
      }
    }

    // Notify all changes
    if (this._batchDepth > 0) {
      changes.forEach(c => this._batchedChanges.add(c.key));
    } else {
      changes.forEach(c => this._notify(c.key, c.value, c.oldValue));
    }
  }

  /**
   * Batch multiple state updates (notify only once at end)
   */
  batch(fn) {
    this._batchDepth++;
    this._batchedChanges.clear();

    try {
      fn();
    } finally {
      this._batchDepth--;

      if (this._batchDepth === 0) {
        // Notify all batched changes
        this._batchedChanges.forEach(key => {
          const value = this._state.get(key);
          this._notify(key, value, null);
        });
        this._batchedChanges.clear();
      }
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(key, listener) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Notify listeners of a state change
   */
  _notify(key, value, oldValue) {
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(value, oldValue, key);
        } catch (err) {
          console.error(`Error in state listener for ${key}:`, err);
        }
      });
    }
  }

  /**
   * Persist state to localStorage
   */
  _persist(key, value) {
    const persistKeys = [
      StateKeys.CURRENT_REFERENCE,
      StateKeys.USER_ID
    ];

    if (persistKeys.includes(key)) {
      try {
        if (value === null || value === undefined) {
          localStorage.removeItem(key);
        } else if (key === StateKeys.CURRENT_REFERENCE) {
          localStorage.setItem(APP_CONFIG.LAST_REFERENCE_KEY, value);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch (err) {
        console.warn('Failed to persist state to localStorage:', err);
      }
    }
  }

  /**
   * Restore state from localStorage
   */
  restore(key) {
    const persistKeys = {
      [StateKeys.CURRENT_REFERENCE]: () =>
        localStorage.getItem(APP_CONFIG.LAST_REFERENCE_KEY),
      [StateKeys.USER_ID]: () => {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            return JSON.parse(stored);
          } catch {
            return stored;
          }
        }
        return null;
      }
    };

    if (persistKeys[key]) {
      const value = persistKeys[key]();
      if (value !== null) {
        this.set(key, value);
        return value;
      }
    }
    return null;
  }

  /**
   * Reset state to defaults
   */
  reset(keys = null) {
    if (keys) {
      // Reset specific keys
      keys.forEach(key => {
        if (key === StateKeys.LAST_STOPS) {
          this.set(key, []);
        } else if (key === StateKeys.CURRENT_DRIVERS || key === StateKeys.CURRENT_CHECKED_DRIVERS) {
          this.set(key, []);
        } else if (key === StateKeys.ALCOHOL_ALL_DONE || key === StateKeys.JOB_CLOSED || key === StateKeys.TRIP_ENDED) {
          this.set(key, false);
        } else if (key === StateKeys.CURRENT_REFERENCE || key === StateKeys.CURRENT_VEHICLE_DESC) {
          this.set(key, '');
        } else if (key === StateKeys.USER_PROFILE) {
          this.set(key, null);
        }
      });
    } else {
      // Reset all job-related state
      this.batch(() => {
        this.set(StateKeys.CURRENT_REFERENCE, '');
        this.set(StateKeys.CURRENT_VEHICLE_DESC, '');
        this.set(StateKeys.LAST_STOPS, []);
        this.set(StateKeys.CURRENT_DRIVERS, []);
        this.set(StateKeys.CURRENT_CHECKED_DRIVERS, []);
        this.set(StateKeys.ALCOHOL_ALL_DONE, false);
        this.set(StateKeys.JOB_CLOSED, false);
        this.set(StateKeys.TRIP_ENDED, false);
      });
    }
  }

  /**
   * Get current state as plain object
   */
  toObject() {
    const obj = {};
    this._state.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Check if all drivers have completed alcohol test
   */
  isAlcoholComplete() {
    const drivers = this.get(StateKeys.CURRENT_DRIVERS) || [];
    const checked = this.get(StateKeys.CURRENT_CHECKED_DRIVERS) || [];
    return drivers.length > 0 && drivers.every(d => checked.includes(d));
  }

  /**
   * Update checked drivers and recalc alcohol status
   */
  updateCheckedDrivers(driverName) {
    const checked = new Set(this.get(StateKeys.CURRENT_CHECKED_DRIVERS) || []);
    checked.add(driverName);
    this.set(StateKeys.CURRENT_CHECKED_DRIVERS, Array.from(checked));
    this.set(StateKeys.ALCOHOL_ALL_DONE, this.isAlcoholComplete());
    return Array.from(checked);
  }

  /**
   * Clear all listeners
   */
  clearListeners() {
    this._listeners.clear();
  }
}

// Singleton instance
const stateManager = new StateManager();

// Export singleton and constants
export { stateManager as StateManager, StateKeys };
export default StateManager;
