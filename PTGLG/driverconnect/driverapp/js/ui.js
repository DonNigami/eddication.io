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
  // Trigger error vibration
  if (navigator.vibrate) {
    navigator.vibrate([200]); // Long vibration for error
  }
  
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
  // Trigger success vibration
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100]); // Double tap for success
  }
  
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
 * Show Trip Summary Modal
 * @param {Object} tripData - Trip statistics
 */
export async function showTripSummary(tripData) {
  const {
    reference,
    totalStops = 0,
    completedStops = 0,
    startTime,
    endTime,
    totalDistance = 0,
    vehicle,
    drivers = []
  } = tripData;

  // Calculate duration
  const duration = calculateDuration(startTime, endTime);
  
  // Trigger success vibration
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 100]); // Triple tap celebration
  }

  const html = `
    <div class="trip-summary-modal">
      <div class="trip-summary-header">
        <span class="trip-summary-icon">🎉</span>
        <h2 class="trip-summary-title">ทริปเสร็จสมบูรณ์!</h2>
        <p class="trip-summary-subtitle">เลขอ้างอิง: ${reference}</p>
      </div>

      <div class="trip-summary-stats">
        <div class="trip-summary-stat">
          <span class="trip-summary-stat-icon">⏱️</span>
          <div class="trip-summary-stat-value">${duration}</div>
          <div class="trip-summary-stat-label">เวลาที่ใช้</div>
        </div>

        <div class="trip-summary-stat">
          <span class="trip-summary-stat-icon">📍</span>
          <div class="trip-summary-stat-value">${completedStops}/${totalStops}</div>
          <div class="trip-summary-stat-label">จุดส่ง</div>
        </div>

        ${totalDistance > 0 ? `
        <div class="trip-summary-stat">
          <span class="trip-summary-stat-icon">🚗</span>
          <div class="trip-summary-stat-value">${totalDistance.toFixed(1)}</div>
          <div class="trip-summary-stat-label">กิโลเมตร</div>
        </div>
        ` : ''}
      </div>

      <div class="trip-summary-details">
        <div class="trip-summary-detail-row">
          <span class="trip-summary-detail-label">เวลาเริ่ม</span>
          <span class="trip-summary-detail-value">${formatTime(startTime)}</span>
        </div>
        <div class="trip-summary-detail-row">
          <span class="trip-summary-detail-label">เวลาจบ</span>
          <span class="trip-summary-detail-value">${formatTime(endTime)}</span>
        </div>
        ${vehicle ? `
        <div class="trip-summary-detail-row">
          <span class="trip-summary-detail-label">รถ</span>
          <span class="trip-summary-detail-value">${vehicle}</span>
        </div>
        ` : ''}
        ${drivers.length > 0 ? `
        <div class="trip-summary-detail-row">
          <span class="trip-summary-detail-label">คนขับ</span>
          <span class="trip-summary-detail-value">${drivers.join(', ')}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  await Swal.fire({
    html,
    icon: null,
    showConfirmButton: true,
    confirmButtonText: '✨ ดีมาก!',
    confirmButtonColor: '#1abc9c',
    width: '90%',
    maxWidth: '500px'
  });
}

/**
 * Calculate duration between two dates
 */
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return '-';
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours} ชม. ${minutes} นาที`;
  }
  return `${minutes} นาที`;
}

/**
 * Format time
 */
function formatTime(dateTime) {
  if (!dateTime) return '-';
  const date = new Date(dateTime);
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Show Empty State
 * @param {string} containerId - Container element ID
 * @param {Object} options - Empty state options
 */
export function showEmptyState(containerId, options = {}) {
  const {
    icon = '📭',
    title = 'ไม่มีข้อมูล',
    message = 'ไม่พบรายการในขณะนี้',
    actionText = null,
    actionCallback = null
  } = options;

  const container = document.getElementById(containerId);
  if (!container) return;

  const actionHtml = actionText && actionCallback ? `
    <div class="empty-state-action">
      <button class="btn-action" onclick="(${actionCallback.toString()})()">${actionText}</button>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon">${icon}</span>
      <h3 class="empty-state-title">${title}</h3>
      <p class="empty-state-message">${message}</p>
      ${actionHtml}
    </div>
  `;
}

/**
 * Show Loading Skeleton
 * @param {string} containerId - Container element ID
 * @param {string} type - Skeleton type ('summary', 'timeline', 'card')
 */
export function showLoadingSkeleton(containerId, type = 'timeline') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let skeletonHTML = '';

  switch (type) {
    case 'summary':
      skeletonHTML = `
        <div class="skeleton skeleton-summary">
          <div class="skeleton-row">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
          <div class="skeleton-row">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
          <div class="skeleton-row">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
          </div>
        </div>
      `;
      break;

    case 'timeline':
      skeletonHTML = `
        ${[1, 2, 3].map(() => `
          <div class="skeleton-timeline-item">
            <div class="skeleton skeleton-marker"></div>
            <div class="skeleton-content">
              <div class="skeleton skeleton-title"></div>
              <div class="skeleton skeleton-sub"></div>
              <div class="skeleton-buttons">
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn"></div>
              </div>
            </div>
          </div>
        `).join('')}
      `;
      break;

    case 'card':
      skeletonHTML = `
        <div class="skeleton" style="height: 100px; margin-bottom: 10px;"></div>
      `;
      break;
  }

  container.innerHTML = skeletonHTML;
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
