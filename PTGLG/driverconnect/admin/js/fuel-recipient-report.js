/**
 * Fuel Recipient Report Module
 * Reports fuel deliveries by recipient type with bubble map visualization
 */

import { supabase } from '../../shared/config.js';

// State
let reportData = {
    deliveries: [],
    stationStats: [],
    recipientTypeStats: [],
    summary: {
        totalDeliveries: 0,
        totalStations: 0,
        totalLiters: 0,
        dateRange: { start: null, end: null }
    }
};

// Map instance
let map = null;
let markers = [];

// Charts
let pieChart = null;
let barChart = null;

/**
 * Initialize the fuel recipient report module
 */
export function initFuelRecipientReport() {
    console.log('Initializing Fuel Recipient Report');

    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const startDateInput = document.getElementById('fuel-report-start-date');
    const endDateInput = document.getElementById('fuel-report-end-date');

    if (startDateInput) startDateInput.valueAsDate = startDate;
    if (endDateInput) endDateInput.valueAsDate = endDate;

    // Attach event listeners
    const loadBtn = document.getElementById('fuel-report-load-btn');
    const exportBtn = document.getElementById('fuel-report-export-btn');
    const typeFilter = document.getElementById('fuel-report-type-filter');

    if (loadBtn) loadBtn.addEventListener('click', loadReport);
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);
    if (typeFilter) typeFilter.addEventListener('change', filterTable);

    // Auto-load on init
    // loadReport();
}

/**
 * Load report data from Supabase
 */
async function loadReport() {
    const startDate = document.getElementById('fuel-report-start-date')?.value;
    const endDate = document.getElementById('fuel-report-end-date')?.value;
    const recipientTypeFilter = document.getElementById('fuel-report-recipient-type')?.value;

    if (!startDate || !endDate) {
        alert('กรุณาระบุช่วงวันที่');
        return;
    }

    // Show loading
    const loadBtn = document.getElementById('fuel-report-load-btn');
    if (loadBtn) {
        loadBtn.textContent = 'กำลังโหลด...';
        loadBtn.disabled = true;
    }

    try {
        // Query jobdata for deliveries in date range
        let query = supabase
            .from('jobdata')
            .select('*')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .not('status', 'eq', 'cancelled')
            .order('created_at', { ascending: false });

        const { data: rows, error } = await query;

        if (error) throw error;

        console.log(`📊 Loaded ${rows?.length || 0} delivery records`);

        // Process data
        processReportData(rows || [], recipientTypeFilter);

        // Update UI
        updateSummaryCards();
        initMap();
        updateCharts();
        updateTable();

    } catch (error) {
        console.error('Error loading fuel recipient report:', error);
        alert('เกิดข้อผิดพลาดในการโหลดรายงาน: ' + error.message);
    } finally {
        if (loadBtn) {
            loadBtn.textContent = 'โหลดรายงาน';
            loadBtn.disabled = false;
        }
    }
}

/**
 * Process report data - group by station and calculate stats
 */
function processReportData(rows, recipientTypeFilter) {
    // Group by ship_to_code (station)
    const stationMap = new Map();

    rows.forEach(row => {
        // Skip origin stops
        if (row.is_origin_stop) return;

        const stationCode = row.ship_to_code || 'UNKNOWN';
        const stationName = row.ship_to_name || row.destination || 'ไม่ระบุ';

        if (!stationMap.has(stationCode)) {
            stationMap.set(stationCode, {
                stationCode,
                stationName,
                deliveries: [],
                totalLiters: 0,
                deliveryCount: 0,
                lat: row.checkout_lat || null,
                lng: row.checkout_lng || null
            });
        }

        const station = stationMap.get(stationCode);
        station.deliveries.push(row);
        station.deliveryCount++;

        // Get fuel amount from process_data if available
        // Or estimate from distance
        const liters = row.fuel_liters || estimateFuelFromDistance(row.distance_km);
        station.totalLiters += liters;
    });

    // Convert to array and sort by delivery count
    const stationStats = Array.from(stationMap.values())
        .sort((a, b) => b.deliveryCount - a.deliveryCount);

    // Calculate recipient type stats
    const recipientTypeMap = new Map();
    stationStats.forEach(station => {
        // Determine type based on station code pattern or name
        const type = determineRecipientType(station.stationCode, station.stationName);
        if (!recipientTypeMap.has(type)) {
            recipientTypeMap.set(type, { type, count: 0, liters: 0 });
        }
        const typeStat = recipientTypeMap.get(type);
        typeStat.count += station.deliveryCount;
        typeStat.liters += station.totalLiters;
    });

    const recipientTypeStats = Array.from(recipientTypeMap.values());

    reportData = {
        deliveries: rows,
        stationStats,
        recipientTypeStats,
        summary: {
            totalDeliveries: rows.length,
            totalStations: stationStats.length,
            totalLiters: stationStats.reduce((sum, s) => sum + s.totalLiters, 0),
            dateRange: { start, end: endDate }
        }
    };
}

/**
 * Determine recipient type based on station code/name
 */
function determineRecipientType(code, name) {
    const upperName = name.toUpperCase();
    const upperCode = (code || '').toUpperCase();

    // PTT stations
    if (upperCode.includes('PTT') || upperName.includes('PTT')) {
        return 'PTT สถานีบริการ';
    }
    // ปตท.
    if (upperName.includes('ปตท.') || upperName.includes('ป.ต.ท.')) {
        return 'ปตท. สถานีบริการ';
    }
    // Bangchak
    if (upperCode.includes('BC') || upperName.includes('บางจาก') || upperName.includes('BC')) {
        return 'บางจาก';
    }
    // Shell
    if (upperCode.includes('S') || upperName.includes('SHELL') || upperName.includes('เชลล์')) {
        return 'Shell';
    }
    // CPF/Feed mills
    if (upperCode.includes('CPF') || upperName.includes('ฟีด') || upperName.includes('โรงสี')) {
        return 'โรงสี/ฟาร์ม';
    }
    // Customer/Direct delivery
    if (upperCode.startsWith('C') || upperName.includes('ลูกค้า')) {
        return 'ลูกค้ารายย่อย';
    }

    return 'อื่นๆ';
}

/**
 * Estimate fuel liters from distance (rough estimate)
 */
function estimateFuelFromDistance(distance) {
    if (!distance) return 0;
    // Assume ~0.3 liters per km for delivery trucks
    return Math.round(distance * 0.3);
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const { summary } = reportData;

    setElementText('fuel-total-deliveries', summary.totalDeliveries);
    setElementText('fuel-total-stations', summary.totalStations);
    setElementText('fuel-total-liters', formatNumber(summary.totalLiters) + ' ลิตร');
}

/**
 * Initialize map with bubbles
 */
function initMap() {
    const mapContainer = document.getElementById('fuel-recipient-map');
    if (!mapContainer) return;

    // Clear existing map
    if (map) {
        map.remove();
    }
    markers = [];

    // Initialize Leaflet map centered on Thailand
    map = L.map('fuel-recipient-map').setView([13.7563, 100.5018], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Add bubble markers for stations with coordinates
    const maxLiters = Math.max(...reportData.stationStats.map(s => s.totalLiters), 1);

    reportData.stationStats.forEach(station => {
        if (!station.lat || !station.lng) return;

        // Bubble size based on volume
        const radius = Math.max(10, Math.min(50, (station.totalLiters / maxLiters) * 40));

        // Color based on recipient type
        const color = getColorByType(determineRecipientType(station.stationCode, station.stationName));

        const marker = L.circleMarker([station.lat, station.lng], {
            radius: radius,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(map);

        // Popup content
        const popupContent = `
            <div style="min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px;">${station.stationName}</h3>
                <p style="margin: 4px 0;"><strong>รหัส:</strong> ${station.stationCode}</p>
                <p style="margin: 4px 0;"><strong>จำนวนครั้ง:</strong> ${station.deliveryCount}</p>
                <p style="margin: 4px 0;"><strong>ปริมาณ:</strong> ${formatNumber(station.totalLiters)} ลิตร</p>
                <p style="margin: 4px 0;"><strong>ประเภท:</strong> ${determineRecipientType(station.stationCode, station.stationName)}</p>
            </div>
        `;

        marker.bindPopup(popupContent);
        markers.push(marker);
    });

    // Fit bounds to show all markers
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * Get color by recipient type
 */
function getColorByType(type) {
    const colors = {
        'PTT สถานีบริการ': '#22c55e',
        'ปตท. สถานีบริการ': '#16a34a',
        'บางจาก': '#eab308',
        'Shell': '#f59e0b',
        'โรงสี/ฟาร์ม': '#3b82f6',
        'ลูกค้ารายย่อย': '#8b5cf6',
        'อื่นๆ': '#6b7280'
    };
    return colors[type] || '#6b7280';
}

/**
 * Update charts
 */
function updateCharts() {
    updatePieChart();
    updateBarChart();
}

/**
 * Update pie chart by recipient type
 */
function updatePieChart() {
    const ctx = document.getElementById('fuel-recipient-pie-chart')?.getContext('2d');
    if (!ctx) return;

    if (pieChart) {
        pieChart.destroy();
    }

    const labels = reportData.recipientTypeStats.map(t => t.type);
    const data = reportData.recipientTypeStats.map(t => t.liters);
    const colors = reportData.recipientTypeStats.map(t => getColorByType(t.type));

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ccc',
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percent = ((value / reportData.summary.totalLiters) * 100).toFixed(1);
                            return `${label}: ${formatNumber(value)} ลิตร (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update bar chart by station
 */
function updateBarChart() {
    const ctx = document.getElementById('fuel-recipient-bar-chart')?.getContext('2d');
    if (!ctx) return;

    if (barChart) {
        barChart.destroy();
    }

    // Top 10 stations by volume
    const topStations = reportData.stationStats.slice(0, 10);

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topStations.map(s => s.stationName),
            datasets: [{
                label: 'ปริมาณน้ำมัน (ลิตร)',
                data: topStations.map(s => s.totalLiters),
                backgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            scales: {
                x: {
                    ticks: { color: '#ccc' },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { color: '#ccc' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Update table
 */
function updateTable(filterType = 'all') {
    const tbody = document.querySelector('#fuel-recipient-table tbody');
    if (!tbody) return;

    let filteredData = reportData.stationStats;
    if (filterType !== 'all') {
        filteredData = reportData.stationStats.filter(s => {
            const type = determineRecipientType(s.stationCode, s.stationName);
            return type === filterType;
        });
    }

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #888;">
                    ไม่พบข้อมูล
                </td>
            </tr>
        `;
        return;
    }

    filteredData.forEach(station => {
        const row = tbody.insertRow();
        const type = determineRecipientType(station.stationCode, station.stationName);
        const color = getColorByType(type);

        row.insertCell().textContent = station.stationCode || '-';
        row.insertCell().innerHTML = `<strong>${station.stationName}</strong>`;
        row.insertCell().innerHTML = `<span style="color: ${color}; font-weight: 500;">${type}</span>`;
        row.insertCell().textContent = station.deliveryCount.toLocaleString();
        row.insertCell().textContent = formatNumber(station.totalLiters) + ' ลิตร';
    });
}

/**
 * Filter table based on selection
 */
function filterTable() {
    const filterType = document.getElementById('fuel-report-type-filter')?.value;
    updateTable(filterType);
}

/**
 * Export to Excel
 */
function exportToExcel() {
    if (reportData.stationStats.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก');
        return;
    }

    const headers = ['รหัสสถานี', 'ชื่อสถานี', 'ประเภทผู้รับ', 'จำนวนครั้ง', 'ปริมาณน้ำมัน(ลิตร)'];
    const csvRows = [headers.join(',')];

    reportData.stationStats.forEach(station => {
        const type = determineRecipientType(station.stationCode, station.stationName);
        const row = [
            station.stationCode || '',
            station.stationName,
            type,
            station.deliveryCount,
            station.totalLiters
        ];
        const escapedRow = row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        });
        csvRows.push(escapedRow.join(','));
    });

    // Add summary
    csvRows.push('');
    csvRows.push(['สรุปรายงานผู้รับน้ำมัน'].join(','));
    csvRows.push(['ทั้งหมด', reportData.summary.totalDeliveries, 'ครั้ง'].join(','));
    csvRows.push(['จำนวนสถานี', reportData.summary.totalStations, 'แห่ง'].join(','));
    csvRows.push(['ปริมาณรวม', formatNumber(reportData.summary.totalLiters), 'ลิตร'].join(','));

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `fuel-recipient-report-${new Date().toISOString().slice(0, 10)}.csv`;

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
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatNumber(num) {
    return Math.round(num).toLocaleString('th-TH');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFuelRecipientReport);
} else {
    initFuelRecipientReport();
}
