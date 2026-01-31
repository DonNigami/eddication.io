/**
 * DriverConnect Admin - Registration Approval Module
 * Handles driver registration approval workflow
 */

import { supabase } from '../../shared/config.js';

// State
let currentRegistration = null;
let currentReviewAction = null; // 'reject' or 'changes'

/**
 * Load registrations with filters
 */
export async function loadRegistrations() {
    const statusFilter = document.getElementById('reg-status-filter')?.value || 'all';
    const searchInput = document.getElementById('reg-search-input')?.value?.trim() || '';
    const tbody = document.getElementById('registration-tbody');

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-sub);">
                <div style="font-size: 48px; margin-bottom: 10px;">⏳</div>
                <p>กำลังโหลดข้อมูล...</p>
            </td>
        </tr>
    `;

    try {
        let query = supabase
            .from('register_data')
            .select('*')
            .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
            query = query.eq('registration_status', statusFilter);
        }

        if (searchInput) {
            query = query.or(`driver_name.ilike.%${searchInput}%,employee_code.ilike.%${searchInput}%,driver_sap_code.ilike.%${searchInput}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Update summary cards
        await updateSummaryCards();

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-sub);">
                        <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                        <p>ไม่พบข้อมูลการลงทะเบียน</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(reg => createRegistrationRow(reg)).join('');

        // Setup action buttons
        setupActionButtons();

    } catch (error) {
        console.error('Load registrations error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: var(--error);">
                    <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                    <p>เกิดข้อผิดพลาด: ${error.message}</p>
                </td>
            </tr>
        `;
    }
}

/**
 * Update summary cards
 */
async function updateSummaryCards() {
    try {
        const { data, error } = await supabase
            .from('register_data')
            .select('registration_status');

        if (error) throw error;

        const counts = {
            PENDING: 0,
            APPROVED: 0,
            REJECTED: 0,
            REQUIRES_CHANGES: 0,
            total: data?.length || 0
        };

        data?.forEach(item => {
            if (counts.hasOwnProperty(item.registration_status)) {
                counts[item.registration_status]++;
            }
        });

        document.getElementById('reg-pending-count').textContent = counts.PENDING;
        document.getElementById('reg-approved-count').textContent = counts.APPROVED;
        document.getElementById('reg-rejected-count').textContent = counts.REJECTED;
        document.getElementById('reg-total-count').textContent = counts.total;

        // Update badge
        const badge = document.getElementById('registration-badge');
        if (badge) {
            badge.textContent = counts.PENDING;
            badge.classList.toggle('hidden', counts.PENDING === 0);
        }

    } catch (error) {
        console.error('Update summary cards error:', error);
    }
}

/**
 * Create registration table row
 */
function createRegistrationRow(reg) {
    const statusClass = {
        'PENDING': 'pending',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'REQUIRES_CHANGES': 'changes'
    }[reg.registration_status] || '';

    const statusText = {
        'PENDING': '⏳ รอตรวจสอบ',
        'APPROVED': '✅ อนุมัติแล้ว',
        'REJECTED': '❌ ไม่อนุมัติ',
        'REQUIRES_CHANGES': '✏️ ต้องแก้ไข'
    }[reg.registration_status] || reg.registration_status;

    const statusStyle = {
        'PENDING': 'background: #FFF8E1; color: #FF6F00;',
        'APPROVED': 'background: #E8F5E9; color: #2E7D32;',
        'REJECTED': 'background: #FFEBEE; color: #C62828;',
        'REQUIRES_CHANGES': 'background: #E3F2FD; color: #1565C0;'
    }[reg.registration_status] || '';

    return `
        <tr data-id="${reg.id}">
            <td>${formatDate(reg.created_at)}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${reg.line_picture_url || 'https://via.placeholder.com/30'}"
                         alt="" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;"
                         onerror="this.src='https://via.placeholder.com/30'">
                    <span>${escapeHtml(reg.driver_name)}</span>
                </div>
            </td>
            <td style="font-family: monospace;">${escapeHtml(reg.employee_code || '-')}</td>
            <td style="font-family: monospace;">${escapeHtml(reg.driver_sap_code)}</td>
            <td>${escapeHtml(reg.section)}</td>
            <td>${escapeHtml(reg.truck_type)}</td>
            <td><span style="padding: 4px 10px; border-radius: 12px; font-size: 12px; ${statusStyle}">${statusText}</span></td>
            <td>
                <button class="btn-view-registration" data-id="${reg.id}" style="padding: 6px 12px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    ดูรายละเอียด
                </button>
            </td>
        </tr>
    `;
}

/**
 * Setup action buttons
 */
function setupActionButtons() {
    // View buttons
    document.querySelectorAll('.btn-view-registration').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            openRegistrationDetail(id);
        });
    });

    // Status filter
    const statusFilter = document.getElementById('reg-status-filter');
    if (statusFilter) {
        statusFilter.removeEventListener('change', loadRegistrations);
        statusFilter.addEventListener('change', loadRegistrations);
    }

    // Search input (debounce)
    const searchInput = document.getElementById('reg-search-input');
    if (searchInput) {
        let timeout;
        searchInput.removeEventListener('input', searchInput._debounceHandler);
        searchInput._debounceHandler = () => {
            clearTimeout(timeout);
            timeout = setTimeout(loadRegistrations, 500);
        };
        searchInput.addEventListener('input', searchInput._debounceHandler);
    }

    // Modal close buttons
    setupModalHandlers();
}

/**
 * Setup modal handlers
 */
function setupModalHandlers() {
    const detailModal = document.getElementById('registration-detail-modal');
    const reviewModal = document.getElementById('reg-review-modal');

    // Close detail modal
    document.getElementById('reg-modal-close')?.addEventListener('click', () => {
        detailModal?.classList.add('hidden');
    });

    document.getElementById('btn-close-registration')?.addEventListener('click', () => {
        detailModal?.classList.add('hidden');
    });

    // Close review modal
    document.getElementById('reg-review-modal-close')?.addEventListener('click', () => {
        reviewModal?.classList.add('hidden');
    });

    document.getElementById('btn-cancel-review')?.addEventListener('click', () => {
        reviewModal?.classList.add('hidden');
    });

    // Action buttons
    document.getElementById('btn-approve-registration')?.addEventListener('click', () => {
        approveRegistration();
    });

    document.getElementById('btn-reject-registration')?.addEventListener('click', () => {
        openReviewModal('reject');
    });

    document.getElementById('btn-request-changes')?.addEventListener('click', () => {
        openReviewModal('changes');
    });

    document.getElementById('btn-copy-driver-master')?.addEventListener('click', () => {
        copyToDriverMaster();
    });

    document.getElementById('btn-confirm-review')?.addEventListener('click', () => {
        confirmReview();
    });
}

/**
 * Open registration detail modal
 */
async function openRegistrationDetail(id) {
    try {
        const { data, error } = await supabase
            .from('register_data')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) {
            showToast('ไม่พบข้อมูล', 'error');
            return;
        }

        currentRegistration = data;

        // Populate modal
        document.getElementById('reg-detail-line-picture').src = data.line_picture_url || 'https://via.placeholder.com/60';
        document.getElementById('reg-detail-line-name').textContent = data.line_display_name || '-';
        document.getElementById('reg-detail-line-userid').textContent = data.line_user_id || '-';

        document.getElementById('reg-detail-employee-code').textContent = data.employee_code || '-';
        document.getElementById('reg-detail-driver-name').textContent = data.driver_name || '-';
        document.getElementById('reg-detail-sap-code').textContent = data.driver_sap_code || '-';
        document.getElementById('reg-detail-phone').textContent = data.phone_number || '-';

        document.getElementById('reg-detail-section').textContent = data.section || '-';
        document.getElementById('reg-detail-truck-type').textContent = data.truck_type || '-';
        document.getElementById('reg-detail-position').textContent = data.position || '-';
        document.getElementById('reg-detail-created').textContent = formatDate(data.created_at);

        // Review section
        const reviewSection = document.getElementById('reg-review-section');
        if (data.review_notes) {
            reviewSection.style.display = 'block';
            document.getElementById('reg-detail-review-notes').textContent = data.review_notes;
            document.getElementById('reg-detail-reviewed-by').textContent = data.reviewed_by || '-';
            document.getElementById('reg-detail-reviewed-at').textContent = formatDate(data.reviewed_at);
        } else {
            reviewSection.style.display = 'none';
        }

        // Show modal
        document.getElementById('registration-detail-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Open detail error:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

/**
 * Approve registration
 */
async function approveRegistration() {
    if (!currentRegistration) return;

    if (!confirm('ยืนยันการอนุมัติการลงทะเบียน?')) return;

    try {
        const { error } = await supabase
            .from('register_data')
            .update({
                registration_status: 'APPROVED',
                reviewed_by: getCurrentUserId(),
                reviewed_at: new Date().toISOString()
            })
            .eq('id', currentRegistration.id);

        if (error) throw error;

        showToast('อนุมัติเรียบร้อยแล้ว', 'success');
        closeModals();
        loadRegistrations();

    } catch (error) {
        console.error('Approve error:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

/**
 * Open review modal
 */
function openReviewModal(action) {
    currentReviewAction = action;

    const title = document.getElementById('reg-review-title');
    const desc = document.getElementById('reg-review-desc');

    if (action === 'reject') {
        title.textContent = '❌ ปฏิเสธการลงทะเบียน';
        desc.textContent = 'ระบุเหตุผลที่ปฏิเสธ (จะแสดงให้ผู้ใช้ทราบ):';
    } else {
        title.textContent = '✏️ ขอให้แก้ไขข้อมูล';
        desc.textContent = 'ระบุสิ่งที่ต้องการให้แก้ไข:';
    }

    document.getElementById('reg-review-notes').value = '';
    document.getElementById('reg-review-modal').classList.remove('hidden');
}

/**
 * Confirm review action
 */
async function confirmReview() {
    if (!currentRegistration) return;

    const notes = document.getElementById('reg-review-notes').value.trim();
    if (!notes) {
        showToast('กรุณาระบุเหตุผล', 'warning');
        return;
    }

    try {
        const newStatus = currentReviewAction === 'reject' ? 'REJECTED' : 'REQUIRES_CHANGES';

        const { error } = await supabase
            .from('register_data')
            .update({
                registration_status: newStatus,
                review_notes: notes,
                reviewed_by: getCurrentUserId(),
                reviewed_at: new Date().toISOString()
            })
            .eq('id', currentRegistration.id);

        if (error) throw error;

        showToast(currentReviewAction === 'reject' ? 'ปฏิเสธเรียบร้อยแล้ว' : 'ส่งคำขอแก้ไขเรียบร้อยแล้ว', 'success');
        closeModals();
        loadRegistrations();

    } catch (error) {
        console.error('Confirm review error:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

/**
 * Copy to driver_master
 */
async function copyToDriverMaster() {
    if (!currentRegistration) return;

    try {
        // Check if employee_code already exists
        const { data: existing } = await supabase
            .from('driver_master')
            .select('employee_code')
            .eq('employee_code', currentRegistration.employee_code)
            .single();

        const shouldUpdate = existing
            ? confirm(`รหัสพนักงาน ${currentRegistration.employee_code} มีอยู่แล้ว ต้องการอัปเดตหรือไม่?`)
            : true;

        if (!shouldUpdate) return;

        const masterData = {
            employee_code: currentRegistration.employee_code,
            driver_name: currentRegistration.driver_name,
            driver_sap_code: currentRegistration.driver_sap_code,
            section: currentRegistration.section,
            truck_type: currentRegistration.truck_type,
            position: currentRegistration.position
        };

        let result;
        if (existing) {
            result = await supabase
                .from('driver_master')
                .update(masterData)
                .eq('employee_code', currentRegistration.employee_code);
        } else {
            result = await supabase
                .from('driver_master')
                .insert(masterData);
        }

        if (result.error) throw result.error;

        showToast(`คัดลอกไป driver_master เรียบร้อยแล้ว (${existing ? 'อัปเดต' : 'สร้างใหม่'})`, 'success');

        // Also approve if pending
        if (currentRegistration.registration_status === 'PENDING') {
            await supabase
                .from('register_data')
                .update({
                    registration_status: 'APPROVED',
                    reviewed_by: getCurrentUserId(),
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', currentRegistration.id);

            loadRegistrations();
        }

    } catch (error) {
        console.error('Copy error:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

/**
 * Close all modals
 */
function closeModals() {
    document.getElementById('registration-detail-modal')?.classList.add('hidden');
    document.getElementById('reg-review-modal')?.classList.add('hidden');
    currentRegistration = null;
    currentReviewAction = null;
}

/**
 * Get current user ID from LIFF profile or localStorage
 */
function getCurrentUserId() {
    // Try to get from liffProfile if available
    if (window.liffProfile) {
        return window.liffProfile.userId;
    }
    // Fallback to localStorage
    return localStorage.getItem('admin_user_id') || 'admin';
}

/**
 * Helper functions
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#00C853' : type === 'error' ? '#D32F2F' : type === 'warning' ? '#FFA000' : '#333'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Add animation
if (!document.getElementById('toast-animation')) {
    const style = document.createElement('style');
    style.id = 'toast-animation';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Export loadRegistrations for global access
window.loadRegistrations = loadRegistrations;
