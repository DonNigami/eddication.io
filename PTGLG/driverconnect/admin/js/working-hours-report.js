/**
 * Working Hours Report Module
 * รายงานชั่วโมงการทำงานของพนักงานขับรถ
 * คำนวณจากเวลาเช็คอินและเช็คเอาท์จากตาราง jobdata
 */

import { supabase } from '../../shared/config.js';
import { showNotification } from './utils.js';

// DOM elements
let reportElements = {};

/**
 * Initialize the working hours report
 */
export async function initWorkingHoursReport() {
    console.log('Initializing Working Hours Report...');

    // Set DOM elements
    reportElements = {
        driverSelect: document.getElementById('wh-driver-select'),
        startDate: document.getElementById('wh-start-date'),
        endDate: document.getElementById('wh-end-date'),
        generateBtn: document.getElementById('wh-generate-btn'),
        exportBtn: document.getElementById('wh-export-btn'),
        summarySection: document.getElementById('wh-summary'),
        detailsTable: document.getElementById('wh-details-table'),
        detailsTableBody: document.getElementById('wh-details-tbody'),
        // Summary elements
        totalJobs: document.getElementById('wh-total-jobs'),
        totalTrips: document.getElementById('wh-total-trips'),
        totalHours: document.getElementById('wh-total-hours'),
        totalMinutes: document.getElementById('wh-total-minutes'),
        avgHoursPerTrip: document.getElementById('wh-avg-hours'),
        avgHoursPerDay: document.getElementById('wh-avg-hours-day'),
        workingDays: document.getElementById('wh-working-days'),
        driverName: document.getElementById('wh-driver-name')
    };

    // Set default dates (last 30 days)
    setDefaultDates();

    // Load drivers
    await loadDrivers();

    // Setup event listeners
    if (reportElements.generateBtn) {
        reportElements.generateBtn.addEventListener('click', generateReport);
    }
    if (reportElements.exportBtn) {
        reportElements.exportBtn.addEventListener('click', exportToExcel);
    }
}

/**
 * Set default date range (last 30 days)
 */
function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    if (reportElements.startDate) {
        reportElements.startDate.value = startDate.toISOString().split('T')[0];
    }
    if (reportElements.endDate) {
        reportElements.endDate.value = endDate.toISOString().split('T')[0];
    }
}

/**
 * Load all drivers into select dropdown
 */
async function loadDrivers() {
    if (!reportElements.driverSelect) return;

    reportElements.driverSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        // Fetch drivers from user_profiles
        const { data: drivers, error } = await supabase
            .from('user_profiles')
            .select('user_id, display_name, driver_code')
            .eq('user_type', 'DRIVER')
            .order('display_name', { ascending: true });

        if (error) throw error;

        reportElements.driverSelect.innerHTML = '<option value="">-- เลือกพนักงานขับรถ --</option>';

        if (drivers && drivers.length > 0) {
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.user_id;
                const displayName = driver.display_name || driver.user_id;
                const driverCode = driver.driver_code ? ` (${driver.driver_code})` : '';
                option.textContent = displayName + driverCode;
                reportElements.driverSelect.appendChild(option);
            });
        }

        // Add "All Drivers" option
        const allOption = document.createElement('option');
        allOption.value = 'ALL';
        allOption.textContent = '📊 ทุกคน (รวมทุกคน)';
        reportElements.driverSelect.insertBefore(allOption, reportElements.driverSelect.firstChild);

    } catch (error) {
        console.error('Error loading drivers:', error);
        reportElements.driverSelect.innerHTML = '<option value="">Error loading drivers</option>';
    }
}

/**
 * Generate working hours report
 */
async function generateReport() {
    const driverId = reportElements.driverSelect?.value;
    const startDate = reportElements.startDate?.value;
    const endDate = reportElements.endDate?.value;

    if (!driverId) {
        showNotification('กรุณาเลือกพนักงานขับรถ', 'error');
        return;
    }
    if (!startDate || !endDate) {
        showNotification('กรุณาเลือกช่วงวันที่', 'error');
        return;
    }

    // Show loading state
    showLoadingState();

    try {
        let reportData;

        if (driverId === 'ALL') {
            reportData = await generateAllDriversReport(startDate, endDate);
        } else {
            reportData = await generateSingleDriverReport(driverId, startDate, endDate);
        }

        displayReport(reportData);

    } catch (error) {
        console.error('Error generating report:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        showErrorState();
    }
}

/**
 * Generate report for a single driver
 */
async function generateSingleDriverReport(driverId, startDate, endDate) {
    // Get driver info
    const { data: driver } = await supabase
        .from('user_profiles')
        .select('display_name, driver_code')
        .eq('user_id', driverId)
        .single();

    const driverName = driver?.display_name || driverId;

    // Fetch jobdata with checkin/checkout times
    const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
    const endDateTime = new Date(endDate + 'T23:59:59').toISOString();

    const { data: jobs, error } = await supabase
        .from('jobdata')
        .select('*')
        .ilike('drivers', `%${driverId}%`)
        .not('checkin_time', 'is', null)
        .not('checkout_time', 'is', null)
        .gte('checkin_time', startDateTime)
        .lte('checkout_time', endDateTime)
        .order('checkin_time', { ascending: true });

    if (error) throw error;

    // Process jobs to calculate working hours
    const processedJobs = processJobsForWorkingHours(jobs || []);

    // Calculate summary
    const summary = calculateSummary(processedJobs);

    return {
        driverName,
        driverId,
        jobs: processedJobs,
        summary,
        reportType: 'single'
    };
}

/**
 * Generate report for all drivers (summary by driver)
 */
async function generateAllDriversReport(startDate, endDate) {
    const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
    const endDateTime = new Date(endDate + 'T23:59:59').toISOString();

    // Fetch all completed trips with checkin/checkout
    const { data: jobs, error } = await supabase
        .from('jobdata')
        .select('*')
        .not('checkin_time', 'is', null)
        .not('checkout_time', 'is', null)
        .gte('checkin_time', startDateTime)
        .lte('checkout_time', endDateTime)
        .order('checkin_time', { ascending: true });

    if (error) throw error;

    // Group by driver
    const driversMap = new Map();

    // Get all unique driver IDs from jobs
    const uniqueDriverIds = new Set();
    (jobs || []).forEach(job => {
        if (job.drivers) {
            // Parse drivers field (could be comma-separated names or JSON)
            const driverList = parseDriversField(job.drivers);
            driverList.forEach(d => uniqueDriverIds.add(d));
        }
    });

    // Fetch driver profiles
    const { data: driverProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, driver_code')
        .in('user_id', Array.from(uniqueDriverIds));

    // Create driver lookup map
    const driverLookup = new Map();
    driverProfiles?.forEach(d => {
        driverLookup.set(d.user_id, d.display_name || d.user_id);
    });

    // Process and group jobs by driver
    (jobs || []).forEach(job => {
        const driverList = parseDriversField(job.drivers);

        driverList.forEach(driverId => {
            if (!driversMap.has(driverId)) {
                driversMap.set(driverId, {
                    driverId,
                    driverName: driverLookup.get(driverId) || driverId,
                    jobs: [],
                    totalMinutes: 0,
                    totalTrips: 0
                });
            }

            const driverData = driversMap.get(driverId);
            const duration = calculateTripDuration(job.checkin_time, job.checkout_time);

            if (duration > 0) {
                driverData.jobs.push({
                    ...job,
                    duration,
                    durationFormatted: formatDuration(duration)
                });
                driverData.totalMinutes += duration;
                driverData.totalTrips += 1;
            }
        });
    });

    // Convert to array and calculate summaries
    const driversData = Array.from(driversMap.values()).map(d => ({
        driverId: d.driverId,
        driverName: d.driverName,
        totalJobs: d.totalTrips,
        totalMinutes: d.totalMinutes,
        totalHours: d.totalMinutes / 60,
        totalHoursFormatted: formatHours(d.totalMinutes),
        avgMinutesPerTrip: d.totalTrips > 0 ? Math.round(d.totalMinutes / d.totalTrips) : 0,
        avgHoursPerTrip: d.totalTrips > 0 ? (d.totalMinutes / d.totalTrips / 60).toFixed(2) : '0.00',
        jobs: d.jobs.slice(0, 10) // Keep first 10 jobs for preview
    }));

    // Calculate overall summary
    const totalJobs = driversData.reduce((sum, d) => sum + d.totalJobs, 0);
    const totalMinutes = driversData.reduce((sum, d) => sum + d.totalMinutes, 0);
    const uniqueWorkingDays = countUniqueWorkingDays(jobs || []);

    const summary = {
        totalJobs,
        totalTrips: totalJobs,
        totalMinutes,
        totalHours: totalMinutes / 60,
        totalHoursFormatted: formatHours(totalMinutes),
        avgMinutesPerTrip: totalJobs > 0 ? Math.round(totalMinutes / totalJobs) : 0,
        avgHoursPerTrip: totalJobs > 0 ? (totalMinutes / totalJobs / 60).toFixed(2) : '0.00',
        workingDays: uniqueWorkingDays,
        avgHoursPerDay: uniqueWorkingDays > 0 ? (totalMinutes / 60 / uniqueWorkingDays).toFixed(2) : '0.00'
    };

    return {
        driverName: 'ทุกคน',
        driverId: 'ALL',
        jobs: [],
        summary,
        driversData,
        reportType: 'all'
    };
}

/**
 * Parse drivers field (handles comma-separated, JSON array, or single value)
 */
function parseDriversField(drivers) {
    if (!drivers) return [];

    if (typeof drivers === 'string') {
        // Try JSON parse first
        try {
            const parsed = JSON.parse(drivers);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            // Split by comma
            return drivers.split(',').map(d => d.trim()).filter(d => d);
        }
    }

    if (Array.isArray(drivers)) {
        return drivers;
    }

    return [drivers];
}

/**
 * Process jobs to calculate working hours
 */
function processJobsForWorkingHours(jobs) {
    return jobs.map(job => {
        const duration = calculateTripDuration(job.checkin_time, job.checkout_time);

        return {
            reference: job.reference || '-',
            shipmentNo: job.shipment_no || '-',
            origin: job.is_origin_stop ? (job.ship_to_name || '-') : '-',
            destination: job.ship_to_name || '-',
            checkinTime: job.checkin_time,
            checkoutTime: job.checkout_time,
            checkinDate: formatDateThai(job.checkin_time),
            checkinTimeFormatted: formatTime(job.checkin_time),
            checkoutTimeFormatted: formatTime(job.checkout_time),
            duration,
            durationFormatted: formatDuration(duration),
            distance: job.distance_km || 0
        };
    }).filter(job => job.duration > 0); // Only include jobs with valid duration
}

/**
 * Calculate trip duration in minutes
 */
function calculateTripDuration(checkinTime, checkoutTime) {
    if (!checkinTime || !checkoutTime) return 0;

    const checkin = new Date(checkinTime);
    const checkout = new Date(checkoutTime);

    return Math.round((checkout - checkin) / (1000 * 60)); // Minutes
}

/**
 * Calculate summary statistics
 */
function calculateSummary(jobs) {
    if (jobs.length === 0) {
        return {
            totalJobs: 0,
            totalTrips: 0,
            totalMinutes: 0,
            totalHours: 0,
            totalHoursFormatted: '0 ชม. 0 นาที',
            avgMinutesPerTrip: 0,
            avgHoursPerTrip: '0.00',
            workingDays: 0,
            avgHoursPerDay: '0.00'
        };
    }

    const totalMinutes = jobs.reduce((sum, job) => sum + job.duration, 0);
    const uniqueDays = countUniqueDays(jobs);

    return {
        totalJobs: jobs.length,
        totalTrips: jobs.length,
        totalMinutes,
        totalHours: totalMinutes / 60,
        totalHoursFormatted: formatHours(totalMinutes),
        avgMinutesPerTrip: Math.round(totalMinutes / jobs.length),
        avgHoursPerTrip: (totalMinutes / jobs.length / 60).toFixed(2),
        workingDays: uniqueDays,
        avgHoursPerDay: (totalMinutes / 60 / uniqueDays).toFixed(2)
    };
}

/**
 * Count unique working days from jobs
 */
function countUniqueDays(jobs) {
    const uniqueDays = new Set();

    jobs.forEach(job => {
        if (job.checkinTime) {
            const date = new Date(job.checkinTime).toDateString();
            uniqueDays.add(date);
        }
    });

    return uniqueDays.size;
}

/**
 * Count unique working days from raw jobdata
 */
function countUniqueWorkingDays(jobs) {
    const uniqueDays = new Set();

    jobs.forEach(job => {
        if (job.checkin_time) {
            const date = new Date(job.checkin_time).toDateString();
            uniqueDays.add(date);
        }
    });

    return uniqueDays.size;
}

/**
 * Display report results
 */
function displayReport(data) {
    const { summary, driverName, jobs, driversData, reportType } = data;

    // Update driver name
    if (reportElements.driverName) {
        reportElements.driverName.textContent = driverName;
    }

    // Update summary
    if (reportElements.totalJobs) reportElements.totalJobs.textContent = summary.totalJobs;
    if (reportElements.totalTrips) reportElements.totalTrips.textContent = summary.totalTrips;
    if (reportElements.totalHours) reportElements.totalHours.textContent = Math.floor(summary.totalHours);
    if (reportElements.totalMinutes) reportElements.totalMinutes.textContent = summary.totalMinutes % 60;
    if (reportElements.avgHoursPerTrip) reportElements.avgHoursPerTrip.textContent = summary.avgHoursPerTrip;
    if (reportElements.avgHoursPerDay) reportElements.avgHoursPerDay.textContent = summary.avgHoursPerDay;
    if (reportElements.workingDays) reportElements.workingDays.textContent = summary.workingDays;

    // Display details table
    if (reportElements.detailsTableBody) {
        reportElements.detailsTableBody.innerHTML = '';

        if (reportType === 'all' && driversData) {
            // Display all drivers summary
            driversData.forEach(driver => {
                const row = reportElements.detailsTableBody.insertRow();
                row.innerHTML = `
                    <td>${driver.driverName}</td>
                    <td class="text-center">${driver.totalJobs}</td>
                    <td class="text-center">${driver.totalHoursFormatted}</td>
                    <td class="text-center">${driver.avgHoursPerTrip}</td>
                    <td class="text-center">${driver.driverId}</td>
                `;
            });

            // Update table headers for all drivers view
            updateTableHeadersForAllDrivers();

        } else if (jobs && jobs.length > 0) {
            // Display individual job details
            jobs.forEach(job => {
                const row = reportElements.detailsTableBody.insertRow();
                row.innerHTML = `
                    <td>${job.reference}</td>
                    <td>${job.checkinDate}</td>
                    <td>${job.checkinTimeFormatted} - ${job.checkoutTimeFormatted}</td>
                    <td class="text-center"><strong>${job.durationFormatted}</strong></td>
                    <td>${job.origin}</td>
                    <td>${job.destination}</td>
                    <td class="text-center">${job.distance || '-'}</td>
                `;
            });

            // Reset table headers for single driver view
            updateTableHeadersForSingleDriver();

        } else {
            reportElements.detailsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        ไม่พบข้อมูลการทำงานในช่วงวันที่เลือก
                    </td>
                </tr>
            `;
        }
    }

    // Show summary section
    if (reportElements.summarySection) {
        reportElements.summarySection.classList.remove('hidden');
    }
}

/**
 * Update table headers for all drivers view
 */
function updateTableHeadersForAllDrivers() {
    const thead = reportElements.detailsTable?.querySelector('thead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>ชื่อพนักงาน</th>
                <th class="text-center">จำนวนงาน</th>
                <th class="text-center">รวมชั่วโมง</th>
                <th class="text-center">เฉลี่ย/งาน (ชม.)</th>
                <th class="text-center">Driver ID</th>
            </tr>
        `;
    }
}

/**
 * Update table headers for single driver view
 */
function updateTableHeadersForSingleDriver() {
    const thead = reportElements.detailsTable?.querySelector('thead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>เลขที่งาน</th>
                <th>วันที่</th>
                <th>เวลาเช็คอิน - เช็คเอาท์</th>
                <th class="text-center">ระยะเวลา</th>
                <th>ต้นทาง</th>
                <th>ปลายทาง</th>
                <th class="text-center">ระยะทาง (กม.)</th>
            </tr>
        `;
    }
}

/**
 * Show loading state
 */
function showLoadingState() {
    if (reportElements.driverName) reportElements.driverName.textContent = 'กำลังโหลด...';
    if (reportElements.totalJobs) reportElements.totalJobs.textContent = '-';
    if (reportElements.totalTrips) reportElements.totalTrips.textContent = '-';
    if (reportElements.totalHours) reportElements.totalHours.textContent = '-';
    if (reportElements.totalMinutes) reportElements.totalMinutes.textContent = '-';
    if (reportElements.avgHoursPerTrip) reportElements.avgHoursPerTrip.textContent = '-';
    if (reportElements.avgHoursPerDay) reportElements.avgHoursPerDay.textContent = '-';
    if (reportElements.workingDays) reportElements.workingDays.textContent = '-';

    if (reportElements.detailsTableBody) {
        reportElements.detailsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading-spinner"></div>
                    <p>กำลังคำนวณชั่วโมงการทำงาน...</p>
                </td>
            </tr>
        `;
    }
}

/**
 * Show error state
 */
function showErrorState() {
    if (reportElements.driverName) reportElements.driverName.textContent = 'เกิดข้อผิดพลาด';
    if (reportElements.detailsTableBody) {
        reportElements.detailsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-error">
                    ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่
                </td>
            </tr>
        `;
    }
}

/**
 * Export report to Excel (CSV format)
 */
function exportToExcel() {
    const driverId = reportElements.driverSelect?.value;
    const startDate = reportElements.startDate?.value;
    const endDate = reportElements.endDate?.value;

    if (!driverId || !startDate || !endDate) {
        showNotification('กรุณาสร้างรายงานก่อน', 'warning');
        return;
    }

    try {
        let csvContent = '';
        let filename = '';

        if (driverId === 'ALL') {
            // Export all drivers summary
            csvContent = '\uFEFFพนักงาน,จำนวนงาน,รวมชั่วโมง,เฉลี่ยชั่วโมงต่องาน\n';

            const rows = reportElements.detailsTableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                    const driver = cells[0].textContent.trim();
                    const jobs = cells[1].textContent.trim();
                    const hours = cells[2].textContent.trim();
                    const avg = cells[3].textContent.trim();
                    csvContent += `"${driver}",${jobs},${hours},${avg}\n`;
                }
            });

            filename = `working_hours_all_${startDate}_to_${endDate}.csv`;

        } else {
            // Export single driver details
            csvContent = '\uFEFFเลขที่งาน,วันที่,เวลาเช็คอิน,เวลาเช็คเอาท์,ระยะเวลา(นาที),ต้นทาง,ปลายทาง,ระยะทาง(กม.)\n';

            const rows = reportElements.detailsTableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    const ref = cells[0].textContent.trim();
                    const date = cells[1].textContent.trim();
                    const timeRange = cells[2].textContent.trim();
                    const duration = cells[3].textContent.trim();
                    const origin = cells[4].textContent.trim();
                    const dest = cells[5].textContent.trim();
                    const dist = cells[6] ? cells[6].textContent.trim() : '0';

                    const [checkin, checkout] = timeRange.split(' - ');
                    const durationMins = parseDurationToMinutes(duration);

                    csvContent += `"${ref}","${date}","${checkin}","${checkout}",${durationMins},"${origin}","${dest}",${dist}\n`;
                }
            });

            const driverName = reportElements.driverName?.textContent || 'driver';
            filename = `working_hours_${driverName}_${startDate}_to_${endDate}.csv`;
        }

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('ดาวน์โหลดรายงานเรียบร้อย', 'success');

    } catch (error) {
        console.error('Export error:', error);
        showNotification('ไม่สามารถส่งออกไฟล์ได้', 'error');
    }
}

/**
 * Parse duration string (e.g., "2ชม. 30นาที") to minutes
 */
function parseDurationToMinutes(durationStr) {
    const hoursMatch = durationStr.match(/(\d+)\s*ชม/);
    const minsMatch = durationStr.match(/(\d+)\s*นาที/);

    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1]) : 0;

    return (hours * 60) + mins;
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
 * Format duration in minutes to "Xชม. Yนาที"
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
 * Format total minutes to "Xชม. Yนาที"
 */
function formatHours(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} ชม. ${mins} นาที`;
}
