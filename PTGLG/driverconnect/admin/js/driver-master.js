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

    // Load form dropdown options from driver_master table
    loadFormDropdownOptions();
}

/**
 * Load form dropdown options from driver_master table
 * This populates the datalists and select dropdowns in the add/edit form
 */
function loadFormDropdownOptions() {
    // Get unique values from driver_master data
    const sections = [...new Set(driverMasterData.map(d => d.section).filter(Boolean))].sort();
    const truckTypes = [...new Set(driverMasterData.map(d => d.truck_type).filter(Boolean))].sort();
    const positions = [...new Set(driverMasterData.map(d => d.position).filter(Boolean))].sort();

    // Update section datalist
    const sectionList = document.getElementById('dm-section-list');
    if (sectionList) {
        if (sections.length > 0) {
            sectionList.innerHTML = sections
                .map(s => `<option value="${escapeHtml(s)}" style="background-color: #1a202e; color: #f7f8fa;">`)
                .join('');
        } else {
            // Keep default options if no data exists
            sectionList.innerHTML = `
                <option value="ขนส่งที่ 1" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="ขนส่งที่ 2" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="ขนส่งที่ 3" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="ขนส่งที่ 4" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="ฝ่ายช่าง" style="background-color: #1a202e; color: #f7f8fa;">
            `;
        }
    }

    // Update truck type select
    const truckTypeSelect = document.getElementById('dm-truck-type');
    if (truckTypeSelect) {
        const currentValue = truckTypeSelect.value;
        if (truckTypes.length > 0) {
            truckTypeSelect.innerHTML = '<option value="" style="background-color: #1a202e; color: #f7f8fa;">-- เลือกประเภทรถ --</option>' +
                truckTypes
                    .map(t => `<option value="${escapeHtml(t)}" ${t === currentValue ? 'selected' : ''} style="background-color: #1a202e; color: #f7f8fa;">${escapeHtml(t)}</option>`)
                    .join('');
        } else {
            // Keep default options if no data exists
            truckTypeSelect.innerHTML = `
                <option value="" style="background-color: #1a202e; color: #f7f8fa;">-- เลือกประเภทรถ --</option>
                <option value="รถบรรทุก 4 ล้อ" style="background-color: #1a202e; color: #f7f8fa;">รถบรรทุก 4 ล้อ</option>
                <option value="รถบรรทุก 6 ล้อ" style="background-color: #1a202e; color: #f7f8fa;">รถบรรทุก 6 ล้อ</option>
                <option value="รถบรรทุก 10 ล้อ" style="background-color: #1a202e; color: #f7f8fa;">รถบรรทุก 10 ล้อ</option>
                <option value="รถพ่วง" style="background-color: #1a202e; color: #f7f8fa;">รถพ่วง</option>
                <option value="รถถัง" style="background-color: #1a202e; color: #f7f8fa;">รถถัง</option>
                <option value="รถบรรทุกน้ำมัน" style="background-color: #1a202e; color: #f7f8fa;">รถบรรทุกน้ำมัน</option>
            `;
        }
    }

    // Update position datalist
    const positionList = document.getElementById('dm-position-list');
    if (positionList) {
        if (positions.length > 0) {
            positionList.innerHTML = positions
                .map(p => `<option value="${escapeHtml(p)}" style="background-color: #1a202e; color: #f7f8fa;">`)
                .join('');
        } else {
            // Keep default options if no data exists
            positionList.innerHTML = `
                <option value="พนักงานขับรถ" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="พนักงานขับรถนำ" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="พนักงานขับรถร่วม" style="background-color: #1a202e; color: #f7f8fa;">
                <option value="หัวหน้างานขนส่ง" style="background-color: #1a202e; color: #f7f8fa;">
            `;
        }
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

    // Load dropdown options from driver_master table
    loadFormDropdownOptions();
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
    console.log('[DEBUG] confirmDeleteDriverMaster called with employeeCode:', employeeCode);

    // Debug: Check auth session
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[DEBUG] Current session:', session ? 'Active' : 'None');
    if (session) {
        console.log('[DEBUG] User ID:', session.user?.id);
        console.log('[DEBUG] Access token exists:', !!session.access_token);
    }

    try {
        console.log('[DEBUG] Starting delete operation...');

        // First check if record exists
        const { data: existingRecord, error: checkError } = await supabase
            .from('driver_master')
            .select('*')
            .eq('employee_code', employeeCode)
            .single();

        console.log('[DEBUG] Existing record check:', { existingRecord, checkError });

        if (checkError) {
            console.error('[DEBUG] Check error:', checkError);
            showNotification(`ไม่พบข้อมูล: ${checkError.message}`, 'error');
            return;
        }

        if (!existingRecord) {
            showNotification('ไม่พบข้อมูลคนขับรถที่ต้องการลบ', 'error');
            closeDmDeleteModal();
            loadDriverMaster();
            return;
        }

        // Delete with count to verify
        const { data, error, count } = await supabase
            .from('driver_master')
            .delete({ count: 'exact' })
            .eq('employee_code', employeeCode)
            .select();

        console.log('[DEBUG] Delete result:', { data, error, count });

        if (error) {
            console.error('[DEBUG] Delete error:', error);
            throw error;
        }

        // Check if actually deleted
        if (count === 0) {
            console.error('[DEBUG] No rows deleted! RLS policy may be blocking delete.');
            showNotification('ไม่สามารถลบข้อมูลได้ (อาจเกิดจากสิทธิ์การเข้าถึง)', 'error');
            return;
        }

        console.log('[DEBUG] Delete successful! Rows affected:', count);
        showNotification('ลบข้อมูลสำเร็จ', 'success');
        closeDmDeleteModal();
        loadDriverMaster();
        loadFilterOptions();
    } catch (error) {
        console.error('[DEBUG] Error deleting driver master:', error);
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
export function initDriverMaster() {
    console.log('[DriverMaster] Initializing...');
    loadDriverMaster();
    loadFilterOptions();
}

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
