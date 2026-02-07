/**
 * Driver Master Management Module
 * CRUD operations for driver_master table
 */

// Import supabase from shared config
import { supabase } from '../../shared/config.js';

// State
let driverMasterData = [];
let filteredDriverMasterData = [];
let currentPage = 1;
const itemsPerPage = 10;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load driver master data when section is shown
    const driverMasterLink = document.querySelector('[data-target="driver-master"]');
    if (driverMasterLink) {
        driverMasterLink.addEventListener('click', () => {
            loadDriverMaster();
            loadFilterOptions();
        });
    }

    // Setup search on Enter key
    const searchInput = document.getElementById('dm-search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                loadDriverMaster();
            }
        });
    }

    // Setup filter change listeners
    const sectionFilter = document.getElementById('dm-section-filter');
    const truckTypeFilter = document.getElementById('dm-truck-type-filter');
    if (sectionFilter) sectionFilter.addEventListener('change', loadDriverMaster);
    if (truckTypeFilter) truckTypeFilter.addEventListener('change', loadDriverMaster);

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const dmModal = document.getElementById('driver-master-modal');
        const deleteModal = document.getElementById('dm-delete-modal');
        if (e.target === dmModal) closeDriverMasterModal();
        if (e.target === deleteModal) closeDmDeleteModal();
    });
});

/**
 * Load all driver master data from Supabase
 */
async function loadDriverMaster() {
    const tbody = document.getElementById('driver-master-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-sub);">
                <div class="loading-spinner"></div>
                <p>กำลังโหลดข้อมูล...</p>
            </td>
        </tr>
    `;

    try {
        const { data, error } = await supabase
            .from('driver_master')
            .select('*')
            .order('driver_name', { ascending: true });

        if (error) throw error;

        driverMasterData = data || [];
        console.log('Driver Master Data loaded:', driverMasterData.length, 'records');
        console.log('Sample data:', driverMasterData.slice(0, 3));
        applyFilters();
        updateSummaryCards();
    } catch (error) {
        console.error('Error loading driver master:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                    <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                    <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                    <small>${error.message}</small>
                </td>
            </tr>
        `;
    }
}

/**
 * Load filter options from existing data
 */
function loadFilterOptions() {
    const sections = [...new Set(driverMasterData.map(d => d.section).filter(Boolean))].sort();
    const truckTypes = [...new Set(driverMasterData.map(d => d.truck_type).filter(Boolean))].sort();

    const sectionFilter = document.getElementById('dm-section-filter');
    const truckTypeFilter = document.getElementById('dm-truck-type-filter');

    if (sectionFilter) {
        const currentValue = sectionFilter.value;
        sectionFilter.innerHTML = '<option value="" style="background-color: #1a202e; color: #f7f8fa;">ทุกแผนก</option>' +
            sections.map(s => `<option value="${s}" ${s === currentValue ? 'selected' : ''} style="background-color: #1a202e; color: #f7f8fa;">${s}</option>`).join('');
    }

    if (truckTypeFilter) {
        const currentValue = truckTypeFilter.value;
        truckTypeFilter.innerHTML = '<option value="" style="background-color: #1a202e; color: #f7f8fa;">ทุกประเภทรถ</option>' +
            truckTypes.map(t => `<option value="${t}" ${t === currentValue ? 'selected' : ''} style="background-color: #1a202e; color: #f7f8fa;">${t}</option>`).join('');
    }
}

/**
 * Apply filters and search
 */
function applyFilters() {
    const searchTerm = document.getElementById('dm-search-input')?.value.toLowerCase() || '';
    const sectionFilter = document.getElementById('dm-section-filter')?.value || '';
    const truckTypeFilter = document.getElementById('dm-truck-type-filter')?.value || '';

    filteredDriverMasterData = driverMasterData.filter(driver => {
        // Safely handle null/undefined values in search
        const empCode = (driver.employee_code || '').toLowerCase();
        const driverName = (driver.driver_name || '').toLowerCase();
        const sapCode = (driver.driver_sap_code || '').toLowerCase();

        const matchesSearch = !searchTerm ||
            empCode.includes(searchTerm) ||
            driverName.includes(searchTerm) ||
            sapCode.includes(searchTerm);

        const matchesSection = !sectionFilter || driver.section === sectionFilter;
        const matchesTruckType = !truckTypeFilter || driver.truck_type === truckTypeFilter;

        return matchesSearch && matchesSection && matchesTruckType;
    });

    currentPage = 1;
    renderDriverMasterTable();
    updatePagination();
}

/**
 * Clear all filters
 */
function clearDriverMasterFilters() {
    const searchInput = document.getElementById('dm-search-input');
    const sectionFilter = document.getElementById('dm-section-filter');
    const truckTypeFilter = document.getElementById('dm-truck-type-filter');

    if (searchInput) searchInput.value = '';
    if (sectionFilter) sectionFilter.value = '';
    if (truckTypeFilter) truckTypeFilter.value = '';

    applyFilters();
}

/**
 * Render the driver master table
 */
function renderDriverMasterTable() {
    const tbody = document.getElementById('driver-master-tbody');
    if (!tbody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredDriverMasterData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-sub);">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔍</div>
                    <p>ไม่พบข้อมูล</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map(driver => `
        <tr>
            <td><strong>${escapeHtml(driver.employee_code || '-')}</strong></td>
            <td>${escapeHtml(driver.driver_name || '-')}</td>
            <td>${escapeHtml(driver.driver_sap_code || '-')}</td>
            <td><span class="badge" style="background: #e3f2fd; color: #1565c0; padding: 4px 10px; border-radius: 20px; font-size: 12px;">${escapeHtml(driver.section || '-')}</span></td>
            <td><span class="badge" style="background: #f3e5f5; color: #7b1fa2; padding: 4px 10px; border-radius: 20px; font-size: 12px;">${escapeHtml(driver.truck_type || '-')}</span></td>
            <td>${escapeHtml(driver.position || '-')}</td>
            <td style="text-align: center;">
                <button onclick="editDriverMaster('${escapeHtml(driver.employee_code)}')" style="padding: 6px 12px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="แก้ไข">✏️</button>
                <button onclick="deleteDriverMaster('${escapeHtml(driver.employee_code)}', '${escapeHtml(driver.driver_name).replace(/'/g, "\\'")}')" style="padding: 6px 12px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer;" title="ลบ">🗑️</button>
            </td>
        </tr>
    `).join('');
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const totalCount = document.getElementById('dm-total-count');
    const sectionCount = document.getElementById('dm-section-count');
    const truckTypeCount = document.getElementById('dm-truck-type-count');

    if (totalCount) totalCount.textContent = driverMasterData.length;
    // Filter out null/undefined values before counting unique
    if (sectionCount) sectionCount.textContent = [...new Set(driverMasterData.map(d => d.section).filter(Boolean))].length;
    if (truckTypeCount) truckTypeCount.textContent = [...new Set(driverMasterData.map(d => d.truck_type).filter(Boolean))].length;
}

/**
 * Update pagination controls
 */
function updatePagination() {
    const totalPages = Math.ceil(filteredDriverMasterData.length / itemsPerPage);
    const pageInfo = document.getElementById('dm-page-info');
    const prevBtn = document.getElementById('dm-prev-btn');
    const nextBtn = document.getElementById('dm-next-btn');

    if (pageInfo) pageInfo.textContent = `หน้า ${currentPage} จาก ${totalPages || 1}`;

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

/**
 * Navigate to previous page
 */
function prevDriverMasterPage() {
    if (currentPage > 1) {
        currentPage--;
        renderDriverMasterTable();
        updatePagination();
    }
}

/**
 * Navigate to next page
 */
function nextDriverMasterPage() {
    const totalPages = Math.ceil(filteredDriverMasterData.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderDriverMasterTable();
        updatePagination();
    }
}

/**
 * Open the driver master modal for creating
 */
function openDriverMasterModal() {
    const modal = document.getElementById('driver-master-modal');
    const form = document.getElementById('driver-master-form');
    const title = document.getElementById('dm-modal-title');

    document.getElementById('dm-mode').value = 'create';
    document.getElementById('dm-original-employee-code').value = '';
    title.textContent = '👨‍✈️ เพิ่มข้อมูลคนขับรถ';

    form.reset();
    modal.classList.remove('hidden');
}

/**
 * Open the driver master modal for editing
 */
function editDriverMaster(employeeCode) {
    const driver = driverMasterData.find(d => d.employee_code === employeeCode);
    if (!driver) return;

    const modal = document.getElementById('driver-master-modal');
    const title = document.getElementById('dm-modal-title');

    document.getElementById('dm-mode').value = 'edit';
    document.getElementById('dm-original-employee-code').value = employeeCode;
    title.textContent = '👨‍✈️ แก้ไขข้อมูลคนขับรถ';

    // Fill form
    document.getElementById('dm-employee-code').value = driver.employee_code;
    document.getElementById('dm-employee-code').readOnly = true; // Cannot change PK
    document.getElementById('dm-employee-code').style.backgroundColor = 'var(--border-color)';
    document.getElementById('dm-driver-name').value = driver.driver_name;
    document.getElementById('dm-driver-sap-code').value = driver.driver_sap_code;
    document.getElementById('dm-section').value = driver.section;
    document.getElementById('dm-truck-type').value = driver.truck_type;
    document.getElementById('dm-position').value = driver.position;

    modal.classList.remove('hidden');
}

/**
 * Close the driver master modal
 */
function closeDriverMasterModal() {
    const modal = document.getElementById('driver-master-modal');
    const form = document.getElementById('driver-master-form');

    modal.classList.add('hidden');
    form.reset();

    // Reset employee code field
    const empCodeInput = document.getElementById('dm-employee-code');
    empCodeInput.readOnly = false;
    empCodeInput.style.backgroundColor = 'var(--input-bg)';
}

/**
 * Save (create or update) driver master record
 */
async function saveDriverMaster(event) {
    event.preventDefault();

    const mode = document.getElementById('dm-mode').value;
    const originalEmployeeCode = document.getElementById('dm-original-employee-code').value;

    const data = {
        employee_code: document.getElementById('dm-employee-code').value.trim(),
        driver_name: document.getElementById('dm-driver-name').value.trim(),
        driver_sap_code: document.getElementById('dm-driver-sap-code').value.trim(),
        section: document.getElementById('dm-section').value.trim(),
        truck_type: document.getElementById('dm-truck-type').value,
        position: document.getElementById('dm-position').value.trim()
    };

    try {
        let result;
        if (mode === 'create') {
            // Check for duplicate employee code
            const { data: existing } = await supabase
                .from('driver_master')
                .select('employee_code')
                .eq('employee_code', data.employee_code)
                .single();

            if (existing) {
                showNotification('รหัสพนักงานนี้มีอยู่ในระบบแล้ว', 'error');
                return;
            }

            result = await supabase
                .from('driver_master')
                .insert(data)
                .select()
                .single();
        } else {
            // Update existing record
            result = await supabase
                .from('driver_master')
                .update(data)
                .eq('employee_code', originalEmployeeCode)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        showNotification(mode === 'create' ? 'เพิ่มข้อมูลสำเร็จ' : 'แก้ไขข้อมูลสำเร็จ', 'success');
        closeDriverMasterModal();
        loadDriverMaster();
        loadFilterOptions();
    } catch (error) {
        console.error('Error saving driver master:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Show delete confirmation modal
 */
function deleteDriverMaster(employeeCode, driverName) {
    document.getElementById('dm-delete-employee-code').value = employeeCode;
    document.getElementById('dm-delete-name').textContent = driverName;
    document.getElementById('dm-delete-modal').classList.remove('hidden');
}

/**
 * Close delete confirmation modal
 */
function closeDmDeleteModal() {
    document.getElementById('dm-delete-modal').classList.add('hidden');
}

/**
 * Confirm and delete driver master record
 */
async function confirmDeleteDriverMaster() {
    const employeeCode = document.getElementById('dm-delete-employee-code').value;

    try {
        const { error } = await supabase
            .from('driver_master')
            .delete()
            .eq('employee_code', employeeCode);

        if (error) throw error;

        showNotification('ลบข้อมูลสำเร็จ', 'success');
        closeDmDeleteModal();
        loadDriverMaster();
        loadFilterOptions();
    } catch (error) {
        console.error('Error deleting driver master:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Export functions for global access
window.loadDriverMaster = loadDriverMaster;
window.openDriverMasterModal = openDriverMasterModal;
window.closeDriverMasterModal = closeDriverMasterModal;
window.editDriverMaster = editDriverMaster;
window.deleteDriverMaster = deleteDriverMaster;
window.saveDriverMaster = saveDriverMaster;
window.closeDmDeleteModal = closeDmDeleteModal;
window.confirmDeleteDriverMaster = confirmDeleteDriverMaster;
window.clearDriverMasterFilters = clearDriverMasterFilters;
window.prevDriverMasterPage = prevDriverMasterPage;
window.nextDriverMasterPage = nextDriverMasterPage;

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .loading-spinner {
        border: 3px solid var(--border-color);
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
