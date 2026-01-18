/**
 * Driver Tracking App - GPS Functions
 */

import { APP_CONFIG } from './config.js';

/**
 * Get current position as Promise
 */
export function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: APP_CONFIG.GPS.enableHighAccuracy,
      timeout: APP_CONFIG.GPS.timeout,
      maximumAge: APP_CONFIG.GPS.maximumAge
    });
  });
}

/**
 * Check and update GPS status UI
 */
export function checkGpsStatus() {
  const statusEl = document.getElementById('gpsStatus');
  const textEl = document.getElementById('gpsText');
  const accuracyEl = document.getElementById('gpsAccuracy');

  if (!statusEl || !textEl || !accuracyEl) return;

  const bars = statusEl.querySelectorAll('.gps-bar');

  statusEl.className = 'gps-status checking';
  textEl.textContent = 'กำลังตรวจสอบ GPS...';
  accuracyEl.textContent = '';
  bars.forEach(b => b.classList.remove('active'));

  getCurrentPositionAsync()
    .then(pos => {
      const accuracy = pos.coords.accuracy;
      const thresholds = APP_CONFIG.GPS.accuracyThresholds;
      let status, text, activeBars;

      if (accuracy <= thresholds.excellent) {
        status = 'good';
        text = 'GPS พร้อมใช้งาน (แม่นยำ)';
        activeBars = 4;
      } else if (accuracy <= thresholds.good) {
        status = 'good';
        text = 'GPS พร้อมใช้งาน';
        activeBars = 3;
      } else if (accuracy <= thresholds.weak) {
        status = 'weak';
        text = 'สัญญาณ GPS อ่อน';
        activeBars = 2;
      } else {
        status = 'weak';
        text = 'สัญญาณ GPS อ่อนมาก';
        activeBars = 1;
      }

      statusEl.className = 'gps-status ' + status;
      textEl.textContent = text;
      accuracyEl.textContent = '±' + Math.round(accuracy) + 'm';
      bars.forEach((b, i) => {
        if (i < activeBars) b.classList.add('active');
      });
    })
    .catch(err => {
      let message = 'ไม่สามารถเข้าถึง GPS';

      if (err.code === 1) {
        message = 'ผู้ใช้ปฏิเสธการเข้าถึง GPS';
      } else if (err.code === 2) {
        message = 'ไม่สามารถระบุตำแหน่งได้';
      } else if (err.code === 3) {
        message = 'หมดเวลาการเข้าถึง GPS';
      }

      statusEl.className = 'gps-status error';
      textEl.textContent = message;
      accuracyEl.textContent = '';
    });
}

/**
 * Navigate to coordinates
 */
export function navigateToCoords(lat, lng) {
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

/**
 * Calculate haversine distance between two points in meters.
 * Replicates logic from driverjob.js
 */
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
