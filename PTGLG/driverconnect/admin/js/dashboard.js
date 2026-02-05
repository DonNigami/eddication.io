/**
 * Dashboard Module
 * Handles dashboard analytics and KPI displays
 */

import { supabase } from '../../shared/config.js';
import { formatNumber } from './utils.js';

// DOM elements
let kpiTotalUsers = null;
let kpiActiveJobs = null;
let kpiActiveJobs48h = null;
let kpiPendingApprovals = null;

/**
 * Set dashboard DOM elements
 * @param {Object} elements - DOM elements for dashboard
 */
export function setDashboardElements(elements) {
    kpiTotalUsers = elements.totalUsers;
    kpiActiveJobs = elements.activeJobs;
    kpiActiveJobs48h = elements.activeJobs48h;
    kpiPendingApprovals = elements.pendingApprovals;
}

/**
 * Load dashboard analytics from database
 */
export async function loadDashboardAnalytics() {
    try {
        // Total Users
        const { count: totalUsers, error: usersError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' });

        if (usersError) throw usersError;
        if (kpiTotalUsers) kpiTotalUsers.textContent = formatNumber(totalUsers);

        // Active Jobs - split into two categories:
        // 1. Active jobs within 48 hours (created_at >= NOW() - INTERVAL '48 hours')
        // 2. Active jobs over 48 hours (created_at < NOW() - INTERVAL '48 hours')

        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        // Active jobs within 48 hours (not closed jobs)
        const { count: activeJobs48h, error: jobsError48h } = await supabase
            .from('jobdata')
            .select('*', { count: 'exact' })
            .in('status', ['pending', 'active', 'assigned', 'in_progress'])
            .gte('created_at', fortyEightHoursAgo);

        if (jobsError48h) throw jobsError48h;
        if (kpiActiveJobs) kpiActiveJobs.textContent = formatNumber(activeJobs48h);

        // Active jobs over 48 hours (unclosed/unfinished trips - needs attention)
        const { count: activeJobsOlder, error: jobsErrorOlder } = await supabase
            .from('jobdata')
            .select('*', { count: 'exact' })
            .in('status', ['pending', 'active', 'assigned', 'in_progress'])
            .lt('created_at', fortyEightHoursAgo);

        if (jobsErrorOlder) throw jobsErrorOlder;
        if (kpiActiveJobs48h) kpiActiveJobs48h.textContent = formatNumber(activeJobsOlder);

        // Pending Approvals
        const { count: pendingApprovals, error: pendingError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' })
            .eq('status', 'PENDING');

        if (pendingError) throw pendingError;
        if (kpiPendingApprovals) kpiPendingApprovals.textContent = formatNumber(pendingApprovals);

    } catch (error) {
        console.error('Error loading dashboard analytics:', error);
        if (kpiTotalUsers) kpiTotalUsers.textContent = 'Error';
        if (kpiActiveJobs) kpiActiveJobs.textContent = 'Error';
        if (kpiActiveJobs48h) kpiActiveJobs48h.textContent = 'Error';
        if (kpiPendingApprovals) kpiPendingApprovals.textContent = 'Error';
    }
}

/**
 * Refresh dashboard analytics
 */
export async function refreshDashboard() {
    await loadDashboardAnalytics();
}

/**
 * Setup KPI card click handlers
 */
export function setupKpiCardHandlers() {
    const kpiCards = document.querySelectorAll('.kpi-clickable');
    const detailPanel = document.getElementById('kpi-detail-panel');
    const detailTitle = document.getElementById('kpi-detail-title');
    const detailContent = document.getElementById('kpi-detail-content');
    const detailClose = document.getElementById('kpi-detail-close');

    // Close button handler
    if (detailClose) {
        detailClose.addEventListener('click', () => {
            if (detailPanel) detailPanel.style.display = 'none';
        });
    }

    // KPI card click handlers
    kpiCards.forEach(card => {
        card.addEventListener('click', async () => {
            const kpiType = card.dataset.kpiType;
            if (!kpiType) return;

            // Highlight selected card
            kpiCards.forEach(c => c.style.transform = 'scale(1)');
            card.style.transform = 'scale(1.05)';

            // Show detail panel
            if (detailPanel) detailPanel.style.display = 'block';

            // Load details based on type
            await loadKpiDetails(kpiType, detailTitle, detailContent);
        });

        // Hover effect
        card.addEventListener('mouseenter', () => {
            if (!card.classList.contains('active')) {
                card.style.transform = 'scale(1.03)';
                card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }
        });

        card.addEventListener('mouseleave', () => {
            if (!card.classList.contains('active')) {
                card.style.transform = 'scale(1)';
                card.style.boxShadow = '';
            }
        });
    });
}

/**
 * Load KPI details based on type
 */
async function loadKpiDetails(kpiType, titleElement, contentElement) {
    if (!titleElement || !contentElement) return;

    const titles = {
        'total-users': '👥 Total Users - รายละเอียด',
        'active-jobs': '🚚 Active Jobs (&lt; 48 ชม.) - รายละเอียด',
        'active-jobs-48h': '⚠️ งานค้างเกิน 48 ชม. - รายละเอียด',
        'pending-approvals': '📝 Pending Approvals - รายละเอียด'
    };

    titleElement.textContent = titles[kpiType] || 'รายละเอียด';
    contentElement.innerHTML = '<p style="color: var(--text-sub);">กำลังโหลดข้อมูล...</p>';

    try {
        switch (kpiType) {
            case 'total-users':
                await loadTotalUsersDetails(contentElement);
                break;
            case 'active-jobs':
                await loadActiveJobsDetails(contentElement, true);
                break;
            case 'active-jobs-48h':
                await loadActiveJobsDetails(contentElement, false);
                break;
            case 'pending-approvals':
                await loadPendingApprovalsDetails(contentElement);
                break;
        }
    } catch (error) {
        console.error('Error loading KPI details:', error);
        contentElement.innerHTML = `<p style="color: #e74c3c;">เกิดข้อผิดพลาด: ${error.message}</p>`;
    }
}

/**
 * Load total users details
 */
async function loadTotalUsersDetails(contentElement) {
    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, employee_id, status, phone, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) throw error;

    if (!users || users.length === 0) {
        contentElement.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูล</p>';
        return;
    }

    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--border-color); text-align: left;">
                        <th style="padding: 10px;">ชื่อ</th>
                        <th style="padding: 10px;">รหัสพนักงาน</th>
                        <th style="padding: 10px;">สถานะ</th>
                        <th style="padding: 10px;">เบอร์โทรศัพท์</th>
                        <th style="padding: 10px;">วันที่ลงทะเบียน</th>
                    </tr>
                </thead>
                <tbody>
    `;

    users.forEach(user => {
        const statusColors = {
            'APPROVED': '#22c55e',
            'PENDING': '#f59e0b',
            'REJECTED': '#ef4444',
            'REQUIRES_CHANGES': '#3b82f6'
        };
        const statusColor = statusColors[user.status] || '#6b7280';

        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 10px;">${user.display_name || '-'}</td>
                <td style="padding: 10px;">${user.employee_id || '-'}</td>
                <td style="padding: 10px;"><span style="color: ${statusColor}; font-weight: 500;">${user.status || '-'}</span></td>
                <td style="padding: 10px;">${user.phone || '-'}</td>
                <td style="padding: 10px;">${formatDate(user.created_at)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <p style="margin-top: 10px; font-size: 12px; color: var(--text-sub);">แสดง 20 รายการล่าสุด</p>
    `;

    contentElement.innerHTML = html;
}

/**
 * Load active jobs details
 */
async function loadActiveJobsDetails(contentElement, isWithin48h) {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    let query = supabase
        .from('jobdata')
        .select('id, reference, shipment_no, confirmed_driver1, ship_to_code, ship_to_name, created_at, updated_at, status, trip_ended, checkin_time, checkout_time')
        .in('status', ['pending', 'active', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false });

    if (isWithin48h) {
        query = query.gte('created_at', fortyEightHoursAgo);
    } else {
        query = query.lt('created_at', fortyEightHoursAgo);
    }

    const { data: jobs, error } = await query.limit(100);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
        contentElement.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูล</p>';
        return;
    }

    // Get driver names using user_id
    const driverUserIds = jobs.map(j => j.confirmed_driver1).filter(Boolean);
    const { data: drivers } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, employee_id')
        .in('user_id', driverUserIds);

    const driverMap = {};
    if (drivers) {
        drivers.forEach(d => driverMap[d.user_id] = {
            name: d.display_name,
            code: d.employee_id
        });
    }

    // Get destination info from origins table (ship_to_code -> origin)
    const originCodes = jobs.map(j => j.ship_to_code).filter(Boolean);
    const { data: origins } = await supabase
        .from('origins')
        .select('code, name')
        .in('code', originCodes);

    const originMap = {};
    if (origins) {
        origins.forEach(o => originMap[o.code] = o.name);
    }

    // Group jobs by reference/shipment_no and consolidate same shiptoname
    const groupedJobs = {};
    jobs.forEach(job => {
        const ref = job.reference || job.shipment_no || 'UNKNOWN';
        if (!groupedJobs[ref]) {
            const driver = driverMap[job.confirmed_driver1] || {};
            groupedJobs[ref] = {
                reference: job.reference,
                shipment_no: job.shipment_no,
                confirmed_driver1: job.confirmed_driver1,
                driverName: driver.name || '-',
                driverCode: driver.code || '',
                created_at: job.created_at,
                status: job.status,
                trip_ended: job.trip_ended,
                checkin_time: job.checkin_time,
                checkout_time: job.checkout_time,
                stops: [],
                allCheckedIn: true,
                anyCheckedOut: false,
                shipToNames: new Set() // Track unique ship_to_names
            };
        }
        // Use ship_to_name for deduplication (consolidate same location in one line)
        // Trim whitespace to ensure consistent matching
        const shipToName = (job.ship_to_name || originMap[job.ship_to_code] || '-').trim();
        // Only add if this ship_to_name hasn't been added yet
        if (!groupedJobs[ref].shipToNames.has(shipToName)) {
            groupedJobs[ref].shipToNames.add(shipToName);
            groupedJobs[ref].stops.push(shipToName);
        }
        // Track check-in/check-out status
        if (!job.checkin_time) groupedJobs[ref].allCheckedIn = false;
        if (job.checkout_time) groupedJobs[ref].anyCheckedOut = true;
    });

    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: var(--border-color); text-align: left;">
                        <th style="padding: 8px;">เลขที่งาน</th>
                        <th style="padding: 8px;">พนักงานขับรถ</th>
                        <th style="padding: 8px;">ปลายทาง</th>
                        <th style="padding: 8px;">จำนวนจุด</th>
                        <th style="padding: 8px;">Check-in</th>
                        <th style="padding: 8px;">Check-out</th>
                        <th style="padding: 8px;">สถานะ</th>
                        <th style="padding: 8px;">อายุงาน</th>
                    </tr>
                </thead>
                <tbody>
    `;

    Object.values(groupedJobs).forEach(job => {
        const ageHours = Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60));
        const ageText = ageHours < 48
            ? `${ageHours} ชม.`
            : `<span style="color: #f59e0b; font-weight: 500;">${ageHours} ชม.</span>`;

        // Status display
        const statusColors = {
            'pending': '#f59e0b',
            'active': '#3b82f6',
            'assigned': '#8b5cf6',
            'in_progress': '#22c55e'
        };
        const statusColor = statusColors[job.status] || '#6b7280';
        const statusText = {
            'pending': 'รอดำเนินการ',
            'active': 'กำลังดำเนินการ',
            'assigned': 'มอบหมายแล้ว',
            'in_progress': 'กำลังดำเนินการ'
        }[job.status] || job.status;

        // Combine destinations, remove duplicates
        const uniqueStops = [...new Set(job.stops)];
        const destinationsText = uniqueStops.join(' → ');

        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px;"><strong>${job.reference || job.shipment_no || '-'}</strong></td>
                <td style="padding: 8px;">${job.driverName} ${job.driverCode ? `(${job.driverCode})` : ''}</td>
                <td style="padding: 8px; font-size: 11px;">${destinationsText || '-'}</td>
                <td style="padding: 8px; text-align: center;">${uniqueStops.length}</td>
                <td style="padding: 8px;">${job.checkin_time ? formatDate(job.checkin_time) : (job.allCheckedIn && uniqueStops.length > 0 ? formatDate(job.checkin_time) : '<span style="color: #ef4444;">ยังไม่ check-in</span>')}</td>
                <td style="padding: 8px;">${job.checkout_time ? formatDate(job.checkout_time) : (job.anyCheckedOut ? '<span style="color: #22c55e;">เสร็จสิ้น</span>' : '<span style="color: #f59e0b;">ยังไม่ check-out</span>')}</td>
                <td style="padding: 8px;"><span style="color: ${statusColor}; font-weight: 500;">${statusText}</span></td>
                <td style="padding: 8px;">${ageText}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <p style="margin-top: 10px; font-size: 12px; color: var(--text-sub);">แสดง ${Object.keys(groupedJobs).length} งาน (${jobs.length} จุด)</p>
    `;

    contentElement.innerHTML = html;
}

/**
 * Load pending approvals details (from user_profiles table)
 */
async function loadPendingApprovalsDetails(contentElement) {
    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, employee_id, user_type, phone, status, created_at')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;

    if (!users || users.length === 0) {
        contentElement.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูล</p>';
        return;
    }

    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: var(--border-color); text-align: left;">
                        <th style="padding: 8px;">ชื่อ-นามสกุล</th>
                        <th style="padding: 8px;">รหัสพนักงาน</th>
                        <th style="padding: 8px;">ประเภทผู้ใช้</th>
                        <th style="padding: 8px;">เบอร์โทรศัพท์</th>
                        <th style="padding: 8px;">สถานะ</th>
                        <th style="padding: 8px;">วันที่สมัคร</th>
                    </tr>
                </thead>
                <tbody>
    `;

    users.forEach(user => {
        const statusColor = '#f59e0b';
        const statusText = 'รออนุมัติ';

        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px;"><strong>${user.display_name || '-'}</strong></td>
                <td style="padding: 8px;">${user.employee_id || '-'}</td>
                <td style="padding: 8px;">${user.user_type || '-'}</td>
                <td style="padding: 8px;">${user.phone || '-'}</td>
                <td style="padding: 8px;"><span style="color: ${statusColor}; font-weight: 500;">${statusText}</span></td>
                <td style="padding: 8px;">${formatDate(user.created_at)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <p style="margin-top: 10px; font-size: 12px; color: var(--text-sub);">แสดง ${users.length} รายการ</p>
    `;

    contentElement.innerHTML = html;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
