/**
 * Driver Tracking App - Configuration
 * Supabase Version
 */

// Supabase Configuration
export const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';

// LIFF Configuration
export const LIFF_ID = '2007705394-y4mV76Gv';

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
    timeout: 15000,
    maximumAge: 0,
    accuracyThresholds: {
      excellent: 20,
      good: 50,
      weak: 100
    }
  },

  // Notification duration (ms)
  NOTIFICATION_DURATION: 4000
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
