/**
 * Enhanced UX Features for Driver Tracking App
 * - Pull-to-Refresh
 * - Quick Actions Bar
 * - Toast Notifications
 * - Syncing Bar
 * - Notification Settings
 */

// ========================================
// PULL-TO-REFRESH
// ========================================
let ptrStartY = 0;
let ptrCurrentY = 0;
let isPulling = false;

function initPullToRefresh() {
  const appShell = document.getElementById('appShell');
  const ptrIndicator = document.getElementById('ptrIndicator');
  const ptrIcon = document.getElementById('ptrIcon');
  const ptrText = document.getElementById('ptrText');

  appShell.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      ptrStartY = e.touches[0].clientY;
      isPulling = true;
      ptrIndicator.style.transition = 'none'; // Disable transition during pull
    }
  });

  appShell.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    
    ptrCurrentY = e.touches[0].clientY;
    const diff = ptrCurrentY - ptrStartY;

    if (diff > 0) {
      ptrIndicator.style.opacity = '1';
      const pullDistance = Math.max(0, diff - 60);
      ptrIndicator.style.transform = `translateX(-50%) translateY(${pullDistance}px)`;

      if (diff < 150) {
        ptrIcon.style.transform = `rotate(${diff * 2}deg)`;
        ptrText.textContent = 'ดึงลงเพื่อรีเฟรช';
      } else {
        ptrIcon.style.transform = 'none';
        ptrIcon.textContent = '↻';
        ptrText.textContent = 'ปล่อยเพื่อรีเฟรช';
      }
    }
  });

  appShell.addEventListener('touchend', async () => {
    if (!isPulling) return;
    
    ptrIndicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    const diff = ptrCurrentY - ptrStartY;
    
    if (diff >= 150) {
      ptrIndicator.style.transform = 'translateX(-50%) translateY(40px)'; // Hold position while refreshing
      ptrIcon.style.display = 'none';
      ptrIndicator.querySelector('.ptr-spinner').style.display = 'block';
      ptrText.textContent = 'กำลังรีเฟรช...';
      
      // Trigger refresh
      if (window.DriverApp && typeof window.DriverApp.search === 'function') {
        await window.DriverApp.search(true); // silent refresh
      }
      
      setTimeout(() => {
        ptrIndicator.style.transform = 'translateX(-50%) translateY(-70px)';
        ptrIndicator.style.opacity = '0';
        ptrIcon.style.display = 'block';
        ptrIndicator.querySelector('.ptr-spinner').style.display = 'none';
        ptrIcon.textContent = '↓';
        ptrIcon.style.transform = 'rotate(0deg)';
      }, 500);
    } else {
      ptrIndicator.style.transform = 'translateX(-50%) translateY(-70px)';
      ptrIndicator.style.opacity = '0';
    }
    
    isPulling = false;
    ptrStartY = 0;
    ptrCurrentY = 0;
  });
}

// ========================================
// QUICK ACTIONS BAR
// ========================================
function showQuickActions(stop) {
  const quickActions = document.getElementById('quickActions');
  const quickActionsStop = document.getElementById('quickActionsStop');
  const quickActionsButtons = document.getElementById('quickActionsButtons');

  if (!stop) {
    hideQuickActions();
    return;
  }

  quickActionsStop.textContent = stop.stopName || `จุดที่ ${stop.stop_number}`;
  
  // Generate buttons based on stop status
  let buttons = '';

  // Ensure required properties exist
  const rowIndex = stop.rowIndex ?? stop.id ?? '';
  const seq = stop.seq ?? stop.stop_number ?? 0;
  const shipToCode = stop.shipToCode ?? stop.shipToCode ?? '';

  if (!stop.checkinTime) {
    buttons += '<button class="quick-action-btn" onclick="window.DriverApp?.startCheckin(\'' + rowIndex + '\', ' + seq + ', \'' + shipToCode + '\')">✅ Check-in</button>';
  } else if (!stop.fuelTime) {
    buttons += '<button class="quick-action-btn" onclick="window.DriverApp?.doFuel(\'' + rowIndex + '\', ' + seq + ', \'' + shipToCode + '\')">⛽ ลงน้ำมัน</button>';
  } else if (!stop.unloadTime) {
    buttons += '<button class="quick-action-btn" onclick="window.DriverApp?.doUnload(\'' + rowIndex + '\', ' + seq + ', \'' + shipToCode + '\')">📦 ลงเสร็จ</button>';
  } else if (!stop.checkoutTime) {
    buttons += '<button class="quick-action-btn" onclick="window.DriverApp?.startCheckout(\'' + rowIndex + '\', ' + seq + ', \'' + shipToCode + '\')">🏁 Check-out</button>';
  }

  quickActionsButtons.innerHTML = buttons;
  quickActions.classList.remove('hidden');
}

function hideQuickActions() {
  const quickActions = document.getElementById('quickActions');
  quickActions.classList.add('hidden');
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(type, title, message, duration = 3000) {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${getToastIcon(type)}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function getToastIcon(type) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[type] || 'ℹ️';
}

function clearAllToasts() {
  const container = document.getElementById('toastContainer');
  container.innerHTML = '';
}

// ========================================
// SYNCING BAR
// ========================================
function showSyncingBar() {
  const syncingBar = document.getElementById('syncingBar');
  syncingBar.classList.add('show');
}

function hideSyncingBar() {
  const syncingBar = document.getElementById('syncingBar');
  syncingBar.classList.remove('show');
}

// ========================================
// NOTIFICATION SETTINGS
// ========================================
async function openNotificationSettings() {
  const result = await Swal.fire({
    title: '🔔 ตั้งค่าการแจ้งเตือน',
    html: `
      <div style="text-align:left;padding:10px;">
        <label style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
          <input type="checkbox" id="notifCheckIn" checked>
          <span>แจ้งเตือนเมื่อ Check-in สำเร็จ</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
          <input type="checkbox" id="notifCheckOut" checked>
          <span>แจ้งเตือนเมื่อ Check-out สำเร็จ</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
          <input type="checkbox" id="notifAlcohol" checked>
          <span>แจ้งเตือนเมื่อตรวจแอลกอฮอล์สำเร็จ</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="notifSync" checked>
          <span>แจ้งเตือนเมื่อซิงค์ Offline Queue</span>
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    const settings = {
      checkIn: document.getElementById('notifCheckIn').checked,
      checkOut: document.getElementById('notifCheckOut').checked,
      alcohol: document.getElementById('notifAlcohol').checked,
      sync: document.getElementById('notifSync').checked
    };

    localStorage.setItem('notification_settings', JSON.stringify(settings));
    showToast('success', 'บันทึกสำเร็จ', 'ตั้งค่าการแจ้งเตือนเรียบร้อย');
  }
}

function getNotificationSettings() {
  const defaultSettings = {
    checkIn: true,
    checkOut: true,
    alcohol: true,
    sync: true
  };

  const saved = localStorage.getItem('notification_settings');
  return saved ? JSON.parse(saved) : defaultSettings;
}

// ========================================
// INIT & EXPORT
// ========================================
function initEnhancedUX() {
  initPullToRefresh();

  // Bind notification button
  document.getElementById('notificationBtn')?.addEventListener('click', openNotificationSettings);

  // Bind quick actions close button
  document.getElementById('quickActionsClose')?.addEventListener('click', hideQuickActions);

  console.log('✅ Enhanced UX features loaded');
}

// Export for ES module usage
export {
  initEnhancedUX,
  showQuickActions,
  hideQuickActions,
  showToast,
  clearAllToasts,
  showSyncingBar,
  hideSyncingBar,
  openNotificationSettings,
  getNotificationSettings
};

// Also export to window for global access (backward compatibility)
window.showQuickActions = showQuickActions;
window.hideQuickActions = hideQuickActions;
window.showToast = showToast;
window.clearAllToasts = clearAllToasts;
window.showSyncingBar = showSyncingBar;
window.hideSyncingBar = hideSyncingBar;
window.openNotificationSettings = openNotificationSettings;
window.getNotificationSettings = getNotificationSettings;

console.log('✅ Enhanced UX Helper loaded');
