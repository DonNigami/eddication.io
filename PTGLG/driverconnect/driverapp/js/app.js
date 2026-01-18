/**
 * Driver Tracking App - Main Application
 * Supabase Version
 */

import { LIFF_ID, APP_CONFIG } from './config.js';
import { escapeHtml, sanitizeInput, validateInput, withRetry, fileToBase64 } from './utils.js';
import { OfflineQueue, executeOrQueue, initOfflineQueue, isOnline, setCurrentReference } from './offline-queue.js';
import { initSupabase, SupabaseAPI } from './supabase-api.js';
import { getCurrentPositionAsync, checkGpsStatus, navigateToCoords, haversineDistanceMeters } from './gps.js';
import {
  showLoading, closeLoading, showError, showSuccess, showInfo,
  showInlineFlex, showInlineFlexCustom, showInputError, clearInputError,
  showSkeleton, hideSkeleton, recordLastUpdated, hideLastUpdatedContainer,
  ThemeManager
} from './ui.js';

// ============================================
// GLOBAL STATE
// ============================================
let currentUserId = '';
let currentUserProfile = null;
let isAdminMode = false;
let currentReference = '';
let currentVehicleDesc = '';
let lastStops = [];
let currentDrivers = [];
let currentCheckedDrivers = [];
let alcoholAllDone = false;
let jobClosed = false;
let tripEnded = false;

// ============================================
// SEARCH FUNCTION
// ============================================
async function search(isSilent = false) {
  // User Approval Check (reverted to 'APPROVED' as per user request)
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
    showSkeleton();
  }

  try {
    const result = await withRetry(
      () => SupabaseAPI.search(keyword, currentUserId),
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
      showError(result.message);
      return;
    }

    const d = result.data;
    const source = result.source || 'unknown';
    
    lastStops = d.stops || [];
    currentReference = d.referenceNo || keyword;
    setCurrentReference(currentReference);
    localStorage.setItem(APP_CONFIG.LAST_REFERENCE_KEY, currentReference);
    
    // Update user's last searched reference
    if (currentUserId && currentUserId.startsWith('U')) {
      SupabaseAPI.updateUserLastReference(currentUserId, currentReference);
    }
    
    currentVehicleDesc = d.vehicleDesc || '';
    currentDrivers = d.alcohol?.drivers || [];
    currentCheckedDrivers = [...new Set(d.alcohol?.checkedDrivers || [])];
    alcoholAllDone = currentDrivers.length > 0 && currentDrivers.every(n => currentCheckedDrivers.includes(n));
    jobClosed = !!d.jobClosed;
    tripEnded = !!d.tripEnded;

    renderSummary(d, source);
    renderAlcoholSection();
    renderTimeline(lastStops);
    recordLastUpdated();

    // Subscribe to realtime updates
    SupabaseAPI.subscribeToJob(currentReference, (payload) => {
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
  hideSkeleton();
  lastStops = [];
  currentDrivers = [];
  currentCheckedDrivers = [];
  alcoholAllDone = false;
  jobClosed = false;
  tripEnded = false;
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
    <div class="summary-row"><span class="summary-label">จำนวนจุดส่ง</span><span class="summary-value">${stops.length} จุด</span></div>
    <div class="summary-row"><span class="summary-label">ปริมาณรวม</span><span class="summary-value">${totalQtyAll || 0}</span></div>
  `;
  summaryEl.classList.remove('hidden');
}

function renderAlcoholSection() {
  const container = document.getElementById('alcoholContainer');
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

function renderTimeline(stops) {
  const container = document.getElementById('timelineContainer');
  const ul = document.getElementById('timeline');
  const closeJobContainer = document.getElementById('closeJobContainer');
  const btnCloseJob = document.getElementById('btnCloseJob');
  const btnEndTrip = document.getElementById('btnEndTrip');

  ul.innerHTML = '';
  closeJobContainer.classList.add('hidden');
  if (btnCloseJob) { btnCloseJob.style.display = 'none'; btnCloseJob.disabled = true; }
  if (btnEndTrip) { btnEndTrip.style.display = 'none'; btnEndTrip.disabled = true; }

  if (!stops || stops.length === 0) {
    container.classList.add('hidden');
    return;
  }

  let allCheckout = true;

  // Group stops by shipToCode
  const grouped = {};
  const groupOrder = [];
  
  stops.forEach(stop => {
    const key = stop.shipToCode || stop.shipToName || `stop_${stop.seq}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        shipToCode: stop.shipToCode,
        shipToName: stop.shipToName,
        seq: stop.seq,
        stops: [],
        isOriginStop: stop.isOriginStop,
        destLat: stop.destLat,
        destLng: stop.destLng
      };
      groupOrder.push(key);
    }
    
    grouped[key].stops.push(stop);
  });

  // Render grouped stops
  groupOrder.forEach(key => {
    const group = grouped[key];
    const firstStop = group.stops[0];
    
    // Check if all stops in this group are checked out
    const hasCheckIn = group.stops.some(s => !!s.checkInTime);
    const hasCheckOut = group.stops.every(s => !!s.checkOutTime);
    const isOrigin = group.isOriginStop;

    if (!hasCheckOut) allCheckout = false;

    // Collect all materials from stops in this group
    const allMaterials = group.stops
      .map(s => s.materials)
      .filter(m => m)
      .join(', ');

    // Use the first stop for button actions
    const stop = firstStop;
    const jsShipToCode = group.shipToCode ? `'${group.shipToCode.replace(/'/g, "\\'")}'` : 'null';

    let btnHtml = '';
    if (isOrigin) {
      if (!hasCheckIn) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.startCheckin('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode})">Check-in</button>`;
      } else if (!hasCheckOut) {
        btnHtml += `<button class="btn-small" onclick="window.DriverApp.startCheckout('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode})">Check-out</button>`;
      }
    } else {
      // Destination Stop State Machine
      if (!hasCheckIn) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.startCheckin('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode})">Check-in</button>`;
      } else if (!stop.fuelingTime) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.doFuel('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode})">ลงน้ำมัน</button>`;
      } else if (!stop.unloadDoneTime) {
        btnHtml += `<button class="btn-small btn-outline" onclick="window.DriverApp.doUnload('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode})">ลงเสร็จ</button>`;
      } else if (!hasCheckOut) {
        btnHtml += `<button class="btn-small" onclick="window.DriverApp.startCheckout('${stop.rowIndex}', ${stop.seq}, ${jsShipToCode})">Check-out</button>`;
      }
    }

    if (group.destLat && group.destLng) {
      btnHtml += `<button class="btn-nav" onclick="window.DriverApp.navigateToStop('${stop.rowIndex}')">นำทาง</button>`;
    }

    const li = document.createElement('li');
    li.className = 'timeline-item';
    
    // Show item count if multiple items in group
    const itemCountBadge = group.stops.length > 1 
      ? `<span style="background:#3ecf8e;color:white;padding:2px 8px;border-radius:12px;font-size:0.75rem;margin-left:4px;">${group.stops.length} รายการ</span>` 
      : '';
    
    li.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <div class="timeline-header-row">
          <span class="timeline-stop-label">จุดที่ ${group.seq}${itemCountBadge}</span>
          <span class="timeline-status">${escapeHtml(firstStop.status) || '-'}</span>
        </div>
        <div class="timeline-sub">${escapeHtml(group.shipToName) || '-'}</div>
        ${allMaterials ? `<div class="materials-text">${escapeHtml(allMaterials)}</div>` : ''}
        <div class="action-row">${btnHtml}</div>
      </div>
    `;
    ul.appendChild(li);
  });

  container.classList.remove('hidden');

  // Show close/end buttons
  if (allCheckout && !jobClosed && !tripEnded) {
    closeJobContainer.classList.remove('hidden');
    if (btnCloseJob) { btnCloseJob.style.display = 'block'; btnCloseJob.disabled = false; }
  } else if (jobClosed && !tripEnded) {
    closeJobContainer.classList.remove('hidden');
    if (btnEndTrip) { btnEndTrip.style.display = 'block'; btnEndTrip.disabled = false; }
  }
}

// ============================================
// ACTION FUNCTIONS
// ============================================
async function startCheckin(rowIndex, seq, shipToCode) {
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

    await updateStopStatus(rowIndex, 'CHECKIN', 'checkin', seq, shipToCode, formValues.odo);

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

    await updateStopStatus(rowIndex, 'CHECKIN', 'checkin', seq, shipToCode, formValues.odo, formValues.receiverName, formValues.receiverType);
  }
}

async function startCheckout(rowIndex, seq, shipToCode) {
  const stop = lastStops.find(s => s.rowIndex === rowIndex);
  const isOrigin = stop && stop.isOriginStop;

  if (isOrigin) {
    await updateStopStatus(rowIndex, 'CHECKOUT', 'checkout', seq, shipToCode);
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
    await updateStopStatus(rowIndex, 'CHECKOUT', 'checkout', seq, shipToCode, null, null, null, formValues.hasPumping, formValues.hasTransfer);
  }
}

async function doFuel(rowIndex, seq, shipToCode) {
  await updateStopStatus(rowIndex, 'FUELING', 'fuel', seq, shipToCode);
}

async function doUnload(rowIndex, seq, shipToCode) {
  await updateStopStatus(rowIndex, 'UNLOAD_DONE', 'unload', seq, shipToCode);
}

async function updateStopStatus(rowIndex, newStatus, type, seq, shipToCode, odo, receiverName, receiverType, hasPumping, hasTransfer) {
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

    showLoading(isOnline() ? 'กำลังอัปเดตสถานะ...' : 'กำลังบันทึกข้อมูล...');

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
      const stop = lastStops.find(s => s.rowIndex === rowIndex);
      showInlineFlexCustom('queued', 'บันทึกไว้แล้ว', `${stop?.shipToName || 'จุดที่ ' + seq} - จะส่งเมื่อออนไลน์`);
      await showSuccess('บันทึกไว้แล้ว', 'ข้อมูลจะถูกส่งโดยอัตโนมัติเมื่อมีสัญญาณ');
      return;
    }

    if (result.stop) {
      showInlineFlex(type, result.stop);
    }

    await showSuccess('อัปเดตสำเร็จ', result.message);
    if (currentReference) search(true);

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
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

    currentCheckedDrivers = result.checkedDrivers || [];
    renderAlcoholSection();
    showSuccess('บันทึกสำเร็จ', 'บันทึกการตรวจแอลกอฮอล์เรียบร้อย');

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function closeJob() {
  if (!currentReference) {
    showInfo('ไม่พบเลขงาน', 'กรุณาค้นหางานก่อน');
    return;
  }

  const { value: formValues } = await Swal.fire({
    icon: 'question',
    title: 'ปิดงาน',
    html: `
      <div style="text-align:left; font-size: 0.9rem;">
        <div style="margin-bottom: 12px;">
          <label style="font-weight:bold; display:block; margin-bottom: 5px;">จำนวนคนขับเที่ยวนี้</label>
          <label style="margin-right: 20px;"><input type="radio" name="driverCount" value="1" checked> 1 คน</label>
          <label><input type="radio" name="driverCount" value="2"> 2 คน</label>
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
          <label style="display:block;"><input type="checkbox" id="repairFee"> นำรถเข้าซ่อม</label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'ยืนยันปิดงาน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1abc9c',
    preConfirm: () => {
      const driverCount = document.querySelector('input[name="driverCount"]:checked').value;
      if (!driverCount) {
        Swal.showValidationMessage('กรุณาเลือกจำนวนคนขับ');
        return false;
      }
      return {
        driverCount: parseInt(driverCount, 10),
        vehicleStatus: document.querySelector('input[name="vehicleStatus"]:checked').value,
        hillFee: document.getElementById('hillFee').checked ? 'yes' : 'no',
        bkkFee: document.getElementById('bkkFee').checked ? 'yes' : 'no',
        repairFee: document.getElementById('repairFee').checked ? 'yes' : 'no'
      }
    }
  });

  if (!formValues) return;

  try {
    showLoading('กำลังปิดงาน...');

    const closeJobData = {
      reference: currentReference,
      userId: currentUserId,
      driverCount: formValues.driverCount,
      vehicleStatus: formValues.vehicleStatus,
      vehicleDesc: currentVehicleDesc,
      hillFee: formValues.hillFee,
      bkkFee: formValues.bkkFee,
      repairFee: formValues.repairFee
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

    jobClosed = true;
    await showSuccess('ปิดงานสำเร็จ', 'บันทึกการปิดงานเรียบร้อย');
    if (currentReference) search(true); // Refresh the job data to show the 'End Trip' button

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function openEndTripDialog() {
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

    tripEnded = true;
    await showSuccess('จบทริปสำเร็จ', 'บันทึกข้อมูลจบทริปเรียบร้อย');

    const closeJobContainer = document.getElementById('closeJobContainer');
    if (closeJobContainer) closeJobContainer.classList.add('hidden');

  } catch (err) {
    closeLoading();
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

function navigateToStop(rowIndex) {
  const stop = lastStops.find(s => s.rowIndex === rowIndex);
  if (!stop || !stop.destLat || !stop.destLng) {
    showInfo('ไม่พบพิกัด', 'ปลายทางนี้ยังไม่มีพิกัดในระบบ');
    return;
  }
  navigateToCoords(stop.destLat, stop.destLng);
}

function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    const adminToggleBtn = document.getElementById('adminToggle');
    if (isAdminMode) {
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
// INITIALIZATION
// ============================================
async function initApp() {
  // Initialize Supabase
  initSupabase();

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

  // Check GPS
  checkGpsStatus();

  // Initialize offline queue
  OfflineQueue.load();
  initOfflineQueue(SupabaseAPI, search, () => currentReference);

  // Network status listeners
  window.addEventListener('online', () => {
    document.getElementById('offlineBar').classList.remove('show');
    showInlineFlexCustom('success', 'กลับมาออนไลน์แล้ว', 'กำลังซิงค์ข้อมูลที่ค้างอยู่...');
    setTimeout(() => { OfflineQueue.sync(); }, 1000);
  });

  window.addEventListener('offline', () => {
    document.getElementById('offlineBar').classList.add('show');
    showInlineFlexCustom('offline', 'ไม่มีสัญญาณอินเทอร์เน็ต', 'ข้อมูลจะถูกบันทึกไว้และส่งเมื่อออนไลน์');
  });

  // Initialize LIFF
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      currentUserId = profile.userId;

      if (currentUserId.startsWith('U')) {
        await SupabaseAPI.saveUserProfile(profile);
        currentUserProfile = await SupabaseAPI.getUserProfile(currentUserId);
      }
      
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
        
        // Show admin button if user's type is admin
        if (currentUserProfile.user_type === 'ADMIN') {
          document.getElementById('adminToggle').style.display = 'block';
        }
      } else {
        statusEl.innerHTML = `<span>สถานะ: รอการอนุมัติใช้งาน</span>`;
        statusEl.style.color = 'orange';
        // Reset flex styles if no image
        statusEl.style.display = 'block';
      }
      
    } else {
      liff.login(); // Enforce login
    }
  } catch (err) {
    console.error('LIFF init error:', err);
    currentUserId = 'fallback_user_' + Date.now();
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
