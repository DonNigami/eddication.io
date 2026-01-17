/**
 * Driver Tracking App - UI Helper Functions
 */

import { APP_CONFIG } from './config.js';
import { formatThaiTime } from './utils.js';

let inlineFlexTimer = null;

/**
 * Show loading dialog
 */
export function showLoading(msg) {
  Swal.fire({
    title: msg || 'กำลังโหลด...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
}

/**
 * Close loading dialog
 */
export function closeLoading() {
  Swal.close();
}

/**
 * Show error dialog
 */
export function showError(msg) {
  Swal.fire({
    icon: 'error',
    title: 'เกิดข้อผิดพลาด',
    text: msg,
    confirmButtonColor: '#1abc9c'
  });
}

/**
 * Show success dialog
 */
export function showSuccess(title, text) {
  return Swal.fire({
    icon: 'success',
    title: title,
    text: text,
    confirmButtonColor: '#1abc9c'
  });
}

/**
 * Show info dialog
 */
export function showInfo(title, text) {
  Swal.fire({
    icon: 'info',
    title: title,
    text: text,
    confirmButtonColor: '#1abc9c'
  });
}

/**
 * Show inline flex notification
 */
export function showInlineFlex(type, stopInfo) {
  const el = document.getElementById('inlineFlex');
  const titleEl = document.getElementById('inlineFlexTitle');
  const mainEl = document.getElementById('inlineFlexMain');
  const subEl = document.getElementById('inlineFlexSub');

  if (!el || !titleEl || !mainEl || !subEl) return;

  if (inlineFlexTimer) clearTimeout(inlineFlexTimer);

  const titles = {
    checkin: '✅ Check-in สำเร็จ',
    checkout: '✅ Check-out สำเร็จ',
    fuel: '⛽ ลงน้ำมันสำเร็จ',
    unload: '📦 ลงเสร็จสำเร็จ',
    closejob: '🏁 ปิดงานสำเร็จ'
  };

  titleEl.textContent = titles[type] || '✅ อัปเดตสำเร็จ';
  mainEl.textContent = stopInfo.shipToName || '';
  subEl.textContent = formatThaiTime();

  el.classList.remove('hidden', 'hide');
  el.classList.add('show');

  inlineFlexTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, APP_CONFIG.NOTIFICATION_DURATION);
}

/**
 * Show custom inline flex notification
 */
export function showInlineFlexCustom(type, title, subtitle) {
  const el = document.getElementById('inlineFlex');
  const titleEl = document.getElementById('inlineFlexTitle');
  const mainEl = document.getElementById('inlineFlexMain');
  const subEl = document.getElementById('inlineFlexSub');

  if (!el || !titleEl || !mainEl || !subEl) return;

  if (inlineFlexTimer) clearTimeout(inlineFlexTimer);

  const icons = {
    sync: '🔄',
    queued: '📥',
    error: '⚠️',
    success: '✅',
    offline: '📵'
  };

  titleEl.textContent = (icons[type] || '📌') + ' ' + title;
  mainEl.textContent = subtitle || '';
  subEl.textContent = formatThaiTime();

  el.classList.remove('hidden', 'hide');
  el.classList.add('show');

  inlineFlexTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, APP_CONFIG.NOTIFICATION_DURATION);
}

/**
 * Show input error
 */
export function showInputError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.add('input-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

/**
 * Clear input error
 */
export function clearInputError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.remove('input-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }
}

/**
 * Show skeleton loading
 */
export function showSkeleton() {
  document.getElementById('summarySkeleton')?.classList.remove('hidden');
  document.getElementById('timelineSkeleton')?.classList.remove('hidden');
  document.getElementById('summary')?.classList.add('hidden');
  document.getElementById('timelineContainer')?.classList.add('hidden');
}

/**
 * Hide skeleton loading
 */
export function hideSkeleton() {
  document.getElementById('summarySkeleton')?.classList.add('hidden');
  document.getElementById('timelineSkeleton')?.classList.add('hidden');
}

/**
 * Record last updated time
 */
export function recordLastUpdated() {
  const textEl = document.getElementById('lastUpdatedText');
  const container = document.getElementById('lastUpdatedContainer');
  if (textEl) textEl.textContent = 'อัปเดตล่าสุด: ' + formatThaiTime();
  if (container) container.classList.remove('hidden');
}

/**
 * Hide last updated container
 */
export function hideLastUpdatedContainer() {
  const container = document.getElementById('lastUpdatedContainer');
  if (container) container.classList.add('hidden');
}

/**
 * Theme management
 */
export const ThemeManager = {
  load() {
    if (localStorage.getItem(APP_CONFIG.THEME_KEY) === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const toggle = document.getElementById('themeToggle');
      if (toggle) toggle.textContent = '☀️';
    }
  },

  toggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const toggle = document.getElementById('themeToggle');

    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(APP_CONFIG.THEME_KEY, 'light');
      if (toggle) toggle.textContent = '🌙';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(APP_CONFIG.THEME_KEY, 'dark');
      if (toggle) toggle.textContent = '☀️';
    }
  }
};
