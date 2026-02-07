/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOCATION MASTER MANAGEMENT
 * จัดการข้อมูลต้นทาง ปลายทาง และลูกค้า
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../../shared/config.js';

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    currentTab: 'origin', // 'origin', 'station', 'customer'
    origin: {
        data: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: 10,
        totalCount: 0
    },
    station: {
        data: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: 10,
        totalCount: 0
    },
    customer: {
        data: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: 10,
        totalCount: 0
    }
};

// ============================================
// INITIALIZATION
// ============================================

export function initLocationMaster() {
    console.log('[LocationMaster] Initializing...');
    setupSearchInputListeners();
    loadLocationMaster();
}

// ============================================
// TAB MANAGEMENT
// ============================================

// Make tab switch function available globally for HTML onclick
window.switchLocationTab = switchLocationTab;

function setupTabEventListeners() {
    // Tab click handlers are set up via onclick in HTML and window assignment above
}

function setupSearchInputListeners() {
    // Setup Enter key listeners for search inputs
    const searchInputs = [
        { inputId: 'origin-search-input', filterId: 'origin-route-filter' },
        { inputId: 'station-search-input', filterId: 'station-area-filter' },
        { inputId: 'customer-search-input', filterId: null }
    ];

    searchInputs.forEach(({ inputId, filterId }) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    if (inputId === 'origin-search-input') applyOriginFilters();
                    else if (inputId === 'station-search-input') applyStationFilters();
                    else if (inputId === 'customer-search-input') applyCustomerFilters();
                }
            });
        }

        if (filterId) {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.addEventListener('change', () => {
                    if (filterId === 'origin-route-filter') applyOriginFilters();
                    else if (filterId === 'station-area-filter') applyStationFilters();
                });
            }
        }
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const originModal = document.getElementById('origin-modal');
        const stationModal = document.getElementById('station-modal');
        const customerModal = document.getElementById('customer-modal');
        const deleteModal = document.getElementById('location-delete-modal');

        if (e.target === originModal) closeOriginModal();
        if (e.target === stationModal) closeStationModal();
        if (e.target === customerModal) closeCustomerModal();
        if (e.target === deleteModal) closeLocationDeleteModal();
    });
}

function switchLocationTab(tabName) {
    state.currentTab = tabName;

    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    const activeContent = document.getElementById(`tab-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
    }

    // Load data for the selected tab
    loadLocationMaster();
}

// ============================================
// DATA LOADING
// ============================================

export async function loadLocationMaster() {
    const { currentTab } = state;

    switch (currentTab) {
        case 'origin':
            await loadOriginData();
            break;
        case 'station':
            await loadStationData();
            break;
        case 'customer':
            await loadCustomerData();
            break;
    }
}

// ─────────────────────────────────────────────────
// ORIGIN DATA
// ─────────────────────────────────────────────────

window.loadOriginData = async function() {
    console.log('[LocationMaster] Loading origin data...');

    const tbody = document.getElementById('origin-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">⏳</div>
                    <p>กำลังโหลดข้อมูล...</p>
                </td>
            </tr>
        `;
    }

    try {
        const { data, error, count } = await supabase
            .from('origin')
            .select('*', { count: 'exact' })
            .order('routeCode', { ascending: true });

        if (error) throw error;

        state.origin.data = data || [];
        state.origin.totalCount = count || 0;
        state.origin.filteredData = [...state.origin.data];

        // Update summary cards
        updateOriginSummary();

        // Apply filters and render
        applyOriginFilters();

        // Populate route filter dropdown
        populateRouteFilter();

    } catch (error) {
        console.error('[LocationMaster] Error loading origin data:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--error-color);">
                        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                        <small>${error.message}</small>
                    </td>
                </tr>
            `;
        }
    }
};

function updateOriginSummary() {
    const totalCount = document.getElementById('origin-total-count');
    const routeCount = document.getElementById('origin-route-count');

    if (totalCount) totalCount.textContent = state.origin.totalCount.toLocaleString();

    const uniqueRoutes = [...new Set(state.origin.data.map(item => item.routeCode))].length;
    if (routeCount) routeCount.textContent = uniqueRoutes;
}

function populateRouteFilter() {
    const select = document.getElementById('origin-route-filter');
    if (!select) return;

    const routes = [...new Set(state.origin.data.map(item => item.routeCode))].sort();
    const currentValue = select.value;

    select.innerHTML = '<option value="">ทุกเส้นทาง</option>';
    routes.forEach(route => {
        const option = document.createElement('option');
        option.value = route;
        option.textContent = route;
        option.style.backgroundColor = '#1a202e';
        option.style.color = '#f7f8fa';
        select.appendChild(option);
    });

    select.value = currentValue;
}

window.applyOriginFilters = function() {
    const searchTerm = document.getElementById('origin-search-input')?.value?.toLowerCase() || '';
    const routeFilter = document.getElementById('origin-route-filter')?.value || '';

    state.origin.filteredData = state.origin.data.filter(item => {
        const matchesSearch = !searchTerm ||
            item.originKey?.toLowerCase().includes(searchTerm) ||
            item.name?.toLowerCase().includes(searchTerm) ||
            item.routeCode?.toLowerCase().includes(searchTerm);

        const matchesRoute = !routeFilter || item.routeCode === routeFilter;

        return matchesSearch && matchesRoute;
    });

    state.origin.currentPage = 1;
    renderOriginTable();
    updateOriginPagination();
};

window.clearOriginFilters = function() {
    const searchInput = document.getElementById('origin-search-input');
    const routeFilter = document.getElementById('origin-route-filter');

    if (searchInput) searchInput.value = '';
    if (routeFilter) routeFilter.value = '';

    applyOriginFilters();
};

function renderOriginTable() {
    const tbody = document.getElementById('origin-tbody');
    if (!tbody) return;

    const { filteredData, currentPage, itemsPerPage } = state.origin;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    <p>ไม่พบข้อมูล</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map(item => `
        <tr style="cursor: pointer;" ondblclick="editOrigin('${escapeHtml(item.originKey)}')">
            <td><strong>${escapeHtml(item.originKey || '-')}</strong></td>
            <td>${escapeHtml(item.name || '-')}</td>
            <td><span style="background: var(--brand-primary-dim); color: var(--brand-primary); padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${escapeHtml(item.routeCode || '-')}</span></td>
            <td>${item.lat?.toFixed(6) || '-'}, ${item.lng?.toFixed(6) || '-'}</td>
            <td>${item.radiusMeters || '-'}</td>
            <td style="text-align: center;">
                <button onclick="editOrigin('${escapeHtml(item.originKey)}')" style="padding: 6px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 4px;">✏️</button>
                <button onclick="confirmDeleteOrigin('${escapeHtml(item.originKey)}', '${escapeHtml(item.name)}')" style="padding: 6px 12px; background: var(--error-color); color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function updateOriginPagination() {
    const { filteredData, currentPage, itemsPerPage } = state.origin;
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    const pageInfo = document.getElementById('origin-page-info');
    const prevBtn = document.getElementById('origin-prev-btn');
    const nextBtn = document.getElementById('origin-next-btn');

    if (pageInfo) pageInfo.textContent = `หน้า ${currentPage} จาก ${totalPages}`;

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

window.prevOriginPage = function() {
    if (state.origin.currentPage > 1) {
        state.origin.currentPage--;
        renderOriginTable();
        updateOriginPagination();
    }
};

window.nextOriginPage = function() {
    const totalPages = Math.ceil(state.origin.filteredData.length / state.origin.itemsPerPage);
    if (state.origin.currentPage < totalPages) {
        state.origin.currentPage++;
        renderOriginTable();
        updateOriginPagination();
    }
};

// ─────────────────────────────────────────────────
// STATION DATA
// ─────────────────────────────────────────────────

window.loadStationData = async function() {
    console.log('[LocationMaster] Loading station data...');

    const tbody = document.getElementById('station-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">⏳</div>
                    <p>กำลังโหลดข้อมูล...</p>
                </td>
            </tr>
        `;
    }

    try {
        const { data, error, count } = await supabase
            .from('station')
            .select('*', { count: 'exact' })
            .order('Name_Area', { ascending: true });

        if (error) throw error;

        state.station.data = data || [];
        state.station.totalCount = count || 0;
        state.station.filteredData = [...state.station.data];

        updateStationSummary();
        applyStationFilters();
        populateAreaFilter();

    } catch (error) {
        console.error('[LocationMaster] Error loading station data:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--error-color);">
                        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                        <small>${error.message}</small>
                    </td>
                </tr>
            `;
        }
    }
};

function updateStationSummary() {
    const totalCount = document.getElementById('station-total-count');
    const areaCount = document.getElementById('station-area-count');

    if (totalCount) totalCount.textContent = state.station.totalCount.toLocaleString();

    const uniqueAreas = [...new Set(state.station.data.map(item => item.Name_Area).filter(Boolean))].length;
    if (areaCount) areaCount.textContent = uniqueAreas;
}

function populateAreaFilter() {
    const select = document.getElementById('station-area-filter');
    if (!select) return;

    const areas = [...new Set(state.station.data.map(item => item.Name_Area).filter(Boolean))].sort();
    const currentValue = select.value;

    select.innerHTML = '<option value="">ทุกพื้นที่</option>';
    areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area;
        option.textContent = area;
        option.style.backgroundColor = '#1a202e';
        option.style.color = '#f7f8fa';
        select.appendChild(option);
    });

    select.value = currentValue;
}

window.applyStationFilters = function() {
    const searchTerm = document.getElementById('station-search-input')?.value?.toLowerCase() || '';
    const areaFilter = document.getElementById('station-area-filter')?.value || '';

    state.station.filteredData = state.station.data.filter(item => {
        const matchesSearch = !searchTerm ||
            item.stationKey?.toLowerCase().includes(searchTerm) ||
            item.ชื่อสถานีบริการ?.toLowerCase().includes(searchTerm) ||
            item.Name_Area?.toLowerCase().includes(searchTerm);

        const matchesArea = !areaFilter || item.Name_Area === areaFilter;

        return matchesSearch && matchesArea;
    });

    state.station.currentPage = 1;
    renderStationTable();
    updateStationPagination();
};

window.clearStationFilters = function() {
    const searchInput = document.getElementById('station-search-input');
    const areaFilter = document.getElementById('station-area-filter');

    if (searchInput) searchInput.value = '';
    if (areaFilter) areaFilter.value = '';

    applyStationFilters();
};

function renderStationTable() {
    const tbody = document.getElementById('station-tbody');
    if (!tbody) return;

    const { filteredData, currentPage, itemsPerPage } = state.station;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    <p>ไม่พบข้อมูล</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map(item => `
        <tr style="cursor: pointer;" ondblclick="editStation('${escapeHtml(item.stationKey)}')">
            <td><strong>${escapeHtml(item.stationKey || '-')}</strong></td>
            <td>${escapeHtml(item.ชื่อสถานีบริการ || '-')}</td>
            <td><span style="background: var(--info-dim); color: var(--info-color); padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${escapeHtml(item.Name_Area || '-')}</span></td>
            <td>${item.lat?.toFixed(6) || '-'}, ${item.lng?.toFixed(6) || '-'}</td>
            <td>${item.radiusMeters || '-'}</td>
            <td style="text-align: center;">
                <button onclick="editStation('${escapeHtml(item.stationKey)}')" style="padding: 6px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 4px;">✏️</button>
                <button onclick="confirmDeleteStation('${escapeHtml(item.stationKey)}', '${escapeHtml(item.ชื่อสถานีบริการ || '')}')" style="padding: 6px 12px; background: var(--error-color); color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function updateStationPagination() {
    const { filteredData, currentPage, itemsPerPage } = state.station;
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    const pageInfo = document.getElementById('station-page-info');
    const prevBtn = document.getElementById('station-prev-btn');
    const nextBtn = document.getElementById('station-next-btn');

    if (pageInfo) pageInfo.textContent = `หน้า ${currentPage} จาก ${totalPages}`;

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

window.prevStationPage = function() {
    if (state.station.currentPage > 1) {
        state.station.currentPage--;
        renderStationTable();
        updateStationPagination();
    }
};

window.nextStationPage = function() {
    const totalPages = Math.ceil(state.station.filteredData.length / state.station.itemsPerPage);
    if (state.station.currentPage < totalPages) {
        state.station.currentPage++;
        renderStationTable();
        updateStationPagination();
    }
};

// ─────────────────────────────────────────────────
// CUSTOMER DATA
// ─────────────────────────────────────────────────

window.loadCustomerData = async function() {
    console.log('[LocationMaster] Loading customer data...');

    const tbody = document.getElementById('customer-tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">⏳</div>
                    <p>กำลังโหลดข้อมูล...</p>
                </td>
            </tr>
        `;
    }

    try {
        const { data, error, count } = await supabase
            .from('customer')
            .select('*', { count: 'exact' })
            .order('name', { ascending: true });

        if (error) throw error;

        state.customer.data = data || [];
        state.customer.totalCount = count || 0;
        state.customer.filteredData = [...state.customer.data];

        updateCustomerSummary();
        applyCustomerFilters();

    } catch (error) {
        console.error('[LocationMaster] Error loading customer data:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--error-color);">
                        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                        <small>${error.message}</small>
                    </td>
                </tr>
            `;
        }
    }
};

function updateCustomerSummary() {
    const totalCount = document.getElementById('customer-total-count');
    const emailCount = document.getElementById('customer-email-count');

    if (totalCount) totalCount.textContent = state.customer.totalCount.toLocaleString();

    const customersWithEmail = state.customer.data.filter(item => item.email).length;
    if (emailCount) emailCount.textContent = customersWithEmail;
}

window.applyCustomerFilters = function() {
    const searchTerm = document.getElementById('customer-search-input')?.value?.toLowerCase() || '';

    state.customer.filteredData = state.customer.data.filter(item => {
        return !searchTerm ||
            item.stationKey?.toLowerCase().includes(searchTerm) ||
            item.name?.toLowerCase().includes(searchTerm);
    });

    state.customer.currentPage = 1;
    renderCustomerTable();
    updateCustomerPagination();
};

window.clearCustomerFilters = function() {
    const searchInput = document.getElementById('customer-search-input');
    if (searchInput) searchInput.value = '';
    applyCustomerFilters();
};

function renderCustomerTable() {
    const tbody = document.getElementById('customer-tbody');
    if (!tbody) return;

    const { filteredData, currentPage, itemsPerPage } = state.customer;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    <p>ไม่พบข้อมูล</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map(item => `
        <tr style="cursor: pointer;" ondblclick="editCustomer('${escapeHtml(item.stationKey)}')">
            <td><strong>${escapeHtml(item.stationKey || '-')}</strong></td>
            <td>${escapeHtml(item.name || '-')}</td>
            <td>${item.lat?.toFixed(6) || '-'}, ${item.lng?.toFixed(6) || '-'}</td>
            <td>${item.radiusMeters || '-'}</td>
            <td>${escapeHtml(item.email || '-')}</td>
            <td>${escapeHtml(item.STD || '-')}</td>
            <td style="text-align: center;">
                <button onclick="editCustomer('${escapeHtml(item.stationKey)}')" style="padding: 6px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 4px;">✏️</button>
                <button onclick="confirmDeleteCustomer('${escapeHtml(item.stationKey)}', '${escapeHtml(item.name)}')" style="padding: 6px 12px; background: var(--error-color); color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function updateCustomerPagination() {
    const { filteredData, currentPage, itemsPerPage } = state.customer;
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

    const pageInfo = document.getElementById('customer-page-info');
    const prevBtn = document.getElementById('customer-prev-btn');
    const nextBtn = document.getElementById('customer-next-btn');

    if (pageInfo) pageInfo.textContent = `หน้า ${currentPage} จาก ${totalPages}`;

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

window.prevCustomerPage = function() {
    if (state.customer.currentPage > 1) {
        state.customer.currentPage--;
        renderCustomerTable();
        updateCustomerPagination();
    }
};

window.nextCustomerPage = function() {
    const totalPages = Math.ceil(state.customer.filteredData.length / state.customer.itemsPerPage);
    if (state.customer.currentPage < totalPages) {
        state.customer.currentPage++;
        renderCustomerTable();
        updateCustomerPagination();
    }
};

// ============================================
// ORIGIN MODAL FUNCTIONS
// ============================================

window.openOriginModal = function(originKey = null) {
    const modal = document.getElementById('origin-modal');
    const title = document.getElementById('origin-modal-title');
    const modeInput = document.getElementById('origin-mode');
    const originalKeyInput = document.getElementById('original-origin-key');

    // Reset form
    document.getElementById('origin-form').reset();

    if (originKey) {
        // Edit mode
        const item = state.origin.data.find(d => d.originKey === originKey);
        if (!item) return;

        title.textContent = '🏭 แก้ไขข้อมูลต้นทาง';
        modeInput.value = 'edit';
        originalKeyInput.value = originKey;

        document.getElementById('origin-origin-key').value = item.originKey || '';
        document.getElementById('origin-origin-key').disabled = true;
        document.getElementById('origin-name').value = item.name || '';
        document.getElementById('origin-route-code').value = item.routeCode || '';
        document.getElementById('origin-lat').value = item.lat || '';
        document.getElementById('origin-lng').value = item.lng || '';
        document.getElementById('origin-radius').value = item.radiusMeters || '';
    } else {
        // Create mode
        title.textContent = '🏭 เพิ่มต้นทางใหม่';
        modeInput.value = 'create';
        originalKeyInput.value = '';
        document.getElementById('origin-origin-key').disabled = false;
    }

    modal.classList.remove('hidden');
};

window.closeOriginModal = function() {
    document.getElementById('origin-modal').classList.add('hidden');
};

window.editOrigin = function(originKey) {
    openOriginModal(originKey);
};

window.saveOrigin = async function(event) {
    event.preventDefault();

    const mode = document.getElementById('origin-mode').value;
    const originalKey = document.getElementById('original-origin-key').value;

    const data = {
        originKey: document.getElementById('origin-origin-key').value.trim(),
        name: document.getElementById('origin-name').value.trim(),
        routeCode: document.getElementById('origin-route-code').value.trim(),
        lat: parseFloat(document.getElementById('origin-lat').value),
        lng: parseFloat(document.getElementById('origin-lng').value),
        radiusMeters: parseInt(document.getElementById('origin-radius').value) || 500
    };

    try {
        let result;

        if (mode === 'create') {
            // Check for duplicate
            const existing = state.origin.data.find(d => d.originKey === data.originKey);
            if (existing) {
                showNotification('รหัสต้นทางนี้มีอยู่แล้ว', 'error');
                return;
            }

            result = await supabase.from('origin').insert([data]);
        } else {
            result = await supabase
                .from('origin')
                .update(data)
                .eq('originKey', originalKey);
        }

        if (result.error) throw result.error;

        showNotification(mode === 'create' ? 'เพิ่มต้นทางสำเร็จ' : 'แก้ไขต้นทางสำเร็จ', 'success');
        closeOriginModal();
        await loadOriginData();

    } catch (error) {
        console.error('[LocationMaster] Error saving origin:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
};

window.confirmDeleteOrigin = function(originKey, name) {
    document.getElementById('location-delete-type').value = 'origin';
    document.getElementById('location-delete-key').value = originKey;
    document.getElementById('location-delete-name').textContent = name;
    document.getElementById('location-delete-modal').classList.remove('hidden');
};

// ============================================
// STATION MODAL FUNCTIONS
// ============================================

window.openStationModal = function(stationKey = null) {
    const modal = document.getElementById('station-modal');
    const title = document.getElementById('station-modal-title');
    const modeInput = document.getElementById('station-mode');
    const originalKeyInput = document.getElementById('original-station-key');

    // Reset form
    document.getElementById('station-form').reset();

    if (stationKey) {
        // Edit mode
        const item = state.station.data.find(d => d.stationKey === stationKey);
        if (!item) return;

        title.textContent = '⛽ แก้ไขข้อมูลปลายทาง';
        modeInput.value = 'edit';
        originalKeyInput.value = stationKey;

        document.getElementById('station-key').value = item.stationKey || '';
        document.getElementById('station-key').disabled = true;
        document.getElementById('station-name').value = item.ชื่อสถานีบริการ || '';
        document.getElementById('station-name-area').value = item.Name_Area || '';
        document.getElementById('station-mobile').value = item.Mobile || '';
        document.getElementById('station-lat').value = item.lat || '';
        document.getElementById('station-lng').value = item.lng || '';
        document.getElementById('station-radius').value = item.radiusMeters || '';
    } else {
        // Create mode
        title.textContent = '⛽ เพิ่มปลายทางใหม่';
        modeInput.value = 'create';
        originalKeyInput.value = '';
        document.getElementById('station-key').disabled = false;
    }

    modal.classList.remove('hidden');
};

window.closeStationModal = function() {
    document.getElementById('station-modal').classList.add('hidden');
};

window.editStation = function(stationKey) {
    openStationModal(stationKey);
};

window.saveStation = async function(event) {
    event.preventDefault();

    const mode = document.getElementById('station-mode').value;
    const originalKey = document.getElementById('original-station-key').value;

    const data = {
        stationKey: document.getElementById('station-key').value.trim(),
        ชื่อสถานีบริการ: document.getElementById('station-name').value.trim(),
        Name_Area: document.getElementById('station-name-area').value.trim(),
        Mobile: document.getElementById('station-mobile').value.trim(),
        lat: parseFloat(document.getElementById('station-lat').value),
        lng: parseFloat(document.getElementById('station-lng').value),
        radiusMeters: parseInt(document.getElementById('station-radius').value) || 500
    };

    try {
        let result;

        if (mode === 'create') {
            // Check for duplicate
            const existing = state.station.data.find(d => d.stationKey === data.stationKey);
            if (existing) {
                showNotification('รหัสสถานีนี้มีอยู่แล้ว', 'error');
                return;
            }

            result = await supabase.from('station').insert([data]);
        } else {
            result = await supabase
                .from('station')
                .update(data)
                .eq('stationKey', originalKey);
        }

        if (result.error) throw result.error;

        showNotification(mode === 'create' ? 'เพิ่มปลายทางสำเร็จ' : 'แก้ไขปลายทางสำเร็จ', 'success');
        closeStationModal();
        await loadStationData();

    } catch (error) {
        console.error('[LocationMaster] Error saving station:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
};

window.confirmDeleteStation = function(stationKey, name) {
    document.getElementById('location-delete-type').value = 'station';
    document.getElementById('location-delete-key').value = stationKey;
    document.getElementById('location-delete-name').textContent = name;
    document.getElementById('location-delete-modal').classList.remove('hidden');
};

// ============================================
// CUSTOMER MODAL FUNCTIONS
// ============================================

window.openCustomerModal = function(stationKey = null) {
    const modal = document.getElementById('customer-modal');
    const title = document.getElementById('customer-modal-title');
    const modeInput = document.getElementById('customer-mode');
    const originalKeyInput = document.getElementById('original-customer-key');

    // Reset form
    document.getElementById('customer-form').reset();

    if (stationKey) {
        // Edit mode
        const item = state.customer.data.find(d => d.stationKey === stationKey);
        if (!item) return;

        title.textContent = '🏪 แก้ไขข้อมูลลูกค้า';
        modeInput.value = 'edit';
        originalKeyInput.value = stationKey;

        document.getElementById('customer-station-key').value = item.stationKey || '';
        document.getElementById('customer-station-key').disabled = true;
        document.getElementById('customer-name').value = item.name || '';
        document.getElementById('customer-station-key2').value = item.stationKey2 || '';
        document.getElementById('customer-lat').value = item.lat || '';
        document.getElementById('customer-lng').value = item.lng || '';
        document.getElementById('customer-radius').value = item.radiusMeters || '';
        document.getElementById('customer-email').value = item.email || '';
        document.getElementById('customer-std').value = item.STD || '';
    } else {
        // Create mode
        title.textContent = '🏪 เพิ่มลูกค้าใหม่';
        modeInput.value = 'create';
        originalKeyInput.value = '';
        document.getElementById('customer-station-key').disabled = false;
    }

    modal.classList.remove('hidden');
};

window.closeCustomerModal = function() {
    document.getElementById('customer-modal').classList.add('hidden');
};

window.editCustomer = function(stationKey) {
    openCustomerModal(stationKey);
};

window.saveCustomer = async function(event) {
    event.preventDefault();

    const mode = document.getElementById('customer-mode').value;
    const originalKey = document.getElementById('original-customer-key').value;

    const data = {
        stationKey: document.getElementById('customer-station-key').value.trim(),
        name: document.getElementById('customer-name').value.trim(),
        stationKey2: document.getElementById('customer-station-key2').value.trim() || null,
        lat: parseFloat(document.getElementById('customer-lat').value),
        lng: parseFloat(document.getElementById('customer-lng').value),
        radiusMeters: parseInt(document.getElementById('customer-radius').value) || 500,
        email: document.getElementById('customer-email').value.trim() || null,
        STD: document.getElementById('customer-std').value.trim() || null
    };

    try {
        let result;

        if (mode === 'create') {
            // Check for duplicate
            const existing = state.customer.data.find(d => d.stationKey === data.stationKey);
            if (existing) {
                showNotification('รหัสลูกค้านี้มีอยู่แล้ว', 'error');
                return;
            }

            result = await supabase.from('customer').insert([data]);
        } else {
            result = await supabase
                .from('customer')
                .update(data)
                .eq('stationKey', originalKey);
        }

        if (result.error) throw result.error;

        showNotification(mode === 'create' ? 'เพิ่มลูกค้าสำเร็จ' : 'แก้ไขลูกค้าสำเร็จ', 'success');
        closeCustomerModal();
        await loadCustomerData();

    } catch (error) {
        console.error('[LocationMaster] Error saving customer:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
};

window.confirmDeleteCustomer = function(stationKey, name) {
    document.getElementById('location-delete-type').value = 'customer';
    document.getElementById('location-delete-key').value = stationKey;
    document.getElementById('location-delete-name').textContent = name;
    document.getElementById('location-delete-modal').classList.remove('hidden');
};

// ============================================
// DELETE CONFIRMATION
// ============================================

window.closeLocationDeleteModal = function() {
    document.getElementById('location-delete-modal').classList.add('hidden');
    document.getElementById('location-delete-type').value = '';
    document.getElementById('location-delete-key').value = '';
};

window.confirmDeleteLocation = async function() {
    const type = document.getElementById('location-delete-type').value;
    const key = document.getElementById('location-delete-key').value;

    if (!type || !key) return;

    try {
        let result;
        let tableName = type;
        let keyColumn = type === 'origin' ? 'originKey' : 'stationKey';

        result = await supabase
            .from(tableName)
            .delete()
            .eq(keyColumn, key);

        if (result.error) throw result.error;

        showNotification('ลบข้อมูลสำเร็จ', 'success');
        closeLocationDeleteModal();

        // Reload data based on type
        switch (type) {
            case 'origin':
                await loadOriginData();
                break;
            case 'station':
                await loadStationData();
                break;
            case 'customer':
                await loadCustomerData();
                break;
        }

    } catch (error) {
        console.error('[LocationMaster] Error deleting location:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Try to use existing notification system
    if (window.showNotificationFromLocationMaster) {
        window.showNotificationFromLocationMaster(message, type);
    } else if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        // Fallback
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(`${message}`);
    }
}

// ============================================
// ASSIGN GLOBAL WINDOW FUNCTIONS FOR HTML ONCLICK
// ============================================

// Make all onclick functions available globally
window.switchLocationTab = switchLocationTab;
window.loadLocationMaster = loadLocationMaster;
window.loadOriginData = loadOriginData;
window.loadStationData = loadStationData;
window.loadCustomerData = loadCustomerData;
window.applyOriginFilters = applyOriginFilters;
window.clearOriginFilters = clearOriginFilters;
window.applyStationFilters = applyStationFilters;
window.clearStationFilters = clearStationFilters;
window.applyCustomerFilters = applyCustomerFilters;
window.clearCustomerFilters = clearCustomerFilters;
window.prevOriginPage = prevOriginPage;
window.nextOriginPage = nextOriginPage;
window.prevStationPage = prevStationPage;
window.nextStationPage = nextStationPage;
window.prevCustomerPage = prevCustomerPage;
window.nextCustomerPage = nextCustomerPage;

// Modal functions
window.openOriginModal = openOriginModal;
window.closeOriginModal = closeOriginModal;
window.editOrigin = editOrigin;
window.saveOrigin = saveOrigin;
window.confirmDeleteOrigin = confirmDeleteOrigin;

window.openStationModal = openStationModal;
window.closeStationModal = closeStationModal;
window.editStation = editStation;
window.saveStation = saveStation;
window.confirmDeleteStation = confirmDeleteStation;

window.openCustomerModal = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.editCustomer = editCustomer;
window.saveCustomer = saveCustomer;
window.confirmDeleteCustomer = confirmDeleteCustomer;

window.closeLocationDeleteModal = closeLocationDeleteModal;
window.confirmDeleteLocation = confirmDeleteLocation;

// ============================================
// EXPORT FUNCTIONS FOR MODULE IMPORTS
// ============================================

export {
    initLocationMaster,
    switchLocationTab,
    loadLocationMaster,
    loadOriginData,
    loadStationData,
    loadCustomerData
};
