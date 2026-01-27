/**
 * Payment Processing Module
 * Handles accounting workflow for driver incentive payments
 * Part of the 4PL incentive management system
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements cache
const elements = {
    // Table
    tbody: null,
    search: null,
    statusFilter: null,
    driverFilter: null,
    periodFilter: null,
    refreshBtn: null,
    exportBtn: null,
    selectAllCheckbox: null,

    // Bulk actions
    bulkActionsBar: null,
    selectedCount: null,
    selectedAmount: null,
    bankTransferBtn: null,
    bulkPaidBtn: null,
    clearSelectionBtn: null,

    // Summary counts
    pendingCount: null,
    pendingAmount: null,
    processingCount: null,
    processingAmount: null,
    completedCount: null,
    completedAmount: null,
    transferCount: null,
    transferAmount: null,

    // Detail modal
    detailModal: null,
    modalClose: null,
    detailReference: null,
    detailDriver: null,
    detailBank: null,
    detailAccount: null,
    detailAmount: null,
    detailStatus: null,
    detailDistance: null,
    detailStops: null,
    detailRate: null,
    detailNotes: null
};

// State
let allPayments = [];
let selectedPayments = new Set();
let drivers = [];

/**
 * Set DOM elements for the module
 */
export function setPaymentProcessingElements(els) {
    Object.assign(elements, els);
}

/**
 * Load payments for processing
 */
export async function loadPayments(filters = {}) {
    if (!elements.tbody) {
        console.error('Payment table body not set');
        return;
    }

    elements.tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;"><div style="font-size:24px;">⏳</div><p>กำลังโหลดข้อมูล...</p></td></tr>';

    try {
        let query = supabase
            .from('jobdata')
            .select('*')
            .eq('incentive_approved', true)
            .not('job_closed_at', 'is', null)
            .order('job_closed_at', { ascending: false });

        // Status filter
        const statusFilter = filters.status || elements.statusFilter?.value || 'ready';
        if (statusFilter === 'ready') {
            query = query.is('payment_status', null);
        } else if (statusFilter === 'processing') {
            query = query.eq('payment_status', 'processing');
        } else if (statusFilter === 'paid') {
            query = query.eq('payment_status', 'paid');
        } else if (statusFilter === 'transfer_pending') {
            query = query.eq('payment_status', 'transfer_pending');
        }

        // Driver filter
        if (filters.driver || elements.driverFilter?.value) {
            query = query.eq('drivers', filters.driver || elements.driverFilter.value);
        }

        // Period filter
        const periodFilter = filters.period || elements.periodFilter?.value || 'current';
        if (periodFilter === 'current') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            query = query.gte('job_closed_at', startOfMonth.toISOString());
        } else if (periodFilter === 'last_month') {
            const now = new Date();
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            query = query.gte('job_closed_at', startOfLastMonth.toISOString())
                       .lte('job_closed_at', endOfLastMonth.toISOString());
        }

        const { data: jobs, error } = await query.limit(500);
        if (error) throw error;

        allPayments = jobs || [];
        await updateSummary();
        await loadDriverOptions();

        // Apply search filter
        let filteredPayments = allPayments;
        if (filters.search || elements.search?.value) {
            const term = (filters.search || elements.search.value).toLowerCase();
            filteredPayments = allPayments.filter(job =>
                (job.reference && job.reference.toLowerCase().includes(term)) ||
                (job.drivers && job.drivers.toLowerCase().includes(term))
            );
        }

        renderTable(filteredPayments);

    } catch (error) {
        console.error('Error loading payments:', error);
        elements.tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #f44336;">
            ❌ เกิดข้อผิดพลาด: ${sanitizeHTML(error.message)}
        </td></tr>`;
    }
}

/**
 * Render the payment table
 */
function renderTable(payments) {
    elements.tbody.innerHTML = '';
    selectedPayments.clear();
    updateBulkActions();

    if (payments.length === 0) {
        elements.tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">
            <div style="font-size:48px; margin-bottom:10px;">📭</div>
            <p>ไม่พบรายการ</p>
        </td></tr>`;
        return;
    }

    // Group by reference
    const groupedPayments = {};
    payments.forEach(job => {
        if (!groupedPayments[job.reference]) {
            groupedPayments[job.reference] = {
                ...job,
                amount: job.incentive_amount || 0
            };
        }
    });

    // Render rows
    Object.values(groupedPayments).forEach(job => {
        const row = elements.tbody.insertRow();

        // Checkbox
        const checkboxCell = row.insertCell();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'payment-checkbox';
        checkbox.dataset.reference = job.reference;
        checkbox.dataset.amount = job.amount || 0;
        checkbox.addEventListener('change', handleCheckboxChange);
        checkboxCell.appendChild(checkbox);

        // Reference
        row.insertCell().textContent = job.reference || '-';

        // Driver
        const driverCell = row.insertCell();
        driverCell.textContent = job.drivers || '-';

        // Bank info
        const bankCell = row.insertCell();
        bankCell.style.fontSize = '0.9rem';
        bankCell.textContent = job.bank_name && job.bank_account_number
            ? `${job.bank_name} ${job.bank_account_number}`
            : '-';

        // Distance
        const distanceCell = row.insertCell();
        distanceCell.textContent = (job.incentive_distance || job.distance_km || 0).toFixed(1) + ' km';

        // Amount
        const amountCell = row.insertCell();
        amountCell.innerHTML = `<strong style="color: #4caf50;">฿${((job.amount || job.incentive_amount || 0)).toFixed(2)}</strong>`;

        // Status
        const statusCell = row.insertCell();
        const statusBadge = document.createElement('span');
        statusBadge.style.cssText = 'color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;';

        switch (job.payment_status) {
            case 'paid':
                statusBadge.style.background = '#4caf50';
                statusBadge.textContent = '✅ ชำระแล้ว';
                break;
            case 'processing':
                statusBadge.style.background = '#2196f3';
                statusBadge.textContent = '⏳ กำลังดำเนินการ';
                break;
            case 'transfer_pending':
                statusBadge.style.background = '#9c27b0';
                statusBadge.textContent = '🏦 รอโอนเงิน';
                break;
            default:
                statusBadge.style.background = '#ff9800';
                statusBadge.textContent = '💵 รอชำระ';
        }
        statusCell.appendChild(statusBadge);

        // Actions
        const actionCell = row.insertCell();
        const viewBtn = document.createElement('button');
        viewBtn.textContent = '👁️ รายละเอียด';
        viewBtn.style.cssText = 'background:var(--primary-color); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right: 5px;';
        viewBtn.addEventListener('click', () => openDetailModal(job));
        actionCell.appendChild(viewBtn);

        // Only show action buttons for non-paid items
        if (job.payment_status !== 'paid') {
            if (job.payment_status !== 'transfer_pending') {
                const transferBtn = document.createElement('button');
                transferBtn.textContent = '🏦 โอนเงิน';
                transferBtn.style.cssText = 'background:#9c27b0; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right: 5px;';
                transferBtn.addEventListener('click', () => markForTransfer(job));
                actionCell.appendChild(transferBtn);
            }

            const paidBtn = document.createElement('button');
            paidBtn.textContent = '✅ ชำระแล้ว';
            paidBtn.style.cssText = 'background:#4caf50; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;';
            paidBtn.addEventListener('click', () => markAsPaid(job));
            actionCell.appendChild(paidBtn);
        }
    });
}

/**
 * Handle checkbox change
 */
function handleCheckboxChange(e) {
    const checkbox = e.target;
    const reference = checkbox.dataset.reference;
    const amount = parseFloat(checkbox.dataset.amount) || 0;

    if (checkbox.checked) {
        selectedPayments.set(reference, amount);
    } else {
        selectedPayments.delete(reference);
    }

    updateBulkActions();
}

/**
 * Update bulk actions bar
 */
function updateBulkActions() {
    if (!elements.bulkActionsBar) return;

    if (selectedPayments.size > 0) {
        elements.bulkActionsBar.style.display = 'block';

        const totalAmount = Array.from(selectedPayments.values()).reduce((sum, amount) => sum + amount, 0);

        if (elements.selectedCount) elements.selectedCount.textContent = selectedPayments.size;
        if (elements.selectedAmount) elements.selectedAmount.textContent = `฿${totalAmount.toFixed(2)}`;
    } else {
        elements.bulkActionsBar.style.display = 'none';
    }
}

/**
 * Select all checkboxes
 */
export function selectAll(checked) {
    const checkboxes = elements.tbody?.querySelectorAll('.payment-checkbox');
    checkboxes?.forEach(checkbox => {
        checkbox.checked = checked;
        const reference = checkbox.dataset.reference;
        const amount = parseFloat(checkbox.dataset.amount) || 0;

        if (checked) {
            selectedPayments.set(reference, amount);
        } else {
            selectedPayments.delete(reference);
        }
    });

    updateBulkActions();
}

/**
 * Clear selection
 */
export function clearSelection() {
    const checkboxes = elements.tbody?.querySelectorAll('.payment-checkbox');
    checkboxes?.forEach(checkbox => checkbox.checked = false);
    selectedPayments.clear();
    updateBulkActions();
}

/**
 * Update summary counts
 */
async function updateSummary() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Pending
        const { data: pendingJobs } = await supabase
            .from('jobdata')
            .select('incentive_amount')
            .eq('incentive_approved', true)
            .is('payment_status', null);

        // Processing
        const { data: processingJobs } = await supabase
            .from('jobdata')
            .select('incentive_amount')
            .eq('payment_status', 'processing');

        // Completed this month
        const { data: completedJobs } = await supabase
            .from('jobdata')
            .select('incentive_amount')
            .eq('payment_status', 'paid')
            .gte('paid_at', startOfMonth.toISOString());

        // Transfer pending
        const { data: transferJobs } = await supabase
            .from('jobdata')
            .select('incentive_amount')
            .eq('payment_status', 'transfer_pending');

        const sumAmount = (jobs) => (jobs || []).reduce((sum, j) => sum + (j.incentive_amount || 0), 0);

        if (elements.pendingCount) elements.pendingCount.textContent = new Set((pendingJobs || []).map(j => j.reference)).size;
        if (elements.pendingAmount) elements.pendingAmount.textContent = `฿${sumAmount(pendingJobs).toFixed(0)}`;

        if (elements.processingCount) elements.processingCount.textContent = new Set((processingJobs || []).map(j => j.reference)).size;
        if (elements.processingAmount) elements.processingAmount.textContent = `฿${sumAmount(processingJobs).toFixed(0)}`;

        if (elements.completedCount) elements.completedCount.textContent = new Set((completedJobs || []).map(j => j.reference)).size;
        if (elements.completedAmount) elements.completedAmount.textContent = `฿${sumAmount(completedJobs).toFixed(0)}`;

        if (elements.transferCount) elements.transferCount.textContent = new Set((transferJobs || []).map(j => j.reference)).size;
        if (elements.transferAmount) elements.transferAmount.textContent = `฿${sumAmount(transferJobs).toFixed(0)}`;

    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

/**
 * Load driver options
 */
async function loadDriverOptions() {
    try {
        const { data } = await supabase
            .from('jobdata')
            .select('drivers')
            .eq('incentive_approved', true)
            .not('drivers', 'is', null);

        const uniqueDrivers = [...new Set((data || []).map(j => j.drivers).filter(d => d))];
        drivers = uniqueDrivers;

        if (elements.driverFilter) {
            elements.driverFilter.innerHTML = '<option value="">คนขับทั้งหมด</option>';
            uniqueDrivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver;
                option.textContent = driver;
                elements.driverFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading drivers:', error);
    }
}

/**
 * Open detail modal
 */
export function openDetailModal(job) {
    if (!elements.detailModal) return;

    if (elements.detailReference) elements.detailReference.textContent = job.reference;
    if (elements.detailDriver) elements.detailDriver.textContent = job.drivers || '-';
    if (elements.detailBank) elements.detailBank.textContent = job.bank_name || '-';
    if (elements.detailAccount) elements.detailAccount.textContent = job.bank_account_number || '-';

    const amount = job.incentive_amount || 0;
    if (elements.detailAmount) elements.detailAmount.textContent = `฿${amount.toFixed(2)}`;

    // Status badge
    if (elements.detailStatus) {
        let statusText = 'รอชำระ';
        let statusColor = '#ff9800';

        switch (job.payment_status) {
            case 'paid':
                statusText = '✅ ชำระแล้ว';
                statusColor = '#4caf50';
                break;
            case 'processing':
                statusText = '⏳ กำลังดำเนินการ';
                statusColor = '#2196f3';
                break;
            case 'transfer_pending':
                statusText = '🏦 รอโอนเงิน';
                statusColor = '#9c27b0';
                break;
        }

        elements.detailStatus.innerHTML = `<span style="color: white; padding: 4px 8px; border-radius: 4px; background: ${statusColor};">${statusText}</span>`;
    }

    if (elements.detailDistance) elements.detailDistance.textContent = (job.incentive_distance || job.distance_km || 0).toFixed(1);
    if (elements.detailStops) elements.detailStops.textContent = job.incentive_stops || 0;
    if (elements.detailRate) elements.detailRate.textContent = (job.incentive_rate || 0).toFixed(2);
    if (elements.detailNotes) elements.detailNotes.value = job.payment_notes || '';

    // Store current job reference
    elements.detailModal.dataset.reference = job.reference;

    elements.detailModal.classList.remove('hidden');
}

/**
 * Close detail modal
 */
export function closeDetailModal() {
    if (elements.detailModal) {
        elements.detailModal.classList.add('hidden');
    }
}

/**
 * Mark as paid
 */
export async function markAsPaid(job) {
    const reference = typeof job === 'string' ? job : job?.reference;
    if (!reference) return;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('reference', reference);

        if (error) throw error;

        showNotification(`✅ บันทึกการชำระเงินสำเร็จ: ${reference}`, 'success');
        closeDetailModal();
        await loadPayments();
    } catch (error) {
        console.error('Error marking as paid:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Mark for bank transfer
 */
export async function markForTransfer(job) {
    const reference = typeof job === 'string' ? job : job?.reference;
    if (!reference) return;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({
                payment_status: 'transfer_pending',
                updated_at: new Date().toISOString()
            })
            .eq('reference', reference);

        if (error) throw error;

        showNotification(`🏦 บันทึกสถานะโอนเงินสำเร็จ: ${reference}`, 'success');
        closeDetailModal();
        await loadPayments();
    } catch (error) {
        console.error('Error marking for transfer:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Bulk mark as paid
 */
export async function bulkMarkAsPaid() {
    if (selectedPayments.size === 0) return;

    try {
        const references = Array.from(selectedPayments.keys());

        const { error } = await supabase
            .from('jobdata')
            .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .in('reference', references);

        if (error) throw error;

        showNotification(`✅ บันทึกการชำระเงิน ${references.length} รายการสำเร็จ`, 'success');
        clearSelection();
        await loadPayments();
    } catch (error) {
        console.error('Error bulk marking as paid:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Bulk mark for bank transfer
 */
export async function bulkMarkForTransfer() {
    if (selectedPayments.size === 0) return;

    try {
        const references = Array.from(selectedPayments.keys());

        const { error } = await supabase
            .from('jobdata')
            .update({
                payment_status: 'transfer_pending',
                updated_at: new Date().toISOString()
            })
            .in('reference', references);

        if (error) throw error;

        showNotification(`🏦 บันทึกสถานะโอนเงิน ${references.length} รายการสำเร็จ`, 'success');
        clearSelection();
        await loadPayments();
    } catch (error) {
        console.error('Error bulk marking for transfer:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Save payment notes
 */
export async function savePaymentNotes(reference, notes) {
    if (!reference) return;

    try {
        const { error } = await supabase
            .from('jobdata')
            .update({
                payment_notes: notes,
                updated_at: new Date().toISOString()
            })
            .eq('reference', reference);

        if (error) throw error;

        showNotification(`💾 บันทึกหมายเหตุสำเร็จ`, 'success');
    } catch (error) {
        console.error('Error saving notes:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

/**
 * Export payment summary
 */
export async function exportPaymentSummary() {
    try {
        const { data: jobs } = await supabase
            .from('jobdata')
            .select('*')
            .eq('incentive_approved', true)
            .is('payment_status', null);

        if (!jobs || jobs.length === 0) {
            showNotification('ไม่มีข้อมูลสำหรับส่งออก', 'warning');
            return;
        }

        // Group by driver
        const byDriver = {};
        jobs.forEach(job => {
            const driver = job.drivers || 'Unknown';
            if (!byDriver[driver]) {
                byDriver[driver] = {
                    driver,
                    bankName: job.bank_name || '-',
                    bankAccount: job.bank_account_number || '-',
                    trips: [],
                    totalAmount: 0
                };
            }
            byDriver[driver].trips.push({
                reference: job.reference,
                date: job.job_closed_at,
                distance: job.incentive_distance || 0,
                amount: job.incentive_amount || 0
            });
            byDriver[driver].totalAmount += job.incentive_amount || 0;
        });

        // Generate CSV
        let csv = 'Driver,Bank Name,Account Number,Total Trips,Total Amount (THB)\n';
        Object.values(byDriver).forEach(d => {
            csv += `"${d.driver}","${d.bankName}","${d.bankAccount}",${d.trips.length},${d.totalAmount.toFixed(2)}\n`;
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `payment-summary-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        showNotification('📥 ส่งออกข้อมูลสำเร็จ', 'success');
    } catch (error) {
        console.error('Error exporting:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}
