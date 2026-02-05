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

        // Active jobs within 48 hours
        const { count: activeJobs48h, error: jobsError48h } = await supabase
            .from('jobdata')
            .select('*', { count: 'exact' })
            .eq('status', 'active')
            .eq('trip_ended', false)
            .gte('created_at', fortyEightHoursAgo);

        if (jobsError48h) throw jobsError48h;
        if (kpiActiveJobs) kpiActiveJobs.textContent = formatNumber(activeJobs48h);

        // Active jobs over 48 hours (unclosed/unfinished trips)
        const { count: activeJobsOlder, error: jobsErrorOlder } = await supabase
            .from('jobdata')
            .select('*', { count: 'exact' })
            .eq('status', 'active')
            .eq('trip_ended', false)
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
        .select('id, display_name, driver_code, status, vehicle_plate, created_at')
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
                        <th style="padding: 10px;">ทะเบียนรถ</th>
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
                <td style="padding: 10px;">${user.driver_code || '-'}</td>
                <td style="padding: 10px;"><span style="color: ${statusColor}; font-weight: 500;">${user.status || '-'}</span></td>
                <td style="padding: 10px;">${user.vehicle_plate || '-'}</td>
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
        .select('ref, driver_id, origin_id, destination_address, created_at, status, trip_ended')
        .eq('status', 'active')
        .eq('trip_ended', false)
        .order('created_at', { ascending: false });

    if (isWithin48h) {
        query = query.gte('created_at', fortyEightHoursAgo);
    } else {
        query = query.lt('created_at', fortyEightHoursAgo);
    }

    const { data: jobs, error } = await query.limit(50);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
        contentElement.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูล</p>';
        return;
    }

    // Get driver names
    const driverIds = jobs.map(j => j.driver_id).filter(Boolean);
    const { data: drivers } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', driverIds);

    const driverMap = {};
    if (drivers) {
        drivers.forEach(d => driverMap[d.id] = d.display_name);
    }

    // Get origin names
    const originIds = jobs.map(j => j.origin_id).filter(Boolean);
    const { data: origins } = await supabase
        .from('origins')
        .select('id, name')
        .in('id', originIds);

    const originMap = {};
    if (origins) {
        origins.forEach(o => originMap[o.id] = o.name);
    }

    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--border-color); text-align: left;">
                        <th style="padding: 10px;">เลขที่งาน</th>
                        <th style="padding: 10px;">พนักงานขับรถ</th>
                        <th style="padding: 10px;">ต้นทาง</th>
                        <th style="padding: 10px;">ปลายทาง</th>
                        <th style="padding: 10px;">เวลาที่สร้าง</th>
                        <th style="padding: 10px;">อายุงาน</th>
                    </tr>
                </thead>
                <tbody>
    `;

    jobs.forEach(job => {
        const driverName = driverMap[job.driver_id] || '-';
        const originName = originMap[job.origin_id] || '-';
        const ageHours = Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60));
        const ageText = ageHours < 48
            ? `${ageHours} ชม.`
            : `<span style="color: #f59e0b; font-weight: 500;">${ageHours} ชม.</span>`;

        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 10px;"><strong>${job.ref || '-'}</strong></td>
                <td style="padding: 10px;">${driverName}</td>
                <td style="padding: 10px;">${originName}</td>
                <td style="padding: 10px;">${job.destination_address || '-'}</td>
                <td style="padding: 10px;">${formatDate(job.created_at)}</td>
                <td style="padding: 10px;">${ageText}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    contentElement.innerHTML = html;
}

/**
 * Load pending approvals details
 */
async function loadPendingApprovalsDetails(contentElement) {
    const { data: registrations, error } = await supabase
        .from('driver_registrations')
        .select('id, full_name, driver_code, sap_code, department, vehicle_type, status, submitted_at')
        .eq('status', 'PENDING')
        .order('submitted_at', { ascending: false })
        .limit(20);

    if (error) throw error;

    if (!registrations || registrations.length === 0) {
        contentElement.innerHTML = '<p style="color: var(--text-sub);">ไม่พบข้อมูล</p>';
        return;
    }

    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--border-color); text-align: left;">
                        <th style="padding: 10px;">ชื่อ-นามสกุล</th>
                        <th style="padding: 10px;">รหัสพนักงาน</th>
                        <th style="padding: 10px;">แผนก</th>
                        <th style="padding: 10px;">ประเภทรถ</th>
                        <th style="padding: 10px;">วันที่สมัคร</th>
                        <th style="padding: 10px;">สถานะ</th>
                    </tr>
                </thead>
                <tbody>
    `;

    registrations.forEach(reg => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 10px;">${reg.full_name || '-'}</td>
                <td style="padding: 10px;">${reg.driver_code || '-'}</td>
                <td style="padding: 10px;">${reg.department || '-'}</td>
                <td style="padding: 10px;">${reg.vehicle_type || '-'}</td>
                <td style="padding: 10px;">${formatDate(reg.submitted_at)}</td>
                <td style="padding: 10px;"><span style="color: #f59e0b; font-weight: 500;">${reg.status || '-'}</span></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
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
