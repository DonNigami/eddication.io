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
