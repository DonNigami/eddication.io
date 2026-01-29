/**
 * Driver Tracking App - Vehicle Breakdown Module
 * Handles vehicle breakdown and new job creation for incomplete stops
 */

import { getSupabase } from './supabase-api.js';
import { StateManager, StateKeys } from './state-manager.js';
import { showLoading, closeLoading, showSuccess, showError, showInfo } from './ui.js';

// State
let breakdownJobsCache = [];
let selectedBreakdownJob = null;
let isLoadingJobs = false;

/**
 * Initialize breakdown modal
 */
export function initBreakdownModal() {
  const modal = document.getElementById('breakdownModal');
  const backdrop = document.getElementById('breakdownModalBackdrop');
  const closeBtn = document.getElementById('breakdownModalClose');
  const btnOpen = document.getElementById('btnBreakdown');
  const searchInput = document.getElementById('breakdownSearch');
  const confirmBtn = document.getElementById('btnConfirmBreakdown');

  // Open modal
  btnOpen?.addEventListener('click', openBreakdownModal);

  // Close modal
  closeBtn?.addEventListener('click', closeBreakdownModal);
  backdrop?.addEventListener('click', closeBreakdownModal);

  // Search filter
  searchInput?.addEventListener('input', (e) => {
    filterJobsList(e.target.value);
  });

  // Confirm breakdown
  confirmBtn?.addEventListener('click', confirmBreakdown);
}

/**
 * Open breakdown modal and load jobs
 */
async function openBreakdownModal() {
  const modal = document.getElementById('breakdownModal');
  const jobList = document.getElementById('breakdownJobList');
  const selectedInfo = document.getElementById('breakdownSelectedInfo');
  const searchInput = document.getElementById('breakdownSearch');

  // Reset state
  selectedBreakdownJob = null;
  searchInput.value = '';
  selectedInfo.classList.add('hidden');

  // Show loading
  jobList.innerHTML = '<div class="breakdown-loading">กำลังโหลดข้อมูล...</div>';

  // Show modal
  modal.classList.remove('hidden');

  // Load jobs with incomplete stops
  await loadIncompleteJobs();
}

/**
 * Close breakdown modal
 */
function closeBreakdownModal() {
  const modal = document.getElementById('breakdownModal');
  modal.classList.add('hidden');
  selectedBreakdownJob = null;
}

/**
 * Load jobs with incomplete stops (not checked out)
 */
async function loadIncompleteJobs() {
  if (isLoadingJobs) return;
  isLoadingJobs = true;

  const jobList = document.getElementById('breakdownJobList');
  const currentUserId = StateManager.get(StateKeys.USER_ID);

  try {
    // Query for jobs that have incomplete stops
    // An incomplete stop is one where checkout_time is null AND status is not 'completed'
    const { data, error } = await getSupabase()
      .from('jobdata')
      .select('*')
      .is('checkout_time', null)
      .is('job_closed_at', null) // Job is not closed
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data || data.length === 0) {
      jobList.innerHTML = '<div class="breakdown-empty">ไม่พบงานที่มีจุดส่งค้างอยู่</div>';
      return;
    }

    // Group by reference + ship_to_name (similar to admin breakdown logic)
    const groupedJobs = [];
    const groupKeyMap = new Map();

    data.forEach(job => {
      const shipToName = job.ship_to_name || job.ship_to_code || 'Unknown';
      const cleanShipToName = shipToName.replace(/\s+/g, '');
      const groupKey = `${job.reference}-${cleanShipToName}`;

      // Count incomplete stops in this group
      const isIncomplete = job.checkout_time === null;

      if (groupKeyMap.has(groupKey)) {
        const existingIndex = groupKeyMap.get(groupKey);
        groupedJobs[existingIndex].jobIds.push(job.id);
        groupedJobs[existingIndex].incompleteCount += isIncomplete ? 1 : 0;
        if (isIncomplete && !groupedJobs[existingIndex].incompleteShipTos.includes(shipToName)) {
          groupedJobs[existingIndex].incompleteShipTos.push(shipToName);
        }
      } else {
        groupKeyMap.set(groupKey, groupedJobs.length);
        groupedJobs.push({
          groupKey: groupKey,
          reference: job.reference,
          shipToName: shipToName,
          drivers: job.drivers,
          vehicleDesc: job.vehicle_desc,
          jobIds: [job.id],
          incompleteCount: isIncomplete ? 1 : 0,
          incompleteShipTos: isIncomplete ? [shipToName] : [],
          route: job.route
        });
      }
    });

    // Filter to only show groups that have incomplete stops
    const incompleteGroups = groupedJobs.filter(g => g.incompleteCount > 0);

    if (incompleteGroups.length === 0) {
      jobList.innerHTML = '<div class="breakdown-empty">ไม่พบงานที่มีจุดส่งค้างอยู่</div>';
      return;
    }

    breakdownJobsCache = incompleteGroups;

    // Render job list
    renderJobsList(incompleteGroups);

  } catch (err) {
    console.error('Error loading incomplete jobs:', err);
    jobList.innerHTML = '<div class="breakdown-empty">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  } finally {
    isLoadingJobs = false;
  }
}

/**
 * Render jobs list
 */
function renderJobsList(jobs) {
  const jobList = document.getElementById('breakdownJobList');

  let html = '';
  jobs.forEach(job => {
    html += `
      <div class="breakdown-job-item" data-group-key="${job.groupKey}">
        <div class="breakdown-job-item-main">
          <div class="breakdown-job-ref">${job.reference}</div>
          <div class="breakdown-job-meta">
            <span>${job.vehicleDesc || '-'}</span>
            <span>${job.drivers || '-'}</span>
          </div>
        </div>
        <span class="breakdown-job-badge">${job.incompleteCount} จุดค้าง</span>
      </div>
    `;
  });

  jobList.innerHTML = html;

  // Add click handlers
  jobList.querySelectorAll('.breakdown-job-item').forEach(item => {
    item.addEventListener('click', () => {
      const groupKey = item.dataset.groupKey;
      selectJob(groupKey);
    });
  });
}

/**
 * Filter jobs list by search term
 */
function filterJobsList(searchTerm) {
  const jobItems = document.querySelectorAll('.breakdown-job-item');

  if (!searchTerm) {
    jobItems.forEach(item => item.classList.remove('hidden'));
    return;
  }

  const term = searchTerm.toLowerCase();
  jobItems.forEach(item => {
    const ref = item.querySelector('.breakdown-job-ref')?.textContent.toLowerCase() || '';
    const meta = item.querySelector('.breakdown-job-meta')?.textContent.toLowerCase() || '';
    const matches = ref.includes(term) || meta.includes(term);
    item.classList.toggle('hidden', !matches);
  });
}

/**
 * Select a job from the list
 */
function selectJob(groupKey) {
  // Update UI selection
  document.querySelectorAll('.breakdown-job-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.groupKey === groupKey);
  });

  // Get job data
  selectedBreakdownJob = breakdownJobsCache.find(j => j.groupKey === groupKey);

  if (!selectedBreakdownJob) return;

  // Show selected info
  const selectedInfo = document.getElementById('breakdownSelectedInfo');
  const selectedRef = document.getElementById('breakdownSelectedRef');
  const selectedVehicle = document.getElementById('breakdownSelectedVehicle');
  const selectedDriver = document.getElementById('breakdownSelectedDriver');
  const selectedStops = document.getElementById('breakdownSelectedStops');

  selectedRef.textContent = selectedBreakdownJob.reference;
  selectedVehicle.textContent = selectedBreakdownJob.vehicleDesc || '-';
  selectedDriver.textContent = selectedBreakdownJob.drivers || '-';
  selectedStops.textContent = `${selectedBreakdownJob.incompleteCount} จุด (${selectedBreakdownJob.incompleteShipTos.join(', ')})`;

  selectedInfo.classList.remove('hidden');
}

/**
 * Generate new breakdown reference
 * Format: BD-OriginalRef-Seq (e.g., BD-2511S15403-001)
 */
async function generateBreakdownReference(originalRef) {
  // Check existing breakdown references to get next sequence
  const { data, error } = await getSupabase()
    .from('jobdata')
    .select('reference')
    .like('reference', `BD-${originalRef}-%`)
    .order('reference', { ascending: false })
    .limit(1);

  let seq = 1;
  if (!error && data && data.length > 0) {
    const lastRef = data[0].reference;
    const match = lastRef.match(/BD-.*-(\d+)$/);
    if (match) {
      seq = parseInt(match[1], 10) + 1;
    }
  }

  // Pad sequence to 3 digits
  const seqStr = String(seq).padStart(3, '0');
  return `BD-${originalRef}-${seqStr}`;
}

/**
 * Confirm breakdown and create new job
 */
async function confirmBreakdown() {
  if (!selectedBreakdownJob) {
    showError('กรุณาเลือกงาน', 'ไม่ได้เลือกงาน');
    return;
  }

  const newVehicle = document.getElementById('breakdownNewVehicle')?.value?.trim();
  const reason = document.getElementById('breakdownReason')?.value;

  if (!newVehicle) {
    showError('กรุณาระบุทะเบียนรถคันใหม่', 'กรอกข้อมูลให้ครบ');
    return;
  }

  if (!reason) {
    showError('กรุณาเลือกสาเหตุ', 'กรอกข้อมูลให้ครบ');
    return;
  }

  const currentUserId = StateManager.get(StateKeys.USER_ID);

  try {
    showLoading('กำลังสร้างงานใหม่...');

    // Get all jobs in this group
    const { data: groupJobs, error: groupError } = await getSupabase()
      .from('jobdata')
      .select('*')
      .in('id', selectedBreakdownJob.jobIds);

    if (groupError) throw groupError;

    if (!groupJobs || groupJobs.length === 0) {
      throw new Error('ไม่พบข้อมูลงาน');
    }

    // Filter to only incomplete stops (not checked out)
    const incompleteJobs = groupJobs.filter(job => !job.checkout_time);

    if (incompleteJobs.length === 0) {
      throw new Error('ไม่มีจุดส่งค้างในงานนี้');
    }

    // Generate new breakdown reference
    const newRef = await generateBreakdownReference(selectedBreakdownJob.reference);

    // Create new jobdata rows with new reference
    const newJobdataRows = incompleteJobs.map(job => ({
      reference: newRef,
      shipment_no: job.shipment_no,
      ship_to_code: job.ship_to_code,
      ship_to_name: job.ship_to_name,
      destination: job.destination,
      status: 'pending',
      checkin_time: null,
      checkin_lat: null,
      checkin_lng: null,
      checkin_odo: null,
      checkout_time: null,
      checkout_lat: null,
      checkout_lng: null,
      checkout_odo: null,
      vehicle_desc: newVehicle,
      drivers: job.drivers,
      seq: job.seq,
      route: job.route,
      is_origin_stop: job.is_origin_stop,
      materials: job.materials,
      total_qty: job.total_qty,
      dest_lat: job.dest_lat,
      dest_lng: job.dest_lng,
      radius_m: job.radius_m,
      distance_km: job.distance_km,
      job_closed_at: null,
      end_odo: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      breakdown_from_ref: selectedBreakdownJob.reference,
      breakdown_reason: reason
    }));

    // Insert new jobdata rows
    const { error: insertError } = await getSupabase()
      .from('jobdata')
      .insert(newJobdataRows);

    if (insertError) throw insertError;

    // Log to driver_logs
    try {
      await getSupabase()
        .from('driver_logs')
        .insert({
          reference: newRef,
          action: 'breakdown_created',
          details: {
            originalRef: selectedBreakdownJob.reference,
            newVehicle: newVehicle,
            reason: reason,
            stopsCount: incompleteJobs.length
          },
          user_id: currentUserId
        });
    } catch (logError) {
      console.warn('Could not log breakdown creation:', logError);
    }

    closeLoading();
    closeBreakdownModal();

    await showSuccess('สร้างงานใหม่สำเร็จ', `Reference ใหม่: ${newRef}`);

    // Auto-search the new reference
    const keywordInput = document.getElementById('keyword');
    if (keywordInput) {
      keywordInput.value = newRef;
      // Trigger search via window.DriverApp.search
      if (window.DriverApp && window.DriverApp.search) {
        window.DriverApp.search();
      }
    }

  } catch (err) {
    console.error('Error creating breakdown job:', err);
    closeLoading();
    showError('สร้างงานไม่สำเร็จ', err.message || 'กรุณาลองอีกครั้ง');
  }
}

// Export for global access if needed
window.BreakdownModule = {
  openModal: openBreakdownModal,
  closeModal: closeBreakdownModal
};
