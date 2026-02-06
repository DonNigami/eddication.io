/**
 * Odometer Distance Comparison Report Module
 * Compares actual distance from odometer readings vs calculated distance (max * 2)
 * Grouped by reference
 */

import { supabase } from '../../shared/config.js';

// State
let reportData = {
    trips: [],
    summary: {
        totalTrips: 0,
        totalOdoDistance: 0,
        totalMaxDistance: 0,
        avgDifference: 0,
        avgDiffPercent: 0,
        overDistance: 0,
        underDistance: 0,
        exactMatch: 0
    }
};

// Chart
let scatterChart = null;
let barChart = null;

/**
 * Initialize the odometer distance comparison report module
 */
export function initOdometerDistanceComparisonReport() {
    console.log('Initializing Odometer Distance Comparison Report');

    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const startDateInput = document.getElementById('odo-report-start-date');
    const endDateInput = document.getElementById('odo-report-end-date');

    if (startDateInput) startDateInput.valueAsDate = startDate;
    if (endDateInput) endDateInput.valueAsDate = endDate;

    // Attach event listeners
    const loadBtn = document.getElementById('odo-report-load-btn');
    const exportBtn = document.getElementById('odo-report-export-btn');

    if (loadBtn) {
        loadBtn.addEventListener('click', loadReport);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }

    // Filter event listeners
    const filterType = document.getElementById('odo-report-filter-type');
    if (filterType) {
        filterType.addEventListener('change', () => updateTable());
    }

    // Load initial data
    loadReport();
}

/**
 * Load report data from Supabase
 */
async function loadReport() {
    const startDate = document.getElementById('odo-report-start-date')?.value;
    const endDate = document.getElementById('odo-report-end-date')?.value;

    if (!startDate || !endDate) {
        console.warn('Date range not specified');
        return;
    }

    // Show loading state
    const loadBtn = document.getElementById('odo-report-load-btn');
    if (loadBtn) {
        loadBtn.textContent = 'กำลังโหลด...';
        loadBtn.disabled = true;
    }

    try {
        // Query jobdata table - get all rows in date range with odometer data
        const { data: rows, error } = await supabase
            .from('jobdata')
            .select('*')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`📊 Loaded ${rows?.length || 0} records from jobdata`);

        // Process data - group by reference and calculate distances
        processReportData(rows || []);

        // Update UI
        updateSummaryCards();
        updateCharts();
        updateTable();

    } catch (error) {
        console.error('Error loading odometer comparison report:', error);
        showNotification('เกิดข้อผิดพลาดในการโหลดรายงาน: ' + error.message, 'error');
    } finally {
        if (loadBtn) {
            loadBtn.textContent = 'โหลดรายงาน';
            loadBtn.disabled = false;
        }
    }
}

/**
 * Process report data - group by reference and calculate distances
 * Logic:
 * - Actual distance: from odometer readings (end_odo - start_odo) or sum of (checkout_odo - checkin_odo)
 * - Max distance: max(distance_km) * 2 (for round trip)
 */
function processReportData(rows) {
    // Group by reference
    const tripsByReference = new Map();

    rows.forEach(row => {
        if (!row.reference) return;

        if (!tripsByReference.has(row.reference)) {
            tripsByReference.set(row.reference, {
                reference: row.reference,
                shipment_no: row.shipment_no || '',
                drivers: row.drivers || '',
                vehicle_desc: row.vehicle_desc || '',
                route: row.route || '',
                status: row.status || '',
                created_at: row.created_at,
                job_closed_at: row.job_closed_at,
                stops: [],
                distanceKmValues: []
            });
        }

        const trip = tripsByReference.get(row.reference);
        trip.stops.push(row);

        // Collect distance_km values
        if (row.distance_km && parseFloat(row.distance_km) > 0) {
            trip.distanceKmValues.push(parseFloat(row.distance_km));
        }
    });

    // Calculate distances for each trip
    const trips = Array.from(tripsByReference.values()).map(trip => {
        // Calculate actual distance from odometer
        const odoDistance = calculateOdometerDistance(trip.stops);

        // Calculate max distance (max distance_km * 2)
        const maxDistanceKm = trip.distanceKmValues.length > 0
            ? Math.max(...trip.distanceKmValues)
            : 0;
        const calculatedDistance = maxDistanceKm * 2;

        // Calculate difference
        const difference = odoDistance - calculatedDistance;
        const diffPercent = calculatedDistance > 0
            ? ((difference / calculatedDistance) * 100)
            : 0;

        // Determine category
        let category = 'exact';
        if (Math.abs(diffPercent) < 1) {
            category = 'exact';
        } else if (difference > 0) {
            category = 'over';
        } else {
            category = 'under';
        }

        return {
            ...trip,
            odoDistance,
            calculatedDistance,
            maxDistanceKm,
            difference,
            diffPercent,
            category
        };
    });

    // Calculate summary statistics
    const totalOdoDistance = trips.reduce((sum, t) => sum + (t.odoDistance || 0), 0);
    const totalMaxDistance = trips.reduce((sum, t) => sum + (t.calculatedDistance || 0), 0);
    const avgDifference = trips.length > 0
        ? trips.reduce((sum, t) => sum + (t.difference || 0), 0) / trips.length
        : 0;
    const avgDiffPercent = trips.length > 0
        ? trips.reduce((sum, t) => sum + (t.diffPercent || 0), 0) / trips.length
        : 0;

    const overDistance = trips.filter(t => t.category === 'over').length;
    const underDistance = trips.filter(t => t.category === 'under').length;
    const exactMatch = trips.filter(t => t.category === 'exact').length;

    reportData = {
        trips: trips,
        summary: {
            totalTrips: trips.length,
            totalOdoDistance: Math.round(totalOdoDistance),
            totalMaxDistance: Math.round(totalMaxDistance),
            avgDifference: Math.round(avgDifference * 10) / 10,
            avgDiffPercent: Math.round(avgDiffPercent * 10) / 10,
            overDistance,
            underDistance,
            exactMatch
        }
    };

    console.log('📊 Processed odometer comparison data:', reportData.summary);
}

/**
 * Calculate actual distance from odometer readings
 * Logic: Collect all odometer readings (checkin_odo and checkout_odo) from all stops,
 * sort them chronologically by timestamp, and calculate the total distance from
 * first reading to last reading (simulating what the driver actually traveled)
 *
 * Priority:
 * 1. Use end_odo (final odometer when trip ended) - first checkin_odo (starting point)
 * 2. If no end_odo, use last checkout_odo - first checkin_odo
 * 3. If no valid above, calculate cumulative distance from sequential odometer readings
 */
function calculateOdometerDistance(stops) {
    if (!stops || stops.length === 0) return 0;

    // Collect all odometer events with timestamps
    const odoEvents = [];

    stops.forEach(stop => {
        // Check-in event
        if (stop.checkin_odo && stop.checkin_odo > 0) {
            odoEvents.push({
                odo: stop.checkin_odo,
                time: stop.checkin_time || stop.created_at,
                type: 'checkin',
                seq: stop.seq || 0
            });
        }
        // Check-out event
        if (stop.checkout_odo && stop.checkout_odo > 0) {
            odoEvents.push({
                odo: stop.checkout_odo,
                time: stop.checkout_time || stop.created_at,
                type: 'checkout',
                seq: stop.seq || 0
            });
        }
    });

    // Also check for end_odo (final reading when trip ended)
    const endOdoStop = stops.find(s => s.end_odo && s.end_odo > 0);
    if (endOdoStop) {
        odoEvents.push({
            odo: endOdoStop.end_odo,
            time: endOdoStop.job_closed_at || endOdoStop.updated_at || new Date().toISOString(),
            type: 'end',
            seq: 9999 // Highest priority for end
        });
    }

    if (odoEvents.length < 2) {
        return 0; // Need at least 2 readings to calculate distance
    }

    // Sort by sequence first, then by time
    odoEvents.sort((a, b) => {
        if (a.seq !== b.seq) return a.seq - b.seq;
        return new Date(a.time) - new Date(b.time);
    });

    // Remove duplicates (same or very close odometer values from same time)
    const uniqueEvents = [];
    odoEvents.forEach(event => {
        const lastEvent = uniqueEvents[uniqueEvents.length - 1];
        if (!lastEvent || Math.abs(event.odo - lastEvent.odo) > 0.1) {
            uniqueEvents.push(event);
        }
    });

    // Method 1: If we have end_odo, use it as final reading
    if (endOdoStop && endOdoStop.end_odo > 0) {
        const firstReading = uniqueEvents[0]?.odo;
        const lastReading = endOdoStop.end_odo;

        if (firstReading && lastReading > firstReading) {
            const distance = lastReading - firstReading;
            // Validate: distance should be reasonable (< 2000 km)
            if (distance > 0 && distance < 2000) {
                console.log(`📏 Odo distance (end_odo method): ${distance} km (from ${firstReading} to ${lastReading})`);
                return Math.round(distance);
            }
        }
    }

    // Method 2: Use last checkout - first checkin (chronologically ordered)
    const firstReading = uniqueEvents[0]?.odo;
    const lastReading = uniqueEvents[uniqueEvents.length - 1]?.odo;

    if (firstReading && lastReading && lastReading > firstReading) {
        const distance = lastReading - firstReading;
        // Validate: distance should be reasonable
        if (distance > 0 && distance < 2000) {
            console.log(`📏 Odo distance (chronological method): ${distance} km (from ${firstReading} to ${lastReading})`);
            return Math.round(distance);
        }
    }

    // Method 3: Calculate cumulative distance from sequential legs
    // Sum up each leg distance where odometer increased
    let cumulativeDistance = 0;
    for (let i = 0; i < uniqueEvents.length - 1; i++) {
        const current = uniqueEvents[i];
        const next = uniqueEvents[i + 1];

        // Only count forward movement (odometer should only increase)
        if (next.odo > current.odo) {
            const legDistance = next.odo - current.odo;
            // Validate leg distance
            if (legDistance > 0 && legDistance < 500) {
                cumulativeDistance += legDistance;
            }
        }
    }

    if (cumulativeDistance > 0) {
        console.log(`📏 Odo distance (cumulative method): ${cumulativeDistance} km`);
        return Math.round(cumulativeDistance);
    }

    return 0;
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const { summary } = reportData;

    setTextContent('odo-total-trips', summary.totalTrips);
    setTextContent('odo-total-odo-km', formatNumber(summary.totalOdoDistance) + ' km');
    setTextContent('odo-total-calc-km', formatNumber(summary.totalMaxDistance) + ' km');

    const diffElement = document.getElementById('odo-avg-diff');
    if (diffElement) {
        const sign = summary.avgDifference >= 0 ? '+' : '';
        diffElement.textContent = `${sign}${summary.avgDifference} km`;
        diffElement.style.color = summary.avgDifference > 0 ? '#22c55e' :
                                  summary.avgDifference < 0 ? '#ef4444' : '#fff';
    }

    const diffPercentElement = document.getElementById('odo-avg-diff-percent');
    if (diffPercentElement) {
        const sign = summary.avgDiffPercent >= 0 ? '+' : '';
        diffPercentElement.textContent = `(${sign}${summary.avgDiffPercent}%)`;
    }

    setTextContent('odo-over-count', summary.overDistance);
    setTextContent('odo-under-count', summary.underDistance);
    setTextContent('odo-exact-count', summary.exactMatch);

    // Update percentages
    const total = summary.totalTrips || 1;
    setTextContent('odo-over-percent', Math.round((summary.overDistance / total) * 100) + '%');
    setTextContent('odo-under-percent', Math.round((summary.underDistance / total) * 100) + '%');
    setTextContent('odo-exact-percent', Math.round((summary.exactMatch / total) * 100) + '%');
}

/**
 * Update charts
 */
function updateCharts() {
    updateScatterChart();
    updateBarChart();
}

/**
 * Update scatter chart (Odometer vs Calculated)
 */
function updateScatterChart() {
    const ctx = document.getElementById('odo-scatter-chart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (scatterChart) {
        scatterChart.destroy();
    }

    // Prepare data points
    const dataPoints = reportData.trips.map(trip => ({
        x: trip.calculatedDistance || 0,
        y: trip.odoDistance || 0,
        reference: trip.reference,
        difference: trip.difference || 0
    }));

    // Filter out trips with no data
    const validPoints = dataPoints.filter(p => p.x > 0 || p.y > 0);

    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Reference Trips',
                data: validPoints,
                backgroundColor: validPoints.map(p => {
                    if (p.difference > 10) return '#22c55e'; // Over - green
                    if (p.difference < -10) return '#ef4444'; // Under - red
                    return '#3b82f6'; // Close - blue
                }),
                pointRadius: 8,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Calculated Distance (km)',
                        color: '#ccc'
                    },
                    ticks: { color: '#ccc' },
                    grid: { color: '#444' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Odometer Distance (km)',
                        color: '#ccc'
                    },
                    ticks: { color: '#ccc' },
                    grid: { color: '#444' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `Ref: ${point.reference}`,
                                `Calculated: ${point.x.toFixed(1)} km`,
                                `Odometer: ${point.y.toFixed(1)} km`,
                                `Diff: ${point.difference.toFixed(1)} km`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update bar chart (Difference categories)
 */
function updateBarChart() {
    const ctx = document.getElementById('odo-diff-bar-chart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (barChart) {
        barChart.destroy();
    }

    const { summary } = reportData;

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['มากกว่า (Over)', ('น้อยกว่า (Under)'), 'ตรง (Exact)'],
            datasets: [{
                label: 'จำนวนเที่ยว',
                data: [summary.overDistance, summary.underDistance, summary.exactMatch],
                backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    ticks: { color: '#ccc' },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: '#ccc' },
                    grid: { color: '#444' },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const total = summary.totalTrips || 1;
                            const percent = ((value / total) * 100).toFixed(1);
                            return `${value} เที่ยว (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update table
 */
function updateTable() {
    const tbody = document.querySelector('#odo-comparison-table tbody');
    if (!tbody) return;

    const filterType = document.getElementById('odo-report-filter-type')?.value || 'all';

    // Filter data based on selection
    let filteredTrips = reportData.trips;
    if (filterType === 'over') {
        filteredTrips = reportData.trips.filter(t => t.category === 'over');
    } else if (filterType === 'under') {
        filteredTrips = reportData.trips.filter(t => t.category === 'under');
    } else if (filterType === 'exact') {
        filteredTrips = reportData.trips.filter(t => t.category === 'exact');
    }

    tbody.innerHTML = '';

    if (filteredTrips.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 20px; color: #888;">
                    ไม่พบข้อมูล
                </td>
            </tr>
        `;
        return;
    }

    // Sort by difference (largest first)
    filteredTrips.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    filteredTrips.forEach(trip => {
        const row = tbody.insertRow();

        // Format date
        const date = new Date(trip.created_at);
        const dateStr = date.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });

        // Category badge
        const categoryBadges = {
            'over': '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">มากกว่า</span>',
            'under': '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">น้อยกว่า</span>',
            'exact': '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">ตรง</span>'
        };

        // Difference badge with color
        const diffSign = trip.difference >= 0 ? '+' : '';
        const diffColor = trip.difference > 10 ? '#22c55e' :
                         trip.difference < -10 ? '#ef4444' : '#888';
        const diffHtml = `<span style="color: ${diffColor}; font-weight: bold;">${diffSign}${trip.difference.toFixed(1)} km</span>`;

        row.insertCell().textContent = dateStr;
        row.insertCell().innerHTML = `<strong>${trip.reference || '-'}</strong>`;
        row.insertCell().textContent = trip.shipment_no || '-';
        row.insertCell().textContent = trip.drivers || '-';
        row.insertCell().textContent = trip.vehicle_desc || '-';
        row.insertCell().textContent = trip.maxDistanceKm > 0 ? trip.maxDistanceKm.toFixed(1) : '-';
        row.insertCell().textContent = trip.calculatedDistance > 0 ? trip.calculatedDistance.toFixed(1) : '-';
        row.insertCell().textContent = trip.odoDistance > 0 ? trip.odoDistance.toFixed(1) : '-';
        row.insertCell().innerHTML = diffHtml;
        row.insertCell().innerHTML = categoryBadges[trip.category] || '-';
    });

    // Update trip count
    const countElement = document.getElementById('odo-trip-count');
    if (countElement) {
        countElement.textContent = `${filteredTrips.length} เที่ยว`;
    }
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
    const headers = [
        'วันที่',
        'Reference',
        'Shipment No.',
        'คนขับ',
        'รถ',
        'Max Distance (km)',
        'Calculated Distance (max*2)',
        'Odometer Distance',
        'Difference (km)',
        'Difference (%)',
        'Category'
    ];
    const csvRows = [headers.join(',')];

    reportData.trips.forEach(trip => {
        const date = new Date(trip.created_at);
        const dateStr = date.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });

        const categoryLabels = {
            'over': 'มากกว่า',
            'under': 'น้อยกว่า',
            'exact': 'ตรง'
        };

        const row = [
            dateStr,
            trip.reference || '',
            trip.shipment_no || '',
            trip.drivers || '',
            trip.vehicle_desc || '',
            trip.maxDistanceKm || 0,
            trip.calculatedDistance || 0,
            trip.odoDistance || 0,
            trip.difference?.toFixed(2) || 0,
            trip.diffPercent?.toFixed(2) || 0,
            categoryLabels[trip.category] || ''
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
    const { summary } = reportData;
    csvRows.push('');
    csvRows.push(['สรุปรายงาน', '', '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['จำนวนเที่ยวทั้งหมด', summary.totalTrips, '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['ระยะทาง Odometer รวม (km)', summary.totalOdoDistance, '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['ระยะทางคำนวณรวม (km)', summary.totalMaxDistance, '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['ความแตกต่างเฉลี่ย (km)', summary.avgDifference, '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['มากกว่า (เที่ยว)', summary.overDistance, '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['น้อยกว่า (เที่ยว)', summary.underDistance, '', '', '', '', '', '', '', '', ''].join(','));
    csvRows.push(['ตรง (เที่ยว)', summary.exactMatch, '', '', '', '', '', '', '', '', ''].join(','));

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Thai character support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `odometer-distance-comparison-${new Date().toISOString().slice(0, 10)}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Utility functions
 */
function setTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function showNotification(message, type = 'info') {
    // Simple notification - could be enhanced
    console.log(`[${type.toUpperCase()}] ${message}`);
}
