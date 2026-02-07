/**
 * Working Hours Dashboard
 * แดชบอร์ดชั่วโมงการทำงานของพนักงานขับรถ
 * แสดงรายการทุกคนพร้อมสรุป และคลิกดูรายละเอียดแต่ละคนได้
 */

import { supabase } from '../../shared/config.js';
import { showNotification } from './utils.js';

// State
let allDriversData = [];
let filteredDriversData = [];
let selectedDateRange = { start: null, end: null };

// DOM elements
const elements = {};

/**
 * Initialize the working hours dashboard
 */
export async function initWorkingHoursReport() {
    console.log('Initializing Working Hours Dashboard...');

    // Cache DOM elements
    cacheElements();

    // Set default date range (current month)
    setDefaultDateRange();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadDashboardData();
}

/**
 * Cache DOM elements
 */
function cacheElements() {
    Object.assign(elements, {
        // Date filters
        startDate: document.getElementById('wh-start-date'),
        endDate: document.getElementById('wh-end-date'),
        applyDateBtn: document.getElementById('wh-apply-date-btn'),
        quickDateBtns: document.querySelectorAll('.wh-quick-date-btn'),

        // Search & Filter
        searchInput: document.getElementById('wh-search-input'),
        statusFilter: document.getElementById('wh-status-filter'),
        exportBtn: document.getElementById('wh-export-btn'),

        // Summary stats
        totalDrivers: document.getElementById('wh-total-drivers'),
        activeDrivers: document.getElementById('wh-active-drivers'),
        totalHours: document.getElementById('wh-total-hours'),
        avgHoursPerDriver: document.getElementById('wh-avg-hours-driver'),
        totalJobs: document.getElementById('wh-total-jobs'),

        // Driver cards container
        driversGrid: document.getElementById('wh-drivers-grid'),

        // Detail modal
        detailModal: document.getElementById('wh-detail-modal'),
        detailModalClose: document.getElementById('wh-detail-modal-close'),
        detailDriverName: document.getElementById('wh-detail-driver-name'),
        detailDriverCode: document.getElementById('wh-detail-driver-code'),
        detailPeriod: document.getElementById('wh-detail-period'),
        detailTotalJobs: document.getElementById('wh-detail-total-jobs'),
        detailTotalHours: document.getElementById('wh-detail-total-hours'),
        detailAvgPerJob: document.getElementById('wh-detail-avg-per-job'),
        detailWorkingDays: document.getElementById('wh-detail-working-days'),
        detailAvgPerDay: document.getElementById('wh-detail-avg-per-day'),
        detailJobsTableBody: document.getElementById('wh-detail-jobs-tbody'),
    });
}

/**
 * Set default date range (current month)
 */
function setDefaultDateRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (elements.startDate) {
        elements.startDate.value = firstDay.toISOString().split('T')[0];
    }
    if (elements.endDate) {
        elements.endDate.value = lastDay.toISOString().split('T')[0];
    }

    selectedDateRange = {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
    };
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Apply date filter
    if (elements.applyDateBtn) {
        elements.applyDateBtn.addEventListener('click', async () => {
            selectedDateRange.start = elements.startDate?.value;
            selectedDateRange.end = elements.endDate?.value;
            await loadDashboardData();
        });
    }

    // Quick date buttons
    elements.quickDateBtns?.forEach(btn => {
        btn.addEventListener('click', async () => {
            const range = btn.dataset.range;
            applyQuickDateRange(range);
            await loadDashboardData();
        });
    });

    // Search input
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(filterDrivers, 300));
    }

    // Status filter
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', filterDrivers);
    }

    // Export button
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportDashboard);
    }

    // Modal close
    if (elements.detailModalClose) {
        elements.detailModalClose.addEventListener('click', closeModal);
    }

    // Close modal on outside click
    if (elements.detailModal) {
        elements.detailModal.addEventListener('click', (e) => {
            if (e.target === elements.detailModal) closeModal();
        });
    }
}

/**
 * Apply quick date range
 */
function applyQuickDateRange(range) {
    const now = new Date();
    let startDate, endDate = now;

    switch (range) {
        case 'today':
            startDate = new Date(now);
            break;
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'quarter':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            return;
    }

    if (elements.startDate) {
        elements.startDate.value = startDate.toISOString().split('T')[0];
    }
    if (elements.endDate) {
        elements.endDate.value = endDate.toISOString().split('T')[0];
    }

    selectedDateRange = {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    showLoadingState();

    try {
        const { start, end } = selectedDateRange;
        const startDateTime = new Date(start + 'T00:00:00').toISOString();
        const endDateTime = new Date(end + 'T23:59:59').toISOString();

        // Fetch all jobs with checkin/checkout in date range
        const { data: jobs, error } = await supabase
            .from('jobdata')
            .select('*')
            .not('checkin_time', 'is', null)
            .not('checkout_time', 'is', null)
            .gte('checkin_time', startDateTime)
            .lte('checkout_time', endDateTime)
            .order('checkin_time', { ascending: true });

        if (error) throw error;

        // Fetch all drivers
        const { data: drivers, error: driversError } = await supabase
            .from('user_profiles')
            .select('user_id, display_name, status')
            .eq('user_type', 'DRIVER')
            .order('display_name', { ascending: true });

        if (driversError) throw driversError;

        // Process data
        allDriversData = processDriverData(drivers || [], jobs || []);
        filteredDriversData = [...allDriversData];

        // Render dashboard
        renderSummaryStats();
        renderDriverCards();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        showErrorState();
    }
}

/**
 * Process driver data from jobs and driver profiles
 */
function processDriverData(drivers, jobs) {
    // Create driver map
    const driverMap = new Map();

    drivers.forEach(driver => {
        driverMap.set(driver.user_id, {
            userId: driver.user_id,
            name: driver.display_name || '-',
            driverCode: '-',
            status: driver.status || 'active',
            jobs: [],
            totalMinutes: 0,
            totalTrips: 0,
            totalDistance: 0,
            uniqueDates: new Set()
        });
    });

    // Process each job
    jobs.forEach(job => {
        const driverList = parseDriversField(job.drivers);

        driverList.forEach(driverId => {
            const driver = driverMap.get(driverId);
            if (!driver) return;

            const duration = calculateTripDuration(job.checkin_time, job.checkout_time);

            if (duration > 0) {
                const checkinDate = new Date(job.checkin_time).toDateString();
                driver.uniqueDates.add(checkinDate);

                driver.jobs.push({
                    reference: job.reference || '-',
                    shipmentNo: job.shipment_no || '-',
                    origin: job.is_origin_stop ? (job.ship_to_name || '-') : null,
                    destination: job.ship_to_name || '-',
                    checkinTime: job.checkin_time,
                    checkoutTime: job.checkout_time,
                    checkinDate: formatDateThai(job.checkin_time),
                    checkinTimeFormatted: formatTime(job.checkin_time),
                    checkoutTimeFormatted: formatTime(job.checkout_time),
                    duration,
                    durationFormatted: formatDuration(duration),
                    distance: job.distance_km || 0
                });

                driver.totalMinutes += duration;
                driver.totalTrips += 1;
                driver.totalDistance += (job.distance_km || 0);
            }
        });
    });

    // Convert to array and calculate derived metrics
    return Array.from(driverMap.values()).map(driver => ({
        ...driver,
        totalHours: driver.totalMinutes / 60,
        totalHoursFormatted: formatHours(driver.totalMinutes),
        avgMinutesPerJob: driver.totalTrips > 0 ? Math.round(driver.totalMinutes / driver.totalTrips) : 0,
        avgHoursPerJob: driver.totalTrips > 0 ? (driver.totalMinutes / driver.totalTrips / 60).toFixed(2) : '0.00',
        workingDays: driver.uniqueDates.size,
        avgHoursPerDay: driver.uniqueDates.size > 0 ? (driver.totalMinutes / 60 / driver.uniqueDates.size).toFixed(2) : '0.00',
        uniqueDates: Array.from(driver.uniqueDates) // Convert Set to Array for serialization
    })).sort((a, b) => b.totalMinutes - a.totalMinutes); // Sort by total hours descending
}

/**
 * Parse drivers field
 */
function parseDriversField(drivers) {
    if (!drivers) return [];

    if (typeof drivers === 'string') {
        try {
            const parsed = JSON.parse(drivers);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return drivers.split(',').map(d => d.trim()).filter(d => d);
        }
    }

    if (Array.isArray(drivers)) {
        return drivers;
    }

    return [drivers];
}

/**
 * Calculate trip duration in minutes
 */
function calculateTripDuration(checkinTime, checkoutTime) {
    if (!checkinTime || !checkoutTime) return 0;
    const checkin = new Date(checkinTime);
    const checkout = new Date(checkoutTime);
    return Math.round((checkout - checkin) / (1000 * 60));
}

/**
 * Render summary statistics
 */
function renderSummaryStats() {
    const totalDrivers = filteredDriversData.length;
    const activeDrivers = filteredDriversData.filter(d => d.totalTrips > 0).length;
    const totalMinutes = filteredDriversData.reduce((sum, d) => sum + d.totalMinutes, 0);
    const totalJobs = filteredDriversData.reduce((sum, d) => sum + d.totalTrips, 0);
    const avgHoursPerDriver = totalDrivers > 0 ? (totalMinutes / 60 / totalDrivers).toFixed(2) : '0.00';

    if (elements.totalDrivers) elements.totalDrivers.textContent = totalDrivers;
    if (elements.activeDrivers) elements.activeDrivers.textContent = activeDrivers;
    if (elements.totalHours) elements.totalHours.textContent = formatHours(totalMinutes);
    if (elements.avgHoursPerDriver) elements.avgHoursPerDriver.textContent = avgHoursPerDriver + ' ชม.';
    if (elements.totalJobs) elements.totalJobs.textContent = totalJobs;
}

/**
 * Render driver cards
 */
function renderDriverCards() {
    if (!elements.driversGrid) return;

    if (filteredDriversData.length === 0) {
        elements.driversGrid.innerHTML = `
            <div class="wh-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-sub);">
                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📊</div>
                <h3>ไม่พบข้อมูล</h3>
                <p>ไม่มีข้อมูลการทำงานในช่วงวันที่เลือก</p>
            </div>
        `;
        return;
    }

    elements.driversGrid.innerHTML = filteredDriversData.map(driver => createDriverCard(driver)).join('');

    // Add click handlers to cards
    document.querySelectorAll('.wh-driver-card').forEach(card => {
        card.addEventListener('click', () => {
            const driverId = card.dataset.driverId;
            openDriverDetail(driverId);
        });
    });
}

/**
 * Create driver card HTML
 */
function createDriverCard(driver) {
    const isActive = driver.totalTrips > 0;
    const statusColor = isActive ? '#22c55e' : '#94a3b8';
    const bgGradient = isActive
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';

    return `
        <div class="wh-driver-card" data-driver-id="${driver.userId}"
             style="background: ${bgGradient}; color: white; border-radius: 16px; padding: 20px;
                    cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; position: relative; overflow: hidden;">

            <!-- Status indicator -->
            <div style="position: absolute; top: 15px; right: 15px; width: 12px; height: 12px;
                        background: ${statusColor}; border-radius: 50%; border: 2px solid white;"></div>

            <!-- Driver info -->
            <div style="margin-bottom: 15px;">
                <div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">
                    ${driver.driverCode !== '-' ? `รหัส: ${driver.driverCode}` : 'พนักงานขับรถ'}
                </div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${driver.name}</h3>
            </div>

            <!-- Stats grid -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px;">
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 12px;">
                    <div style="font-size: 11px; opacity: 0.8;">ทำงาน</div>
                    <div style="font-size: 20px; font-weight: 700;">${driver.totalTrips}</div>
                    <div style="font-size: 10px; opacity: 0.7;">งาน</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 12px;">
                    <div style="font-size: 11px; opacity: 0.8;">รวมชั่วโมง</div>
                    <div style="font-size: 20px; font-weight: 700;">${Math.floor(driver.totalHours)}</div>
                    <div style="font-size: 10px; opacity: 0.7;">ชั่วโมง</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 12px;">
                    <div style="font-size: 11px; opacity: 0.8;">ทำงาน</div>
                    <div style="font-size: 20px; font-weight: 700;">${driver.workingDays}</div>
                    <div style="font-size: 10px; opacity: 0.7;">วัน</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 12px;">
                    <div style="font-size: 11px; opacity: 0.8;">เฉลี่ย/วัน</div>
                    <div style="font-size: 20px; font-weight: 700;">${driver.avgHoursPerDay}</div>
                    <div style="font-size: 10px; opacity: 0.7;">ชั่วโมง</div>
                </div>
            </div>

            <!-- Click hint -->
            <div style="margin-top: 15px; font-size: 11px; opacity: 0.7; text-align: center;">
                คลิกดูรายละเอียด →
            </div>
        </div>
    `;
}

/**
 * Filter drivers based on search input
 */
function filterDrivers() {
    const searchTerm = elements.searchInput?.value?.toLowerCase() || '';
    const statusFilter = elements.statusFilter?.value || 'all';

    filteredDriversData = allDriversData.filter(driver => {
        // Search filter
        const matchesSearch = !searchTerm ||
            driver.name.toLowerCase().includes(searchTerm) ||
            driver.driverCode.toLowerCase().includes(searchTerm);

        // Status filter
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = driver.totalTrips > 0;
        } else if (statusFilter === 'inactive') {
            matchesStatus = driver.totalTrips === 0;
        }

        return matchesSearch && matchesStatus;
    });

    renderSummaryStats();
    renderDriverCards();
}

/**
 * Open driver detail modal
 */
function openDriverDetail(driverId) {
    const driver = allDriversData.find(d => d.userId === driverId);
    if (!driver) return;

    // Populate modal content
    if (elements.detailDriverName) elements.detailDriverName.textContent = driver.name;
    if (elements.detailDriverCode) elements.detailDriverCode.textContent = `รหัส: ${driver.driverCode}`;
    if (elements.detailPeriod) {
        elements.detailPeriod.textContent = formatDateRange(selectedDateRange.start, selectedDateRange.end);
    }
    if (elements.detailTotalJobs) elements.detailTotalJobs.textContent = driver.totalTrips;
    if (elements.detailTotalHours) elements.detailTotalHours.textContent = driver.totalHoursFormatted;
    if (elements.detailAvgPerJob) elements.detailAvgPerJob.textContent = driver.avgHoursPerJob + ' ชม.';
    if (elements.detailWorkingDays) elements.detailWorkingDays.textContent = driver.workingDays;
    if (elements.detailAvgPerDay) elements.detailAvgPerDay.textContent = driver.avgHoursPerDay + ' ชม.';

    // Render jobs table
    if (elements.detailJobsTableBody) {
        if (driver.jobs.length === 0) {
            elements.detailJobsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-sub);">
                        ไม่พบข้อมูลการทำงาน
                    </td>
                </tr>
            `;
        } else {
            elements.detailJobsTableBody.innerHTML = driver.jobs.map(job => `
                <tr>
                    <td>${job.reference}</td>
                    <td>${job.checkinDate}</td>
                    <td>${job.checkinTimeFormatted} - ${job.checkoutTimeFormatted}</td>
                    <td style="text-align: center;"><strong>${job.durationFormatted}</strong></td>
                    <td>${job.origin || '-'}</td>
                    <td>${job.destination}</td>
                    <td style="text-align: center;">${job.distance || '-'}</td>
                </tr>
            `).join('');
        }
    }

    // Show modal
    if (elements.detailModal) {
        elements.detailModal.classList.remove('hidden');
        elements.detailModal.classList.add('active');
    }
}

/**
 * Close modal
 */
function closeModal() {
    if (elements.detailModal) {
        elements.detailModal.classList.add('hidden');
        elements.detailModal.classList.remove('active');
    }
}

/**
 * Show loading state
 */
function showLoadingState() {
    if (elements.driversGrid) {
        elements.driversGrid.innerHTML = `
            <div class="wh-loading" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                <p style="color: var(--text-sub);">กำลังโหลดข้อมูล...</p>
            </div>
        `;
    }

    // Reset stats
    if (elements.totalDrivers) elements.totalDrivers.textContent = '-';
    if (elements.activeDrivers) elements.activeDrivers.textContent = '-';
    if (elements.totalHours) elements.totalHours.textContent = '-';
    if (elements.avgHoursPerDriver) elements.avgHoursPerDriver.textContent = '-';
    if (elements.totalJobs) elements.totalJobs.textContent = '-';
}

/**
 * Show error state
 */
function showErrorState() {
    if (elements.driversGrid) {
        elements.driversGrid.innerHTML = `
            <div class="wh-error" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">⚠️</div>
                <h3>เกิดข้อผิดพลาด</h3>
                <p style="color: var(--text-sub);">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่</p>
            </div>
        `;
    }
}

/**
 * Export dashboard to CSV
 */
function exportDashboard() {
    if (filteredDriversData.length === 0) {
        showNotification('ไม่มีข้อมูลให้ส่งออก', 'warning');
        return;
    }

    try {
        let csvContent = '\uFEFFชื่อพนักงาน,รหัสพนักงาน,จำนวนงาน,รวมชั่วโมง,รวมนาที,จำนวนวันทำงาน,เฉลี่ยชั่วโมงต่องาน,เฉลี่ยชั่วโมงต่อวัน\n';

        filteredDriversData.forEach(driver => {
            const row = [
                `"${driver.name}"`,
                `"${driver.driverCode}"`,
                driver.totalTrips,
                Math.floor(driver.totalHours),
                driver.totalMinutes % 60,
                driver.workingDays,
                driver.avgHoursPerJob,
                driver.avgHoursPerDay
            ];
            csvContent += row.join(',') + '\n';
        });

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const filename = `working_hours_${selectedDateRange.start}_to_${selectedDateRange.end}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('ส่งออกข้อมูลเรียบร้อย', 'success');

    } catch (error) {
        console.error('Export error:', error);
        showNotification('ไม่สามารถส่งออกไฟล์ได้', 'error');
    }
}

// ========== Utility Functions ==========

/**
 * Format date in Thai format
 */
function formatDateThai(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    });
}

/**
 * Format time
 */
function formatTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format duration
 */
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} นาที`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} ชม. ${mins} นาที` : `${hours} ชม.`;
}

/**
 * Format total hours
 */
function formatHours(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} ชม. ${mins} นาที`;
}

/**
 * Format date range
 */
function formatDateRange(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const startStr = startDate.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    });

    const endStr = endDate.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    });

    return `${startStr} - ${endStr}`;
}

/**
 * Debounce utility
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
