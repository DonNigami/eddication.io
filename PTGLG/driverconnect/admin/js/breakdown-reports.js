/**
 * Breakdown Reports Module (Driver-Submitted)
 * Handles viewing and managing breakdown/accident reports from drivers
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let reportsTableBody = null;
let searchInput = null;
let statusFilter = null;
let typeFilter = null;
let refreshBtn = null;
let modal = null;
let modalClose = null;
let modalCancel = null;
let actionForm = null;

// KPI elements
let pendingCountEl = null;
let inProgressCountEl = null;
let resolvedCountEl = null;
let totalCountEl = null;

// Modal elements
let modalTitle = null;
let detailType = null;
let detailStatus = null;
let detailTime = null;
let detailDriverName = null;
let detailDriverId = null;
let detailVehicle = null;
let detailReference = null;
let detailIncompleteStops = null;
let detailLocation = null;
let detailLatLng = null;
let detailMapLink = null;
let detailPhotoContainer = null;
let detailPhoto = null;
let detailDescription = null;
let detailRequestNewVehicle = null;
let detailRequestCloseTrip = null;
let actionReportId = null;
let actionStatus = null;
let actionVehicle = null;
let actionNotes = null;

// Current reports cache
let reportsCache = [];

// Vehicle cache for dropdown
let vehiclesCache = [];

// Status labels
const STATUS_LABELS = {
    'pending': '<span style="color: #ff9800;">⏳ รอดำเนินการ</span>',
    'acknowledged': '<span style="color: #2196f3;">👌 รับทราบแล้ว</span>',
    'in_progress': '<span style="color: #2196f3;">🔧 กำลังดำเนินการ</span>',
    'resolved': '<span style="color: #4caf50;">✅ เสร็จสิ้น</span>',
    'cancelled': '<span style="color: #f44336;">❌ ยกเลิก</span>'
};

// Type labels
const TYPE_LABELS = {
    'breakdown': '🔧 ขัดข้อง',
    'accident': '🚗 อุบัติเหตุ',
    'maintenance': '🔧 ซ่อมบำรุง',
    'emergency': '🚨 ฉุกเฉิน'
};

/**
 * Set breakdown reports DOM elements
 */
export function setBreakdownReportsElements(elements) {
    reportsTableBody = elements.tableBody;
    searchInput = elements.searchInput;
    statusFilter = elements.statusFilter;
    typeFilter = elements.typeFilter;
    refreshBtn = elements.refreshBtn;
    modal = elements.modal;
    modalClose = elements.modalClose;
    modalCancel = elements.modalCancel;
    actionForm = elements.actionForm;
    pendingCountEl = elements.pendingCount;
    inProgressCountEl = elements.inProgressCount;
    resolvedCountEl = elements.resolvedCount;
    totalCountEl = elements.totalCount;
    modalTitle = elements.modalTitle;
    detailType = elements.detailType;
    detailStatus = elements.detailStatus;
    detailTime = elements.detailTime;
    detailDriverName = elements.detailDriverName;
    detailDriverId = elements.detailDriverId;
    detailVehicle = elements.detailVehicle;
    detailReference = elements.detailReference;
    detailIncompleteStops = elements.detailIncompleteStops;
    detailLocation = elements.detailLocation;
    detailLatLng = elements.detailLatLng;
    detailMapLink = elements.detailMapLink;
    detailPhotoContainer = elements.detailPhotoContainer;
    detailPhoto = elements.detailPhoto;
    detailDescription = elements.detailDescription;
    detailRequestNewVehicle = elements.detailRequestNewVehicle;
    detailRequestCloseTrip = elements.detailRequestCloseTrip;
    actionReportId = elements.actionReportId;
    actionStatus = elements.actionStatus;
    actionVehicle = elements.actionVehicle;
    actionNotes = elements.actionNotes;
}

/**
 * Fetch vehicles from jobdata for dropdown
 */
export async function fetchVehiclesForDropdown() {
    const vehicleDatalist = document.getElementById('br-vehicle-list');
    if (!vehicleDatalist) return;

    try {
        const { data, error } = await supabase
            .from('jobdata')
            .select('vehicle_desc')
            .not('vehicle_desc', 'is', null)
            .not('vehicle_desc', 'eq', '')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        // Get unique vehicle descriptions
        const uniqueVehicles = [...new Set(data?.map(d => d.vehicle_desc).filter(v => v) || [])];
        vehiclesCache = uniqueVehicles.sort();

        // Populate datalist
        vehicleDatalist.innerHTML = '';
        if (vehiclesCache.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '-- ไม่พบข้อมูลรถ --';
            vehicleDatalist.appendChild(option);
        } else {
            vehiclesCache.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle;
                vehicleDatalist.appendChild(option);
            });
        }

        console.log(`✅ Loaded ${vehiclesCache.length} vehicles for dropdown`);
    } catch (error) {
        console.error('Error fetching vehicles:', error);
    }
}

/**
 * Load breakdown reports from database
 */
export async function loadBreakdownReports() {
    if (!reportsTableBody) {
        console.error('Breakdown reports table body not set');
        return;
    }

    // Fetch vehicles for dropdown on first load
    if (vehiclesCache.length === 0) {
        fetchVehiclesForDropdown();
    }

    reportsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">
        <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
        <p>กำลังโหลดข้อมูล...</p>
    </td></tr>`;

    try {
        const searchTerm = searchInput?.value || '';
        const statusFilterValue = statusFilter?.value || 'all';
        const typeFilterValue = typeFilter?.value || 'all';

        let query = supabase
            .from('breakdown_reports')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (statusFilterValue !== 'all') {
            query = query.eq('status', statusFilterValue);
        }
        if (typeFilterValue !== 'all') {
            query = query.eq('report_type', typeFilterValue);
        }
        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,driver_name.ilike.%${searchTerm}%,vehicle_desc.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }

        const { data: reports, error } = await query;

        if (error) throw error;

        reportsCache = reports || [];
        reportsTableBody.innerHTML = '';

        if (!reports || reports.length === 0) {
            reportsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-sub);">
                <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                <p>ไม่พบรายงาน</p>
            </td></tr>`;
            updateKPICounts([]);
            return;
        }

        reports.forEach(report => {
            const row = reportsTableBody.insertRow();
            row.style.cursor = 'pointer';
            row.dataset.reportId = report.id;

            // Time
            const timeCell = row.insertCell();
            const time = new Date(report.created_at);
            timeCell.textContent = time.toLocaleString('th-TH');
            timeCell.style.fontSize = '0.85em';
            timeCell.style.color = 'var(--text-sub)';

            // Type
            row.insertCell().innerHTML = TYPE_LABELS[report.report_type] || report.report_type;

            // Driver
            row.insertCell().textContent = report.driver_name || '-';

            // Vehicle
            row.insertCell().textContent = report.vehicle_desc || '-';

            // Reference
            const refCell = row.insertCell();
            refCell.textContent = report.reference || '-';
            if (report.incomplete_stops > 0) {
                refCell.innerHTML += ` <span style="color: #ff9800; font-size: 0.8em;">(${report.incomplete_stops} จุดค้าง)</span>`;
            }

            // Description (truncated)
            const descCell = row.insertCell();
            const desc = report.description || '';
            descCell.textContent = desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
            descCell.style.color = 'var(--text-sub)';
            descCell.style.fontSize = '0.9em';

            // Status
            row.insertCell().innerHTML = STATUS_LABELS[report.status] || report.status;

            // Actions
            const actionCell = row.insertCell();
            const viewBtn = document.createElement('button');
            viewBtn.textContent = '👁️ ดู';
            viewBtn.className = 'btn-small';
            viewBtn.style.padding = '4px 8px';
            viewBtn.style.borderRadius = '4px';
            viewBtn.style.border = '1px solid var(--border-color)';
            viewBtn.style.background = 'var(--card-bg)';
            viewBtn.style.color = 'var(--text-color)';
            viewBtn.style.cursor = 'pointer';
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                openReportModal(report);
            };
            actionCell.appendChild(viewBtn);

            // Row click
            row.onclick = () => openReportModal(report);
        });

        updateKPICounts(reports);

    } catch (error) {
        console.error('Error loading breakdown reports:', error);

        // Check if table doesn't exist
        if (error.code === 'PGRST204' || error.message?.includes('Could not find the table')) {
            reportsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 30px;">
                        <div style="color: #ff9800; font-size: 48px; margin-bottom: 15px;">⚠️</div>
                        <h4 style="margin-bottom: 10px;">Table Not Found</h4>
                        <p style="color: #888;">The <code>breakdown_reports</code> table doesn't exist.</p>
                        <p style="color: #666; font-size: 12px; margin-top: 15px;">
                            Please run the migration: <code>supabase/migrations/20260129000000_create_breakdown_reports_table.sql</code>
                        </p>
                    </td>
                </tr>
            `;
        } else {
            reportsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f44336;">
                Error: ${sanitizeHTML(error.message)}
            </td></tr>`;
        }
    }
}

/**
 * Update KPI counts
 */
function updateKPICounts(reports) {
    if (!reports) reports = reportsCache;

    const pending = reports.filter(r => r.status === 'pending').length;
    const inProgress = reports.filter(r => r.status === 'in_progress' || r.status === 'acknowledged').length;
    const resolved = reports.filter(r => r.status === 'resolved').length;
    const total = reports.length;

    if (pendingCountEl) pendingCountEl.textContent = pending;
    if (inProgressCountEl) inProgressCountEl.textContent = inProgress;
    if (resolvedCountEl) resolvedCountEl.textContent = resolved;
    if (totalCountEl) totalCountEl.textContent = total;
}

/**
 * Open report detail modal
 */
export function openReportModal(report) {
    if (!modal) return;

    // Set current report ID
    if (actionReportId) actionReportId.value = report.id;

    // Title
    if (modalTitle) modalTitle.textContent = `🚨 ${TYPE_LABELS[report.report_type]?.split(' ')[1] || report.report_type} - ${report.driver_name || '-'}`;

    // Basic info
    if (detailType) detailType.innerHTML = TYPE_LABELS[report.report_type] || report.report_type;
    if (detailStatus) detailStatus.innerHTML = STATUS_LABELS[report.status] || report.status;
    if (detailTime) detailTime.textContent = new Date(report.created_at).toLocaleString('th-TH');

    // Driver info
    if (detailDriverName) detailDriverName.textContent = report.driver_name || '-';
    if (detailDriverId) detailDriverId.textContent = report.driver_user_id || '-';

    // Vehicle
    if (detailVehicle) detailVehicle.textContent = report.vehicle_desc || '-';

    // Reference
    if (detailReference) {
        detailReference.textContent = report.reference || '-';
        if (detailIncompleteStops && report.incomplete_stops > 0) {
            detailIncompleteStops.textContent = `(ค้าง ${report.incomplete_stops} จุด)`;
            detailIncompleteStops.style.display = 'inline';
        } else if (detailIncompleteStops) {
            detailIncompleteStops.style.display = 'none';
        }
    }

    // Location
    if (detailLocation) detailLocation.textContent = report.location || '-';
    if (detailLatLng && report.lat && report.lng) {
        detailLatLng.textContent = `พิกัด: ${report.lat}, ${report.lng}`;
    } else if (detailLatLng) {
        detailLatLng.textContent = '';
    }

    // Map link
    if (detailMapLink && report.lat && report.lng) {
        detailMapLink.href = `https://www.google.com/maps?q=${report.lat},${report.lng}`;
        detailMapLink.style.display = 'inline';
    } else if (detailMapLink) {
        detailMapLink.style.display = 'none';
    }

    // Photo
    if (detailPhotoContainer && detailPhoto) {
        if (report.photo_url) {
            detailPhoto.src = report.photo_url;
            detailPhotoContainer.style.display = 'block';
        } else {
            detailPhotoContainer.style.display = 'none';
        }
    }

    // Description
    if (detailDescription) detailDescription.textContent = report.description || '-';

    // Driver requests
    if (detailRequestNewVehicle) {
        detailRequestNewVehicle.style.display = report.request_new_vehicle ? 'block' : 'none';
    }
    if (detailRequestCloseTrip) {
        detailRequestCloseTrip.style.display = report.request_close_trip ? 'block' : 'none';
    }

    // Set action form values
    if (actionStatus) actionStatus.value = report.status || 'pending';
    if (actionVehicle) actionVehicle.value = report.assigned_vehicle || '';
    if (actionNotes) actionNotes.value = report.admin_notes || '';

    // Show modal
    modal.classList.remove('hidden');
}

/**
 * Close report modal
 */
export function closeReportModal() {
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Handle action form submit
 */
export async function handleReportActionSubmit(event) {
    event.preventDefault();

    const reportId = actionReportId?.value;
    const status = actionStatus?.value;
    const assignedVehicle = actionVehicle?.value;
    const adminNotes = actionNotes?.value;

    if (!reportId) {
        showNotification('ไม่พบรายงาน', 'error');
        return;
    }

    try {
        const updateData = {
            status: status,
            assigned_vehicle: assignedVehicle || null,
            admin_notes: adminNotes || null
        };

        // Add resolved timestamp if status is resolved
        if (status === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
        } else {
            updateData.resolved_at = null;
        }

        const { error } = await supabase
            .from('breakdown_reports')
            .update(updateData)
            .eq('id', reportId);

        if (error) throw error;

        showNotification('บันทึกสำเร็จ', 'success');
        closeReportModal();
        await loadBreakdownReports();

    } catch (error) {
        console.error('Error updating report:', error);
        showNotification(`บันทึกไม่สำเร็จ: ${error.message}`, 'error');
    }
}
