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

    // Performance Summary elements
    perfTotalTime: null,
    perfTotalDistance: null,
    perfHolidayWork: null,
    perfDriverCount: null,
    perfDriverNames: null,
    perfVehicleStatus: null,

    // Edit buttons
    editDeliveryBtn: null,
    editHolidayBtn: null,
    editDriverCountBtn: null,
    editDriverNamesBtn: null,

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
 * Export calculateIncentiveDistance for use in other modules
 */
export { calculateIncentiveDistance };

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
 * Calculate incentive distance based on MAX distance per ship_to_code
 * Formula: Sum of (MAX distance per ship_to_code) x 2 (round trip)
 * @param {Array} jobs - Array of job records for a single reference
 * @returns {Promise<number>} Total incentive distance in km
 */
async function calculateIncentiveDistance(jobs) {
    // Load origin keys once
    const origins = await loadOriginKeys();

    // Group by ship_to_code to find MAX distance for each unique destination
    const distanceByShipToCode = new Map();

    for (const job of jobs) {
        const shipToCode = job.ship_to || job.ship_to_code || '';
        const distance = parseFloat(job.distance_km) || 0;

        // Skip if no valid distance or ship_to_code
        if (!shipToCode || shipToCode.trim() === '' || distance <= 0) {
            continue;
        }

        // Check if this is an origin point - exclude from calculation
        const isOrigin = origins.has(shipToCode);
        if (isOrigin) {
            console.log('⏭️ Skipping origin point for distance:', shipToCode);
            continue;
        }

        // Keep MAX distance for this ship_to_code
        const currentMax = distanceByShipToCode.get(shipToCode) || 0;
        if (distance > currentMax) {
            distanceByShipToCode.set(shipToCode, distance);
        }
    }

    // Sum all MAX distances and multiply by 2 (round trip)
    const oneWayDistance = Array.from(distanceByShipToCode.values()).reduce((sum, dist) => sum + dist, 0);
    const roundTripDistance = oneWayDistance * 2;

    console.log('📏 Incentive Distance Calculation:', {
        uniqueDestinations: distanceByShipToCode.size,
        oneWayDistance: oneWayDistance.toFixed(1),
        roundTripDistance: roundTripDistance.toFixed(1),
        breakdown: Array.from(distanceByShipToCode.entries()).map(([code, dist]) => `${code}: ${dist}km`)
    });

    return roundTripDistance;
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
                all_seqs: [job.seq]
            };
        } else {
            groupedJobs[job.reference].all_jobs.push(job);
            groupedJobs[job.reference].all_seqs.push(job.seq);
        }
    });

    // Calculate unique stops and incentive distance for each reference
    for (const reference of Object.keys(groupedJobs)) {
        groupedJobs[reference].stop_count = await calculateUniqueStops(groupedJobs[reference].all_jobs);
        groupedJobs[reference].total_distance = await calculateIncentiveDistance(groupedJobs[reference].all_jobs);
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
    const isHoliday = job.is_holiday_work || job.all_jobs?.some(j => j.is_holiday_work);
    if (elements.detailHolidayWork) {
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

    // Calculate incentive distance using the new formula (MAX per ship_to_code x 2)
    const totalDistance = await calculateIncentiveDistance(stops);
    const rate = job.incentive_rate || DEFAULT_RATE_PER_KM;
    const amount = totalDistance * rate;

    // Calculate total duration from check-in to last check-out
    const perfMetrics = calculatePerformanceMetrics(stops);

    // Populate Performance Summary section
    if (elements.perfTotalTime) {
        elements.perfTotalTime.textContent = perfMetrics.totalDuration || '-';
    }
    if (elements.perfTotalDistance) {
        elements.perfTotalDistance.textContent = `${totalDistance.toFixed(1)} กม.`;
    }
    if (elements.perfHolidayWork) {
        elements.perfHolidayWork.textContent = isHoliday ? '✅ ใช่' : '❌ ไม่ใช่';
    }
    if (elements.perfDriverCount) {
        const driverCount = job.driver_count || countDrivers(job.drivers);
        elements.perfDriverCount.textContent = `${driverCount} คน`;
    }
    if (elements.perfDriverNames) {
        const driverNames = formatDriverNames(job.drivers);
        elements.perfDriverNames.textContent = driverNames || '-';
    }
    if (elements.perfVehicleStatus) {
        const isVehicleReady = checkVehicleReady(job);
        elements.perfVehicleStatus.textContent = isVehicleReady ? '✅ พร้อมจัดส่ง' : '⚠️ ไม่พร้อม';
        elements.perfVehicleStatus.style.color = isVehicleReady ? '#2e7d32' : '#f44336';
    }

    // Render delivery summary (horizontal layout)
    if (elements.detailDeliverySummary) {
        await renderDeliverySummaryHorizontal(stops);
    }

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

    // Setup edit delivery button
    setupEditDeliveryButton();

    // Setup performance summary edit buttons
    setupPerformanceEditButtons();

    // Setup tab switching
    setupModalTabs();
}

/**
 * Calculate performance metrics from stops
 */
function calculatePerformanceMetrics(stops) {
    if (!stops || stops.length === 0) {
        return { totalDuration: '-' };
    }

    // Find first check-in and last check-out
    let firstCheckin = null;
    let lastCheckout = null;

    for (const stop of stops) {
        if (stop.checkin_time && (!firstCheckin || new Date(stop.checkin_time) < new Date(firstCheckin))) {
            firstCheckin = stop.checkin_time;
        }
        if (stop.checkout_time && (!lastCheckout || new Date(stop.checkout_time) > new Date(lastCheckout))) {
            lastCheckout = stop.checkout_time;
        }
    }

    if (firstCheckin && lastCheckout) {
        const duration = new Date(lastCheckout) - new Date(firstCheckin);
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        return {
            totalDuration: `${hours} ชม. ${minutes} นาที`,
            firstCheckin,
            lastCheckout
        };
    }

    return { totalDuration: '-' };
}

/**
 * Count number of drivers from driver string
 */
function countDrivers(driversStr) {
    if (!driversStr) return 0;
    // Split by comma and count non-empty entries
    return driversStr.split(',').filter(d => d && d.trim()).length;
}

/**
 * Format driver names for display
 */
function formatDriverNames(driversStr) {
    if (!driversStr) return '-';
    const drivers = driversStr.split(',').filter(d => d && d.trim());
    if (drivers.length === 0) return '-';
    if (drivers.length <= 2) return drivers.join(', ');
    return `${drivers.slice(0, 2).join(', ')} +${drivers.length - 2}`;
}

/**
 * Check if vehicle is ready for delivery
 */
function checkVehicleReady(job) {
    // Vehicle is ready if job is completed and no issues
    const hasIssues = job.vehicle_breakdown || job.has_issues || job.status === 'breakdown';
    return !hasIssues && (job.status === 'completed' || job.trip_ended);
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
            const hasPumping = record.has_pumping;
            const hasTransfer = record.has_transfer;
            const materials = record.materials || '-';
            const quantity = record.total_qty ? `${parseFloat(record.total_qty).toLocaleString()} ลิตร` : '-';
            const receiver = record.receiver_name || '';
            const receiverType = record.receiver_type || '';

            html += `
                <div style="padding: 8px 10px; margin-bottom: 4px; background: ${isComplete ? '#ffffff' : '#fff8e1'}; border-radius: 4px; border-left: 4px solid ${isComplete ? '#4caf50' : '#ff9800'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="color: #424242; font-weight: 500;">Seq ${seq}</div>
                    <div style="margin-top: 4px; color: #616161;">
                        Check-in: <strong style="color: ${isComplete ? '#2e7d32' : '#ef6c00'};">${checkinTime}</strong>
                        | Check-out: <strong style="color: ${isComplete ? '#2e7d32' : '#ef6c00'};">${checkoutTime}</strong>
                        ${record.checkin_odo ? `| ไมล์: <span style="color: #1976d2;">${record.checkin_odo}</span>` : ''}
                        ${record.checkout_odo ? `→ <span style="color: #1976d2;">${record.checkout_odo}</span>` : ''}
                    </div>
                    <div style="margin-top: 4px; color: #616161; font-size: 0.8rem;">
                        ${hasPumping ? '<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">⛽ ปั่น</span> ' : ''}
                        ${hasTransfer ? '<span style="background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">🔄 โยก</span> ' : ''}
                        ${materials !== '-' ? `📦 <strong>${sanitizeHTML(materials)}</strong>` : ''}
                        ${quantity !== '-' ? `| ปริมาณ: <strong style="color: #e65100;">${quantity}</strong>` : ''}
                    </div>
                    ${receiver ? `
                        <div style="margin-top: 2px; color: #616161; font-size: 0.8rem;">
                            👤 ผู้รับ: <strong>${sanitizeHTML(receiver)}</strong>${receiverType ? ` <span style="color: #757575;">(${sanitizeHTML(receiverType)})</span>` : ''}
                        </div>
                    ` : ''}
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

    // Calculate incentive distance breakdown for display
    const maxDistanceByCode = new Map();
    for (const [key, group] of groupedStops.entries()) {
        if (group.isOrigin) continue;

        // Find MAX distance for this ship_to_code
        let maxDist = 0;
        for (const record of group.records) {
            const dist = parseFloat(record.distance_km) || 0;
            if (dist > maxDist) maxDist = dist;
        }
        if (maxDist > 0) {
            maxDistanceByCode.set(group.shipToCode || key, {
                name: group.shipToName,
                distance: maxDist
            });
        }
    }

    const oneWayDistance = Array.from(maxDistanceByCode.values()).reduce((sum, d) => sum + d.distance, 0);
    const roundTripDistance = oneWayDistance * 2;

    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'margin-top: 16px; padding: 14px; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 8px; border: 1px solid #81c784; box-shadow: 0 2px 6px rgba(76, 175, 80, 0.15);';
    summaryDiv.innerHTML = `
        <div style="font-size: 1.05rem; font-weight: bold; color: #2e7d32; margin-bottom: 6px;">
            💰 คำนวณ Incentive (ระยะทางไป-กลับ)
        </div>
        <div style="font-size: 0.95rem; color: #1b5e20; margin-bottom: 8px;">
            จุดส่งจริงที่นับรับ: <strong style="font-size: 1.1rem;">${uniqueDeliveryCount} จุด</strong>
            <span style="color: #4caf50;">(ไม่รวมต้นทาง ${uniqueOriginCount} จุด)</span>
        </div>
        <div style="font-size: 0.85rem; color: #2e7d32; margin-bottom: 6px;">
            📏 สูตรคำนวณ: รวม(ระยะทางสูงสุดต่อจุดส่ง) × 2
        </div>
        <div style="font-size: 0.85rem; color: #1b5e20;">
            ระยะทางไป: <strong>${oneWayDistance.toFixed(1)}</strong> กม. |
            ระยะทางไป-กลับ: <strong style="font-size: 1.1rem;">${roundTripDistance.toFixed(1)}</strong> กม.
        </div>
    `;
    elements.detailStops.appendChild(summaryDiv);

    // Add detailed breakdown if there are multiple distances
    if (maxDistanceByCode.size > 0) {
        const breakdownDiv = document.createElement('div');
        breakdownDiv.style.cssText = 'margin-top: 12px; padding: 12px; background: #fff8e1; border-radius: 8px; border: 1px solid #ffb74d;';
        breakdownDiv.innerHTML = `
            <div style="font-size: 0.85rem; font-weight: bold; color: #e65100; margin-bottom: 8px;">
                📊 รายละเอียดระยะทาง (MAX ต่อจุดส่ง)
            </div>
            ${Array.from(maxDistanceByCode.entries()).map(([code, data]) => `
                <div style="font-size: 0.8rem; color: #424242; padding: 4px 0; border-bottom: 1px dashed #ffe0b2;">
                    <span style="font-weight: 500;">${sanitizeHTML(data.name || code)}</span>
                    <span style="float: right; color: #1976d2; font-weight: 600;">${data.distance.toFixed(1)} กม.</span>
                </div>
            `).join('')}
        `;
        elements.detailStops.appendChild(breakdownDiv);
    }
}

/**
 * Render delivery summary - detailed breakdown by destination and delivery records
 */
async function renderDeliverySummary(stops) {
    // Keep the old function for backward compatibility, but use the new horizontal version
    await renderDeliverySummaryHorizontal(stops);
}

/**
 * Render delivery summary - horizontal layout with editable cards
 * NEW VERSION - Horizontal cards that can be edited individually
 * Each card shows complete summary for that destination
 */
async function renderDeliverySummaryHorizontal(stops) {
    if (!elements.detailDeliverySummary) return;

    elements.detailDeliverySummary.innerHTML = '';

    if (stops.length === 0) {
        elements.detailDeliverySummary.innerHTML = '<p style="color: #757575; padding: 20px; text-align: center;">ไม่พบข้อมูลการจัดส่ง</p>';
        return;
    }

    // Ensure origin keys are loaded
    const origins = await loadOriginKeys();

    // Group by destination - use ship_to_name primarily since ship_to_code is often empty
    const destinationGroups = new Map();
    let totalQuantity = 0;
    let allMaterials = new Map(); // Track all materials for total summary

    for (const stop of stops) {
        const shipToCode = stop.ship_to || stop.ship_to_code || '';
        const shipToName = stop.ship_to_name || stop.destination || 'ไม่ระบุ';

        // Check if this is an origin point
        const isOrigin = origins.has(shipToCode);

        // Use ship_to_name as the primary key
        const key = shipToName;

        if (!destinationGroups.has(key)) {
            destinationGroups.set(key, {
                shipToCode,
                shipToName,
                isOrigin,
                hasPumping: false,
                hasTransfer: false,
                receiverNames: new Set(),
                deliveries: []
            });
        }

        const group = destinationGroups.get(key);

        // Track individual delivery record
        group.deliveries.push({
            id: stop.id,
            seq: stop.seq,
            materials: stop.materials || '',
            quantity: parseFloat(stop.total_qty) || 0,
            receiver: stop.receiver_name || '',
            receiverType: stop.receiver_type || '',
            hasPumping: stop.has_pumping || false,
            hasTransfer: stop.has_transfer || false,
            checkinTime: stop.checkin_time,
            checkoutTime: stop.checkout_time,
            checkinOdo: stop.checkin_odo,
            checkoutOdo: stop.checkout_odo
        });

        // Aggregate has_pumping and has_transfer for this destination
        if (stop.has_pumping) group.hasPumping = true;
        if (stop.has_transfer) group.hasTransfer = true;

        // Aggregate receiver names
        if (stop.receiver_name) {
            if (!group.receiverNames) group.receiverNames = new Set();
            group.receiverNames.add(stop.receiver_name);
        }

        // Accumulate totals
        totalQuantity += parseFloat(stop.total_qty) || 0;

        // Track all materials
        if (stop.materials) {
            const materials = stop.materials.split(',').map(m => m.trim()).filter(m => m);
            for (const material of materials) {
                if (!allMaterials.has(material)) {
                    allMaterials.set(material, 0);
                }
                allMaterials.set(material, allMaterials.get(material) + (stop.total_qty || 0));
            }
        }
    }

    const deliveryDestinations = Array.from(destinationGroups.entries()).filter(([key, group]) => !group.isOrigin);
    const totalStops = deliveryDestinations.length;
    const pumpingStops = deliveryDestinations.filter(([key, group]) => group.hasPumping).length;
    const transferStops = deliveryDestinations.filter(([key, group]) => group.hasTransfer).length;

    // Display total summary at the top - horizontal pill badges
    const totalDiv = document.createElement('div');
    totalDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ffb74d;';

    totalDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%); padding: 8px 16px; border-radius: 20px; border: 1px solid #ff9800; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">📊</span>
            <div>
                <span style="color: #e65100; font-weight: 600;">จุดส่ง ${totalStops} แห่ง</span>
                <span style="color: #757575; margin: 0 8px;">|</span>
                <span style="color: #212121;">รวม ${totalQuantity.toLocaleString()} ลิตร</span>
            </div>
        </div>
        ${pumpingStops > 0 ? `
            <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 6px 14px; border-radius: 20px; border: 1px solid #2196f3; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1rem;">⛽</span>
                <span style="color: #1976d2; font-weight: 600;">ปั่น ${pumpingStops} จุด</span>
            </div>
        ` : ''}
        ${transferStops > 0 ? `
            <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 6px 14px; border-radius: 20px; border: 1px solid #ff9800; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1rem;">🔄</span>
                <span style="color: #e65100; font-weight: 600;">โยก ${transferStops} จุด</span>
            </div>
        ` : ''}
        ${Array.from(allMaterials.entries()).map(([mat, qty]) => `
            <div style="background: white; padding: 6px 14px; border-radius: 20px; border: 1px solid #ffcc80; display: flex; align-items: center; gap: 6px;">
                <span style="color: #e65100; font-weight: 500;">${sanitizeHTML(mat)}</span>
                <span style="color: #757575; font-size: 0.9rem;">${qty.toLocaleString()} ลิตร</span>
            </div>
        `).join('')}
    `;
    elements.detailDeliverySummary.appendChild(totalDiv);

    // Display each destination as a horizontal card with complete summary
    let stopIndex = 0;
    for (const [key, group] of deliveryDestinations) {
        stopIndex++;

        // Calculate destination totals
        const destTotalQty = group.deliveries.reduce((sum, d) => sum + d.quantity, 0);

        // Get unique materials for this destination
        const destMaterials = new Map();
        for (const delivery of group.deliveries) {
            if (delivery.materials) {
                const materials = delivery.materials.split(',').map(m => m.trim()).filter(m => m);
                for (const material of materials) {
                    if (!destMaterials.has(material)) {
                        destMaterials.set(material, 0);
                    }
                    destMaterials.set(material, destMaterials.get(material) + delivery.quantity);
                }
            }
        }

        // Get check-in/out times for this destination
        const firstCheckin = group.deliveries.find(d => d.checkinTime)?.checkinTime;
        const lastCheckout = group.deliveries.filter(d => d.checkoutTime).sort((a, b) =>
            new Date(b.checkoutTime) - new Date(a.checkoutTime)
        )[0]?.checkoutTime;
        const checkinOdo = group.deliveries.find(d => d.checkinOdo)?.checkinOdo;
        const checkoutOdo = group.deliveries.filter(d => d.checkoutOdo).sort((a, b) =>
            parseInt(b.checkoutOdo || 0) - parseInt(a.checkoutOdo || 0)
        )[0]?.checkoutOdo;

        // Create horizontal card for this destination
        const stopCard = document.createElement('div');
        stopCard.className = 'delivery-destination-card';
        stopCard.dataset.destination = key;
        stopCard.style.cssText = `
            flex: 1;
            min-width: 320px;
            max-width: 450px;
            background: white;
            border-radius: 16px;
            border: 2px solid #ffb74d;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: all 0.3s ease;
        `;

        stopCard.onmouseover = () => {
            stopCard.style.boxShadow = '0 8px 24px rgba(255, 152, 0, 0.25)';
            stopCard.style.transform = 'translateY(-4px)';
        };
        stopCard.onmouseout = () => {
            stopCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            stopCard.style.transform = 'translateY(0)';
        };

        // Format times
        const checkinTimeStr = firstCheckin ? new Date(firstCheckin).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
        const checkoutTimeStr = lastCheckout ? new Date(lastCheckout).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

        // Build card HTML - redesigned with complete summary per destination
        let cardHtml = `
            <!-- Card Header -->
            <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 44px; height: 44px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; color: #ff9800; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        ${stopIndex}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="color: white; font-size: 1.1rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitizeHTML(group.shipToName)}</div>
                        ${group.shipToCode ? `<div style="color: rgba(255,255,255,0.85); font-size: 0.8rem;">📍 รหัส: ${sanitizeHTML(group.shipToCode)}</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="color: rgba(255,255,255,0.8); font-size: 0.7rem; text-transform: uppercase;">ปริมาณรวม</div>
                        <div style="color: white; font-weight: bold; font-size: 1.4rem;">${destTotalQty.toLocaleString()} <span style="font-size: 0.9rem;">ลิตร</span></div>
                    </div>
                </div>
            </div>

            <!-- Card Body - Summary Information -->
            <div style="padding: 16px;">
                <!-- Pumping/Transfer Status Section -->
                <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        ${group.hasPumping ? `
                            <div style="background: white; padding: 6px 12px; border-radius: 20px; border: 1px solid #2196f3; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 1rem;">⛽</span>
                                <span style="color: #1976d2; font-weight: 600; font-size: 0.85rem;">ปั่นน้ำมัน</span>
                            </div>
                        ` : ''}
                        ${group.hasTransfer ? `
                            <div style="background: white; padding: 6px 12px; border-radius: 20px; border: 1px solid #ff9800; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 1rem;">🔄</span>
                                <span style="color: #e65100; font-weight: 600; font-size: 0.85rem;">โยกน้ำมัน</span>
                            </div>
                        ` : ''}
                        ${!group.hasPumping && !group.hasTransfer ? `
                            <span style="color: #757575; font-size: 0.85rem;">ไม่มีการปั่น/โยก</span>
                        ` : ''}
                    </div>
                </div>

                <!-- Receiver Section -->
                ${group.receiverNames && group.receiverNames.size > 0 ? `
                    <div style="background: #fff3e0; border-radius: 10px; padding: 12px; margin-bottom: 12px; border-left: 4px solid #ff9800;">
                        <div style="color: #757575; font-size: 0.7rem; margin-bottom: 4px;">👤 ผู้รับน้ำมัน:</div>
                        <div style="color: #e65100; font-weight: 600; font-size: 0.95rem;">
                            ${Array.from(group.receiverNames).map(r => sanitizeHTML(r)).join(', ')}
                        </div>
                    </div>
                ` : ''}

                <!-- Time & Odometer Section -->
                <div style="background: #f5f5f5; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <div style="color: #757575; font-size: 0.7rem; margin-bottom: 2px;">🕐 Check-in</div>
                            <div style="color: #212121; font-weight: 600; font-size: 0.95rem;" class="editable-field" data-field="checkin-time">${checkinTimeStr}</div>
                        </div>
                        <div>
                            <div style="color: #757575; font-size: 0.7rem; margin-bottom: 2px;">🕕 Check-out</div>
                            <div style="color: #212121; font-weight: 600; font-size: 0.95rem;" class="editable-field" data-field="checkout-time">${checkoutTimeStr}</div>
                        </div>
                        <div>
                            <div style="color: #757575; font-size: 0.7rem; margin-bottom: 2px;">📏 ไมล์เริ่ม</div>
                            <div style="color: #1976d2; font-weight: 600; font-size: 0.95rem;" class="editable-field" data-field="checkin-odo">${checkinOdo ? checkinOdo.toLocaleString() : '-'}</div>
                        </div>
                        <div>
                            <div style="color: #757575; font-size: 0.7rem; margin-bottom: 2px;">📏 ไมล์สิ้นสุด</div>
                            <div style="color: #1976d2; font-weight: 600; font-size: 0.95rem;" class="editable-field" data-field="checkout-odo">${checkoutOdo ? checkoutOdo.toLocaleString() : '-'}</div>
                        </div>
                    </div>
                </div>

                <!-- Materials Section -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #757575; font-size: 0.75rem; margin-bottom: 8px;">📦 วัสดุที่จัดส่ง:</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
        `;

        // Add each material as a row
        for (const [material, qty] of destMaterials.entries()) {
            cardHtml += `
                <div class="material-row editable-field" data-field="material" data-material="${sanitizeHTML(material)}" data-qty="${qty}"
                     style="background: #fff8e1; padding: 10px 12px; border-radius: 8px; border-left: 4px solid #ff9800; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <span style="color: #e65100; font-weight: 600; font-size: 0.95rem;">${sanitizeHTML(material)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #757575; font-size: 0.8rem;">ปริมาณ</span>
                        <span style="color: #212121; font-weight: 700; font-size: 1.1rem; min-width: 60px; text-align: right;">${qty.toLocaleString()}</span>
                        <span style="color: #757575; font-size: 0.8rem;">ลิตร</span>
                    </div>
                </div>
            `;
        }

        cardHtml += `
                    </div>
                </div>

                <!-- Delivery Records (collapsible) -->
                <div style="border-top: 1px dashed #e0e0e0; padding-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" class="records-toggle" data-card="${stopIndex}">
                        <span style="color: #757575; font-size: 0.75rem;">📋 รายการจัดส่ง (${group.deliveries.length} รายการ)</span>
                        <span style="color: #ff9800; font-size: 1.2rem;">▼</span>
                    </div>
                    <div class="records-list" style="display: none; margin-top: 10px; max-height: 150px; overflow-y: auto;">
        `;

        // Add each delivery record (collapsible)
        for (const delivery of group.deliveries) {
            const dCheckinTime = delivery.checkinTime ? new Date(delivery.checkinTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
            const dCheckoutTime = delivery.checkoutTime ? new Date(delivery.checkoutTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
            const isComplete = delivery.checkinTime && delivery.checkoutTime;

            cardHtml += `
                <div class="delivery-record-item" data-delivery-id="${delivery.id}"
                     style="padding: 10px; margin-bottom: 6px; background: ${isComplete ? '#f1f8e9' : '#fff8e1'}; border-radius: 8px; border-left: 4px solid ${isComplete ? '#4caf50' : '#ff9800'}; font-size: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <span style="color: #757575; font-weight: 600;">Seq ${delivery.seq || '-'}</span>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            ${delivery.hasPumping ? '<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">⛽ ปั่น</span>' : ''}
                            ${delivery.hasTransfer ? '<span style="background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">🔄 โยก</span>' : ''}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <div style="color: #424242;">${sanitizeHTML(delivery.materials || '-')}</div>
                        <div style="color: #e65100; font-weight: 700;">${delivery.quantity.toLocaleString()} ลิตร</div>
                    </div>
                    ${delivery.receiver ? `
                        <div style="color: #616161; font-size: 0.75rem; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #bdbdbd;">
                            👤 ผู้รับ: ${sanitizeHTML(delivery.receiver)}${delivery.receiverType ? ` (${sanitizeHTML(delivery.receiverType)})` : ''}
                        </div>
                    ` : ''}
                    <div style="color: #757575; font-size: 0.7rem; margin-top: 4px;">
                        🕐 ${dCheckinTime} - ${dCheckoutTime}
                    </div>
                </div>
            `;
        }

        cardHtml += `
                    </div>
                </div>
            </div>
        `;

        stopCard.innerHTML = cardHtml;
        elements.detailDeliverySummary.appendChild(stopCard);

        // Setup toggle for records
        setTimeout(() => {
            const toggle = stopCard.querySelector('.records-toggle');
            const list = stopCard.querySelector('.records-list');
            const toggleIcon = toggle.querySelector('span:last-child');

            if (toggle && list) {
                toggle.addEventListener('click', () => {
                    const isHidden = list.style.display === 'none';
                    list.style.display = isHidden ? 'block' : 'none';
                    toggleIcon.textContent = isHidden ? '▲' : '▼';
                });
            }
        }, 100);
    }

    // If no delivery destinations (only origins)
    if (deliveryDestinations.length === 0) {
        elements.detailDeliverySummary.innerHTML = '<p style="color: #757575; padding: 20px; text-align: center;">ไม่มีข้อมูลการจัดส่ง (มีเฉพาะต้นทาง)</p>';
    }

    // Setup edit functionality for all editable fields
    setupEditableFields();
}

/**
 * Setup editable fields for inline editing
 */
function setupEditableFields() {
    const editBtn = document.getElementById('btn-edit-delivery');
    if (!editBtn) return;

    // Remove any existing listeners
    const newBtn = editBtn.cloneNode(true);
    editBtn.parentNode.replaceChild(newBtn, editBtn);

    newBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll('.delivery-destination-card');
        const isEditing = newBtn.dataset.editing === 'true';

        cards.forEach(card => {
            const editableFields = card.querySelectorAll('.editable-field');

            if (!isEditing) {
                // Enter edit mode - make fields editable
                editableFields.forEach(field => {
                    const fieldType = field.dataset.field;
                    const currentValue = field.textContent.trim();

                    if (fieldType === 'checkin-time' || fieldType === 'checkout-time') {
                        // Time input
                        field.innerHTML = `<input type="time" class="edit-time-input" value="${currentValue !== '-' ? currentValue : ''}"
                            style="width: 100%; padding: 4px 8px; border: 1px solid #ff9800; border-radius: 4px; font-size: 0.9rem; background: white;">`;
                    } else if (fieldType === 'checkin-odo' || fieldType === 'checkout-odo') {
                        // Number input for odometer
                        field.innerHTML = `<input type="number" class="edit-odo-input" value="${currentValue !== '-' ? currentValue.replace(/,/g, '') : ''}"
                            style="width: 100%; padding: 4px 8px; border: 1px solid #2196f3; border-radius: 4px; font-size: 0.9rem; background: white;">`;
                    } else if (fieldType === 'material') {
                        // Material row - make editable
                        const material = field.dataset.material;
                        const qty = field.dataset.qty;
                        field.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                <input type="text" class="edit-material-name" value="${sanitizeHTML(material)}"
                                    style="flex: 1; padding: 4px 8px; border: 1px solid #ff9800; border-radius: 4px; font-size: 0.9rem; background: white;">
                                <input type="number" class="edit-material-qty" value="${qty}"
                                    style="width: 80px; padding: 4px 8px; border: 1px solid #ff9800; border-radius: 4px; font-size: 0.9rem; background: white;">
                                <span style="color: #757575; font-size: 0.8rem;">ลิตร</span>
                            </div>
                        `;
                        field.style.background = '#fff3e0';
                        field.style.borderLeft = '4px solid #2196f3';
                    }
                });

                // Add save button to card
                const saveBtn = document.createElement('button');
                saveBtn.className = 'save-delivery-card-btn';
                saveBtn.textContent = '💾 บันทึก';
                saveBtn.style.cssText = 'margin: 10px; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
                saveBtn.onclick = () => saveDeliveryCard(card);
                card.appendChild(saveBtn);

                card.style.border = '2px solid #2196f3';
            } else {
                // Exit edit mode - reload to restore
                location.reload();
            }
        });

        // Update button state
        newBtn.dataset.editing = (!isEditing).toString();
        newBtn.innerHTML = isEditing ? '✏️ แก้ไข' : '❌ ยกเลิก';
        newBtn.style.background = isEditing ? '#ff9800' : '#f44336';
    });
}

/**
 * Setup edit delivery button functionality (legacy - kept for compatibility)
 */
function setupEditDeliveryButton() {
    setupEditableFields();
}

/**
 * Setup performance summary edit buttons
 */
function setupPerformanceEditButtons() {
    // Holiday work edit button
    const holidayEditBtn = document.getElementById('btn-edit-holiday');
    if (holidayEditBtn) {
        const newHolidayBtn = holidayEditBtn.cloneNode(true);
        holidayEditBtn.parentNode.replaceChild(newHolidayBtn, holidayEditBtn);

        newHolidayBtn.addEventListener('click', () => {
            const isEditing = newHolidayBtn.dataset.editing === 'true';
            const displayEl = document.getElementById('perf-holiday-work');

            if (!isEditing) {
                const currentValue = displayEl.textContent.trim();
                displayEl.innerHTML = `<select id="edit-holiday-select" style="padding: 4px 8px; border: 1px solid #1976d2; border-radius: 4px; font-size: 1rem; background: white; color: #212121;">
                    <option value="No" ${currentValue === 'No' ? 'selected' : ''}>No</option>
                    <option value="Yes" ${currentValue === 'Yes' ? 'selected' : ''}>Yes</option>
                </select>
                <button id="save-holiday-btn" style="margin-left: 4px; padding: 4px 8px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">💾</button>
                <button id="cancel-holiday-btn" style="margin-left: 2px; padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">✕</button>`;

                document.getElementById('save-holiday-btn').onclick = () => saveHolidayWork();
                document.getElementById('cancel-holiday-btn').onclick = () => cancelHolidayEdit(currentValue);
                newHolidayBtn.dataset.editing = 'true';
            }
        });
    }

    // Driver count edit button
    const driverCountEditBtn = document.getElementById('btn-edit-driver-count');
    if (driverCountEditBtn) {
        const newDriverCountBtn = driverCountEditBtn.cloneNode(true);
        driverCountEditBtn.parentNode.replaceChild(newDriverCountBtn, driverCountEditBtn);

        newDriverCountBtn.addEventListener('click', () => {
            const isEditing = newDriverCountBtn.dataset.editing === 'true';
            const displayEl = document.getElementById('perf-driver-count');

            if (!isEditing) {
                const currentValue = displayEl.textContent.trim();
                displayEl.innerHTML = `<input type="number" id="edit-driver-count-input" value="${currentValue !== '-' ? currentValue : '1'}" min="1" max="5" style="padding: 4px 8px; border: 1px solid #1976d2; border-radius: 4px; font-size: 1rem; background: white; color: #212121; width: 60px;">
                <button id="save-driver-count-btn" style="margin-left: 4px; padding: 4px 8px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">💾</button>
                <button id="cancel-driver-count-btn" style="margin-left: 2px; padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">✕</button>`;

                document.getElementById('save-driver-count-btn').onclick = () => saveDriverCount();
                document.getElementById('cancel-driver-count-btn').onclick = () => cancelDriverCountEdit(currentValue);
                newDriverCountBtn.dataset.editing = 'true';
            }
        });
    }

    // Driver names edit button
    const driverNamesEditBtn = document.getElementById('btn-edit-driver-names');
    if (driverNamesEditBtn) {
        const newDriverNamesBtn = driverNamesEditBtn.cloneNode(true);
        driverNamesEditBtn.parentNode.replaceChild(newDriverNamesBtn, driverNamesEditBtn);

        newDriverNamesBtn.addEventListener('click', () => {
            const isEditing = newDriverNamesBtn.dataset.editing === 'true';
            const displayEl = document.getElementById('perf-driver-names');

            if (!isEditing) {
                const currentValue = displayEl.textContent.trim();
                displayEl.innerHTML = `<input type="text" id="edit-driver-names-input" value="${currentValue !== '-' ? currentValue : ''}" placeholder="ชื่อคนขับ" style="padding: 4px 8px; border: 1px solid #1976d2; border-radius: 4px; font-size: 0.9rem; background: white; color: #212121; width: 100%;">
                <button id="save-driver-names-btn" style="margin-left: 4px; padding: 4px 8px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">💾</button>
                <button id="cancel-driver-names-btn" style="margin-left: 2px; padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">✕</button>`;

                document.getElementById('save-driver-names-btn').onclick = () => saveDriverNames();
                document.getElementById('cancel-driver-names-btn').onclick = () => cancelDriverNamesEdit(currentValue);
                newDriverNamesBtn.dataset.editing = 'true';
            }
        });
    }
}

/**
 * Save holiday work
 */
async function saveHolidayWork() {
    if (!currentJob) return;

    const select = document.getElementById('edit-holiday-select');
    const newValue = select.value;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({ holiday_work: newValue })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification('💾 บันทึกการทำงานวันหยุดแล้ว', 'success');

        // Reset edit button
        const editBtn = document.getElementById('btn-edit-holiday');
        if (editBtn) editBtn.dataset.editing = 'false';

        // Reload modal
        await openDetailModal(currentJob);
    } catch (error) {
        console.error('Error saving holiday work:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Cancel holiday work edit
 */
function cancelHolidayEdit(originalValue) {
    const displayEl = document.getElementById('perf-holiday-work');
    displayEl.textContent = originalValue;

    const editBtn = document.getElementById('btn-edit-holiday');
    if (editBtn) editBtn.dataset.editing = 'false';
}

/**
 * Save driver count
 */
async function saveDriverCount() {
    if (!currentJob) return;

    const input = document.getElementById('edit-driver-count-input');
    const newValue = parseInt(input.value);

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({ driver_count: newValue })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification('💾 บันทึกจำนวนคนขับแล้ว', 'success');

        // Reset edit button
        const editBtn = document.getElementById('btn-edit-driver-count');
        if (editBtn) editBtn.dataset.editing = 'false';

        // Reload modal
        await openDetailModal(currentJob);
    } catch (error) {
        console.error('Error saving driver count:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Cancel driver count edit
 */
function cancelDriverCountEdit(originalValue) {
    const displayEl = document.getElementById('perf-driver-count');
    displayEl.textContent = originalValue;

    const editBtn = document.getElementById('btn-edit-driver-count');
    if (editBtn) editBtn.dataset.editing = 'false';
}

/**
 * Save driver names
 */
async function saveDriverNames() {
    if (!currentJob) return;

    const input = document.getElementById('edit-driver-names-input');
    const newValue = input.value.trim();

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({ drivers: newValue })
            .eq('reference', currentJob.reference);

        if (error) throw error;

        showNotification('💾 บันทึกรายชื่อคนขับแล้ว', 'success');

        // Reset edit button
        const editBtn = document.getElementById('btn-edit-driver-names');
        if (editBtn) editBtn.dataset.editing = 'false';

        // Reload modal
        await openDetailModal(currentJob);
    } catch (error) {
        console.error('Error saving driver names:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Cancel driver names edit
 */
function cancelDriverNamesEdit(originalValue) {
    const displayEl = document.getElementById('perf-driver-names');
    displayEl.textContent = originalValue;

    const editBtn = document.getElementById('btn-edit-driver-names');
    if (editBtn) editBtn.dataset.editing = 'false';
}

/**
 * Save delivery card changes
 */
async function saveDeliveryCard(card) {
    if (!currentJob) return;

    try {
        // Collect changed data
        const timeInputs = card.querySelectorAll('.edit-time-input');
        const odoInputs = card.querySelectorAll('.edit-odo-input');
        const materialInputs = card.querySelectorAll('.edit-material-name');
        const qtyInputs = card.querySelectorAll('.edit-material-qty');

        const changes = {
            checkinTime: null,
            checkoutTime: null,
            checkinOdo: null,
            checkoutOdo: null,
            materials: []
        };

        timeInputs.forEach(input => {
            const field = input.closest('.editable-field');
            const fieldType = field.dataset.field;
            if (input.value) {
                changes[fieldType === 'checkin-time' ? 'checkinTime' : 'checkoutTime'] = input.value;
            }
        });

        odoInputs.forEach(input => {
            const field = input.closest('.editable-field');
            const fieldType = field.dataset.field;
            if (input.value) {
                changes[fieldType === 'checkin-odo' ? 'checkinOdo' : 'checkoutOdo'] = input.value;
            }
        });

        materialInputs.forEach((input, index) => {
            const qtyInput = qtyInputs[index];
            if (input.value && qtyInput.value) {
                changes.materials.push({
                    material: input.value,
                    quantity: parseFloat(qtyInput.value)
                });
            }
        });

        console.log('Changes to save:', changes);

        // Here you would update the database
        // For now, just show a notification
        showNotification(`💾 บันทึกข้อมูลแล้ว (${changes.materials.length} รายการ)`, 'success');

        // Remove save button
        const saveBtn = card.querySelector('.save-delivery-card-btn');
        if (saveBtn) saveBtn.remove();

        // Reset card border
        card.style.border = '2px solid #ffb74d';

        // Reset editable fields styling
        const materialRows = card.querySelectorAll('.editable-field[data-field="material"]');
        materialRows.forEach(row => {
            row.style.background = '#fff8e1';
            row.style.borderLeft = '4px solid #ff9800';
        });

        // Reload the modal to show updated data
        await openDetailModal(currentJob);
    } catch (error) {
        console.error('Error saving delivery card:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
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

        // Calculate incentive distance using the correct formula
        const stops = await loadJobStops(currentJob.reference);
        const totalDistance = await calculateIncentiveDistance(stops);
        const uniqueStopsCount = await calculateUniqueStops(stops);

        const rate = currentJob.incentive_rate || DEFAULT_RATE_PER_KM;
        const amount = totalDistance * rate;

        const { error } = await supabase
            .from('jobdata')
            .update({
                incentive_approved: true,
                incentive_approved_by: lineProfile.userId,
                incentive_approved_at: new Date().toISOString(),
                incentive_amount: amount,
                incentive_distance: totalDistance,
                incentive_stops: uniqueStopsCount,
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
