/**
 * Driver Tracking App - Configuration
 * Supabase Version
 */

import { SUPABASE_URL as SU, SUPABASE_ANON_KEY as SAK, LIFF_IDS } from '../../shared/config.js';

// Supabase Configuration
export const SUPABASE_URL = SU;
export const SUPABASE_ANON_KEY = SAK;

// LIFF Configuration
export const LIFF_ID = LIFF_IDS.DRIVER_APP;

// App Settings
export const APP_CONFIG = {
  // Offline Queue
  OFFLINE_QUEUE_KEY: 'driverapp_offline_queue',
  MAX_RETRIES: 5,

  // Theme
  THEME_KEY: 'driverapp_theme',

  // Last Reference
  LAST_REFERENCE_KEY: 'last_reference',

  // Retry settings
  RETRY: {
    maxRetries: 3,
    delay: 1000,
    backoff: 1.5
  },

  // GPS settings
  GPS: {
    enableHighAccuracy: true,
    timeout: 60000,      // 60 seconds - increased for better reliability
    maximumAge: 30000,   // Allow 30s cached position
    accuracyThresholds: {
      excellent: 20,
      good: 50,
      weak: 100
    }
  },

  // Notification duration (ms)
  NOTIFICATION_DURATION: 4000,

  // Live Tracking settings
  LIVE_TRACKING: {
    normalInterval: 300000, // 5 minutes in milliseconds
    liveInterval: 15000,    // 15 seconds in milliseconds
    enableAutoTracking: true
  }
};

// Validation Rules
export const ValidationRules = {
  reference: {
    pattern: /^[a-zA-Z0-9\-_]+$/,
    minLength: 3,
    maxLength: 50,
    messages: {
      required: 'กรุณากรอกเลข Reference',
      pattern: 'เลข Reference ต้องเป็นตัวอักษร ตัวเลข หรือ - _ เท่านั้น',
      minLength: 'เลข Reference ต้องมีอย่างน้อย 3 ตัวอักษร',
      maxLength: 'เลข Reference ต้องไม่เกิน 50 ตัวอักษร'
    }
  },
  odo: {
    pattern: /^\d+$/,
    min: 0,
    max: 9999999,
    messages: {
      pattern: 'เลขไมล์ต้องเป็นตัวเลขเท่านั้น',
      range: 'เลขไมล์ต้องอยู่ระหว่าง 0-9,999,999'
    }
  },
  alcohol: {
    pattern: /^\d+(\.\d{1,3})?$/,
    min: 0,
    max: 5,
    messages: {
      pattern: 'ค่าแอลกอฮอล์ต้องเป็นตัวเลข',
      range: 'ค่าแอลกอฮอล์ต้องอยู่ระหว่าง 0-5'
    }
  }
};
