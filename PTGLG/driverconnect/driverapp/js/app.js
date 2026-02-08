/**
 * Driver Tracking App - Main Application
 * Supabase Version
 */

// Debounce flag to prevent realtime updates from interfering immediately after local updates
let lastLocalUpdateTime = 0;
const REALTIME_DEBOUNCE_MS = 2000; // Ignore realtime updates for 2s after local update

import { LIFF_ID, APP_CONFIG, REGISTRATION_URL } from './config.js';
import { escapeHtml, sanitizeInput, validateInput, withRetry, fileToBase64, vibrateSuccess, vibrateError, vibrateWarning, vibrateNotification, vibrateImpact, formatDuration } from './utils.js';
import { OfflineQueue, executeOrQueue, initOfflineQueue, isOnline, setCurrentReference } from './offline-queue.js';
import { initSupabase, SupabaseAPI } from './supabase-api.js';
import { getCurrentPositionAsync, checkGpsStatus, navigateToCoords, haversineDistanceMeters } from './gps.js';
import {
  showLoading, closeLoading, showError, showSuccess, showInfo,
  showInlineFlex, showInlineFlexCustom, showInputError, clearInputError,
  showSkeleton, hideSkeleton, recordLastUpdated, hideLastUpdatedContainer,
  showEmptyState, showLoadingSkeleton, showTripSummary,
  ThemeManager
} from './ui.js';
import { liveTracking } from './live-tracking.js';
import { StateManager, StateKeys, ErrorCodes, getErrorInfo } from './state-manager.js';
import { initEnhancedUX } from './enhanced-ux.js';
import { initBreakdownModal } from './breakdown.js';
import { initBreakdownReport } from './breakdown-report.js';

// ============================================
// SEARCH FUNCTION
// ============================================
async function search(isSilent = false) {
  // User Approval Check (reverted to 'APPROVED' as per user request)
  const currentUserProfile = StateManager.get(StateKeys.USER_PROFILE);
  if (currentUserProfile?.status !== 'APPROVED') {
    showError('คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ', 'กรุณาติดต่อผู้ดูแล');
    return;
  }

  const keywordRaw = document.getElementById('keyword').value;
  const btn = document.getElementById('btnSearch');

  // Clear previous errors
  clearInputError('keyword', 'keywordError');

  // Validate input
  const validation = validateInput(keywordRaw, 'reference');
  if (!validation.valid) {
    showInputError('keyword', 'keywordError', validation.message);
    return;
  }

  const keyword = validation.value || sanitizeInput(keywordRaw);

  if (!keyword) {
    showInputError('keyword', 'keywordError', 'กรุณากรอกเลข Reference');
    return;
  }

  btn.disabled = true;

  if (!isSilent) {
    // Show loading skeleton instead of simple spinner
    showLoadingSkeleton('timeline', 'timeline');
    showLoadingSkeleton('summary', 'summary');
  }

  try {
    const result = await withRetry(
      () => SupabaseAPI.search(keyword, StateManager.get(StateKeys.USER_ID)),
      {
        ...APP_CONFIG.RETRY,
        onRetry: (attempt, waitTime) => {
          console.log(`🔄 Retry ${attempt}, waiting ${waitTime}ms...`);
        }
      }
    );

    if (!isSilent) hideSkeleton();

    if (!result.success) {
      clearResult();
      // Show empty state with error
      const timelineContainer = document.getElementById('timelineContainer');
      timelineContainer.classList.remove('hidden');
      showEmptyState('timeline', {
        icon: '❌',
        title: 'ไม่พบงาน',
        message: result.message || 'ไม่พบเลขอ้างอิงงานนี้ในระบบ',
        actionText: '🔄 ลองอีกครั้ง',
        actionCallback: () => document.getElementById('btnSearch').click()
      });
      return;
    }

    const d = result.data;
    const source = result.source || 'unknown';

    const stops = d.stops || [];
    const reference = d.referenceNo || keyword;
    const vehicleDesc = d.vehicleDesc || '';
    const drivers = d.alcohol?.drivers || [];
    const checkedDrivers = [...new Set(d.alcohol?.checkedDrivers || [])];

    // Update state atomically
    StateManager.batch(() => {
      StateManager.set(StateKeys.LAST_STOPS, stops);
      StateManager.set(StateKeys.CURRENT_REFERENCE, reference);
      StateManager.set(StateKeys.CURRENT_VEHICLE_DESC, vehicleDesc);
      StateManager.set(StateKeys.CURRENT_DRIVERS, drivers);
      StateManager.set(StateKeys.CURRENT_CHECKED_DRIVERS, checkedDrivers);
      StateManager.set(StateKeys.ALCOHOL_ALL_DONE, drivers.length > 0 && drivers.every(n => checkedDrivers.includes(n)));
      const jobClosed = !!d.jobClosed;
      const tripEnded = !!d.tripEnded;
      StateManager.set(StateKeys.JOB_CLOSED, jobClosed);
      StateManager.set(StateKeys.TRIP_ENDED, tripEnded);
      console.log('📊 Job status from database:', { jobClosed, tripEnded, jobData: d.jobClosed, tripData: d.tripEnded });
    });

    setCurrentReference(reference);
    localStorage.setItem(APP_CONFIG.LAST_REFERENCE_KEY, reference);

    // Update user's last searched reference
    const currentUserId = StateManager.get(StateKeys.USER_ID);
    if (currentUserId && currentUserId.startsWith('U')) {
      SupabaseAPI.updateUserLastReference(currentUserId, reference);
    }

    renderSummary(d, source);
    renderAlcoholSection();
    renderTripDashboard(stops, reference);
    renderTimeline(stops, reference);
    recordLastUpdated();

    // Show force refresh button when job is loaded
    document.getElementById('btnForceRefresh').classList.remove('hidden');

    // Subscribe to realtime updates
    SupabaseAPI.subscribeToJob(reference, (payload) => {
      // Ignore realtime updates if we just did a local update (prevents race conditions)
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateTime;
      if (timeSinceLastUpdate < REALTIME_DEBOUNCE_MS) {
        console.log(`📡 Realtime update ignored (debounce: ${timeSinceLastUpdate}ms ago)`);
        return;
      }
      console.log('📡 Realtime update, refreshing...');
      search(true);
    });

  } catch (err) {
    console.error(err);
    if (!isSilent) hideSkeleton();
    showError('เกิดข้อผิดพลาดในการเชื่อมต่อกับ Supabase (ลองใหม่แล้ว 3 ครั้ง)');
  } finally {
    btn.disabled = false;
  }
}

// ============================================
// CLEAR RESULT
// ============================================
function clearResult() {
  document.getElementById('summary').classList.add('hidden');
  document.getElementById('timelineContainer').classList.add('hidden');
  document.getElementById('summary').innerHTML = '';
  document.getElementById('timeline').innerHTML = '';
  document.getElementById('closeJobContainer').classList.add('hidden');
  document.getElementById('alcoholContainer').classList.add('hidden');
  document.getElementById('btnForceRefresh').classList.add('hidden');
  hideSkeleton();
  StateManager.reset();
  hideLastUpdatedContainer();

  SupabaseAPI.unsubscribe();
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderSummary(d, source = 'unknown') {
  const summaryEl = document.getElementById('summary');
  const stops = d.stops || [];
  const totalQtyAll = stops.reduce((acc, s) => acc + (s.totalQty || 0), 0);

  // Count unique stops by shipToCode/shipToName (exclude origin and คลังศรีราชา)
  const filteredStops = stops.filter(stop =>
    stop.shipToName &&
    !stop.shipToName.includes('คลังศรีราชา') &&
    !stop.isOriginStop
  );
  const uniqueStopKeys = new Set();
  filteredStops.forEach(stop => {
    const key = stop.shipToCode && stop.shipToCode.trim()
      ? stop.shipToCode
      : stop.shipToName || `seq_${stop.seq}`;
    uniqueStopKeys.add(key);
  });
  const uniqueStopCount = uniqueStopKeys.size;

  // Determine source badge
  let sourceBadge = '';
  if (source === 'jobdata') {
    sourceBadge = '<span class="badge" style="background:#3ecf8e;font-size:0.7rem;margin-left:4px;">jobdata</span>';
  } else if (source === 'driver_jobs') {
    sourceBadge = '<span class="badge" style="background:#f39c12;font-size:0.7rem;margin-left:4px;">driver_jobs→synced</span>';
  }

  summaryEl.innerHTML = `
    <div class="summary-row"><span class="summary-label">Reference</span><span class="summary-value">${escapeHtml(d.referenceNo)}${sourceBadge}</span></div>
    <div class="summary-row"><span class="summary-label">ชื่อรถ</span><span class="summary-value">${escapeHtml(d.vehicleDesc) || '-'}</span></div>
    <div class="summary-row"><span class="summary-label">จำนวนจุดส่ง</span><span class="summary-value">${uniqueStopCount} จุด</span></div>
    <div class="summary-row"><span class="summary-label">ปริมาณรวม</span><span class="summary-value">${totalQtyAll || 0}</span></div>
  `;
  summaryEl.classList.remove('hidden');
}

function renderAlcoholSection() {
  const container = document.getElementById('alcoholContainer');
  const currentDrivers = StateManager.get(StateKeys.CURRENT_DRIVERS) || [];
  const currentCheckedDrivers = StateManager.get(StateKeys.CURRENT_CHECKED_DRIVERS) || [];

  if (!currentDrivers || currentDrivers.length === 0) {
    container.classList.add('hidden');
    return;
  }

  let html = `<div style="font-weight:600;margin-bottom:4px;">เป่าแอลกอฮอล์ก่อนเริ่มงาน</div>`;

  currentDrivers.forEach(name => {
    const checked = currentCheckedDrivers.includes(name);
    const displayName = escapeHtml(name);
    const jsName = escapeHtml(name.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));

    html += `<div style="margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
      <span>${displayName}</span>
      ${checked
        ? '<button class="btn-small btn-secondary" disabled>ตรวจแล้ว</button>'
        : `<button class="btn-small btn-outline" onclick="window.DriverApp.doAlcoholCheck('${jsName}')">บันทึกผลแอลกอฮอล์</button>`
      }
    </div>`;
  });

  container.innerHTML = html;
  container.classList.remove('hidden');
}

/**
 * Render Trip Dashboard with grouped stops
 * Groups stops by shipToCode/shipToName for mini dots display
 */
function renderTripDashboard(stops, reference) {
  const dashboard = document.getElementById('tripDashboard');
  const refEl = document.getElementById('tripRef');
  const completedEl = document.getElementById('tripCompleted');
  const durationEl = document.getElementById('tripDuration');
  const progressPercentEl = document.getElementById('tripProgressPercent');
  const progressFillEl = document.getElementById('tripProgressFill');
  const stopsMiniEl = document.getElementById('tripStopsMini');

  if (!dashboard) return;

  // Hide if no stops or no reference
  if (!stops || stops.length === 0 || !reference) {
    dashboard.classList.add('hidden');
    return;
  }

  dashboard.classList.remove('hidden');

  // Reference
  if (refEl) {
    refEl.textContent = reference;
  }

  // Filter out origin stops and "คลังศรีราชา"
  const filteredStops = stops.filter(stop =>
    stop.shipToName &&
    !stop.shipToName.includes('คลังศรีราชา') &&
    !stop.isOriginStop
  );

  // Group stops by shipToCode for counting and mini dots
  const grouped = {};
  const groupOrder = [];

  filteredStops.forEach(stop => {
    const key = stop.shipToCode && stop.shipToCode.trim()
      ? stop.shipToCode
      : stop.shipToName || `seq_${stop.seq}`;

    if (!grouped[key]) {
      grouped[key] = {
        shipToCode: stop.shipToCode,
        shipToName: stop.shipToName,
        seq: stop.seq,
        allSeqs: [stop.seq],
        stops: []
      };
      groupOrder.push(key);
    } else {
      if (!grouped[key].allSeqs.includes(stop.seq)) {
        grouped[key].allSeqs.push(stop.seq);
      }
    }
    grouped[key].stops.push(stop);
  });

  // Count completed stops (all items in group checked out)
  let completedCount = 0;
  let inProgressCount = 0;
  let firstCheckinTime = null;
  let lastCheckoutTime = null;

  groupOrder.forEach(key => {
    const group = grouped[key];
    // Group is complete only if ALL stops in group are checked out
    const groupCompleted = group.stops.every(s => !!s.checkOutTime);
    const groupInProgress = group.stops.some(s => !!s.checkInTime) && !groupCompleted;

    if (groupCompleted) {
      completedCount++;
    } else if (groupInProgress) {
      inProgressCount++;
    }

    // Track times from individual stops
    group.stops.forEach(stop => {
      if (stop.checkOutTime) {
        const coTime = new Date(stop.checkOutTime);
        if (!lastCheckoutTime || coTime > lastCheckoutTime) {
          lastCheckoutTime = coTime;
        }
      }
      if (stop.checkInTime) {
        const ciTime = new Date(stop.checkInTime);
        if (!firstCheckinTime || ciTime < firstCheckinTime) {
          firstCheckinTime = ciTime;
        }
      }
    });
  });

  const totalGroups = groupOrder.length;

  // Update completed count
  if (completedEl) {
    completedEl.textContent = `${completedCount}/${totalGroups}`;
  }

  // Update duration
  if (durationEl) {
    if (firstCheckinTime) {
      const endTime = lastCheckoutTime || new Date();
      const durationMs = endTime - firstCheckinTime;
      durationEl.textContent = formatDuration(durationMs);
    } else {
      durationEl.textContent = '-';
    }
  }

  // Update progress bar
  const progressPercent = totalGroups > 0 ? Math.round((completedCount / totalGroups) * 100) : 0;
  if (progressPercentEl) {
    progressPercentEl.textContent = `${progressPercent}%`;
  }
  if (progressFillEl) {
    progressFillEl.style.width = `${progressPercent}%`;
  }

  // Render mini stop dots (GROUPED by shipToCode/shipToName)
  if (stopsMiniEl) {
    let dotsHtml = '';
    groupOrder.forEach(key => {
      const group = grouped[key];
      const seq = group.seq || '?';
      const allSeqsStr = group.allSeqs.length > 1 ? group.allSeqs.join(', ') : seq;
      let dotClass = 'trip-stop-dot';

      // Check group status
      const groupCompleted = group.stops.every(s => !!s.checkOutTime);
      const groupInProgress = group.stops.some(s => !!s.checkInTime) && !groupCompleted;

      if (groupCompleted) {
        dotClass += ' completed';
      } else if (groupInProgress) {
        dotClass += ' in-progress';
      } else {
        dotClass += ' pending';
      }

      // Show badge for multiple items in group
      const countBadge = group.stops.length > 1
        ? `<span class="trip-stop-dot-count">${group.stops.length}</span>`
        : '';

      dotsHtml += `<div class="${dotClass}" title="${group.shipToName || 'จุดที่ ' + allSeqsStr}">${seq}${countBadge}</div>`;
    });
    stopsMiniEl.innerHTML = dotsHtml;
  }
}

// Track current job reference to prevent mixing timeline items from different jobs
let currentTimelineJobRef = null;

function renderTimeline(stops, jobReference = null) {
  const container = document.getElementById('timelineContainer');
  const ul = document.getElementById('timeline');
  const closeJobContainer = document.getElementById('closeJobContainer');
  const btnCloseJob = document.getElementById('btnCloseJob');
  const btnEndTrip = document.getElementById('btnEndTrip');
  const jobClosed = StateManager.get(StateKeys.JOB_CLOSED);
  const tripEnded = StateManager.get(StateKeys.TRIP_ENDED);

  // Determine the job reference for this render
  const thisJobRef = jobReference || (stops && stops[0] && stops[0].referenceNo) || currentTimelineJobRef;

  console.log(`🔍 renderTimeline called for job "${thisJobRef}", current tracking: "${currentTimelineJobRef}"`);

  // First pass: Remove any items with different job reference (stale items)
  const staleItems = ul.querySelectorAll(`[data-job-ref]:not([data-job-ref="${thisJobRef}"])`);
  if (staleItems.length > 0) {
    console.log(`🧹 Removing ${staleItems.length} stale timeline items from previous jobs`);
    staleItems.forEach(item => item.remove());
  }

  // If job reference changed, clear ALL remaining timeline items aggressively
  if (currentTimelineJobRef !== thisJobRef) {
    console.log(`🔄 Job changed: "${currentTimelineJobRef}" -> "${thisJobRef}", clearing ALL timeline items`);
    ul.innerHTML = '';
    // Remove ALL children, not just timeline-item class
    while (ul.firstChild) {
      ul.removeChild(ul.firstChild);
    }
    currentTimelineJobRef = thisJobRef;
  } else {
    // Same job, just clear using innerHTML
    ul.innerHTML = '';
  }

  closeJobContainer.classList.add('hidden');
  if (btnCloseJob) { btnCloseJob.style.display = 'none'; btnCloseJob.disabled = true; }
  if (btnEndTrip) { btnEndTrip.style.display = 'none'; btnEndTrip.disabled = true; }

  // Filter out "คลังศรีราชา" stops before rendering
  const filteredStops = stops ? stops.filter(stop => stop.shipToName && !stop.shipToName.includes('คลังศรีราชา')) : [];

  console.log('🔍 renderTimeline: filteredStops count =', filteredStops.length,
    'unique seqs =', [...new Set(filteredStops.map(s => s.seq))].sort((a,b) => a-b));

  if (filteredStops.length === 0) {
    container.classList.remove('hidden');
    showEmptyState('timeline', {
      icon: '📦',
      title: 'ไม่มีจุดส่ง',
      message: 'ไม่พบจุดส่งสินค้าในทริปนี้'
    });
    return;
  }

  let allCheckout = true;

  // Group stops by shipToCode
  const grouped = {};
  const groupOrder = [];

  filteredStops.forEach(stop => {
    // Group by shipToCode when available, otherwise by shipToName
    // - If shipToCode exists: group all materials with same code together
    // - If shipToCode is empty: group by shipToName (same location = same group)
    const key = stop.shipToCode && stop.shipToCode.trim()
      ? stop.shipToCode
      : stop.shipToName || `seq_${stop.seq}`;

    if (!grouped[key]) {
      grouped[key] = {
        shipToCode: stop.shipToCode,
        shipToName: stop.shipToName,
        seq: stop.seq,
        allSeqs: [stop.seq], // Track all seqs in this group
        stops: [],
        isOriginStop: stop.isOriginStop,
        destLat: stop.destLat,
        destLng: stop.destLng
      };
      groupOrder.push(key);
    } else {
      // Add seq to the list if not already there
      if (!grouped[key].allSeqs.includes(stop.seq)) {
        grouped[key].allSeqs.push(stop.seq);
      }
    }

    grouped[key].stops.push(stop);
  });

  console.log('🔍 Grouping result:', {
    totalStops: filteredStops.length,
    totalGroups: groupOrder.length,
    groups: groupOrder.map(key => ({ key, count: grouped[key].stops.length, seq: grouped[key].seq, name: grouped[key].shipToName }))
  });

  // Render grouped stops
  groupOrder.forEach(key => {
    const group = grouped[key];
    const firstStop = group.stops[0];

    // Check if this group has check-in/check-out
    // Use every() since a location may have multiple material rows,
    // and all must be checked out to consider the location complete
    const hasCheckIn = group.stops.some(s => !!s.checkInTime);
    const hasCheckOut = group.stops.every(s => !!s.checkOutTime);
    const isOrigin = group.isOriginStop;

    // Log checkout status for debugging
    if (!hasCheckOut) {
      console.log(`⚠️ Stop "${group.shipToName}" (seq ${group.seq}) not checked out.`, {
        hasCheckIn,
        hasCheckOut,
        checkInTime: group.stops.map(s => s.checkInTime),
        checkOutTime: group.stops.map(s => s.checkOutTime)
      });
    }

    if (!hasCheckOut) allCheckout = false;

    // Collect all materials with quantities from stops in this group
    // Display as vertical list instead of comma-separated
    const allMaterials = group.stops
      .filter(s => s.materials)
      .map(s => {
        const mat = s.materials || '';
        const qty = s.totalQty || s.qty || '';
        return qty ? `<div class="material-item">• ${escapeHtml(mat)} <span class="material-qty">(${qty})</span></div>` : `<div class="material-item">• ${escapeHtml(mat)}</div>`;
      })
      .join('');

    // Use the first stop for button actions
    const stop = firstStop;
    // Pass shipToName as fallback for grouping when shipToCode is empty
    const jsShipToCode = group.shipToCode ? `'${group.shipToCode.replace(/'/g, "\\'")}'` : 'null';
    const jsShipToName = group.shipToName ? `'${(group.shipToName || '').replace(/'/g, "\\'")}'` : 'null';

    let btnHtml = '';
    if (isOrigin) {
      if (!hasCheckIn) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.startCheckin('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode}, ${jsShipToName})">Check-in</button>`;
      } else if (!hasCheckOut) {
        btnHtml += `<button class="btn-small" onclick="window.DriverApp.startCheckout('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode}, ${jsShipToName})">Check-out</button>`;
      }
    } else {
      // Destination Stop State Machine
      if (!hasCheckIn) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.startCheckin('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode}, ${jsShipToName})">Check-in</button>`;
      } else if (!stop.fuelingTime) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.doFuel('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode}, ${jsShipToName})">ลงน้ำมัน</button>`;
      } else if (!stop.unloadDoneTime) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.doUnload('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode}, ${jsShipToName})">ลงเสร็จ</button>`;
      } else if (!hasCheckOut) {
        btnHtml += `<button class="btn-small" onclick="window.DriverApp.startCheckout('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode}, ${jsShipToName})">Check-out</button>`;
      }
    }

    if (group.destLat && group.destLng) {
      btnHtml += `<button class="btn-nav" onclick="window.DriverApp.navigateToStop('${stop.rowIndex}')">นำทาง</button>`;
    }

    const li = document.createElement('li');
    li.className = 'timeline-item';
    // Track job reference to identify stale items
    li.setAttribute('data-job-ref', thisJobRef);

    // For grouped stops: show location name as main label, seq info as badge
    // For single stops: show "จุดที่ X" + location name
    const isGrouped = group.stops.length > 1;
    const locationName = escapeHtml(group.shipToName) || '-';

    let labelHtml = '';
    if (isGrouped) {
      // Grouped: Location name (main) + seq badge
      const seqBadge = `<span class="seq-badge">${group.allSeqs.join(',')}</span>`;
      const countBadge = `<span class="count-badge">${group.stops.length}</span>`;
      labelHtml = `
        <span class="timeline-stop-label grouped">
          ${locationName}
          <span class="timeline-badges">${seqBadge}${countBadge}</span>
        </span>
      `;
    } else {
      // Single: Show location name (ship_to_name) directly
      const seqBadge = `<span class="seq-badge">${group.seq}</span>`;
      labelHtml = `
        <span class="timeline-stop-label">
          ${locationName}
          <span class="timeline-badges">${seqBadge}</span>
        </span>
      `;
    }

    li.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <div class="timeline-header-row">
          ${labelHtml}
          <span class="timeline-status">${escapeHtml(firstStop.status) || '-'}</span>
        </div>
        <!-- Location name now shown in main label -->
        ${allMaterials ? `<div class="materials-text">${allMaterials}</div>` : ''}
        <div class="action-row">${btnHtml}</div>
      </div>
    `;
    ul.appendChild(li);
    console.log(`📌 Added timeline item for seq ${group.seq}, key "${key}", stops count: ${group.stops.length}`);
  });

  container.classList.remove('hidden');

  // Show close/end buttons
  console.log('🔍 Close job button check:', { allCheckout, jobClosed, tripEnded, totalGroups: groupOrder.length });
  if (allCheckout && !jobClosed && !tripEnded) {
    console.log('✅ Showing close job button');
    closeJobContainer.classList.remove('hidden');
    if (btnCloseJob) { btnCloseJob.style.display = 'block'; btnCloseJob.disabled = false; }
  } else if (jobClosed && !tripEnded) {
    console.log('✅ Showing end trip button');
    closeJobContainer.classList.remove('hidden');
    if (btnEndTrip) { btnEndTrip.style.display = 'block'; btnEndTrip.disabled = false; }
  } else {
    console.log('⚠️ Close job button not shown. Reasons:', {
      allCheckout,
      jobClosed,
      tripEnded
    });
  }
}

// ============================================
// ACTION FUNCTIONS
// ============================================
async function startCheckin(rowIndex, seq, shipToCode, shipToName) {
  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);
  const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];
  const stop = lastStops.find(s => s.rowIndex === rowIndex);
  const isOrigin = stop && stop.isOriginStop;

  // --- Origin Stop Check-in ---
  if (isOrigin) {
    // 1. Alcohol Check
    const hasAlcohol = await SupabaseAPI.hasAtLeastOneAlcoholChecked(currentReference);
    if (!hasAlcohol) {
      showError("กรุณาเป่าแอลกอฮอล์อย่างน้อย 1 คนก่อนเช็คอินต้นทาง");
      return;
    }

    // 2. Get Odometer reading
    const { value: formValues } = await Swal.fire({
      icon: 'question',
      title: 'Check-in ต้นทาง',
      html: `<label style="font-size:0.8rem;color:#555;">เลขไมล์รถ</label>
             <input id="swalOdo" type="number" class="swal2-input" placeholder="เลขไมล์ ณ จุดต้นทาง">`,
      showCancelButton: true,
      confirmButtonText: 'Check-in',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1abc9c',
      preConfirm: () => {
        const odo = document.getElementById('swalOdo').value;
        if (!odo) {
          Swal.showValidationMessage('กรุณากรอกเลขไมล์รถ');
          return false;
        }
        const odoValidation = validateInput(odo, 'odo');
        if (!odoValidation.valid) {
          Swal.showValidationMessage(odoValidation.message);
          return false;
        }
        return { odo: odoValidation.value };
      }
    });

    if (!formValues) return;

    await updateStopStatus(rowIndex, 'CHECKIN', 'checkin', seq, shipToCode, shipToName, formValues.odo);

  // --- Destination Stop Check-in ---
  } else {
    const { value: formValues } = await Swal.fire({
      icon: 'question',
      title: 'Check-in ปลายทาง',
      html: `
        <div style="text-align:left;">
          <label style="font-size:0.8rem;color:#555;">เลขไมล์รถ</label>
          <input id="swalOdo" type="number" class="swal2-input" placeholder="เลขไมล์">

          <label style="font-size:0.8rem;color:#555;margin-top:10px;display:block;">ชื่อผู้รับน้ำมัน</label>
          <input id="swalReceiverName" type="text" class="swal2-input" placeholder="ชื่อผู้รับ">

          <label style="font-size:0.8rem;color:#555;margin-top:10px;display:block;">ประเภทผู้รับน้ำมัน</label>
          <select id="swalReceiverType" class="swal2-select">
            <option value="">-- เลือกประเภท --</option>
            <option value="manager">ผู้จัดการปั๊ม</option>
            <option value="frontHasCard">พนักงานหน้าลาน (มีบัตร)</option>
            <option value="frontNoCard">พนักงานหน้าลาน (ไม่มีบัตร)</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Check-in',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1abc9c',
      preConfirm: () => {
        const odo = document.getElementById('swalOdo').value;
        const receiverName = document.getElementById('swalReceiverName').value;
        const receiverType = document.getElementById('swalReceiverType').value;

        if (!odo) {
          Swal.showValidationMessage('กรุณากรอกเลขไมล์รถ');
          return false;
        }
        if (!receiverName) {
          Swal.showValidationMessage('กรุณากรอกชื่อผู้รับน้ำมัน');
          return false;
        }
        if (!receiverType) {
          Swal.showValidationMessage('กรุณาเลือกประเภทผู้รับน้ำมัน');
          return false;
        }
        
        const odoValidation = validateInput(odo, 'odo');
        if (!odoValidation.valid) {
          Swal.showValidationMessage(odoValidation.message);
          return false;
        }

        return { 
          odo: odoValidation.value, 
          receiverName: receiverName,
          receiverType: receiverType
        };
      }
    });

    if (!formValues) return;

    await updateStopStatus(rowIndex, 'CHECKIN', 'checkin', seq, shipToCode, shipToName, formValues.odo, formValues.receiverName, formValues.receiverType);
  }
}

async function startCheckout(rowIndex, seq, shipToCode, shipToName) {
  const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];
  const stop = lastStops.find(s => s.rowIndex === rowIndex);
  const isOrigin = stop && stop.isOriginStop;

  if (isOrigin) {
    await updateStopStatus(rowIndex, 'CHECKOUT', 'checkout', seq, shipToCode, shipToName);
  } else {
    const { value: formValues } = await Swal.fire({
      icon: 'question',
      title: 'Check-out พร้อมบันทึกข้อมูล',
      html: `
        <div style="text-align:left;">
          <label><input type="checkbox" id="swalPumping"> มีปั่นน้ำมัน</label><br>
          <label><input type="checkbox" id="swalTransfer"> มีโยกน้ำมัน</label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Check-out',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1abc9c',
      preConfirm: () => ({
        hasPumping: document.getElementById('swalPumping').checked ? 'yes' : 'no',
        hasTransfer: document.getElementById('swalTransfer').checked ? 'yes' : 'no'
      })
    });

    if (!formValues) return;
    await updateStopStatus(rowIndex, 'CHECKOUT', 'checkout', seq, shipToCode, shipToName, null, null, null, formValues.hasPumping, formValues.hasTransfer);
  }
}

async function doFuel(rowIndex, seq, shipToCode, shipToName) {
  await updateStopStatus(rowIndex, 'FUELING', 'fuel', seq, shipToCode, shipToName);
}

async function doUnload(rowIndex, seq, shipToCode, shipToName) {
  await updateStopStatus(rowIndex, 'UNLOAD_DONE', 'unload', seq, shipToCode, shipToName);
}

async function updateStopStatus(rowIndex, newStatus, type, seq, shipToCode, shipToName, odo, receiverName, receiverType, hasPumping, hasTransfer) {
  const currentUserId = StateManager.get(StateKeys.USER_ID);
  const isAdminMode = StateManager.get(StateKeys.IS_ADMIN_MODE);
  const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];
  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);

  if (!currentUserId) {
    showError('ไม่พบข้อมูลผู้ใช้');
    return;
  }

  try {
    showLoading('กำลังอ่านพิกัด GPS...');
    const pos = await getCurrentPositionAsync();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // --- GEOFENCING LOGIC ---
    if (!isAdminMode) {
      const stop = lastStops.find(s => s.rowIndex === rowIndex);
      // Only check if destination coordinates are available
      if (stop && stop.destLat && stop.destLng) {
        const radiusM = stop.radiusM || 200; // Use radius from data, with 200m fallback
        const distance = haversineDistanceMeters(stop.destLat, stop.destLng, lat, lng);
        
        if (distance > radiusM) {
          closeLoading(); // Ensure loading indicator is hidden
          showError(`คุณอยู่นอกพื้นที่ (ห่าง ${Math.round(distance)} ม. / รัศมี ${radiusM} ม.)`);
          return;
        }
      }
    } else {
      console.log('👑 Admin mode: Bypassing geofence check.');
    }
    // --- END GEOFENCING LOGIC ---

    const stopData = {
      reference: currentReference,
      seq: seq,
      shipToCode: shipToCode,
      shipToName: shipToName,
      status: newStatus,
      type,
      userId: currentUserId,
      lat,
      lng,
      odo: odo ? sanitizeInput(odo) : null,
      receiverName: receiverName ? sanitizeInput(receiverName) : null,
      receiverType,
      hasPumping,
      hasTransfer
    };

    showLoading(StateManager.get(StateKeys.IS_ONLINE) ? 'กำลังอัปเดตสถานะ...' : 'กำลังบันทึกข้อมูล...');

    const result = await executeOrQueue(
      'updateStop',
      stopData,
      () => withRetry(
        () => SupabaseAPI.updateStop(stopData),
        APP_CONFIG.RETRY
      )
    );

    closeLoading();

    if (!result.success) {
      showError(result.message);
      return;
    }

    // Handle queued response
    if (result.queued) {
      const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];
      const stop = lastStops.find(s => s.rowIndex === rowIndex);
      showInlineFlexCustom('queued', 'บันทึกไว้แล้ว', `${stop?.shipToName || 'จุดที่ ' + seq} - จะส่งเมื่อออนไลน์`);
      await showSuccess('บันทึกไว้แล้ว', 'ข้อมูลจะถูกส่งโดยอัตโนมัติเมื่อมีสัญญาณ');
      // Refresh UI after queued to show updated state
      if (currentReference) search(true);
      return;
    }

    if (result.stop) {
      showInlineFlex(type, result.stop);
    }

    // Refresh UI immediately to ensure latest state is shown
    // This must happen BEFORE showing success to avoid race conditions
    if (currentReference) {
      lastLocalUpdateTime = Date.now(); // Set debounce flag to prevent realtime interference
      await search(true);
    }

    await showSuccess('อัปเดตสำเร็จ', result.message);

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
    // Refresh UI after error to get latest state from server
    // This helps recover from transient errors
    if (currentReference) {
      setTimeout(() => search(true), 1000);
    }
  }
}

async function doAlcoholCheck(driverName) {
  const { value: formValues } = await Swal.fire({
    title: 'บันทึกผลแอลกอฮอล์',
    html: `
      <div style="text-align:left;">
        <label>ชื่อคนขับ</label>
        <input id="swalDriver" type="text" class="swal2-input" value="${escapeHtml(driverName)}" readonly>
        <label>ค่าแอลกอฮอล์</label>
        <input id="swalAlcohol" type="number" step="0.001" class="swal2-input" placeholder="0.000">
        <label>รูปภาพหลักฐาน</label>
        <input id="swalImage" type="file" accept="image/*" capture="environment" class="swal2-input">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1abc9c',
    preConfirm: () => {
      const val = document.getElementById('swalAlcohol').value;
      const file = document.getElementById('swalImage').files[0];
      if (!val) { Swal.showValidationMessage('กรุณากรอกค่าแอลกอฮอล์'); return false; }
      if (!file) { Swal.showValidationMessage('กรุณาถ่ายรูปหลักฐาน'); return false; }
      return { alcoholValue: val, file };
    }
  });

  if (!formValues) return;

  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);
  const currentUserId = StateManager.get(StateKeys.USER_ID);

  try {
    showLoading('กำลังดึงพิกัด...');
    const pos = await getCurrentPositionAsync();

    showLoading('กำลังบันทึก...');
    const base64 = await fileToBase64(formValues.file);

    // Validate alcohol value
    const alcoholValidation = validateInput(formValues.alcoholValue, 'alcohol');
    if (!alcoholValidation.valid) {
      closeLoading();
      showError(alcoholValidation.message);
      return;
    }

    const alcoholData = {
      reference: currentReference,
      driverName: sanitizeInput(driverName),
      userId: currentUserId,
      alcoholValue: alcoholValidation.value,
      imageBase64: base64,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    const result = await executeOrQueue(
      'uploadAlcohol',
      alcoholData,
      () => withRetry(
        () => SupabaseAPI.uploadAlcohol(alcoholData),
        APP_CONFIG.RETRY
      )
    );

    closeLoading();

    if (!result.success) {
      showError(result.message);
      return;
    }

    // Handle queued response
    if (result.queued) {
      showInlineFlexCustom('queued', 'บันทึกไว้แล้ว', `${driverName} - จะส่งเมื่อออนไลน์`);
      await showSuccess('บันทึกไว้แล้ว', 'ข้อมูลจะถูกส่งโดยอัตโนมัติเมื่อมีสัญญาณ');
      return;
    }

    const checkedDrivers = result.checkedDrivers || [];
    StateManager.set(StateKeys.CURRENT_CHECKED_DRIVERS, checkedDrivers);
    StateManager.set(StateKeys.ALCOHOL_ALL_DONE, StateManager.isAlcoholComplete());
    renderAlcoholSection();
    showSuccess('บันทึกสำเร็จ', 'บันทึกการตรวจแอลกอฮอล์เรียบร้อย');

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function closeJob() {
  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);
  const currentVehicleDesc = StateManager.get(StateKeys.CURRENT_VEHICLE_DESC);
  const currentUserId = StateManager.get(StateKeys.USER_ID);
  const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];
  const currentDrivers = StateManager.get(StateKeys.CURRENT_DRIVERS) || [];

  if (!currentReference) {
    showInfo('ไม่พบเลขงาน', 'กรุณาค้นหางานก่อน');
    return;
  }

  // Fetch all drivers from driver_master table
  showLoading('กำลังโหลดรายชื่อพนักงาน...');
  const driversResult = await SupabaseAPI.fetchDrivers();
  closeLoading();

  const allDrivers = driversResult.success ? (driversResult.drivers || []) : [];
  const driverNames = allDrivers.map(d => d.driver_name).filter(n => n);

  // Build datalist options from driver_master
  const datalistOptions = driverNames.length > 0
    ? driverNames.map(d => `<option value="${escapeHtml(d)}">`).join('')
    : '';

  // Get default values from currentDrivers (jobdata)
  const defaultDriver1 = currentDrivers.length > 0 ? currentDrivers[0] : '';
  const defaultDriver2 = currentDrivers.length > 1 ? currentDrivers[1] : '';

  const { value: formValues } = await Swal.fire({
    icon: 'question',
    title: 'ปิดงาน',
    html: `
      <div style="text-align:left; font-size: 0.9rem;">
        <div style="margin-bottom: 12px;">
          <label style="font-weight:bold; display:block; margin-bottom: 8px;">👤 ยืนยันพนักงานขับรถ</label>

          <div style="margin-bottom: 8px;">
            <label style="font-weight:normal; display:block; margin-bottom: 4px;">คนที่ 1 <span style="color:red;">*</span></label>
            <input
              id="driver1Input"
              class="swal2-input"
              list="driverList"
              placeholder="พิมพ์หรือเลือกชื่อพนักงาน"
              style="width:100%; margin:0;"
              value="${escapeHtml(defaultDriver1)}"
              autocomplete="off"
            />
          </div>

          <div style="margin-bottom: 8px;">
            <label style="font-weight:normal; display:block; margin-bottom: 4px;">คนที่ 2 (ถ้ามี)</label>
            <input
              id="driver2Input"
              class="swal2-input"
              list="driverList"
              placeholder="พิมพ์หรือเลือกชื่อพนักงาน"
              style="width:100%; margin:0;"
              value="${escapeHtml(defaultDriver2)}"
              autocomplete="off"
            />
          </div>

          <datalist id="driverList">
            ${datalistOptions}
          </datalist>

          <small style="color:#666; display:block; margin-top:4px;">
            * ค้นหาชื่อได้โดยพิมพ์ในช่อง | รายชื่อจากฐานข้อมูล driver_master (${driverNames.length} คน)
          </small>
        </div>
        <hr style="border:none; border-top: 1px solid #eee; margin: 15px 0;">
        <div style="margin-bottom: 12px;">
          <label style="font-weight:bold; display:block; margin-bottom: 5px;">สถานะรถ</label>
          <label style="margin-right: 20px;"><input type="radio" name="vehicleStatus" value="ready" checked> พร้อมรับงาน</label>
          <label><input type="radio" name="vehicleStatus" value="maintenance"> เข้าซ่อมบำรุง</label>
        </div>
        <hr style="border:none; border-top: 1px solid #eee; margin: 15px 0;">
        <div>
          <label style="font-weight:bold; display:block; margin-bottom: 5px;">ค่าใช้จ่ายพิเศษ (ถ้ามี)</label>
          <label style="display:block; margin-bottom: 5px;"><input type="checkbox" id="hillFee"> มีค่าขึ้นเขา</label>
          <label style="display:block; margin-bottom: 5px;"><input type="checkbox" id="bkkFee"> มีค่าเข้า กทม</label>
          <label style="display:block; margin-bottom: 5px;"><input type="checkbox" id="repairFee"> นำรถเข้าซ่อม</label>
          <label style="display:block;"><input type="checkbox" id="swalHolidayWork"> ทำงานในวันหยุด</label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'ยืนยันปิดงาน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1abc9c',
    preConfirm: () => {
      const driver1Name = document.getElementById('driver1Input').value.trim();
      const driver2Name = document.getElementById('driver2Input').value.trim();

      if (!driver1Name) {
        Swal.showValidationMessage('กรุณากรอกหรือเลือกพนักงานคนที่ 1');
        return false;
      }

      // Calculate driver count based on selections
      const driverCount = driver2Name ? 2 : 1;

      return {
        driverCount,
        driver1Name,
        driver2Name,
        vehicleStatus: document.querySelector('input[name="vehicleStatus"]:checked').value,
        hillFee: document.getElementById('hillFee').checked ? 'yes' : 'no',
        bkkFee: document.getElementById('bkkFee').checked ? 'yes' : 'no',
        repairFee: document.getElementById('repairFee').checked ? 'yes' : 'no',
        isHolidayWork: document.getElementById('swalHolidayWork').checked
      };
    }
  });

  if (!formValues) return;

  // Add extra confirmation step if holiday work is checked
  if (formValues.isHolidayWork) {
    const { value: notes } = await Swal.fire({
      title: 'ยืนยันทำงานวันหยุด',
      html: `
        <div style="text-align:left;">
          <p style="margin-bottom:15px; color:#e74c3c; font-weight:bold;">
            ⚠️ การทำงานในวันหยุดต้องได้รับการอนุมัติจากหัวหน้างาน
          </p>
          <p style="margin-bottom:15px;">กรุณาระบุรายละเอียด:</p>
          <textarea id="holidayNotes" class="swal2-textarea"
            placeholder="เช่น: งานเร่งด่วน, ส่งของนอกเวลา, ลูกค้าขอเพิ่มเติม..."
            style="width:100%; min-height:100px; font-size:14px; resize:vertical;"
            required></textarea>
          <small style="color:#666; display:block; margin-top:8px;">
            * ข้อมูลนี้จะส่งไปยังหัวหน้างานเพื่อพิจารณาอนุมัติ
          </small>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: '✅ ยืนยันและส่งขออนุมัติ',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const notes = document.getElementById('holidayNotes').value;
        if (!notes || notes.trim() === '') {
          Swal.showValidationMessage('⚠️ กรุณากรอกเหตุผล/รายละเอียด');
          return false;
        }
        if (notes.trim().length < 10) {
          Swal.showValidationMessage('⚠️ กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร');
          return false;
        }
        return notes.trim();
      }
    });

    if (!notes) {
      return; // User cancelled
    }

    // Add notes to formValues
    formValues.holidayWorkNotes = notes;
  }

  try {
    showLoading('กำลังปิดงาน...');

    const closeJobData = {
      reference: currentReference,
      userId: currentUserId,
      driverCount: formValues.driverCount,
      driver1Name: formValues.driver1Name,
      driver2Name: formValues.driver2Name || null,
      vehicleStatus: formValues.vehicleStatus,
      vehicleDesc: currentVehicleDesc,
      hillFee: formValues.hillFee,
      bkkFee: formValues.bkkFee,
      repairFee: formValues.repairFee,
      isHolidayWork: formValues.isHolidayWork,
      holidayWorkNotes: formValues.holidayWorkNotes || null
    };

    const result = await executeOrQueue(
      'closeJob',
      closeJobData,
      () => withRetry(
        () => SupabaseAPI.closeJob(closeJobData),
        APP_CONFIG.RETRY
      )
    );

    closeLoading();

    if (!result.success) {
      showError(result.message);
      return;
    }

    // Handle queued response
    if (result.queued) {
      showInlineFlexCustom('queued', 'บันทึกไว้แล้ว', `ปิดงาน ${currentReference} - จะส่งเมื่อออนไลน์`);
      await showSuccess('บันทึกไว้แล้ว', 'ข้อมูลจะถูกส่งโดยอัตโนมัติเมื่อมีสัญญาณ');
      return;
    }

    StateManager.set(StateKeys.JOB_CLOSED, true);

    // Calculate and show trip summary
    const tripData = {
      reference: currentReference,
      totalStops: lastStops.length,
      completedStops: lastStops.filter(s => s.checkOutFlag === 'Y').length,
      startTime: lastStops.find(s => s.checkInFlag === 'Y')?.checkinTime,
      endTime: lastStops[lastStops.length - 1]?.checkoutTime || new Date(),
      vehicle: currentVehicleDesc,
      drivers: currentDrivers,
      isHolidayWork: formValues.isHolidayWork,
      holidayWorkNotes: formValues.holidayWorkNotes
    };

    await showTripSummary(tripData);
    if (currentReference) search(true); // Refresh the job data to show the 'End Trip' button

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function openEndTripDialog() {
  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);
  const currentUserId = StateManager.get(StateKeys.USER_ID);

  if (!currentReference) {
    showInfo('ไม่พบเลขงาน', 'กรุณาค้นหางานก่อน');
    return;
  }

  const { value: formValues } = await Swal.fire({
    title: 'สรุปจบทริป',
    html: `
      <div style="text-align:left;">
        <label>เลขไมล์จบทริป</label>
        <input id="swalEndOdo" type="number" class="swal2-input" placeholder="เลขไมล์">
        <label>จุดจบทริป</label>
        <input id="swalEndPoint" type="text" class="swal2-input" placeholder="ชื่อสถานที่">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกจบทริป',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1abc9c',
    preConfirm: () => ({
      endOdo: document.getElementById('swalEndOdo').value,
      endPointName: document.getElementById('swalEndPoint').value
    })
  });

  if (!formValues) return;

  try {
    showLoading('กำลังดึงพิกัด...');
    const pos = await getCurrentPositionAsync();

    // Validate odo if provided
    if (formValues.endOdo) {
      const odoValidation = validateInput(formValues.endOdo, 'odo');
      if (!odoValidation.valid) {
        showError(odoValidation.message);
        return;
      }
    }

    showLoading('กำลังบันทึกจบทริป...');

    const endTripData = {
      reference: currentReference,
      userId: currentUserId,
      endOdo: formValues.endOdo ? sanitizeInput(formValues.endOdo) : null,
      endPointName: sanitizeInput(formValues.endPointName),
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    const result = await executeOrQueue(
      'endTrip',
      endTripData,
      () => withRetry(
        () => SupabaseAPI.endTrip(endTripData),
        APP_CONFIG.RETRY
      )
    );

    closeLoading();

    if (!result.success) {
      showError(result.message);
      return;
    }

    // Handle queued response
    if (result.queued) {
      showInlineFlexCustom('queued', 'บันทึกไว้แล้ว', `จบทริป ${currentReference} - จะส่งเมื่อออนไลน์`);
      await showSuccess('บันทึกไว้แล้ว', 'ข้อมูลจะถูกส่งโดยอัตโนมัติเมื่อมีสัญญาณ');
      const closeJobContainer = document.getElementById('closeJobContainer');
      if (closeJobContainer) closeJobContainer.classList.add('hidden');
      return;
    }

    StateManager.set(StateKeys.TRIP_ENDED, true);
    await showSuccess('จบทริปสำเร็จ', 'บันทึกข้อมูลจบทริปเรียบร้อย');

    const closeJobContainer = document.getElementById('closeJobContainer');
    if (closeJobContainer) closeJobContainer.classList.add('hidden');

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

function navigateToStop(rowIndex) {
  const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];
  const stop = lastStops.find(s => s.rowIndex === rowIndex);
  if (!stop || !stop.destLat || !stop.destLng) {
    showInfo('ไม่พบพิกัด', 'ปลายทางนี้ยังไม่มีพิกัดในระบบ');
    return;
  }
  navigateToCoords(stop.destLat, stop.destLng);
}

function toggleAdminMode() {
    const currentIsAdminMode = StateManager.get(StateKeys.IS_ADMIN_MODE);
    const newIsAdminMode = !currentIsAdminMode;
    StateManager.set(StateKeys.IS_ADMIN_MODE, newIsAdminMode);

    const adminToggleBtn = document.getElementById('adminToggle');
    if (newIsAdminMode) {
        adminToggleBtn.style.backgroundColor = '#2ecc71'; // Green
        adminToggleBtn.style.color = 'white';
        showInfo('เปิดโหมดแอดมิน', 'ปิดการตรวจสอบระยะห่าง');
    } else {
        adminToggleBtn.style.backgroundColor = '#e74c3c'; // Red
        adminToggleBtn.style.color = 'white';
        showInfo('ปิดโหมดแอดมิน', 'เปิดการตรวจสอบระยะห่าง');
    }
}

// ============================================
// REGISTRATION PROMPT HELPER
// ============================================
/**
 * Render registration prompt HTML based on user status
 * @param {string} status - User status (APPROVED, PENDING, REJECTED, or null)
 * @returns {string} HTML for registration prompt
 */
function renderRegistrationPrompt(status) {
  if (status === 'PENDING') {
    return `
      <div class="registration-prompt pending">
        <div class="registration-prompt-icon">⏳</div>
        <div class="registration-prompt-title">สถานะ: รอการอนุมัติ</div>
        <div class="registration-prompt-message">
          ข้อมูลของคุณอยู่ระหว่างการตรวจสอบ<br>
          ทางผู้ดูแลระบบจะตรวจสอบและอนุมัติภายใน 24 ชั่วโมง
        </div>
      </div>
    `;
  } else if (status === 'REJECTED') {
    return `
      <div class="registration-prompt rejected">
        <div class="registration-prompt-icon">✕</div>
        <div class="registration-prompt-title">ไม่ได้รับอนุมัติใช้งาน</div>
        <div class="registration-prompt-message">
          กรุณาติดต่อผู้ดูแลระบบ
        </div>
        <a href="${REGISTRATION_URL}" class="registration-prompt-button">ติดต่อผู้ดูแล</a>
      </div>
    `;
  } else {
    // New user or null status
    return `
      <div class="registration-prompt new">
        <div class="registration-prompt-icon">📝</div>
        <div class="registration-prompt-title">ยังไม่ได้ลงทะเบียนใช้งาน</div>
        <div class="registration-prompt-message">
          กรุณาลงทะเบียนก่อนใช้งานแอปพลิเคชัน
        </div>
        <a href="${REGISTRATION_URL}" class="registration-prompt-button primary">ลงทะเบียน</a>
      </div>
    `;
  }
}

/**
 * Disable all features for unapproved users
 */
function disableFeaturesForUnapproved() {
  // Disable search input and button
  const keywordInput = document.getElementById('keyword');
  const searchBtn = document.getElementById('btnSearch');
  const reportBtn = document.getElementById('btnReportBreakdown');

  if (keywordInput) {
    keywordInput.disabled = true;
    keywordInput.placeholder = 'กรุณาลงทะเบียนก่อนใช้งาน';
  }
  if (searchBtn) {
    searchBtn.disabled = true;
  }
  if (reportBtn) {
    reportBtn.disabled = true;
  }
}

/**
 * Enable all features for approved users
 */
function enableFeaturesForApproved() {
  const keywordInput = document.getElementById('keyword');
  const searchBtn = document.getElementById('btnSearch');
  const reportBtn = document.getElementById('btnReportBreakdown');

  if (keywordInput) {
    keywordInput.disabled = false;
    keywordInput.placeholder = 'กรอกเลข Reference เช่น 2511S15403';
  }
  if (searchBtn) {
    searchBtn.disabled = false;
  }
  if (reportBtn) {
    reportBtn.disabled = false;
  }
}

// ============================================
// INITIALIZATION
// ============================================
async function initApp() {
  // Initialize Supabase
  initSupabase();

  // Set initial online status
  StateManager.set(StateKeys.IS_ONLINE, navigator.onLine);

  // Create Admin Button and prepend it to the header
  const adminToggleBtn = document.createElement('button');
  adminToggleBtn.id = 'adminToggle';
  adminToggleBtn.className = 'theme-toggle';
  adminToggleBtn.setAttribute('aria-label', 'สลับโหมดแอดมิน');
  adminToggleBtn.innerHTML = '👑';
  adminToggleBtn.style.display = 'none'; // Hidden by default
  adminToggleBtn.style.backgroundColor = '#e74c3c'; // Default to Red (OFF)
  adminToggleBtn.style.color = 'white';
  document.querySelector('.header > div:last-child').prepend(adminToggleBtn);

  // Load theme
  ThemeManager.load();

  // Initialize Enhanced UX features (pull-to-refresh, notifications, etc.)
  initEnhancedUX();

  // Initialize breakdown modal
  initBreakdownModal();

  // Initialize breakdown report
  initBreakdownReport();

  // Check GPS
  checkGpsStatus();

  // Initialize offline queue
  OfflineQueue.load();
  initOfflineQueue(SupabaseAPI, search, () => StateManager.get(StateKeys.CURRENT_REFERENCE));

  // Network status listeners
  window.addEventListener('online', () => {
    StateManager.set(StateKeys.IS_ONLINE, true);
    document.getElementById('offlineBar').classList.remove('show');
    showInlineFlexCustom('success', 'กลับมาออนไลน์แล้ว', 'กำลังซิงค์ข้อมูลที่ค้างอยู่...');
    setTimeout(() => { OfflineQueue.sync(); }, 1000);
  });

  window.addEventListener('offline', () => {
    StateManager.set(StateKeys.IS_ONLINE, false);
    document.getElementById('offlineBar').classList.add('show');
    showInlineFlexCustom('offline', 'ไม่มีสัญญาณอินเทอร์เน็ต', 'ข้อมูลจะถูกบันทึกไว้และส่งเมื่อออนไลน์');
  });

  // Initialize LIFF
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      const userId = profile.userId;

      StateManager.set(StateKeys.USER_ID, userId);

      if (userId.startsWith('U')) {
        await SupabaseAPI.saveUserProfile(profile);
        const userProfile = await SupabaseAPI.getUserProfile(userId);
        StateManager.set(StateKeys.USER_PROFILE, userProfile);
      }

      const currentUserProfile = StateManager.get(StateKeys.USER_PROFILE);
      const statusEl = document.getElementById('status');
      const profilePictureUrl = currentUserProfile?.picture_url || profile.pictureUrl;

      // Make statusEl a flex container for image and text
      statusEl.style.display = 'flex';
      statusEl.style.alignItems = 'center';
      statusEl.style.gap = '10px';

      // Logic based on 'APPROVED' status as per user request
      if (currentUserProfile?.status === 'APPROVED') {
        const displayName = currentUserProfile.display_name || profile.displayName;
        const welcomeText = currentUserProfile.user_type === 'ADMIN' ? 'สวัสดี Admin ' : 'สวัสดี ';

        let profileImageHtml = '';
        if (profilePictureUrl) {
            profileImageHtml = `<img src="${profilePictureUrl}" alt="Profile" style="width: 36px; height: 36px; border-radius: 50%;">`;
        }

        statusEl.innerHTML = `
          ${profileImageHtml}
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${welcomeText}${escapeHtml(displayName)}</span>
        `;
        statusEl.style.color = 'var(--text-main)';

        // Enable features for approved users
        enableFeaturesForApproved();

        // Show admin button if user's type is admin
        if (currentUserProfile.user_type === 'ADMIN') {
          document.getElementById('adminToggle').style.display = 'block';
        }

        // Initialize live tracking after successful login
        if (APP_CONFIG.LIVE_TRACKING.enableAutoTracking) {
          console.log('🌍 Initializing live tracking for user:', userId);
          liveTracking.init(userId);
          // Expose to window for debugging
          window.liveTracking = liveTracking;
        }
      } else {
        // Show registration prompt for unapproved users
        const userStatus = currentUserProfile?.status || null;
        statusEl.innerHTML = renderRegistrationPrompt(userStatus);
        statusEl.style.color = 'var(--text-sub)';
        // Reset flex styles for registration prompt
        statusEl.style.display = 'block';

        // Disable features for unapproved users
        disableFeaturesForUnapproved();
      }

    } else {
      liff.login(); // Enforce login
    }
  } catch (err) {
    console.error('LIFF init error:', err);
    const fallbackUserId = 'fallback_user_' + Date.now();
    StateManager.set(StateKeys.USER_ID, fallbackUserId);
    document.getElementById('status').textContent = 'ไม่สามารถเชื่อมต่อ LINE ได้';
  }

  // Load last reference
  const lastRef = localStorage.getItem(APP_CONFIG.LAST_REFERENCE_KEY);
  if (lastRef) {
    document.getElementById('keyword').value = lastRef;
    search(true); // Auto-load cached job
  }

  // Bind events
  document.getElementById('adminToggle').addEventListener('click', toggleAdminMode);
  document.getElementById('btnSearch').addEventListener('click', () => search());
  document.getElementById('keyword').addEventListener('keypress', (e) => { if (e.key === 'Enter') search(); });
  document.getElementById('btnCloseJob').addEventListener('click', closeJob);
  document.getElementById('btnEndTrip').addEventListener('click', openEndTripDialog);
  document.getElementById('themeToggle').addEventListener('click', () => ThemeManager.toggle());
  document.getElementById('gpsStatus').addEventListener('click', checkGpsStatus);
  document.getElementById('btnForceRefresh').addEventListener('click', () => search(true));

  // Sync queue if online and has pending items
  if (isOnline() && OfflineQueue.getCount() > 0) {
    setTimeout(() => OfflineQueue.sync(), 2000);
  }
}

// ============================================
// EXPORT FOR GLOBAL ACCESS
// ============================================
window.DriverApp = {
  search,
  startCheckin,
  startCheckout,
  doFuel,
  doUnload,
  doAlcoholCheck,
  closeJob,
  openEndTripDialog,
  navigateToStop,
  toggleTheme: () => ThemeManager.toggle(),
  checkGps: checkGpsStatus
};

// Start the app
initApp();
