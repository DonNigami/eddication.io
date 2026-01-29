/**
 * Driver Tracking App - Breakdown/Accident Report Module
 * Handles quick reporting of vehicle breakdown or accidents to admin
 */

import { getSupabase } from './supabase-api.js';
import { StateManager, StateKeys } from './state-manager.js';
import { showLoading, closeLoading, showSuccess, showError, showInfo } from './ui.js';
import { getCurrentPositionAsync } from './gps.js';
import { fileToBase64 } from './utils.js';

/**
 * Initialize breakdown report modal
 */
export function initBreakdownReport() {
  const modal = document.getElementById('reportBreakdownModal');
  const backdrop = document.getElementById('reportBreakdownModalBackdrop');
  const closeBtn = document.getElementById('reportBreakdownModalClose');
  const btnOpen = document.getElementById('btnReportBreakdown');
  const btnSubmit = document.getElementById('btnSubmitReport');
  const btnUseLocation = document.getElementById('btnUseCurrentLocation');

  // Open modal
  btnOpen?.addEventListener('click', openReportModal);

  // Close modal
  closeBtn?.addEventListener('click', closeReportModal);
  backdrop?.addEventListener('click', closeReportModal);

  // Submit report
  btnSubmit?.addEventListener('click', submitReport);

  // Use current location
  btnUseLocation?.addEventListener('click', useCurrentLocation);
}

/**
 * Open report modal
 */
function openReportModal() {
  const modal = document.getElementById('reportBreakdownModal');
  const currentJobDiv = document.getElementById('reportBreakdownCurrentJob');
  const currentRefSpan = document.getElementById('reportBreakdownCurrentRef');

  // Get current reference from state
  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);

  if (currentReference) {
    currentRefSpan.textContent = currentReference;
    currentJobDiv.classList.remove('hidden');
  } else {
    currentJobDiv.classList.add('hidden');
  }

  // Reset form
  document.getElementById('reportBreakdownType').value = '';
  document.getElementById('reportBreakdownDesc').value = '';
  document.getElementById('reportBreakdownLocation').value = '';
  document.getElementById('reportRequestNewVehicle').checked = true;
  document.getElementById('reportRequestCloseTrip').checked = false;
  document.getElementById('reportBreakdownPhoto').value = '';

  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Close report modal
 */
function closeReportModal() {
  const modal = document.getElementById('reportBreakdownModal');
  modal.classList.add('hidden');
}

/**
 * Use current GPS location
 */
async function useCurrentLocation() {
  const locationInput = document.getElementById('reportBreakdownLocation');

  try {
    showLoading('กำลังดึงพิกัด...');
    const pos = await getCurrentPositionAsync();
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    locationInput.value = `${lat}, ${lng}`;
    closeLoading();
  } catch (err) {
    closeLoading();
    showError('ไม่สามารถดึงพิกัดได้', err.message);
  }
}

/**
 * Submit breakdown report
 */
async function submitReport() {
  const currentReference = StateManager.get(StateKeys.CURRENT_REFERENCE);
  const currentVehicleDesc = StateManager.get(StateKeys.CURRENT_VEHICLE_DESC);
  const currentUserId = StateManager.get(StateKeys.USER_ID);
  const lastStops = StateManager.get(StateKeys.LAST_STOPS) || [];

  // Get form values
  const reportType = document.getElementById('reportBreakdownType').value;
  const description = document.getElementById('reportBreakdownDesc').value.trim();
  const location = document.getElementById('reportBreakdownLocation').value.trim();
  const requestNewVehicle = document.getElementById('reportRequestNewVehicle').checked;
  const requestCloseTrip = document.getElementById('reportRequestCloseTrip').checked;
  const photoFile = document.getElementById('reportBreakdownPhoto').files[0];

  // Validation
  if (!reportType) {
    showError('กรุณาเลือกประเภทการแจ้ง', 'เลือกประเภท');
    return;
  }

  if (!description || description.length < 10) {
    showError('กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร', 'ระบุรายละเอียด');
    return;
  }

  if (!requestNewVehicle && !requestCloseTrip) {
    showError('กรุณาเลือกคำขออย่างน้อย 1 รายการ', 'เลือกคำขอ');
    return;
  }

  try {
    showLoading('กำลังส่งแจ้งแอดมิน...');

    // Get current location if not provided
    let reportLocation = location;
    let reportLat = null;
    let reportLng = null;

    if (!reportLocation) {
      try {
        const pos = await getCurrentPositionAsync();
        reportLat = pos.coords.latitude;
        reportLng = pos.coords.longitude;
        reportLocation = `${reportLat.toFixed(6)}, ${reportLng.toFixed(6)}`;
      } catch (locErr) {
        console.warn('Could not get location:', locErr);
      }
    } else {
      // Parse location if it's in lat,lng format
      const match = reportLocation.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (match) {
        reportLat = parseFloat(match[1]);
        reportLng = parseFloat(match[2]);
      }
    }

    // Upload photo if provided
    let photoUrl = null;
    if (photoFile) {
      const base64 = await fileToBase64(photoFile);
      // Upload to Supabase Storage
      const fileName = `breakdown-${Date.now()}-${currentUserId}.jpg`;
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError } = await getSupabase()
        .storage
        .from('breakdown-photos')
        .upload(filePath, base64ToBlob(base64), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (!uploadError) {
        const { data: { publicUrl } } = getSupabase()
          .storage
          .from('breakdown-photos')
          .getPublicUrl(filePath);
        photoUrl = publicUrl;
      }
    }

    // Create report data
    const reportData = {
      reference: currentReference || null,
      vehicle_desc: currentVehicleDesc || null,
      driver_user_id: currentUserId,
      report_type: reportType,
      description: description,
      location: reportLocation,
      lat: reportLat,
      lng: reportLng,
      request_new_vehicle: requestNewVehicle,
      request_close_trip: requestCloseTrip,
      photo_url: photoUrl,
      status: 'pending', // pending, acknowledged, in_progress, resolved
      incomplete_stops: currentReference ? lastStops.filter(s => !s.checkOutTime).length : 0,
      created_at: new Date().toISOString()
    };

    // Insert into breakdown_reports table
    const { data, error } = await getSupabase()
      .from('breakdown_reports')
      .insert([reportData])
      .select();

    if (error) {
      // Table might not exist yet
      if (error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('breakdown_reports table does not exist. Please run the migration.');
        // Fallback: log to driver_logs
        await getSupabase()
          .from('driver_logs')
          .insert({
            reference: currentReference || 'N/A',
            action: 'breakdown_report_fallback',
            details: reportData,
            user_id: currentUserId
          });
      } else {
        throw error;
      }
    }

    closeLoading();
    closeReportModal();

    await showSuccess(
      'ส่งแจ้งแอดมินแล้ว',
      'แอดมินจะตรวจสอบและดำเนินการต่อไป'
    );

  } catch (err) {
    console.error('Error submitting breakdown report:', err);
    closeLoading();
    showError('ส่งแจ้งไม่สำเร็จ', err.message || 'กรุณาลองอีกครั้ง');
  }
}

/**
 * Convert base64 to Blob
 */
function base64ToBlob(base64) {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Export for global access
window.BreakdownReportModule = {
  openModal: openReportModal,
  closeModal: closeReportModal
};
