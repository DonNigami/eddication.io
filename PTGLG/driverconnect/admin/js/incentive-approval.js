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
    detailVehicle: null,
    detailDate: null,
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

        renderTable(filteredJobs);

    } catch (error) {
        console.error('Error loading incentive jobs:', error);
        elements.tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: #f44336;">
            ❌ เกิดข้อผิดพลาด: ${sanitizeHTML(error.message)}
        </td></tr>`;
    }
}

/**
 * Render the incentive table
 */
function renderTable(jobs) {
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
                stop_count: 1,
                total_distance: parseFloat(job.distance_km) || 0,
                all_seqs: [job.seq]
            };
        } else {
            groupedJobs[job.reference].stop_count++;
            groupedJobs[job.reference].all_seqs.push(job.seq);
            groupedJobs[job.reference].total_distance += parseFloat(job.distance_km) || 0;
        }
    });

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
    if (elements.detailVehicle) elements.detailVehicle.textContent = job.vehicle_desc || '-';
    if (elements.detailDate) {
        elements.detailDate.textContent = job.job_closed_at
            ? new Date(job.job_closed_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
            : '-';
    }

    // Calculate totals
    const rate = job.incentive_rate || DEFAULT_RATE_PER_KM;
    const totalDistance = job.total_distance || 0;
    const amount = totalDistance * rate;

    if (elements.detailDistance) elements.detailDistance.textContent = totalDistance.toFixed(1) + ' km';
    if (elements.detailStopsCount) elements.detailStopsCount.textContent = job.stop_count + ' จุด';
    if (elements.detailRate) elements.detailRate.textContent = '฿' + rate.toFixed(2);
    if (elements.detailAmount) elements.detailAmount.textContent = '฿' + amount.toFixed(2);

    // Load stops detail
    if (elements.detailStops) {
        const stops = await loadJobStops(job.reference);
        renderStopsDetail(stops);
    }

    // Notes
    if (elements.detailNotes) {
        elements.detailNotes.textContent = job.incentive_notes || job.holiday_work_notes || 'ไม่มีหมายเหตุ';
    }

    // Populate edit form
    if (elements.editReference) elements.editReference.value = job.reference;
    if (elements.editDistance) elements.editDistance.value = totalDistance;
    if (elements.editStopsCount) elements.editStopsCount.value = job.stop_count;
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
 * Render stops detail
 */
function renderStopsDetail(stops) {
    if (!elements.detailStops) return;

    elements.detailStops.innerHTML = '';

    if (stops.length === 0) {
        elements.detailStops.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูลจุดส่ง</p>';
        return;
    }

    stops.forEach((stop, index) => {
        const stopDiv = document.createElement('div');
        stopDiv.style.cssText = 'display: flex; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);';

        stopDiv.innerHTML = `
            <div style="width: 30px; height: 30px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 10px;">
                ${index + 1}
            </div>
            <div style="flex: 1;">
                <strong>${sanitizeHTML(stop.destination || '-')}</strong>
                <div style="font-size: 0.85rem; color: var(--text-sub);">
                    Check-in: ${stop.checkin_time ? new Date(stop.checkin_time).toLocaleTimeString('th-TH') : '-'}
                    | Check-out: ${stop.checkout_time ? new Date(stop.checkout_time).toLocaleTimeString('th-TH') : '-'}
                </div>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 0.85rem; padding: 2px 8px; background: ${stop.checkin_time && stop.checkout_time ? '#4caf50' : '#ff9800'}; color: white; border-radius: 4px;">
                    ${stop.checkin_time && stop.checkout_time ? '✅ เสร็จสิ้น' : '⏳ ไม่สมบูรณ์'}
                </span>
            </div>
        `;

        elements.detailStops.appendChild(stopDiv);
    });
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
