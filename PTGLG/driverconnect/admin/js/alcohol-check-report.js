/**
 * Alcohol Check Report Module
 * Reports alcohol test results with map visualization
 */

import { supabase } from '../../shared/config.js';

// State
let reportData = {
    checks: [],
    driverStats: [],
    summary: {
        totalCount: 0,
        totalDrivers: 0,
        avgValue: 0,
        maxValue: 0,
        dateRange: { start: null, end: null }
    }
};

// Map instance
let map = null;
let markers = [];

// Current filter state
let currentFilters = {
    driverSearch: '',
    refSearch: '',
    resultFilter: 'all'
};

/**
 * Initialize the alcohol check report module
 */
export function initAlcoholCheckReport() {
    console.log('Initializing Alcohol Check Report');

    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const startDateInput = document.getElementById('alcohol-report-start-date');
    const endDateInput = document.getElementById('alcohol-report-end-date');

    if (startDateInput) startDateInput.valueAsDate = startDate;
    if (endDateInput) endDateInput.valueAsDate = endDate;

    // Attach event listeners
    const loadBtn = document.getElementById('alcohol-report-load-btn');
    const exportBtn = document.getElementById('alcohol-report-export-btn');
    const driverSearch = document.getElementById('alcohol-report-driver-search');
    const refSearch = document.getElementById('alcohol-report-ref-search');

    if (loadBtn) loadBtn.addEventListener('click', loadReport);
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);
    if (driverSearch) driverSearch.addEventListener('input', handleSearch);
    if (refSearch) refSearch.addEventListener('input', handleSearch);

    // Quick date buttons
    const quickDateBtns = document.querySelectorAll('.alcohol-quick-date-btn');
    quickDateBtns.forEach(btn => {
        btn.addEventListener('click', handleQuickDateClick);
    });

    // Result filter buttons
    const resultFilterBtns = document.querySelectorAll('.alcohol-result-filter-btn');
    resultFilterBtns.forEach(btn => {
        btn.addEventListener('click', handleResultFilterClick);
    });

    // Make loadReport globally accessible for refresh button
    window.loadAlcoholCheckReport = loadReport;
}

/**
 * Handle quick date button click
 */
function handleQuickDateClick(e) {
    const btn = e.target;
    const range = btn.dataset.range;

    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
        case 'today':
            // Start and end are same day
            startDate.setDate(endDate.getDate());
            break;
        case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case 'month':
            startDate.setDate(endDate.getDate() - 30);
            break;
    }

    const startDateInput = document.getElementById('alcohol-report-start-date');
    const endDateInput = document.getElementById('alcohol-report-end-date');

    if (startDateInput) startDateInput.valueAsDate = startDate;
    if (endDateInput) endDateInput.valueAsDate = endDate;

    // Auto-load report
    loadReport();
}

/**
 * Handle search input
 */
function handleSearch() {
    currentFilters.driverSearch = document.getElementById('alcohol-report-driver-search')?.value?.toLowerCase() || '';
    currentFilters.refSearch = document.getElementById('alcohol-report-ref-search')?.value?.toLowerCase() || '';
    updateTable();
}

/**
 * Handle result filter button click
 */
function handleResultFilterClick(e) {
    const btn = e.target;

    // Update active state
    document.querySelectorAll('.alcohol-result-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'var(--card-bg)';
        b.style.color = b.style.borderColor || 'var(--text-color)';
    });

    btn.classList.add('active');

    // Set active button style
    const filterType = btn.dataset.resultFilter;
    if (filterType === 'all') {
        btn.style.background = 'var(--primary-color)';
        btn.style.color = 'white';
    } else {
        const colorMap = {
            'pass': '#22c55e',
            'fail': '#ef4444'
        };
        btn.style.background = colorMap[filterType];
        btn.style.color = 'white';
    }

    currentFilters.resultFilter = filterType;
    updateTable();
    updateMap();
}

/**
 * Load report data from Supabase
 */
async function loadReport() {
    const startDate = document.getElementById('alcohol-report-start-date')?.value;
    const endDate = document.getElementById('alcohol-report-end-date')?.value;

    if (!startDate || !endDate) {
        alert('กรุณาระบุช่วงวันที่');
        return;
    }

    // Show loading
    const loadBtn = document.getElementById('alcohol-report-load-btn');
    if (loadBtn) {
        loadBtn.textContent = 'กำลังโหลด...';
        loadBtn.disabled = true;
    }

    try {
        // Query driver_alcohol_checks table
        // Use checked_at column for date filtering
        let query = supabase
            .from('driver_alcohol_checks')
            .select('*')
            .gte('checked_at', startDate + 'T00:00:00')
            .lte('checked_at', endDate + 'T23:59:59')
            .order('checked_at', { ascending: false });

        const { data: rows, error } = await query;

        if (error) throw error;

        console.log(`🍺 Loaded ${rows?.length || 0} alcohol check records`);

        // Process data
        processReportData(rows || [], { startDate, endDate });

        // Update UI
        updateSummaryCards();
        updateMap();
        updateTable();

    } catch (error) {
        console.error('Error loading alcohol check report:', error);
        alert('เกิดข้อผิดพลาดในการโหลดรายงาน: ' + error.message);
    } finally {
        if (loadBtn) {
            loadBtn.textContent = 'โหลดรายงาน';
            loadBtn.disabled = false;
        }
    }
}

/**
 * Process report data - calculate stats and group by driver
 */
function processReportData(rows, { startDate, endDate } = {}) {
    // Group by driver_name
    const driverMap = new Map();

    rows.forEach(row => {
        const driverName = row.driver_name || 'ไม่ระบุ';

        // Extract lat/lng from location JSONB if available
        let lat = null;
        let lng = null;
        if (row.location) {
            if (typeof row.location === 'object') {
                lat = row.location.lat || null;
                lng = row.location.lng || null;
            } else if (typeof row.location === 'string') {
                try {
                    const loc = JSON.parse(row.location);
                    lat = loc.lat || null;
                    lng = loc.lng || null;
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
        // Store lat/lng in row for later use
        row._lat = lat;
        row._lng = lng;

        if (!driverMap.has(driverName)) {
            driverMap.set(driverName, {
                driverName,
                checks: [],
                totalCount: 0,
                avgValue: 0,
                maxValue: 0,
                lat: lat,
                lng: lng
            });
        }

        const driver = driverMap.get(driverName);
        driver.checks.push(row);
        driver.totalCount++;

        const value = row.alcohol_value || 0;
        if (value > driver.maxValue) {
            driver.maxValue = value;
        }

        // Update coordinates if available
        if (lat && lng) {
            driver.lat = lat;
            driver.lng = lng;
        }
    });

    // Calculate averages
    driverMap.forEach(driver => {
        const sum = driver.checks.reduce((s, c) => s + (c.alcohol_value || 0), 0);
        driver.avgValue = driver.totalCount > 0 ? sum / driver.totalCount : 0;
    });

    // Convert to array and sort by count
    const driverStats = Array.from(driverMap.values())
        .sort((a, b) => b.totalCount - a.totalCount);

    // Calculate summary stats
    const allValues = rows.map(r => r.alcohol_value || 0).filter(v => v > 0);
    const avgValue = allValues.length > 0
        ? allValues.reduce((s, v) => s + v, 0) / allValues.length
        : 0;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;

    reportData = {
        checks: rows,
        driverStats,
        summary: {
            totalCount: rows.length,
            totalDrivers: driverMap.size,
            avgValue: avgValue,
            maxValue: maxValue,
            dateRange: { start: startDate, end: endDate }
        }
    };
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const { summary } = reportData;

    setElementText('alcohol-total-count', summary.totalCount.toLocaleString());
    setElementText('alcohol-total-drivers', summary.totalDrivers.toLocaleString());
    setElementText('alcohol-avg-value', formatAlcoholValue(summary.avgValue));
    setElementText('alcohol-max-value', formatAlcoholValue(summary.maxValue));
}

/**
 * Initialize map with markers
 */
function updateMap() {
    const mapContainer = document.getElementById('alcohol-check-map');
    if (!mapContainer) return;

    // Clear existing map
    if (map) {
        map.remove();
    }
    markers = [];

    // Initialize Leaflet map centered on Thailand
    map = L.map('alcohol-check-map').setView([13.7563, 100.5018], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Filter checks based on current filters
    let checksToShow = filterChecks();

    // Add markers for checks with coordinates
    checksToShow.forEach(check => {
        if (!check._lat || !check._lng) return;

        const value = check.alcohol_value || 0;
        const isPass = isPassingValue(value);
        const color = isPass ? '#22c55e' : '#ef4444';

        const marker = L.circleMarker([check._lat, check._lng], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        // Popup content
        const popupContent = `
            <div style="min-width: 220px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px;">${check.driver_name || 'ไม่ระบุ'}</h3>
                <p style="margin: 4px 0;"><strong>วันที่:</strong> ${formatDateTime(check.checked_at)}</p>
                <p style="margin: 4px 0;"><strong>เลขที่:</strong> ${check.reference || '-'}</p>
                <p style="margin: 4px 0;"><strong>ค่าแอลกอฮอล์:</strong> <span style="color: ${color}; font-weight: bold;">${formatAlcoholValue(value)}</span></p>
                <p style="margin: 4px 0;"><strong>ผล:</strong> ${isPass ? '✅ ผ่าน' : '❌ ไม่ผ่าน'}</p>
                ${check.image_url ? `<p style="margin: 4px 0;"><a href="${check.image_url}" target="_blank">ดูรูปภาพ</a></p>` : ''}
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
 * Filter checks based on current filters
 */
function filterChecks() {
    let filtered = reportData.checks;

    // Apply driver name search
    if (currentFilters.driverSearch) {
        filtered = filtered.filter(c => {
            const name = (c.driver_name || '').toLowerCase();
            return name.includes(currentFilters.driverSearch);
        });
    }

    // Apply reference search
    if (currentFilters.refSearch) {
        filtered = filtered.filter(c => {
            const ref = (c.reference || '').toLowerCase();
            return ref.includes(currentFilters.refSearch);
        });
    }

    // Apply result filter
    if (currentFilters.resultFilter !== 'all') {
        filtered = filtered.filter(c => {
            const value = c.alcohol_value || 0;
            const isPass = isPassingValue(value);
            return currentFilters.resultFilter === 'pass' ? isPass : !isPass;
        });
    }

    return filtered;
}

/**
 * Update table
 */
function updateTable() {
    const tbody = document.querySelector('#alcohol-check-table tbody');
    if (!tbody) return;

    const filteredData = filterChecks();

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #888;">
                    ไม่พบข้อมูล
                </td>
            </tr>
        `;
        return;
    }

    filteredData.forEach(check => {
        const row = tbody.insertRow();

        const value = check.alcohol_value || 0;
        const isPass = isPassingValue(value);
        const color = isPass ? '#22c55e' : '#ef4444';
        const resultText = isPass ? '✅ ผ่าน' : '❌ ไม่ผ่าน';

        // Date/Time
        row.insertCell().textContent = formatDateTime(check.checked_at);

        // Driver Name
        row.insertCell().textContent = check.driver_name || '-';

        // Reference
        row.insertCell().textContent = check.reference || '-';

        // Alcohol Value
        const valueCell = row.insertCell();
        valueCell.innerHTML = `<span style="color: ${color}; font-weight: bold;">${formatAlcoholValue(value)}</span>`;

        // Result
        const resultCell = row.insertCell();
        resultCell.innerHTML = `<span style="color: ${color}; font-weight: 500;">${resultText}</span>`;

        // Coordinates
        const coordCell = row.insertCell();
        if (check._lat && check._lng) {
            coordCell.innerHTML = `<small>${check._lat.toFixed(5)}, ${check._lng.toFixed(5)}</small>`;
        } else {
            coordCell.textContent = '-';
        }

        // Image
        const imgCell = row.insertCell();
        if (check.image_url) {
            const imgLink = document.createElement('a');
            imgLink.href = check.image_url;
            imgLink.target = '_blank';
            imgLink.textContent = '📷 ดูรูป';
            imgLink.style.color = 'var(--primary-color)';
            imgLink.style.textDecoration = 'none';
            imgCell.appendChild(imgLink);
        } else {
            imgCell.textContent = '-';
        }
    });
}

/**
 * Check if alcohol value is passing (threshold: 0.5 mg/L or 50 mg/100mL)
 */
function isPassingValue(value) {
    // Standard threshold is 0.50 mg/L (or 0.05% BAC)
    return value < 0.5;
}

/**
 * Format alcohol value for display
 */
function formatAlcoholValue(value) {
    return (value || 0).toFixed(3) + ' mg/L';
}

/**
 * Format date/time for display
 */
function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Export to Excel
 */
function exportToExcel() {
    const filteredData = filterChecks();

    if (filteredData.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก');
        return;
    }

    const headers = ['วันที่/เวลา', 'ชื่อคนขับ', 'เลขที่เอกสาร', 'ค่าแอลกอฮอล์ (mg/L)', 'ผล', 'ละติจูด', 'ลองจิจูด', 'รูปภาพ'];
    const csvRows = [headers.join(',')];

    filteredData.forEach(check => {
        const value = check.alcohol_value || 0;
        const isPass = isPassingValue(value);
        const resultText = isPass ? 'ผ่าน' : 'ไม่ผ่าน';

        const row = [
            formatDateTime(check.checked_at),
            check.driver_name || '',
            check.reference || '',
            value.toFixed(3),
            resultText,
            check._lat || '',
            check._lng || '',
            check.image_url || ''
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
    csvRows.push(['สรุปรายงานการเป่าแอลกอฮอล์'].join(','));
    csvRows.push(['ทั้งหมด', reportData.summary.totalCount, 'ครั้ง'].join(','));
    csvRows.push(['คนขับทั้งหมด', reportData.summary.totalDrivers, 'คน'].join(','));
    csvRows.push(['ค่าเฉลี่ย', formatAlcoholValue(reportData.summary.avgValue)].join(','));
    csvRows.push(['ค่าสูงสุด', formatAlcoholValue(reportData.summary.maxValue)].join(','));

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `alcohol-check-report-${new Date().toISOString().slice(0, 10)}.csv`;

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
    document.addEventListener('DOMContentLoaded', initAlcoholCheckReport);
} else {
    initAlcoholCheckReport();
}
