# 🚀 แผนปรับปรุง Driver Tracking App เป็น 10/10

## 📋 สารบัญ
1. [โครงสร้างและ Architecture](#1-โครงสร้างและ-architecture)
2. [Performance & Optimization](#2-performance--optimization)
3. [Security & Error Handling](#3-security--error-handling)
4. [UX/UI Improvements](#4-uxui-improvements)
5. [Testing & Documentation](#5-testing--documentation)
6. [Advanced Features](#6-advanced-features)

---

## 1. โครงสร้างและ Architecture

### 1.1 แยกไฟล์ CSS
```
driverapp/
├── index.html
├── styles/
│   ├── variables.css      (CSS Variables)
│   ├── base.css          (Reset & Base styles)
│   ├── components.css    (Buttons, Cards, etc.)
│   ├── layout.css        (Grid, Flexbox)
│   ├── themes.css        (Dark mode)
│   └── animations.css    (Transitions, Keyframes)
```

**ตัวอย่าง: `styles/variables.css`**
```css
:root {
  /* Colors */
  --primary: #1abc9c;
  --primary-dark: #16a085;
  --primary-light: #48c9b0;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Typography */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.85rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  
  /* Shadows */
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
}
```

### 1.2 แยกไฟล์ JavaScript เป็น Modules

```
driverapp/
├── js/
│   ├── config/
│   │   ├── constants.js
│   │   └── env.js
│   ├── core/
│   │   ├── AppState.js       (State Management)
│   │   ├── EventBus.js       (Event System)
│   │   └── ServiceWorker.js
│   ├── services/
│   │   ├── LiffService.js
│   │   ├── ApiService.js
│   │   ├── GpsService.js
│   │   ├── StorageService.js
│   │   └── NotificationService.js
│   ├── components/
│   │   ├── Timeline.js
│   │   ├── QuickActions.js
│   │   ├── GpsMonitor.js
│   │   └── Toast.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── helpers.js
│   └── app.js (Main entry point)
```

**ตัวอย่าง: `core/AppState.js`**
```javascript
// State Management แบบ Reactive
class AppState {
  constructor() {
    this._state = {
      user: { id: '', name: '', lineId: '' },
      job: { reference: '', stops: [], closed: false, tripEnded: false },
      settings: this._loadSettings(),
      ui: { loading: false, theme: 'light' },
      gps: { status: 'unknown', accuracy: null },
      offline: { queue: [], syncing: false }
    };
    this._listeners = new Map();
  }

  // Reactive State Pattern
  get(path) {
    return this._getNestedValue(this._state, path);
  }

  set(path, value) {
    const oldValue = this.get(path);
    this._setNestedValue(this._state, path, value);
    this._notify(path, value, oldValue);
  }

  subscribe(path, callback) {
    if (!this._listeners.has(path)) {
      this._listeners.set(path, []);
    }
    this._listeners.get(path).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this._listeners.get(path);
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  _notify(path, newValue, oldValue) {
    const callbacks = this._listeners.get(path) || [];
    callbacks.forEach(cb => cb(newValue, oldValue));
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  _setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => acc[part], obj);
    target[last] = value;
  }

  _loadSettings() {
    try {
      return JSON.parse(localStorage.getItem('app_settings')) || this._defaultSettings();
    } catch (e) {
      return this._defaultSettings();
    }
  }

  _defaultSettings() {
    return {
      theme: 'light',
      autoRefresh: true,
      refreshInterval: 30000,
      notifications: {
        statusChange: true,
        newJob: true,
        lineMessage: true,
        sound: true
      },
      gps: {
        highAccuracy: true,
        timeout: 10000
      }
    };
  }
}

export default new AppState();
```

**ตัวอย่าง: `services/ApiService.js`**
```javascript
import appState from '../core/AppState.js';
import { handleOfflineRequest } from './OfflineService.js';

class ApiService {
  constructor() {
    this.baseUrl = this._getApiUrl();
    this.timeout = 30000;
  }

  _getApiUrl() {
    // ใช้ environment variable
    return window.APP_CONFIG?.API_URL || 
           'https://script.google.com/macros/s/YOUR_ID/exec';
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl + endpoint, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

    } catch (error) {
      clearTimeout(timeoutId);

      // Handle offline
      if (!navigator.onLine) {
        return handleOfflineRequest(endpoint, options);
      }

      // Log error
      this._logError(error, endpoint, options);
      throw error;
    }
  }

  async search(reference) {
    const params = new URLSearchParams({
      action: 'search',
      reference,
      userId: appState.get('user.id')
    });

    return this.request('', {
      method: 'POST',
      body: params
    });
  }

  async updateStop(data) {
    const params = new URLSearchParams(data);
    return this.request('', {
      method: 'POST',
      body: params
    });
  }

  _logError(error, endpoint, options) {
    console.error('API Error:', {
      error: error.message,
      endpoint,
      timestamp: new Date().toISOString(),
      userId: appState.get('user.id'),
      reference: appState.get('job.reference')
    });

    // TODO: Send to error logging service
  }
}

export default new ApiService();
```

**ตัวอย่าง: `services/GpsService.js`**
```javascript
import appState from '../core/AppState.js';
import EventBus from '../core/EventBus.js';

class GpsService {
  constructor() {
    this.watchId = null;
    this.lastPosition = null;
    this.checkInterval = null;
  }

  init() {
    if (!navigator.geolocation) {
      this._updateStatus('error', 'อุปกรณ์ไม่รองรับ GPS');
      return;
    }

    this.startMonitoring();
  }

  startMonitoring() {
    this.checkStatus();
    this.checkInterval = setInterval(() => this.checkStatus(), 30000); // 30 วินาที
  }

  stopMonitoring() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkStatus() {
    this._updateStatus('checking', 'กำลังตรวจสอบ GPS...');

    try {
      const position = await this.getCurrentPosition();
      this._handleSuccess(position);
    } catch (error) {
      this._handleError(error);
    }
  }

  getCurrentPosition(options = {}) {
    const settings = appState.get('settings.gps');
    
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: settings.highAccuracy,
          timeout: settings.timeout,
          maximumAge: 0,
          ...options
        }
      );
    });
  }

  _handleSuccess(position) {
    this.lastPosition = position;
    const accuracy = position.coords.accuracy;

    let status, text, bars;
    if (accuracy <= 20) {
      status = 'excellent';
      text = 'GPS พร้อมใช้งาน (แม่นยำมาก)';
      bars = 4;
    } else if (accuracy <= 50) {
      status = 'good';
      text = 'GPS พร้อมใช้งาน';
      bars = 3;
    } else if (accuracy <= 100) {
      status = 'fair';
      text = 'สัญญาณ GPS ปานกลาง';
      bars = 2;
    } else {
      status = 'weak';
      text = 'สัญญาณ GPS อ่อน';
      bars = 1;
    }

    this._updateStatus(status, text, accuracy, bars);
    EventBus.emit('gps:success', position);
  }

  _handleError(error) {
    let status = 'error';
    let text = 'เกิดข้อผิดพลาด GPS';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        text = 'ไม่ได้รับอนุญาตเข้าถึง GPS';
        break;
      case error.POSITION_UNAVAILABLE:
        text = 'ไม่พบสัญญาณ GPS';
        break;
      case error.TIMEOUT:
        text = 'หมดเวลาค้นหา GPS';
        break;
    }

    this._updateStatus(status, text);
    EventBus.emit('gps:error', error);
  }

  _updateStatus(status, text, accuracy = null, bars = 0) {
    appState.set('gps', { status, text, accuracy, bars });
  }
}

export default new GpsService();
```

---

## 2. Performance & Optimization

### 2.1 Service Worker สำหรับ Offline-First

**`service-worker.js`**
```javascript
const CACHE_NAME = 'driver-app-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/app.css',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch - Network First, Cache Fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response ก่อน cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

### 2.2 Lazy Loading สำหรับ Timeline

```javascript
class Timeline {
  constructor(container) {
    this.container = container;
    this.observer = null;
    this.items = [];
  }

  init() {
    this.observer = new IntersectionObserver(
      (entries) => this._handleIntersection(entries),
      { rootMargin: '50px' }
    );
  }

  render(stops) {
    this.items = stops;
    this.container.innerHTML = '';

    stops.forEach((stop, index) => {
      const placeholder = this._createPlaceholder(stop, index);
      this.container.appendChild(placeholder);
      this.observer.observe(placeholder);
    });
  }

  _createPlaceholder(stop, index) {
    const div = document.createElement('div');
    div.className = 'timeline-item-placeholder';
    div.dataset.index = index;
    div.style.minHeight = '120px';
    return div;
  }

  _handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = entry.target.dataset.index;
        const stop = this.items[index];
        
        // Render เฉพาะ item ที่ปรากฏในหน้าจอ
        const content = this._renderStop(stop);
        entry.target.outerHTML = content;
        
        this.observer.unobserve(entry.target);
      }
    });
  }

  _renderStop(stop) {
    // Render HTML ของ stop
    return `<div class="timeline-item">...</div>`;
  }
}
```

### 2.3 Debounce & Throttle

```javascript
// utils/helpers.js
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ใช้งาน
const handleScroll = throttle(() => {
  console.log('Scrolling...');
}, 200);

const handleSearch = debounce((query) => {
  console.log('Searching:', query);
}, 500);
```

---

## 3. Security & Error Handling

### 3.1 Environment Variables

**`config/env.js`**
```javascript
// Development
const DEV_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/DEV_ID/exec',
  LIFF_ID: '1234567890-abcdefgh',
  LOG_LEVEL: 'debug',
  ENABLE_MOCK: true
};

// Production
const PROD_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/PROD_ID/exec',
  LIFF_ID: '1234567890-production',
  LOG_LEVEL: 'error',
  ENABLE_MOCK: false
};

export const APP_CONFIG = process.env.NODE_ENV === 'production' 
  ? PROD_CONFIG 
  : DEV_CONFIG;
```

### 3.2 Comprehensive Error Handling

**`core/ErrorHandler.js`**
```javascript
class ErrorHandler {
  constructor() {
    this.logQueue = [];
    this.maxQueueSize = 50;
    this.flushInterval = 60000; // 1 นาที
    
    this._initGlobalHandlers();
    this._startAutoFlush();
  }

  _initGlobalHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'global_error',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandled_promise',
        message: event.reason?.message || event.reason,
        stack: event.reason?.stack
      });
    });
  }

  logError(error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      userId: appState.get('user.id'),
      reference: appState.get('job.reference'),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...error
    };

    console.error('Error logged:', errorLog);

    this.logQueue.push(errorLog);

    // Flush ถ้าเต็ม
    if (this.logQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.logQueue.length === 0) return;

    const logs = [...this.logQueue];
    this.logQueue = [];

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs })
      });
    } catch (e) {
      console.error('Failed to send error logs:', e);
      // เก็บกลับใน queue
      this.logQueue.push(...logs);
    }
  }

  _startAutoFlush() {
    setInterval(() => this.flush(), this.flushInterval);
  }
}

export default new ErrorHandler();
```

### 3.3 Input Validation

**`utils/validators.js`**
```javascript
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function validateOdometer(value) {
  const num = parseInt(value, 10);
  
  if (isNaN(num)) {
    throw new ValidationError('เลขไมล์ต้องเป็นตัวเลขเท่านั้น', 'odometer');
  }
  
  if (num < 0) {
    throw new ValidationError('เลขไมล์ต้องมากกว่า 0', 'odometer');
  }
  
  if (num > 9999999) {
    throw new ValidationError('เลขไมล์ใหญ่เกินไป', 'odometer');
  }
  
  return num;
}

export function validateReceiverName(value) {
  const trimmed = value.trim();
  
  if (!trimmed) {
    throw new ValidationError('กรุณากรอกชื่อผู้รับ', 'receiverName');
  }
  
  if (trimmed.length < 2) {
    throw new ValidationError('ชื่อผู้รับต้องมีอย่างน้อย 2 ตัวอักษร', 'receiverName');
  }
  
  if (trimmed.length > 100) {
    throw new ValidationError('ชื่อผู้รับยาวเกินไป', 'receiverName');
  }
  
  // ตรวจสอบอักขระพิเศษที่ไม่ต้องการ
  if (!/^[\u0E00-\u0E7Fa-zA-Z\s.'-]+$/.test(trimmed)) {
    throw new ValidationError('ชื่อผู้รับมีอักขระที่ไม่ถูกต้อง', 'receiverName');
  }
  
  return trimmed;
}

export function validateCoordinates(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    throw new ValidationError('พิกัดไม่ถูกต้อง', 'coordinates');
  }
  
  if (latitude < -90 || latitude > 90) {
    throw new ValidationError('ค่า Latitude ไม่ถูกต้อง', 'coordinates');
  }
  
  if (longitude < -180 || longitude > 180) {
    throw new ValidationError('ค่า Longitude ไม่ถูกต้อง', 'coordinates');
  }
  
  // ตรวจสอบพิกัด 0,0 (อาจเป็น error)
  if (latitude === 0 && longitude === 0) {
    throw new ValidationError('ได้รับพิกัด 0,0 ซึ่งไม่น่าจะถูกต้อง', 'coordinates');
  }
  
  return { latitude, longitude };
}
```

---

## 4. UX/UI Improvements

### 4.1 Loading Skeleton

**`components/Skeleton.js`**
```javascript
export class Skeleton {
  static timeline() {
    return `
      <div class="skeleton-timeline">
        ${[1,2,3].map(() => `
          <div class="skeleton-item">
            <div class="skeleton-circle"></div>
            <div class="skeleton-content">
              <div class="skeleton-line skeleton-line-title"></div>
              <div class="skeleton-line skeleton-line-text"></div>
              <div class="skeleton-line skeleton-line-text short"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  static card() {
    return `
      <div class="skeleton-card">
        <div class="skeleton-line skeleton-line-title"></div>
        <div class="skeleton-line skeleton-line-text"></div>
        <div class="skeleton-line skeleton-line-text"></div>
      </div>
    `;
  }
}
```

**CSS:**
```css
.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, 
    var(--input-bg) 25%, 
    var(--input-border) 50%, 
    var(--input-bg) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 8px;
}

.skeleton-line-title {
  height: 16px;
  width: 60%;
}

.skeleton-line-text {
  width: 100%;
}

.skeleton-line-text.short {
  width: 80%;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 4.2 Undo System

**`core/UndoManager.js`**
```javascript
class UndoManager {
  constructor() {
    this.stack = [];
    this.maxSize = 10;
  }

  push(action) {
    this.stack.push({
      action,
      timestamp: Date.now()
    });

    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  }

  async undo() {
    if (this.stack.length === 0) {
      throw new Error('ไม่มีการดำเนินการที่จะยกเลิก');
    }

    const item = this.stack.pop();
    
    // แสดง Toast พร้อมปุ่มยกเลิกการ Undo
    const toastId = Toast.show({
      type: 'info',
      title: 'กำลังยกเลิกการดำเนินการ...',
      message: item.action.description,
      duration: 5000,
      actions: [
        {
          text: 'ยกเลิก',
          onClick: () => {
            this.stack.push(item); // เอากลับคืน
            Toast.close(toastId);
          }
        }
      ]
    });

    try {
      await item.action.undo();
      Toast.update(toastId, {
        type: 'success',
        title: 'ยกเลิกสำเร็จ',
        message: 'ย้อนกลับการดำเนินการแล้ว'
      });
    } catch (error) {
      this.stack.push(item); // เอากลับคืนถ้า error
      Toast.update(toastId, {
        type: 'error',
        title: 'ยกเลิกไม่สำเร็จ',
        message: error.message
      });
    }
  }
}

// ตัวอย่างการใช้งาน
const undoManager = new UndoManager();

// เมื่อ Check-in
async function checkin(stopId, data) {
  const result = await api.checkin(stopId, data);
  
  // บันทึก Undo action
  undoManager.push({
    description: 'Check-in จุดที่ ' + data.sequence,
    undo: async () => {
      await api.undoCheckin(stopId);
    }
  });
  
  return result;
}
```

### 4.3 Confirmation Dialogs

```javascript
class ConfirmationDialog {
  static async show({ title, message, type = 'warning', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก' }) {
    return Swal.fire({
      icon: type,
      title,
      text: message,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      confirmButtonColor: type === 'danger' ? '#e74c3c' : '#1abc9c',
      reverseButtons: true,
      focusCancel: true
    });
  }

  static async dangerZone({ title, message, confirmText = 'ยืนยันการลบ' }) {
    const result = await Swal.fire({
      icon: 'warning',
      title,
      html: `
        <p>${message}</p>
        <div class="danger-confirm">
          <label>พิมพ์ <strong>ยืนยัน</strong> เพื่อดำเนินการต่อ</label>
          <input id="danger-confirm-input" type="text" class="swal2-input" placeholder="พิมพ์: ยืนยัน">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#e74c3c',
      preConfirm: () => {
        const input = document.getElementById('danger-confirm-input').value;
        if (input !== 'ยืนยัน') {
          Swal.showValidationMessage('กรุณาพิมพ์ "ยืนยัน" เพื่อดำเนินการต่อ');
          return false;
        }
        return true;
      }
    });

    return result;
  }
}

// ตัวอย่างการใช้งาน
async function deleteJob() {
  const result = await ConfirmationDialog.dangerZone({
    title: 'ลบงานนี้?',
    message: 'การลบจะไม่สามารถย้อนกลับได้',
    confirmText: 'ลบงาน'
  });

  if (result.isConfirmed) {
    await api.deleteJob();
  }
}
```

### 4.4 Accessibility (ARIA)

```html
<!-- ปรับปรุง HTML ให้มี ARIA attributes -->
<div class="timeline" role="region" aria-label="รายการจุดส่ง">
  <div class="timeline-item" role="article" aria-labelledby="stop-1-title">
    <h3 id="stop-1-title" class="timeline-title">จุดที่ 1: ปั๊ม PTT สาขาลาดพร้าว</h3>
    
    <div class="action-buttons" role="group" aria-label="การดำเนินการ">
      <button 
        type="button"
        aria-label="Check-in จุดที่ 1"
        onclick="checkin(1)"
      >
        📍 Check-in
      </button>
    </div>
  </div>
</div>

<!-- GPS Status -->
<div 
  class="gps-status" 
  role="status" 
  aria-live="polite"
  aria-atomic="true"
>
  <span class="gps-text" id="gps-status-text">GPS พร้อมใช้งาน</span>
</div>

<!-- Loading -->
<div 
  class="loading" 
  role="status" 
  aria-live="assertive"
  aria-busy="true"
>
  <span class="sr-only">กำลังโหลด...</span>
</div>
```

**CSS สำหรับ Screen Readers:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 5. Testing & Documentation

### 5.1 Unit Tests (Jest)

**`tests/services/GpsService.test.js`**
```javascript
import GpsService from '../../js/services/GpsService';

describe('GpsService', () => {
  beforeEach(() => {
    // Mock geolocation API
    global.navigator.geolocation = {
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(),
      clearWatch: jest.fn()
    };
  });

  describe('getCurrentPosition', () => {
    it('should resolve with position on success', async () => {
      const mockPosition = {
        coords: {
          latitude: 13.7563,
          longitude: 100.5018,
          accuracy: 10
        }
      };

      navigator.geolocation.getCurrentPosition.mockImplementation(
        (success) => success(mockPosition)
      );

      const result = await GpsService.getCurrentPosition();
      expect(result).toEqual(mockPosition);
    });

    it('should reject with error on permission denied', async () => {
      const mockError = {
        code: 1,
        message: 'User denied Geolocation'
      };

      navigator.geolocation.getCurrentPosition.mockImplementation(
        (success, error) => error(mockError)
      );

      await expect(GpsService.getCurrentPosition()).rejects.toEqual(mockError);
    });

    it('should reject invalid coordinates (0,0)', async () => {
      const mockPosition = {
        coords: {
          latitude: 0,
          longitude: 0,
          accuracy: 10
        }
      };

      navigator.geolocation.getCurrentPosition.mockImplementation(
        (success) => success(mockPosition)
      );

      // GpsService ต้องตรวจสอบและ reject พิกัด 0,0
      await expect(GpsService.getCurrentPosition()).rejects.toThrow('Invalid coordinates');
    });
  });

  describe('_handleSuccess', () => {
    it('should classify accuracy as excellent (≤20m)', () => {
      const position = {
        coords: { accuracy: 15 }
      };

      GpsService._handleSuccess(position);
      expect(appState.get('gps.status')).toBe('excellent');
      expect(appState.get('gps.bars')).toBe(4);
    });

    it('should classify accuracy as good (≤50m)', () => {
      const position = {
        coords: { accuracy: 35 }
      };

      GpsService._handleSuccess(position);
      expect(appState.get('gps.status')).toBe('good');
      expect(appState.get('gps.bars')).toBe(3);
    });
  });
});
```

### 5.2 Integration Tests (Cypress)

**`cypress/e2e/checkin-flow.cy.js`**
```javascript
describe('Check-in Flow', () => {
  beforeEach(() => {
    // Mock LIFF
    cy.window().then((win) => {
      win.liff = {
        init: () => Promise.resolve(),
        isLoggedIn: () => true,
        getProfile: () => Promise.resolve({
          userId: 'U1234567890',
          displayName: 'Test Driver'
        })
      };
    });

    cy.visit('/');
  });

  it('should complete check-in successfully', () => {
    // ค้นหางาน
    cy.get('#keyword').type('REF001');
    cy.get('#btnSearch').click();

    // รอ timeline โหลด
    cy.get('.timeline').should('be.visible');

    // คลิก Check-in จุดแรก
    cy.contains('button', '📍 Check-in').first().click();

    // กรอกข้อมูล
    cy.get('#swalOdoInput').type('123456');
    cy.get('#swalReceiverName').type('นายสมชาย ใจดี');
    cy.get('input[name="receiverType"][value="manager"]').check();

    // ยืนยัน
    cy.contains('button', 'ยืนยัน Check-in').click();

    // ตรวจสอบผลลัพธ์
    cy.contains('Check-in สำเร็จ').should('be.visible');
    cy.get('.timeline-item').first().should('contain', '✅');
  });

  it('should show validation error for empty odometer', () => {
    cy.get('#keyword').type('REF001');
    cy.get('#btnSearch').click();
    
    cy.contains('button', '📍 Check-in').first().click();
    
    // ไม่กรอกเลขไมล์
    cy.get('#swalReceiverName').type('นายสมชาย');
    cy.get('input[name="receiverType"][value="manager"]').check();
    cy.contains('button', 'ยืนยัน Check-in').click();
    
    // ต้องเห็น validation error
    cy.contains('กรุณากรอกเลขไมล์รถ').should('be.visible');
  });

  it('should handle GPS error gracefully', () => {
    // Mock GPS error
    cy.window().then((win) => {
      win.navigator.geolocation.getCurrentPosition = (success, error) => {
        error({ code: 1, message: 'Permission denied' });
      };
    });

    cy.get('#keyword').type('REF001');
    cy.get('#btnSearch').click();
    cy.contains('button', '📍 Check-in').first().click();
    
    // กรอกข้อมูลครบ
    cy.get('#swalOdoInput').type('123456');
    cy.get('#swalReceiverName').type('นายสมชาย');
    cy.get('input[name="receiverType"][value="manager"]').check();
    cy.contains('button', 'ยืนยัน Check-in').click();
    
    // ต้องเห็น error message
    cy.contains('ไม่สามารถดึงพิกัดจากอุปกรณ์ได้').should('be.visible');
  });
});
```

### 5.3 API Documentation

**`docs/API.md`**
```markdown
# Driver App API Documentation

## Overview
Base URL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec`

## Authentication
- ใช้ LIFF userId สำหรับ authentication
- ส่งใน body ของทุก request เป็น `userId` parameter

## Endpoints

### 1. Search Job
ค้นหางานด้วย Reference Number

**Request:**
```http
POST /
Content-Type: application/x-www-form-urlencoded

action=search&reference=REF001&userId=U1234567890
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "reference": "REF001",
    "vehicle": "80-1234 กทม",
    "drivers": [
      {
        "driverName": "นายสมชาย ใจดี",
        "licenseNo": "12345678",
        "alcoholChecked": false
      }
    ],
    "stops": [
      {
        "rowIndex": 5,
        "seq": 1,
        "destination": "ปั๊ม PTT สาขาลาดพร้าว",
        "checkInTime": null,
        "checkOutTime": null,
        "lat": 13.7563,
        "lng": 100.5018
      }
    ],
    "jobClosed": false,
    "tripEnded": false
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "ไม่พบงานตามเลข Reference ที่ระบุ"
}
```

---

### 2. Update Stop Status
อัปเดตสถานะของจุดส่ง (Check-in, Fueling, Unload, Check-out)

**Request:**
```http
POST /
Content-Type: application/x-www-form-urlencoded

action=updatestop
&reference=REF001
&userId=U1234567890
&rowIndex=5
&newStatus=CHECKIN
&type=checkin
&seq=1
&lat=13.7563
&lng=100.5018
&odo=123456
&receiverName=นายสมชาย
&receiverType=manager
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | Yes | `updatestop` |
| reference | string | Yes | Reference Number |
| userId | string | Yes | LINE User ID |
| rowIndex | number | Yes | Row index in Google Sheets |
| newStatus | string | Yes | `CHECKIN`, `FUELING`, `UNLOAD_DONE`, `CHECKOUT` |
| type | string | Yes | `checkin`, `fuel`, `unload`, `checkout` |
| seq | number | Yes | Sequence number |
| lat | number | Yes | Latitude |
| lng | number | Yes | Longitude |
| odo | string | No | Odometer reading |
| receiverName | string | No | Receiver name (for non-origin stops) |
| receiverType | string | No | `manager`, `frontHasCard`, `frontNoCard` |
| hasPumping | string | No | `yes`, `no` (for checkout) |
| hasTransfer | string | No | `yes`, `no` (for checkout) |

**Response:**
```json
{
  "success": true,
  "stop": {
    "rowIndex": 5,
    "status": "CHECKIN",
    "timestamp": "15/01/2026 10:30:00"
  }
}
```

---

[... ต่อสำหรับ endpoint อื่นๆ ...]
```

### 5.4 Inline Documentation (JSDoc)

```javascript
/**
 * อัปเดตสถานะของจุดส่งและบันทึกพิกัด GPS
 * 
 * @param {number} rowIndex - Row index ใน Google Sheets
 * @param {string} newStatus - สถานะใหม่ ('CHECKIN', 'FUELING', 'UNLOAD_DONE', 'CHECKOUT')
 * @param {string} type - ประเภทการดำเนินการ ('checkin', 'fuel', 'unload', 'checkout')
 * @param {number} seq - ลำดับจุดส่ง
 * @param {string} [odo] - เลขไมล์รถ (optional)
 * @param {string} [receiverName] - ชื่อผู้รับ (optional, สำหรับ non-origin stops)
 * @param {string} [receiverType] - ประเภทผู้รับ (optional: 'manager', 'frontHasCard', 'frontNoCard')
 * @param {string} [hasPumping] - มีปั่นน้ำมันหรือไม่ (optional: 'yes', 'no')
 * @param {string} [hasTransfer] - มีโยกน้ำมันหรือไม่ (optional: 'yes', 'no')
 * 
 * @returns {Promise<void>}
 * 
 * @throws {ValidationError} ถ้าข้อมูล input ไม่ถูกต้อง
 * @throws {GpsError} ถ้าไม่สามารถดึงพิกัด GPS ได้
 * @throws {ApiError} ถ้า API request ล้มเหลว
 * 
 * @example
 * // Check-in จุดแรก
 * await updateStopStatus(5, 'CHECKIN', 'checkin', 1, '123456', 'นายสมชาย', 'manager');
 * 
 * @example
 * // Checkout จุดปลายทาง
 * await updateStopStatus(10, 'CHECKOUT', 'checkout', 3, null, null, null, 'no', 'yes');
 */
async function updateStopStatus(
  rowIndex, 
  newStatus, 
  type, 
  seq, 
  odo = null, 
  receiverName = null, 
  receiverType = null,
  hasPumping = null,
  hasTransfer = null
) {
  // Implementation...
}
```

---

## 6. Advanced Features

### 6.1 Real-time Sync (WebSocket/SSE)

```javascript
class RealtimeService {
  constructor() {
    this.eventSource = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
  }

  connect() {
    const userId = appState.get('user.id');
    const reference = appState.get('job.reference');
    
    if (!userId || !reference) return;

    const url = `${API_URL}/stream?userId=${userId}&reference=${reference}`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('status-update', (event) => {
      const data = JSON.parse(event.data);
      this._handleStatusUpdate(data);
    });

    this.eventSource.addEventListener('new-stop', (event) => {
      const data = JSON.parse(event.data);
      this._handleNewStop(data);
    });

    this.eventSource.onerror = () => {
      this.eventSource.close();
      this._reconnect();
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  _handleStatusUpdate(data) {
    // อัปเดต UI แบบ real-time
    Toast.show({
      type: 'status',
      title: 'สถานะอัปเดต',
      message: `จุดที่ ${data.seq} มีการเปลี่ยนแปลง`
    });

    // Refresh data
    search(true); // silent refresh
  }

  _handleNewStop(data) {
    Toast.show({
      type: 'newjob',
      title: 'มีจุดส่งใหม่',
      message: `เพิ่มจุดที่ ${data.seq}: ${data.destination}`
    });

    search(true);
  }

  _reconnect() {
    setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2, 
        this.maxReconnectDelay
      );
    }, this.reconnectDelay);
  }
}
```

### 6.2 Progressive Web App (PWA)

**`manifest.json`**
```json
{
  "name": "Driver Tracking App",
  "short_name": "Driver App",
  "description": "แอปติดตามการส่งน้ำมันสำหรับพนักงานขับรถ",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f4f8f7",
  "theme_color": "#1abc9c",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 6.3 Analytics & Monitoring

```javascript
class AnalyticsService {
  constructor() {
    this.sessionId = this._generateSessionId();
    this.events = [];
  }

  track(eventName, properties = {}) {
    const event = {
      sessionId: this.sessionId,
      eventName,
      properties,
      timestamp: Date.now(),
      userId: appState.get('user.id'),
      reference: appState.get('job.reference'),
      page: window.location.pathname,
      userAgent: navigator.userAgent
    };

    this.events.push(event);

    // Send to analytics service
    this._send(event);
  }

  trackTiming(category, variable, value) {
    this.track('timing', {
      category,
      variable,
      value,
      unit: 'ms'
    });
  }

  async _send(event) {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (e) {
      // Store in queue for retry
      console.error('Analytics error:', e);
    }
  }

  _generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

const analytics = new AnalyticsService();

// ตัวอย่างการใช้งาน
analytics.track('page_view');
analytics.track('search', { reference: 'REF001' });
analytics.track('checkin', { sequence: 1, duration: 1500 });
analytics.trackTiming('api', 'search_request', 850);
```

### 6.4 Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
  }

  start(label) {
    this.marks.set(label, performance.now());
  }

  end(label) {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`No start mark for: ${label}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.measures.push({ label, duration });

    analytics.trackTiming('performance', label, duration);

    // Warning ถ้าช้าเกินไป
    if (duration > 3000) {
      console.warn(`⚠️ Slow operation: ${label} took ${duration}ms`);
    }

    this.marks.delete(label);
    return duration;
  }

  report() {
    console.table(this.measures);
  }
}

const perf = new PerformanceMonitor();

// ตัวอย่างการใช้งาน
async function search(reference) {
  perf.start('search_total');
  
  perf.start('api_request');
  const data = await api.search(reference);
  perf.end('api_request');
  
  perf.start('render_timeline');
  renderTimeline(data.stops);
  perf.end('render_timeline');
  
  const totalTime = perf.end('search_total');
  console.log(`Search completed in ${totalTime}ms`);
}
```

---

## 🎯 Implementation Checklist

### Priority 1: Critical (ทำทันที)
- [ ] แยก CSS ออกเป็นไฟล์ต่างหาก
- [ ] แยก JavaScript ออกเป็น modules
- [ ] เพิ่ม comprehensive error handling
- [ ] เพิ่ม input validation
- [ ] ปรับ auto-refresh interval เป็น 30-60 วิ

### Priority 2: Important (ทำภายใน 1 สัปดาห์)
- [ ] สร้าง State Management system
- [ ] เพิ่ม Service Worker
- [ ] เพิ่ม Loading Skeleton
- [ ] เพิ่ม Undo System
- [ ] เขียน Unit Tests

### Priority 3: Nice to Have (ทำภายใน 1 เดือน)
- [ ] เพิ่ม Real-time Sync
- [ ] สร้าง PWA
- [ ] เพิ่ม Analytics
- [ ] เพิ่ม Performance Monitoring
- [ ] เขียน Documentation ครบถ้วน

---

## 📚 Resources

### Learning Materials
- [MDN Web Docs - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev - Performance](https://web.dev/performance/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Cypress Documentation](https://docs.cypress.io/)

### Tools
- **Bundler:** Vite, Webpack, or Rollup
- **Testing:** Jest + Cypress
- **Linting:** ESLint + Prettier
- **Monitoring:** Sentry, LogRocket
- **Analytics:** Google Analytics, Mixpanel

---

## 🚀 Quick Start

```bash
# 1. โครงสร้างโปรเจค
npm init -y
npm install vite @vitejs/plugin-legacy

# 2. ติดตั้ง dependencies
npm install sweetalert2

# 3. ติดตั้ง dev dependencies
npm install -D jest @testing-library/jest-dom cypress eslint prettier

# 4. Build
npm run build

# 5. Deploy
npm run deploy
```

---

**หมายเหตุ:** การปรับปรุงทั้งหมดนี้จะทำให้โค้ดมีคุณภาพสูงขึ้น maintainable มากขึ้น และ user experience ดีขึ้นอย่างมาก ทำให้ได้คะแนน **10/10** แน่นอน! 🎉
