/**
 * Incentive Approval Module
 * Handles driver incentive verification, approval, and correction workflow
 * Replaces the original holiday-work.js with enhanced functionality
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements cache
const elements = {
    // Table
    tbody: null,
    search: null,
    statusFilter: null,
    dateFrom: null,
    dateTo: null,
    refreshBtn: null,

    // Summary counts
    pendingCount: null,
    readyPaymentCount: null,
    paidCount: null,
    rejectedCount: null,

    // Detail modal
    detailModal: null,
    modalClose: null,
    detailReference: null,
    detailDriver: null,
    detailDriverCount: null,
    detailVehicle: null,
    detailDate: null,
    detailHolidayWork: null,
    detailPumping: null,
    detailTransfer: null,
    detailMaterials: null,
    detailQuantity: null,
    detailReceiver: null,
    detailDeliverySummary: null,
    detailStops: null,
    detailDistance: null,
    detailStopsCount: null,
    detailRate: null,
    detailAmount: null,
    detailNotes: null,

    // Edit form
    editForm: null,
    editReference: null,
    editDistance: null,
    editStopsCount: null,
    editRate: null,
    editAmount: null,
    editNotes: null,

    // Correction modal
    correctionModal: null,
    correctionModalClose: null,
    correctionForm: null,
    correctionReference: null,
    correctionReason: null,
    correctionDetail: null,

    // Map
    incentiveMap: null,
    mapInstance: null
};

// Realtime channel
let realtimeChannel = null;

// Current job data
let currentJob = null;
let allJobs = [];

// Incentive rate (baht per km) - should be configurable from settings
const DEFAULT_RATE_PER_KM = 2.0;

// Cache for origin keys from origin table
let originKeysCache = new Set();
let originCacheLoaded = false;

/**
 * Load origin keys from origin table
 */
async function loadOriginKeys() {
    if (originCacheLoaded) return originKeysCache;

    try {
        const { data, error } = await supabase
            .from('origin')
            .select('originKey');

        if (error) {
            console.warn('Could not load origin table:', error);
            // Return empty set if origin table doesn't exist or can't be accessed
            return new Set();
        }

        originKeysCache = new Set((data || []).map(o => o.originKey));
        originCacheLoaded = true;
        console.log('🏠 Loaded origin keys:', Array.from(originKeysCache));
        return originKeysCache;
    } catch (e) {
        console.warn('Error loading origin keys:', e);
        return new Set();
    }
}

/**
 * Check if a ship_to_code is an origin point
 */
async function isOriginPoint(shipToCode) {
    if (!shipToCode) return false;

    // Load origin keys if not already loaded
    const origins = await loadOriginKeys();

    // Check if ship_to_code exists in origin table
    return origins.has(shipToCode);
}

/**
 * Set DOM elements for the module
 */
export function setIncentiveApprovalElements(els) {
    Object.assign(elements, els);
}

/**
 * Load incentive jobs for approval
 */
export async function loadIncentiveJobs(searchTerm = '', statusFilter = 'pending') {
    if (!elements.tbody) {
        console.error('Incentive table body not set');
        return;
    }

    elements.tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;"><div style="font-size:24px;">⏳</div><p>กำลังโหลดข้อมูล...</p></td></tr>';

    try {
        let query = supabase
            .from('jobdata')
            .select('*')
            .not('job_closed_at', 'is', null)
            .order('job_closed_at', { ascending: false });

        // Apply filters
        if (statusFilter === 'pending') {
            // Jobs that are completed but not yet approved for payment
            query = query.is('incentive_approved', null);
        } else if (statusFilter === 'ready') {
            // Approved and ready for payment
            query = query.eq('incentive_approved', true).is('payment_status', null);
        } else if (statusFilter === 'paid') {
            // Fully paid
            query = query.eq('payment_status', 'paid');
        } else if (statusFilter === 'rejected') {
            // Rejected or needs correction
            query = query.or('incentive_approved.eq.false,payment_status.eq.correction_needed');
        }

        // Date range filter
        if (elements.dateFrom?.value) {
            query = query.gte('job_closed_at', elements.dateFrom.value);
        }
        if (elements.dateTo?.value) {
            const endDate = new Date(elements.dateTo.value);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('job_closed_at', endDate.toISOString().split('T')[0]);
        }

        const { data: jobs, error } = await query.limit(500);
        if (error) throw error;

        allJobs = jobs || [];
        await updateSummary();

        // Filter by search term
        let filteredJobs = allJobs;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredJobs = allJobs.filter(job =>
                (job.reference && job.reference.toLowerCase().includes(term)) ||
                (job.drivers && job.drivers.toLowerCase().includes(term)) ||
                (job.vehicle_desc && job.vehicle_desc.toLowerCase().includes(term))
            );
        }

        await renderTable(filteredJobs);

    } catch (error) {
        console.error('Error loading incentive jobs:', error);
        elements.tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: #f44336;">
            ❌ เกิดข้อผิดพลาด: ${sanitizeHTML(error.message)}
        </td></tr>`;
    }
}

/**
 * Calculate unique delivery stops count (excluding origin)
 * @param {Array} jobs - Array of job records for a single reference
 * @returns {Promise<number>} Count of unique delivery destinations
 */
async function calculateUniqueStops(jobs) {
    // Use Set to track unique ship_to values (jobdata uses 'ship_to', driver_jobs uses 'ship_to_code')
    const uniqueDestinations = new Set();

    console.log('🔍 Debug calculateUniqueStops:', {
        jobsCount: jobs.length,
        jobs: jobs.map(j => ({
            seq: j.seq,
            ship_to: j.ship_to,
            ship_to_code: j.ship_to_code,
            ship_to_name: j.ship_to_name,
            destination: j.destination
        }))
    });

    // Load origin keys for comparison
    const origins = await loadOriginKeys();
    console.log('🏠 Origin keys for comparison:', Array.from(origins));

    for (const job of jobs) {
        // Get column values - jobdata table uses 'ship_to', not 'ship_to_code'
        // ship_to_code is in driver_jobs table only
        const shipToCode = job.ship_to || job.ship_to_code || '';
        const shipToName = job.ship_to_name || '';

        // Check if this is an origin point by looking up in origin table
        const isOrigin = await isOriginPoint(shipToCode);

        console.log('📍 Processing stop:', {
            shipToCode,
            shipToName,
            isOrigin
        });

        if (isOrigin) {
            console.log('⏭️ Skipping origin point:', shipToCode);
            continue; // Skip origin
        }

        // Use ship_to if available, otherwise use ship_to_name for grouping
        const key = shipToCode || shipToName;
        if (key && key.trim() !== '') {
            uniqueDestinations.add(key.trim());
        }
    }

    const result = uniqueDestinations.size;
    console.log('✅ Unique delivery stops count:', result, 'destinations:', Array.from(uniqueDestinations));

    return result;
}

/**
 * Render the incentive table
 */
async function renderTable(jobs) {
    elements.tbody.innerHTML = '';

    if (jobs.length === 0) {
        elements.tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px;">
            <div style="font-size:48px; margin-bottom:10px;">📭</div>
            <p>ไม่พบรายการ</p>
        </td></tr>`;
        return;
    }

    // Group by reference
    const groupedJobs = {};
    jobs.forEach(job => {
        if (!groupedJobs[job.reference]) {
            groupedJobs[job.reference] = {
                ...job,
                all_jobs: [job],
                total_distance: parseFloat(job.distance_km) || 0,
                all_seqs: [job.seq]
            };
        } else {
            groupedJobs[job.reference].all_jobs.push(job);
            groupedJobs[job.reference].all_seqs.push(job.seq);
            groupedJobs[job.reference].total_distance += parseFloat(job.distance_km) || 0;
        }
    });

    // Calculate unique stops for each reference (now async)
    for (const reference of Object.keys(groupedJobs)) {
        groupedJobs[reference].stop_count = await calculateUniqueStops(groupedJobs[reference].all_jobs);
    }

    // Render rows
    Object.values(groupedJobs).forEach(job => {
        const row = elements.tbody.insertRow();

        // Reference
        const refCell = row.insertCell();
        const refStrong = document.createElement('strong');
        refStrong.textContent = job.reference || '-';
        refCell.appendChild(refStrong);

        // Date
        const dateCell = row.insertCell();
        dateCell.style.fontSize = '0.9rem';
        dateCell.textContent = job.job_closed_at
            ? new Date(job.job_closed_at).toLocaleString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric'
            })
            : '-';

        // Driver
        row.insertCell().textContent = job.drivers || '-';

        // Vehicle
        const vehicleCell = row.insertCell();
        vehicleCell.style.fontSize = '0.9rem';
        vehicleCell.textContent = job.vehicle_desc || '-';

        // Stops count
        const stopsCell = row.insertCell();
        stopsCell.style.textAlign = 'center';
        const stopsSpan = document.createElement('span');
        stopsSpan.style.cssText = 'background:#2196f3;color:white;padding:2px 8px;border-radius:10px;font-size:0.85rem;';
        stopsSpan.textContent = `${job.stop_count} จุด`;
        stopsCell.appendChild(stopsSpan);

        // Distance
        const distanceCell = row.insertCell();
        distanceCell.textContent = (job.total_distance || 0).toFixed(1) + ' km';

        // Incentive amount
        const amountCell = row.insertCell();
        const rate = job.incentive_rate || DEFAULT_RATE_PER_KM;
        const amount = (job.total_distance || 0) * rate;
        amountCell.innerHTML = `<strong style="color: #4caf50;">฿${amount.toFixed(2)}</strong>`;

        // Status
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        statusBadge.style.cssText = 'color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;';

        if (job.payment_status === 'paid') {
            statusBadge.style.background = '#4caf50';
            statusBadge.textContent = '✅ ชำระแล้ว';
        } else if (job.incentive_approved === true) {
            statusBadge.style.background = '#2196f3';
            statusBadge.textContent = '💵 รอชำระ';
        } else if (job.payment_status === 'correction_needed') {
            statusBadge.style.background = '#ff9800';
            statusBadge.textContent = '📝 ต้องแก้ไข';
        } else if (job.incentive_approved === false) {
            statusBadge.style.background = '#f44336';
            statusBadge.textContent = '❌ ปฏิเสธ';
        } else {
            statusBadge.style.background = '#ff9800';
            statusBadge.textContent = '⏳ รอตรวจสอบ';
        }
        statusCell.appendChild(statusBadge);

        // Actions
        const actionCell = row.insertCell();
        const viewBtn = document.createElement('button');
        viewBtn.textContent = '🔍 ตรวจสอบ';
        viewBtn.style.cssText = 'background:var(--primary-color); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;';
        viewBtn.addEventListener('click', () => openDetailModal(job));
        actionCell.appendChild(viewBtn);
    });
}

/**
 * Update summary counts
 */
async function updateSummary() {
    try {
        // Pending verification
        const { data: pendingJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .not('job_closed_at', 'is', null)
            .is('incentive_approved', null);

        // Ready for payment
        const { data: readyJobs } = await supabase
            .from('jobdata')
            .select('reference, distance_km, incentive_rate')
            .not('job_closed_at', 'is', null)
            .eq('incentive_approved', true)
            .is('payment_status', null);

        // Paid
        const { data: paidJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('payment_status', 'paid');

        // Rejected/correction needed
        const { data: rejectedJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .or('incentive_approved.eq.false,payment_status.eq.correction_needed');

        const pendingCount = new Set((pendingJobs || []).map(j => j.reference)).size;
        const readyCount = new Set((readyJobs || []).map(j => j.reference)).size;
        const paidCount = new Set((paidJobs || []).map(j => j.reference)).size;
        const rejectedCount = new Set((rejectedJobs || []).map(j => j.reference)).size;

        if (elements.pendingCount) elements.pendingCount.textContent = pendingCount;
        if (elements.readyPaymentCount) elements.readyPaymentCount.textContent = readyCount;
        if (elements.paidCount) elements.paidCount.textContent = paidCount;
        if (elements.rejectedCount) elements.rejectedCount.textContent = rejectedCount;

        updateNavBadge(pendingCount);
    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

/**
 * Update navigation badge
 */
function updateNavBadge(count) {
    const navLink = document.querySelector('[data-target="incentive-approval"]');
    if (!navLink) return;

    let badge = navLink.querySelector('.badge');
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge';
            badge.style.cssText = 'background: #ff9800; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem; margin-left: 5px; font-weight: bold;';
            navLink.appendChild(badge);
        }
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        if (badge) badge.classList.add('hidden');
    }
}

/**
 * Open detail modal
 */
export async function openDetailModal(job) {
    currentJob = job;
    if (!elements.detailModal) return;

    // Populate basic info
    if (elements.detailReference) elements.detailReference.textContent = job.reference;
    if (elements.detailDriver) elements.detailDriver.textContent = job.drivers || '-';
    if (elements.detailDriverCount) {
        const driverCount = job.driver_count || job.all_jobs?.[0]?.driver_count;
        elements.detailDriverCount.textContent = driverCount ? `${driverCount} คน` : '-';
    }
    if (elements.detailVehicle) elements.detailVehicle.textContent = job.vehicle_desc || '-';
    if (elements.detailDate) {
        elements.detailDate.textContent = job.job_closed_at
            ? new Date(job.job_closed_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
            : '-';
    }

    // Populate trip details
    // Holiday Work
    if (elements.detailHolidayWork) {
        const isHoliday = job.is_holiday_work || job.all_jobs?.some(j => j.is_holiday_work);
        elements.detailHolidayWork.textContent = isHoliday ? '✅ ใช่ (ทำงานวันหยุด)' : 'ไม่ใช่';
    }

    // Pumping
    if (elements.detailPumping) {
        const hasPumping = job.has_pumping || job.all_jobs?.some(j => j.has_pumping);
        elements.detailPumping.textContent = hasPumping ? '✅ ปั่นน้ำมัน' : 'ไม่ปั่น';
    }

    // Transfer
    if (elements.detailTransfer) {
        const hasTransfer = job.has_transfer || job.all_jobs?.some(j => j.has_transfer);
        elements.detailTransfer.textContent = hasTransfer ? '✅ โยกน้ำมัน' : 'ไม่ได้โยก';
    }

    // Materials
    if (elements.detailMaterials) {
        const materials = job.materials || job.all_jobs?.map(j => j.materials).filter(m => m).join(', ');
        elements.detailMaterials.textContent = materials || '-';
    }

    // Total Quantity
    if (elements.detailQuantity) {
        const qty = job.total_qty || job.all_jobs?.reduce((sum, j) => sum + (j.total_qty || 0), 0);
        elements.detailQuantity.textContent = qty ? `${qty.toLocaleString()} ลิตร` : '-';
    }

    // Receiver
    if (elements.detailReceiver) {
        const receiver = job.receiver_name || job.all_jobs?.map(j => j.receiver_name).filter(r => r).join(', ');
        const receiverType = job.receiver_type || job.all_jobs?.[0]?.receiver_type;
        elements.detailReceiver.textContent = receiver
            ? `${receiver}${receiverType ? ` (${receiverType})` : ''}`
            : '-';
    }

    // Load all stops for this reference to calculate unique stops correctly
    const stops = await loadJobStops(job.reference);
    const uniqueStopsCount = await calculateUniqueStops(stops);

    // Render delivery summary (now async)
    if (elements.detailDeliverySummary) {
        await renderDeliverySummary(stops);
    }

    // Calculate totals
    const rate = job.incentive_rate || DEFAULT_RATE_PER_KM;
    const totalDistance = job.total_distance || 0;
    const amount = totalDistance * rate;

    if (elements.detailDistance) elements.detailDistance.textContent = totalDistance.toFixed(1) + ' km';
    if (elements.detailStopsCount) elements.detailStopsCount.textContent = uniqueStopsCount + ' จุด';
    if (elements.detailRate) elements.detailRate.textContent = '฿' + rate.toFixed(2);
    if (elements.detailAmount) elements.detailAmount.textContent = '฿' + amount.toFixed(2);

    // Render stops detail
    if (elements.detailStops) {
        await renderStopsDetail(stops);
    }

    // Notes
    if (elements.detailNotes) {
        elements.detailNotes.textContent = job.incentive_notes || job.holiday_work_notes || 'ไม่มีหมายเหตุ';
    }

    // Populate edit form
    if (elements.editReference) elements.editReference.value = job.reference;
    if (elements.editDistance) elements.editDistance.value = totalDistance;
    if (elements.editStopsCount) elements.editStopsCount.value = uniqueStopsCount;
    if (elements.editRate) elements.editRate.value = rate;
    if (elements.editAmount) elements.editAmount.value = amount;
    if (elements.editNotes) elements.editNotes.value = '';

    elements.detailModal.classList.remove('hidden');

    // Setup tab switching
    setupModalTabs();
}

/**
 * Load job stops
 */
async function loadJobStops(reference) {
    try {
        const { data, error } = await supabase
            .from('jobdata')
            .select('*')
            .eq('reference', reference)
            .order('seq', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading stops:', error);
        return [];
    }
}

/**
 * Render stops detail - grouped by ship_to for incentive calculation
 * Shows all jobdata records with their check-in/check-out details
 */
async function renderStopsDetail(stops) {
    if (!elements.detailStops) return;

    elements.detailStops.innerHTML = '';

    if (stops.length === 0) {
        elements.detailStops.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูลจุดส่ง</p>';
        return;
    }

    // Load origin keys once for all stops
    const origins = await loadOriginKeys();

    // Group stops by ship_to (unique destinations)
    // key: ship_to or ship_to_name, value: array of all stops for this destination
    const groupedStops = new Map();
    const originStops = [];
    const deliveryStops = [];

    for (const stop of stops) {
        const shipToCode = stop.ship_to || stop.ship_to_code || '';
        const shipToName = stop.ship_to_name || '';
        const isOrigin = origins.has(shipToCode);

        // Use ship_to as key for grouping
        const key = shipToCode || shipToName || 'unknown';

        if (!groupedStops.has(key)) {
            groupedStops.set(key, {
                shipToCode,
                shipToName,
                destination: stop.destination || '',
                isOrigin,
                records: []
            });
        }

        groupedStops.get(key).records.push(stop);

        if (isOrigin) {
            originStops.push(key);
        } else {
            deliveryStops.push(key);
        }
    }

    // Display header
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem; color: #424242; border: 1px solid #e0e0e0;';
    headerDiv.innerHTML = `
        <div><strong>ข้อมูลทั้งหมดจาก jobdata:</strong> ${stops.length} ระเบียน</div>
        <div style="margin-top: 5px;">
            <span style="color: #78909c;">🏠 ต้นทาง ${new Set(originStops).size} จุด (${originStops.length} ระเบียน)</span> |
            <span style="color: #4caf50;">📍 จุดส่ง ${new Set(deliveryStops).size} จุด (${deliveryStops.length} ระเบียน)</span>
        </div>
    `;
    elements.detailStops.appendChild(headerDiv);

    // Display grouped stops
    let displayIndex = 0;
    for (const [key, group] of groupedStops.entries()) {
        displayIndex++;

        const groupDiv = document.createElement('div');
        groupDiv.style.cssText = 'margin-bottom: 15px; padding: 12px; background: #e3f2fd; border-radius: 8px; border: 1px solid #90caf9; box-shadow: 0 2px 4px rgba(0,0,0,0.08);';

        // Header for this group (unique destination)
        const destinationName = group.shipToName || group.destination || key;
        const bgColor = group.isOrigin ? '#78909c' : 'var(--primary-color)';
        const label = group.isOrigin ? '🏠 ต้นทาง' : `📍 จุดส่งที่ ${displayIndex}`;

        // Check if any records are incomplete
        const hasIncomplete = group.records.some(r => !r.checkin_time || !r.checkout_time);

        let html = `
            <div style="display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px dashed #90caf9;">
                <div style="width: 36px; height: 36px; background: ${bgColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                    ${group.isOrigin ? '🏠' : displayIndex}
                </div>
                <div style="flex: 1;">
                    <strong style="color: #1565c0; font-size: 0.95rem;">${sanitizeHTML(destinationName)}</strong>
                    ${!group.isOrigin ? `<div style="font-size: 0.8rem; color: #546e7a;">รหัส: ${sanitizeHTML(group.shipToCode || '-')}</div>` : ''}
                    <div style="font-size: 0.8rem; color: ${hasIncomplete ? '#ef6c00' : '#2e7d32'};">
                        ${group.records.length} ระเบียน ${hasIncomplete ? '⚠️ บางระเบียนไม่สมบูรณ์' : '✅ สมบูรณ์'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.8rem; padding: 4px 10px; background: ${group.isOrigin ? '#78909c' : '#1976d2'}; color: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                        ${label}
                    </span>
                </div>
            </div>
        `;

        // List all records for this destination
        html += '<div style="margin-left: 48px; font-size: 0.85rem;">';
        for (const [i, record] of group.records.entries()) {
            const seq = record.seq || i + 1;
            const checkinTime = record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString('th-TH') : '-';
            const checkoutTime = record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString('th-TH') : '-';
            const isComplete = record.checkin_time && record.checkout_time;

            html += `
                <div style="padding: 8px 10px; margin-bottom: 4px; background: ${isComplete ? '#ffffff' : '#fff8e1'}; border-radius: 4px; border-left: 4px solid ${isComplete ? '#4caf50' : '#ff9800'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="color: #424242; font-weight: 500;">Seq ${seq}</div>
                    <div style="margin-top: 4px; color: #616161;">
                        Check-in: <strong style="color: ${isComplete ? '#2e7d32' : '#ef6c00'};">${checkinTime}</strong>
                        | Check-out: <strong style="color: ${isComplete ? '#2e7d32' : '#ef6c00'};">${checkoutTime}</strong>
                        ${record.checkin_odo ? `| ไมล์: <span style="color: #1976d2;">${record.checkin_odo}</span>` : ''}
                        ${record.checkout_odo ? `→ <span style="color: #1976d2;">${record.checkout_odo}</span>` : ''}
                    </div>
                </div>
            `;
        }
        html += '</div>';

        groupDiv.innerHTML = html;
        elements.detailStops.appendChild(groupDiv);
    }

    // Summary for incentive calculation
    const uniqueDeliveryCount = new Set(deliveryStops).size;
    const uniqueOriginCount = new Set(originStops).size;
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'margin-top: 16px; padding: 14px; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 8px; border: 1px solid #81c784; box-shadow: 0 2px 6px rgba(76, 175, 80, 0.15);';
    summaryDiv.innerHTML = `
        <div style="font-size: 1.05rem; font-weight: bold; color: #2e7d32; margin-bottom: 6px;">
            💰 คำนวณ Incentive
        </div>
        <div style="font-size: 0.95rem; color: #1b5e20;">
            จุดส่งจริงที่นับรับ: <strong style="font-size: 1.1rem;">${uniqueDeliveryCount} จุด</strong>
            <span style="color: #4caf50;">(ไม่รวมต้นทาง ${uniqueOriginCount} จุด)</span>
        </div>
    `;
    elements.detailStops.appendChild(summaryDiv);
}

/**
 * Render delivery summary - grouped by destination with materials and quantities
 */
async function renderDeliverySummary(stops) {
    if (!elements.detailDeliverySummary) return;

    elements.detailDeliverySummary.innerHTML = '';

    if (stops.length === 0) {
        elements.detailDeliverySummary.innerHTML = '<p style="color: #757575;">ไม่พบข้อมูลการจัดส่ง</p>';
        return;
    }

    // Ensure origin keys are loaded
    const origins = await loadOriginKeys();

    // Group by destination - use ship_to_name primarily since ship_to_code is often empty
    const destinationGroups = new Map();
    let totalQuantity = 0;

    for (const stop of stops) {
        const shipToCode = stop.ship_to || stop.ship_to_code || '';
        const shipToName = stop.ship_to_name || stop.destination || 'ไม่ระบุ';

        // Check if this is an origin point
        const isOrigin = origins.has(shipToCode);

        // Skip origin points from delivery summary
        if (isOrigin) continue;

        // Use ship_to_name as the primary key since ship_to_code is often empty
        const key = shipToName;

        if (!destinationGroups.has(key)) {
            destinationGroups.set(key, {
                shipToCode,
                shipToName,
                materials: new Map(), // Use Map to store material -> total quantity
                totalQuantity: 0,
                records: []
            });
        }

        const group = destinationGroups.get(key);

        // Add materials with quantities
        if (stop.materials) {
            const materials = stop.materials.split(',').map(m => m.trim()).filter(m => m);
            for (const material of materials) {
                if (!group.materials.has(material)) {
                    group.materials.set(material, 0);
                }
                group.materials.set(material, group.materials.get(material) + (stop.total_qty || 0));
            }
        }

        // Add quantity
        const qty = parseFloat(stop.total_qty) || 0;
        group.totalQuantity += qty;
        totalQuantity += qty;

        // Track records
        group.records.push(stop);
    }

    const totalStops = destinationGroups.size;

    // Display total summary at the top
    const totalDiv = document.createElement('div');
    totalDiv.style.cssText = 'background: linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%); padding: 14px; border-radius: 8px; border: 2px solid #ff9800; margin-bottom: 15px; box-shadow: 0 2px 6px rgba(255, 152, 0, 0.2);';
    totalDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="color: #e65100; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">📊 สรุปทั้งหมด</div>
                <div style="color: #212121; font-size: 0.9rem;">
                    จุดส่ง <strong>${totalStops}</strong> แห่ง |
                    ปริมาณรวม <strong>${totalQuantity.toLocaleString()} ลิตร</strong>
                </div>
            </div>
            <div style="font-size: 2rem;">📦</div>
        </div>
    `;
    elements.detailDeliverySummary.appendChild(totalDiv);

    // Display each destination with its details
    let stopIndex = 0;
    for (const [key, group] of destinationGroups.entries()) {
        stopIndex++;

        const stopDiv = document.createElement('div');
        stopDiv.style.cssText = 'background: white; padding: 12px; border-radius: 8px; border-left: 5px solid #ff9800; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';

        // Build materials list with quantities
        let materialsHtml = '';
        if (group.materials.size > 0) {
            const materialEntries = Array.from(group.materials.entries());
            materialsHtml = materialEntries.map(([material, qty]) =>
                `<span style="display: inline-block; background: #fff3e0; padding: 2px 6px; border-radius: 4px; margin: 2px; font-size: 0.75rem; color: #e65100;">
                    ${sanitizeHTML(material)}: <strong>${qty.toLocaleString()}</strong> ลิตร
                </span>`
            ).join('');
        } else {
            materialsHtml = '<span style="color: #9e9e9e;">-</span>';
        }

        stopDiv.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <div style="width: 36px; height: 36px; background: #ff9800; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 1rem;">
                    ${stopIndex}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #212121; font-size: 1rem; margin-bottom: 4px;">
                        ${sanitizeHTML(group.shipToName)}
                    </div>
                    ${group.shipToCode ? `<div style="font-size: 0.75rem; color: #757575; margin-bottom: 4px;">รหัส: ${sanitizeHTML(group.shipToCode)}</div>` : ''}
                    ${group.records.length > 1 ? `<div style="font-size: 0.7rem; color: #757575;">(${group.records.length} ระเบียน)</div>` : ''}
                    <div style="margin-top: 8px;">
                        <div style="font-size: 0.75rem; color: #757575; margin-bottom: 4px;">📦 สินค้าและปริมาณ:</div>
                        <div style="line-height: 1.8;">${materialsHtml}</div>
                    </div>
                    ${group.totalQuantity > 0 ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e0e0e0;">
                            <span style="color: #757575; font-size: 0.8rem;">⚖️ ปริมาณรวมที่จุดนี้:</span>
                            <span style="color: #e65100; font-weight: bold; font-size: 1rem; margin-left: 8px;">${group.totalQuantity.toLocaleString()} ลิตร</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        elements.detailDeliverySummary.appendChild(stopDiv);
    }

    // If no data
    if (totalQuantity === 0 && destinationGroups.size === 0) {
        elements.detailDeliverySummary.innerHTML = '<p style="color: #757575;">ไม่มีข้อมูลสินค้าที่จัดส่ง</p>';
    }
}

/**
 * Setup modal tabs
 */
function setupModalTabs() {
    const tabs = elements.detailModal?.querySelectorAll('.modal-tab');
    const contents = elements.detailModal?.querySelectorAll('.tab-content');

    tabs?.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update tab styles
            tabs.forEach(t => {
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-color)';
            });
            tab.style.borderBottomColor = 'var(--primary-color)';
            tab.style.color = 'var(--primary-color)';

            // Show content
            const targetTab = tab.dataset.tab;
            contents?.forEach(content => {
                content.style.display = content.id === `tab-${targetTab}` ? 'block' : 'none';
            });

            // Initialize map if map tab
            if (targetTab === 'map' && currentJob) {
                initIncentiveMap(currentJob);
            }
        });
    });
}

/**
 * Initialize incentive map
 */
async function initIncentiveMap(job) {
    if (!elements.incentiveMap) return;

    // Lazy load Leaflet
    if (typeof L === 'undefined') {
        await loadLeaflet();
    }

    if (elements.mapInstance) {
        elements.mapInstance.remove();
    }

    elements.mapInstance = L.map('incentive-map').setView([13.736717, 100.523186], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(elements.mapInstance);

    // Load stops with coordinates
    try {
        const { data: stops } = await supabase
            .from('jobdata')
            .select('*')
            .eq('reference', job.reference)
            .not('checkin_lat', 'is', null)
            .order('seq', { ascending: true });

        if (stops && stops.length > 0) {
            const latlngs = stops.map(s => [s.checkin_lat, s.checkin_lng]);

            // Add markers
            stops.forEach((stop, index) => {
                const marker = L.marker([stop.checkin_lat, stop.checkin_lng])
                    .addTo(elements.mapInstance)
                    .bindPopup(`<b>จุดที่ ${index + 1}</b><br>${sanitizeHTML(stop.destination || '-')}`);
            });

            // Draw path
            if (latlngs.length > 1) {
                L.polyline(latlngs, { color: 'blue', weight: 3 }).addTo(elements.mapInstance);
            }

            elements.mapInstance.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
        }
    } catch (error) {
        console.error('Error loading map data:', error);
    }

    // Force resize
    setTimeout(() => elements.mapInstance?.invalidateSize(), 100);
}

/**
 * Load Leaflet dynamically
 */
function loadLeaflet() {
    return new Promise((resolve, reject) => {
        if (typeof L !== 'undefined') {
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Close detail modal
 */
export function closeDetailModal() {
    if (elements.detailModal) {
        elements.detailModal.classList.add('hidden');
    }
    if (elements.mapInstance) {
        elements.mapInstance.remove();
        elements.mapInstance = null;
    }
    currentJob = null;
}

/**
 * Approve incentive and send to payment
 */
export async function approveIncentive(liff) {
    if (!currentJob) return;

    try {
        const lineProfile = await liff.getProfile();
        const rate = currentJob.incentive_rate || DEFAULT_RATE_PER_KM;
        const totalDistance = currentJob.total_distance || 0;
        const amount = totalDistance * rate;

        const { error } = await supabase
            .from('jobdata')
            .update({
                incentive_approved: true,
                incentive_approved_by: lineProfile.userId,
                incentive_approved_at: new Date().toISOString(),
                incentive_amount: amount,
                incentive_distance: totalDistance,
                incentive_stops: currentJob.stop_count,
                incentive_rate: rate,
                updated_at: new Date().toISOString()
            })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification(`✅ อนุมัติ incentive สำเร็จ: ${currentJob.reference}`, 'success');
        closeDetailModal();
        await loadIncentiveJobs(elements.search?.value, elements.statusFilter?.value);
    } catch (error) {
        console.error('Error approving incentive:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Reject incentive
 */
export async function rejectIncentive(reason) {
    if (!currentJob) return;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({
                incentive_approved: false,
                payment_status: 'rejected',
                incentive_notes: (currentJob.incentive_notes || '') + `\n\nปฏิเสธ: ${reason}`,
                updated_at: new Date().toISOString()
            })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification(`❌ ปฏิเสธ incentive แล้ว: ${currentJob.reference}`, 'success');
        closeDetailModal();
        closeCorrectionModal();
        await loadIncentiveJobs(elements.search?.value, elements.statusFilter?.value);
    } catch (error) {
        console.error('Error rejecting incentive:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Request correction
 */
export async function requestCorrection(reason, detail) {
    if (!currentJob) return;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({
                payment_status: 'correction_needed',
                incentive_notes: (currentJob.incentive_notes || '') +
                    `\n\nขอแก้ไข [${reason}]:\n${detail}`,
                updated_at: new Date().toISOString()
            })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification(`📝 ส่งคำขอแก้ไขแล้ว: ${currentJob.reference}`, 'success');
        closeDetailModal();
        closeCorrectionModal();
        await loadIncentiveJobs(elements.search?.value, elements.statusFilter?.value);
    } catch (error) {
        console.error('Error requesting correction:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Edit incentive data
 */
export async function editIncentive(data) {
    if (!currentJob) return;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({
                incentive_distance: data.distance,
                incentive_stops: data.stops,
                incentive_rate: data.rate,
                incentive_amount: data.amount,
                incentive_notes: (currentJob.incentive_notes || '') +
                    `\n\nแก้ไขโดย admin:\n${data.notes}`,
                updated_at: new Date().toISOString()
            })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification(`💾 บันทึกการแก้ไขสำเร็จ`, 'success');
        closeDetailModal();
        await loadIncentiveJobs(elements.search?.value, elements.statusFilter?.value);
    } catch (error) {
        console.error('Error editing incentive:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Open correction modal
 */
export function openCorrectionModal() {
    if (elements.correctionModal && currentJob) {
        elements.correctionReference.value = currentJob.reference;
        elements.correctionModal.classList.remove('hidden');
    }
}

/**
 * Close correction modal
 */
export function closeCorrectionModal() {
    if (elements.correctionModal) {
        elements.correctionModal.classList.add('hidden');
        if (elements.correctionForm) {
            elements.correctionForm.reset();
        }
    }
}

/**
 * Subscribe to realtime updates
 */
export function subscribeToIncentiveUpdates() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
        .channel('incentive-updates')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'jobdata'
            },
            (payload) => {
                console.log('Incentive change detected:', payload);

                const eventType = payload.eventType;
                if (eventType === 'UPDATE') {
                    if (payload.new.incentive_approved !== payload.old.incentive_approved) {
                        const status = payload.new.incentive_approved ? 'อนุมัติ' : 'ปฏิเสธ';
                        showNotification(`💰 Incentive: ${payload.new.reference} - ${status}`, 'info');
                    } else if (payload.new.payment_status !== payload.old.payment_status) {
                        showNotification(`💵 Payment status: ${payload.new.reference} - ${payload.new.payment_status}`, 'info');
                    }
                }

                // Refresh if on incentive page
                const activeSection = document.querySelector('.content-section.active');
                if (activeSection && activeSection.id === 'incentive-approval') {
                    setTimeout(() => {
                        loadIncentiveJobs(elements.search?.value, elements.statusFilter?.value);
                    }, 500);
                } else {
                    updateSummary();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to incentive updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Failed to subscribe to incentive updates');
                setTimeout(() => subscribeToIncentiveUpdates(), 5000);
            }
        });
}

/**
 * Unsubscribe from realtime updates
 */
export function unsubscribeFromIncentiveUpdates() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
}
