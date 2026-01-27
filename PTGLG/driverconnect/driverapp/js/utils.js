/**
 * Driver Tracking App - Utility Functions
 */

import { ValidationRules, APP_CONFIG } from './config.js';

/**
 * Escape HTML special characters
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize input string
 */
export function sanitizeInput(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .replace(/[<>"'`]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

/**
 * Validate input against rules
 */
export function validateInput(value, ruleName) {
  const rule = ValidationRules[ruleName];
  if (!rule) return { valid: true };

  const sanitized = sanitizeInput(value);

  if (!sanitized && rule.messages.required) {
    return { valid: false, message: rule.messages.required };
  }

  if (!sanitized) return { valid: true, value: sanitized };

  if (rule.minLength && sanitized.length < rule.minLength) {
    return { valid: false, message: rule.messages.minLength };
  }

  if (rule.maxLength && sanitized.length > rule.maxLength) {
    return { valid: false, message: rule.messages.maxLength };
  }

  if (rule.pattern && !rule.pattern.test(sanitized)) {
    return { valid: false, message: rule.messages.pattern };
  }

  if (rule.min !== undefined || rule.max !== undefined) {
    const num = parseFloat(sanitized);
    if (isNaN(num) || num < rule.min || num > rule.max) {
      return { valid: false, message: rule.messages.range };
    }
  }

  return { valid: true, value: sanitized };
}

/**
 * Retry logic wrapper
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = APP_CONFIG.RETRY.maxRetries,
    delay = APP_CONFIG.RETRY.delay,
    backoff = APP_CONFIG.RETRY.backoff,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, err.message);

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        if (onRetry) onRetry(attempt, waitTime, err);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * Convert file to base64
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Decode base64 to Uint8Array (for Supabase storage)
 */
export function decodeBase64(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Format Thai time
 */
export function formatThaiTime(date = new Date()) {
  return date.toLocaleTimeString('th-TH');
}

/**
 * Format Thai date
 */
export function formatThaiDate(date = new Date()) {
  return date.toLocaleDateString('th-TH');
}

/**
 * Format duration in milliseconds to Thai time string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2 ชม. 30 นาที" or "45 นาที")
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '-';

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 0) {
    return `${hours} ชม. ${minutes} นาที`;
  }
  return `${minutes} นาที`;
}

/**
 * Haptic Feedback (Vibration)
 * Provides tactile feedback for user actions
 */
export const HapticFeedback = {
  patterns: {
    success: [100, 50, 100],        // Double tap
    error: [200],                   // Single long
    warning: [50, 50, 50, 50],      // Quick pulses
    notification: [100],             // Single short
    impact: [10],                    // Light tap
    selection: [5]                   // Very light tap
  },

  /**
   * Trigger vibration if supported and enabled
   * @param {string} type - Pattern type (success, error, warning, etc.)
   */
  trigger(type = 'impact') {
    // Check if vibration is supported
    if (!navigator.vibrate) {
      return false;
    }

    // Check if user has disabled haptic feedback
    const hapticEnabled = localStorage.getItem('haptic_feedback_enabled');
    if (hapticEnabled === 'false') {
      return false;
    }

    const pattern = this.patterns[type] || this.patterns.impact;
    
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.warn('Vibration failed:', error);
      return false;
    }
  },

  /**
   * Enable/disable haptic feedback
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    localStorage.setItem('haptic_feedback_enabled', enabled.toString());
  },

  /**
   * Check if haptic feedback is enabled
   * @returns {boolean}
   */
  isEnabled() {
    const value = localStorage.getItem('haptic_feedback_enabled');
    return value !== 'false'; // Enabled by default
  }
};

/**
 * Convenience functions for common haptic patterns
 */
export function vibrateSuccess() {
  HapticFeedback.trigger('success');
}

export function vibrateError() {
  HapticFeedback.trigger('error');
}

export function vibrateWarning() {
  HapticFeedback.trigger('warning');
}

export function vibrateNotification() {
  HapticFeedback.trigger('notification');
}

export function vibrateImpact() {
  HapticFeedback.trigger('impact');
}

export function vibrateSelection() {
  HapticFeedback.trigger('selection');
}
