/**
 * Users Module
 * Handles user management functions
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

const USERS_TABLE_COLUMNS = 5;

/**
 * Load users from database and populate table
 */
export async function loadUsers() {
    const usersTableBody = document.querySelector('#users-table tbody');
    if (!usersTableBody) {
        console.error('Users table body not found');
        return;
    }

    usersTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const { data: users, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
            return;
        }

        usersTableBody.innerHTML = ''; // Clear loading state
        users.forEach(user => {
            const row = usersTableBody.insertRow();
            row.dataset.userId = user.id; // UserProfile ID (serial)

            row.insertCell().textContent = user.display_name || 'N/A';
            row.insertCell().textContent = user.user_id;

            // Status select
            const statusCell = row.insertCell();
            const statusSelect = createStatusSelect(user.status);
            statusCell.appendChild(statusSelect);

            // Role select
            const roleCell = row.insertCell();
            const roleSelect = createRoleSelect(user.user_type);
            roleCell.appendChild(roleSelect);

            // Action button
            const actionCell = row.insertCell();
            const saveButton = document.createElement('button');
            saveButton.className = 'save-user-btn';
            saveButton.dataset.id = user.id;
            saveButton.textContent = 'Save';
            saveButton.addEventListener('click', handleUserUpdate);
            actionCell.appendChild(saveButton);
        });

    } catch (error) {
        console.error('Error loading users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="${USERS_TABLE_COLUMNS}">Error loading users: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Create status select element
 * @param {string} currentStatus - Current status value
 * @returns {HTMLSelectElement} Status select element
 */
function createStatusSelect(currentStatus) {
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    ['PENDING', 'APPROVED', 'REJECTED'].forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        if (currentStatus === status) option.selected = true;
        statusSelect.appendChild(option);
    });
    return statusSelect;
}

/**
 * Create role select element
 * @param {string} currentRole - Current role value
 * @returns {HTMLSelectElement} Role select element
 */
function createRoleSelect(currentRole) {
    const roleSelect = document.createElement('select');
    roleSelect.className = 'role-select';
    ['DRIVER', 'ADMIN'].forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        if (currentRole === role) option.selected = true;
        roleSelect.appendChild(option);
    });
    return roleSelect;
}

/**
 * Handle user update
 * @param {Event} event - Click event
 */
async function handleUserUpdate(event) {
    const button = event.currentTarget;
    const userId = button.dataset.id; // Get ID from button's data-id
    const row = button.closest('tr');
    const status = row.querySelector('.status-select').value;
    const userType = row.querySelector('.role-select').value;

    // Validate userId
    if (!userId || userId === 'undefined') {
        showNotification('ไม่สามารถอัพเดทได้: ไม่พบ User ID', 'error');
        return;
    }

    const originalText = button.textContent;
    button.textContent = 'Saving...';
    button.disabled = true;

    try {
        // Get current admin LINE User ID from localStorage (set during LIFF login)
        const adminUserId = localStorage.getItem('liff_user_id') || 'admin';

        // Prepare update data
        const updateData = {
            status: status,
            user_type: userType,
            updated_at: new Date().toISOString()
        };

        // Add approval tracking when approving
        if (status === 'APPROVED') {
            updateData.approved_by = adminUserId;
            updateData.approved_at = new Date().toISOString();
            updateData.rejection_reason = null; // Clear rejection reason if any
        } else if (status === 'REJECTED') {
            updateData.approved_by = null;
            updateData.approved_at = null;
            // Note: rejection_reason should be set via a separate dialog
        } else if (status === 'PENDING') {
            updateData.approved_by = null;
            updateData.approved_at = null;
            updateData.rejection_reason = null;
        }

        const { error } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', userId); // Use user_profiles.id (serial) for update

        if (error) throw error;

        const statusMessages = {
            'APPROVED': 'อนุมัติการใช้งานสำเร็จ!',
            'REJECTED': 'ปฏิเสธการใช้งานสำเร็จ',
            'PENDING': 'เปลี่ยนสถานะเป็นรออนุมัติสำเร็จ'
        };

        showNotification(statusMessages[status] || 'User updated successfully!', 'success');

    } catch (error) {
        console.error('Error updating user:', error);
        showNotification(`Failed to update user: ${error.message}`, 'error');
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}
