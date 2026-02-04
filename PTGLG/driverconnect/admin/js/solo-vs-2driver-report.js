/**
 * Solo vs 2-Driver Trip Report Module
 * Reports trips with solo drivers vs 2 drivers, grouped by unique reference
 */

import { supabase } from '../../shared/config.js';

// State
let reportData = {
    trips: [],
    soloTrips: [],
    twoDriverTrips: [],
    summary: {
        total: 0,
        solo: 0,
        twoDriver: 0
    }
};

// Charts
let pieChart = null;
let barChart = null;

/**
 * Initialize the report module
 */
export function initSoloVs2DriverReport() {
    console.log('Initializing Solo vs 2-Driver Report');

    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    document.getElementById('solo-report-start-date').valueAsDate = startDate;
    document.getElementById('solo-report-end-date').valueAsDate = endDate;

    // Load drivers filter
    loadDriversFilter();

    // Attach event listeners
    document.getElementById('solo-report-load-btn').addEventListener('click', loadReport);
    document.getElementById('solo-report-export-btn').addEventListener('click', exportToExcel);
    document.getElementById('solo-report-filter-type').addEventListener('change', filterTable);
}

/**
 * Load drivers for filter dropdown
 */
async function loadDriversFilter() {
    try {
        const { data: drivers } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name');

        const driverSelect = document.getElementById('solo-report-driver-filter');
        // Clear existing options except first
        while (driverSelect.options.length > 1) {
            driverSelect.remove(1);
        }

        if (drivers) {
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.user_id;
                option.textContent = driver.display_name || driver.user_id;
                driverSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading drivers:', error);
    }
}

/**
 * Load report data
 */
async function loadReport() {
    const startDate = document.getElementById('solo-report-start-date').value;
    const endDate = document.getElementById('solo-report-end-date').value;
    const driverFilter = document.getElementById('solo-report-driver-filter').value;

    if (!startDate || !endDate) {
        alert('กรุณาระบุช่วงวันที่');
        return;
    }

    // Show loading
    const loadBtn = document.getElementById('solo-report-load-btn');
    loadBtn.textContent = 'กำลังโหลด...';
    loadBtn.disabled = true;

    try {
        // Query jobdata table - get all rows in date range
        let query = supabase
            .from('jobdata')
            .select('*')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .order('created_at', { ascending: false });

        if (driverFilter) {
            query = query.ilike('drivers', `%${driverFilter}%`);
        }

        const { data: rows, error } = await query;

        if (error) throw error;

        console.log(`📊 Loaded ${rows?.length || 0} records from jobdata`);

        // Process data - group by reference and count drivers
        processReportData(rows || []);

        // Update UI
        updateSummaryCards();
        updateCharts();
        updateTable();

    } catch (error) {
        console.error('Error loading report:', error);
        alert('เกิดข้อผิดพลาดในการโหลดรายงาน: ' + error.message);
    } finally {
        loadBtn.textContent = 'โหลดรายงาน';
        loadBtn.disabled = false;
    }
}

/**
 * Process report data - group by reference and determine solo vs 2-driver
 */
function processReportData(rows) {
    // Group by reference
    const tripsByReference = new Map();

    rows.forEach(row => {
        if (!row.reference) return;

        if (!tripsByReference.has(row.reference)) {
            tripsByReference.set(row.reference, {
                reference: row.reference,
                shipment_no: row.shipment_no,
                drivers: row.drivers || '',
                vehicle_desc: row.vehicle_desc || '',
                route: row.route || '',
                status: row.status || '',
                created_at: row.created_at,
                job_closed_at: row.job_closed_at,
                stops: []
            });
        }

        tripsByReference.get(row.reference).stops.push(row);
    });

    // Determine if solo or 2-driver based on drivers field
    // drivers field contains comma-separated names like "Driver1" or "Driver1,Driver2"
    const trips = Array.from(tripsByReference.values());
    const soloTrips = [];
    const twoDriverTrips = [];

    trips.forEach(trip => {
        const driverCount = countDrivers(trip.drivers);
        trip.driverCount = driverCount;
        trip.driverType = driverCount === 1 ? 'solo' : '2driver';

        if (driverCount === 1) {
            soloTrips.push(trip);
        } else if (driverCount === 2) {
            twoDriverTrips.push(trip);
        }
        // If more than 2, still count as 2-driver category
        else if (driverCount > 2) {
            trip.driverType = 'multi';
            twoDriverTrips.push(trip);
        }
    });

    reportData = {
        trips: trips,
        soloTrips: soloTrips,
        twoDriverTrips: twoDriverTrips,
        summary: {
            total: trips.length,
            solo: soloTrips.length,
            twoDriver: twoDriverTrips.length
        }
    };

    console.log('📊 Processed data:', {
        total: reportData.summary.total,
        solo: reportData.summary.solo,
        twoDriver: reportData.summary.twoDriver
    });
}

/**
 * Count drivers from comma-separated string
 */
function countDrivers(driversStr) {
    if (!driversStr || driversStr.trim() === '') return 0;
    const drivers = driversStr.split(',').filter(d => d.trim());
    return drivers.length;
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const { summary } = reportData;

    document.getElementById('solo-total-trips').textContent = summary.total;
    document.getElementById('solo-solo-count').textContent = summary.solo;
    document.getElementById('solo-2driver-count').textContent = summary.twoDriver;

    // Calculate percentages
    const soloPercent = summary.total > 0 ? ((summary.solo / summary.total) * 100).toFixed(1) : 0;
    const twoDriverPercent = summary.total > 0 ? ((summary.twoDriver / summary.total) * 100).toFixed(1) : 0;

    document.getElementById('solo-solo-percent').textContent = `${soloPercent}%`;
    document.getElementById('solo-2driver-percent').textContent = `${twoDriverPercent}%`;

    // Calculate ratio
    let ratio = '0:1';
    if (summary.solo > 0) {
        const ratioValue = (summary.twoDriver / summary.solo).toFixed(2);
        ratio = `${ratioValue}:1`;
    } else if (summary.twoDriver > 0) {
        ratio = '1:0';
    }
    document.getElementById('solo-ratio').textContent = ratio;
}

/**
 * Update charts
 */
function updateCharts() {
    updatePieChart();
    updateBarChart();
}

/**
 * Update pie chart
 */
function updatePieChart() {
    const ctx = document.getElementById('solo-2driver-pie-chart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (pieChart) {
        pieChart.destroy();
    }

    const { summary } = reportData;

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['วิ่งคนเดียว', 'วิ่งสองคน'],
            datasets: [{
                data: [summary.solo, summary.twoDriver],
                backgroundColor: ['#22c55e', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ccc',
                        padding: 20,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = summary.total || 1;
                            const percent = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} เที่ยว (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update bar chart by driver
 */
function updateBarChart() {
    const ctx = document.getElementById('solo-2driver-bar-chart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (barChart) {
        barChart.destroy();
    }

    // Count trips by driver
    const driverStats = new Map();

    reportData.trips.forEach(trip => {
        const drivers = trip.drivers.split(',').filter(d => d.trim());
        drivers.forEach(driver => {
            if (!driverStats.has(driver)) {
                driverStats.set(driver, { solo: 0, twoDriver: 0, total: 0 });
            }
            const stats = driverStats.get(driver);
            stats.total++;
            if (trip.driverType === 'solo') {
                stats.solo++;
            } else {
                stats.twoDriver++;
            }
        });
    });

    // Sort by total trips
    const sortedDrivers = Array.from(driverStats.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10); // Top 10

    const labels = sortedDrivers.map(d => d[0]);
    const soloData = sortedDrivers.map(d => d[1].solo);
    const twoDriverData = sortedDrivers.map(d => d[1].twoDriver);

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'วิ่งคนเดียว',
                    data: soloData,
                    backgroundColor: '#22c55e'
                },
                {
                    label: 'วิ่งสองคน',
                    data: twoDriverData,
                    backgroundColor: '#3b82f6'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#ccc'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    ticks: {
                        color: '#ccc'
                    },
                    grid: {
                        color: '#444'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ccc',
                        padding: 20
                    }
                }
            }
        }
    });
}

/**
 * Update table
 */
function updateTable(filterType = 'all') {
    const tbody = document.querySelector('#solo-2driver-table tbody');
    if (!tbody) return;

    // Filter data based on selection
    let filteredTrips = reportData.trips;
    if (filterType === 'solo') {
        filteredTrips = reportData.soloTrips;
    } else if (filterType === '2driver') {
        filteredTrips = reportData.twoDriverTrips;
    }

    tbody.innerHTML = '';

    if (filteredTrips.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 20px; color: #888;">
                    ไม่พบข้อมูล
                </td>
            </tr>
        `;
        return;
    }

    filteredTrips.forEach(trip => {
        const row = tbody.insertRow();

        // Format date
        const date = new Date(trip.created_at);
        const dateStr = date.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });

        // Driver type badge
        const driverTypeBadge = trip.driverType === 'solo'
            ? '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">1 คน</span>'
            : '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">2 คน</span>';

        // Status badge
        const statusColors = {
            'pending': '#f59e0b',
            'checkin': '#3b82f6',
            'checkout': '#8b5cf6',
            'completed': '#22c55e',
            'cancelled': '#ef4444'
        };
        const statusColor = statusColors[trip.status] || '#6b7280';
        const statusBadge = trip.status
            ? `<span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">${trip.status}</span>`
            : '-';

        row.insertCell().textContent = dateStr;
        row.insertCell().innerHTML = `<strong>${trip.reference || '-'}</strong>`;
        row.insertCell().textContent = trip.shipment_no || '-';
        row.insertCell().textContent = trip.drivers || '-';
        row.insertCell().textContent = trip.vehicle_desc || '-';
        row.insertCell().innerHTML = driverTypeBadge;
        row.insertCell().innerHTML = statusBadge;
        row.insertCell().textContent = trip.route || '-';
    });
}

/**
 * Filter table based on dropdown selection
 */
function filterTable() {
    const filterType = document.getElementById('solo-report-filter-type').value;
    updateTable(filterType);
}

/**
 * Export to Excel
 */
function exportToExcel() {
    if (reportData.trips.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก');
        return;
    }

    // Create CSV content
    const headers = ['วันที่', 'Reference', 'Shipment No.', 'คนขับ', 'รถ', 'จำนวนคนขับ', 'สถานะ', 'เส้นทาง'];
    const csvRows = [headers.join(',')];

    reportData.trips.forEach(trip => {
        const date = new Date(trip.created_at);
        const dateStr = date.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });

        const row = [
            dateStr,
            trip.reference || '',
            trip.shipment_no || '',
            trip.drivers || '',
            trip.vehicle_desc || '',
            trip.driverCount,
            trip.status || '',
            trip.route || ''
        ];

        // Escape commas and quotes
        const escapedRow = row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        });

        csvRows.push(escapedRow.join(','));
    });

    // Add summary at the end
    csvRows.push('');
    csvRows.push(['', '', '', 'สรุป', '', '', '', ''].join(','));
    csvRows.push(['', '', '', 'ทั้งหมด', reportData.summary.total, '', '', ''].join(','));
    csvRows.push(['', '', '', 'วิ่งคนเดียว', reportData.summary.solo, '', '', ''].join(','));
    csvRows.push(['', '', '', 'วิ่งสองคน', reportData.summary.twoDriver, '', '', ''].join(','));

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Thai character support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `solo-vs-2driver-report-${new Date().toISOString().slice(0, 10)}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
