/**
 * Holiday Work Module
 * Handles holiday work approval workflow
 */

import { supabase } from '../admin.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let holidayWorkTableBody = null;
let holidayWorkSearch = null;
let holidayStatusFilter = null;
let holidayDateFrom = null;
let holidayDateTo = null;
let holidayRefreshBtn = null;
let pendingHolidayCount = null;
let approvedHolidayCount = null;
let rejectedHolidayCount = null;
let holidayApprovalModal = null;
let holidayApprovalForm = null;
let approvalReferenceInput = null;
let approvalReference = null;
let approvalDriver = null;
let approvalVehicle = null;
let approvalDate = null;
let approvalNotes = null;
let approvalComment = null;
let approvalAction = null;
let approvalModalTitle = null;
let approveBtnModal = null;
let rejectBtnModal = null;

// Realtime channel
let holidayWorkRealtimeChannel = null;

const HOLIDAY_TABLE_COLUMNS = 9;

/**
 * Set holiday work DOM elements
 * @param {Object} elements - DOM elements
 */
export function setHolidayWorkElements(elements) {
    holidayWorkTableBody = elements.tableBody;
    holidayWorkSearch = elements.search;
    holidayStatusFilter = elements.statusFilter;
    holidayDateFrom = elements.dateFrom;
    holidayDateTo = elements.dateTo;
    holidayRefreshBtn = elements.refreshBtn;
    pendingHolidayCount = elements.pendingCount;
    approvedHolidayCount = elements.approvedCount;
    rejectedHolidayCount = elements.rejectedCount;
    holidayApprovalModal = elements.approvalModal;
    holidayApprovalForm = elements.approvalForm;
    approvalReferenceInput = elements.referenceInput;
    approvalReference = elements.reference;
    approvalDriver = elements.driver;
    approvalVehicle = elements.vehicle;
    approvalDate = elements.date;
    approvalNotes = elements.notes;
    approvalComment = elements.comment;
    approvalAction = elements.action;
    approvalModalTitle = elements.modalTitle;
    approveBtnModal = elements.approveBtn;
    rejectBtnModal = elements.rejectBtn;
}

/**
 * Load holiday work jobs
 * @param {string} searchTerm - Search term
 * @param {string} statusFilter - Status filter
 */
export async function loadHolidayWorkJobs(searchTerm = '', statusFilter = 'pending') {
    if (!holidayWorkTableBody) {
        console.error('Holiday work table body not set');
        return;
    }

    holidayWorkTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;"><div style="font-size:24px;">⏳</div><p>กำลังโหลดข้อมูล...</p></td></tr>';

    try {
        let query = supabase
            .from('jobdata')
            .select('*')
            .eq('is_holiday_work', true)
            .order('job_closed_at', { ascending: false });

        // Filter by status
        if (statusFilter === 'pending') {
            query = query.or('holiday_work_approved.is.null,holiday_work_approved.eq.false')
                        .or('holiday_work_approved_at.is.null');
        } else if (statusFilter === 'approved') {
            query = query.eq('holiday_work_approved', true);
        } else if (statusFilter === 'rejected') {
            query = query.eq('holiday_work_approved', false).not('holiday_work_approved_at', 'is', null);
        }

        // Filter by date range
        if (holidayDateFrom?.value) {
            query = query.gte('job_closed_at', holidayDateFrom.value);
        }
        if (holidayDateTo?.value) {
            const endDate = new Date(holidayDateTo.value);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('job_closed_at', endDate.toISOString().split('T')[0]);
        }

        const { data: jobs, error } = await query;
        if (error) throw error;

        // Update summary counts
        await updateHolidaySummary();

        holidayWorkTableBody.innerHTML = '';
        if (jobs.length === 0) {
            holidayWorkTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px;">
                <div style="font-size:48px; margin-bottom:10px;">📭</div>
                <p>ไม่พบรายการ</p>
            </td></tr>`;
            return;
        }

        // Filter by search term
        let filteredJobs = jobs;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredJobs = jobs.filter(job =>
                (job.reference && job.reference.toLowerCase().includes(term)) ||
                (job.drivers && job.drivers.toLowerCase().includes(term)) ||
                (job.vehicle_desc && job.vehicle_desc.toLowerCase().includes(term))
            );
        }

        // Group by reference
        const groupedJobs = {};
        filteredJobs.forEach(job => {
            if (!groupedJobs[job.reference]) {
                groupedJobs[job.reference] = { ...job, stop_count: 1, all_seqs: [job.seq] };
            } else {
                groupedJobs[job.reference].stop_count++;
                groupedJobs[job.reference].all_seqs.push(job.seq);
            }
        });

        // Render rows
        Object.values(groupedJobs).forEach(job => {
            const row = holidayWorkTableBody.insertRow();

            // Reference
            const referenceCell = row.insertCell();
            const referenceStrong = document.createElement('strong');
            referenceStrong.textContent = job.reference || '-';
            referenceCell.appendChild(referenceStrong);

            // Date
            const closedDateCell = row.insertCell();
            closedDateCell.style.fontSize = '0.9rem';
            closedDateCell.textContent = job.job_closed_at
                ? new Date(job.job_closed_at).toLocaleString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                })
                : '-';

            row.insertCell().textContent = job.drivers || '-';

            // Vehicle
            const vehicleCell = row.insertCell();
            vehicleCell.style.fontSize = '0.9rem';
            vehicleCell.textContent = job.vehicle_desc || '-';

            // Stop count
            const stopCountCell = row.insertCell();
            stopCountCell.style.textAlign = 'center';
            const stopCountSpan = document.createElement('span');
            stopCountSpan.style.cssText = 'background:#2196f3;color:white;padding:2px 8px;border-radius:10px;font-size:0.85rem;';
            stopCountSpan.textContent = `${job.stop_count} จุด`;
            stopCountCell.appendChild(stopCountSpan);

            // Notes
            const notesCell = row.insertCell();
            notesCell.style.cssText = 'max-width:200px; font-size:0.85rem; line-height:1.4;';
            if (job.holiday_work_notes) {
                notesCell.textContent = job.holiday_work_notes;
            } else {
                const notesSpan = document.createElement('span');
                notesSpan.style.color = 'var(--text-sub)';
                notesSpan.textContent = '-';
                notesCell.appendChild(notesSpan);
            }

            // Status
            const statusCell = row.insertCell();
            const statusBadge = document.createElement('span');
            statusBadge.style.cssText = 'color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;';
            if (job.holiday_work_approved === true) {
                statusBadge.style.background = '#4caf50';
                statusBadge.textContent = '✅ อนุมัติแล้ว';
            } else if (job.holiday_work_approved === false && job.holiday_work_approved_at) {
                statusBadge.style.background = '#f44336';
                statusBadge.textContent = '❌ ปฏิเสธ';
            } else {
                statusBadge.style.background = '#ff9800';
                statusBadge.textContent = '⏳ รอดำเนินการ';
            }
            statusCell.appendChild(statusBadge);

            // Approved by
            const approvedByCell = row.insertCell();
            approvedByCell.style.fontSize = '0.85rem';
            if (job.holiday_work_approved_by) {
                const approvedByDiv = document.createElement('div');
                approvedByDiv.textContent = job.holiday_work_approved_by;
                approvedByCell.appendChild(approvedByDiv);

                const approvedAtSmall = document.createElement('small');
                approvedAtSmall.style.color = 'var(--text-sub)';
                approvedAtSmall.textContent = job.holiday_work_approved_at
                    ? new Date(job.holiday_work_approved_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                    : '';
                approvedByCell.appendChild(approvedAtSmall);
            } else {
                approvedByCell.textContent = '-';
            }

            // Actions
            const actionCell = row.insertCell();
            if (job.holiday_work_approved === true) {
                const approvedButton = document.createElement('button');
                approvedButton.disabled = true;
                approvedButton.style.cssText = 'opacity:0.5; cursor:not-allowed;';
                approvedButton.textContent = 'อนุมัติแล้ว';
                actionCell.appendChild(approvedButton);
            } else if (job.holiday_work_approved === false && job.holiday_work_approved_at) {
                const rejectedButton = document.createElement('button');
                rejectedButton.disabled = true;
                rejectedButton.style.cssText = 'opacity:0.5; cursor:not-allowed;';
                rejectedButton.textContent = 'ปฏิเสธแล้ว';
                actionCell.appendChild(rejectedButton);
            } else {
                const approveButton = document.createElement('button');
                approveButton.className = 'approve-holiday-btn';
                approveButton.style.cssText = 'background:#4caf50; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px;';
                approveButton.textContent = '✅ อนุมัติ';
                approveButton.addEventListener('click', () => openHolidayApprovalModal(job, 'approve'));
                actionCell.appendChild(approveButton);

                const rejectButton = document.createElement('button');
                rejectButton.className = 'reject-holiday-btn';
                rejectButton.style.cssText = 'background:#f44336; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;';
                rejectButton.textContent = '❌ ปฏิเสธ';
                rejectButton.addEventListener('click', () => openHolidayApprovalModal(job, 'reject'));
                actionCell.appendChild(rejectButton);
            }
        });

    } catch (error) {
        console.error('Error loading holiday work jobs:', error);
        holidayWorkTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #f44336;">
            ❌ เกิดข้อผิดพลาด: ${sanitizeHTML(error.message)}
        </td></tr>`;
    }
}

/**
 * Update holiday summary counts
 */
async function updateHolidaySummary() {
    try {
        // Pending
        const { data: pendingJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('is_holiday_work', true)
            .or('holiday_work_approved.is.null,holiday_work_approved.eq.false')
            .is('holiday_work_approved_at', null);

        // Approved
        const { data: approvedJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('is_holiday_work', true)
            .eq('holiday_work_approved', true);

        // Rejected
        const { data: rejectedJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('is_holiday_work', true)
            .eq('holiday_work_approved', false)
            .not('holiday_work_approved_at', 'is', null);

        // Count unique references
        const pendingCount = new Set((pendingJobs || []).map(j => j.reference)).size;
        const approvedCount = new Set((approvedJobs || []).map(j => j.reference)).size;
        const rejectedCount = new Set((rejectedJobs || []).map(j => j.reference)).size;

        if (pendingHolidayCount) pendingHolidayCount.textContent = pendingCount;
        if (approvedHolidayCount) approvedHolidayCount.textContent = approvedCount;
        if (rejectedHolidayCount) rejectedHolidayCount.textContent = rejectedCount;

        // Update navigation badge
        updateHolidayNavBadge(pendingCount);
    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

/**
 * Update navigation badge
 * @param {number} count - Count to display
 */
function updateHolidayNavBadge(count) {
    const navLink = document.querySelector('[data-target="holiday-work"]');
    if (!navLink) return;

    let badge = navLink.querySelector('.badge');

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge';
            badge.style.cssText = 'background: #ff9800; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem; margin-left: 5px; font-weight: bold;';
            navLink.appendChild(badge);
        }
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        if (badge) badge.classList.add('hidden');
    }
}

/**
 * Subscribe to holiday work realtime updates
 */
export function subscribeToHolidayWorkUpdates() {
    if (holidayWorkRealtimeChannel) {
        supabase.removeChannel(holidayWorkRealtimeChannel);
    }

    holidayWorkRealtimeChannel = supabase
        .channel('holiday-work-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'jobdata',
                filter: 'is_holiday_work=eq.true'
            },
            (payload) => {
                console.log('Holiday work change detected:', payload);

                const eventType = payload.eventType;
                if (eventType === 'INSERT') {
                    showNotification(`🆕 มีคำขอทำงานวันหยุดใหม่: ${payload.new.reference}`, 'info');
                } else if (eventType === 'UPDATE') {
                    if (payload.new.holiday_work_approved !== payload.old.holiday_work_approved) {
                        const status = payload.new.holiday_work_approved ? 'อนุมัติ' : 'ปฏิเสธ';
                        showNotification(`✅ อัพเดท: ${payload.new.reference} - ${status}`, 'info');
                    }
                }

                // Refresh data if on holiday work page
                const activeSection = document.querySelector('.content-section.active');
                if (activeSection && activeSection.id === 'holiday-work') {
                    setTimeout(() => {
                        loadHolidayWorkJobs(holidayWorkSearch?.value, holidayStatusFilter?.value);
                    }, 500);
                } else {
                    updateHolidaySummary();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to holiday work updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Failed to subscribe to holiday work updates');
                setTimeout(() => subscribeToHolidayWorkUpdates(), 5000);
            }
        });
}

/**
 * Unsubscribe from holiday work updates
 */
export function unsubscribeFromHolidayWorkUpdates() {
    if (holidayWorkRealtimeChannel) {
        supabase.removeChannel(holidayWorkRealtimeChannel);
        holidayWorkRealtimeChannel = null;
    }
}

/**
 * Open holiday approval modal
 * @param {Object} job - Job object
 * @param {string} action - 'approve' or 'reject'
 */
export function openHolidayApprovalModal(job, action) {
    if (!holidayApprovalModal) return;

    if (approvalReferenceInput) approvalReferenceInput.value = job.reference;
    const stopInfo = job.stop_count > 1 ? ` (${job.stop_count} จุด)` : '';
    if (approvalReference) approvalReference.textContent = `${job.reference}${stopInfo}`;
    if (approvalDriver) approvalDriver.textContent = job.drivers || '-';
    if (approvalVehicle) approvalVehicle.textContent = job.vehicle_desc || '-';
    if (approvalDate) {
        approvalDate.textContent = job.job_closed_at
            ? new Date(job.job_closed_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
            : '-';
    }
    if (approvalNotes) approvalNotes.textContent = job.holiday_work_notes || '(ไม่มีหมายเหตุ)';
    if (approvalComment) approvalComment.value = '';
    if (approvalAction) approvalAction.value = action;

    if (action === 'reject') {
        if (approvalModalTitle) approvalModalTitle.textContent = '❌ ปฏิเสธการทำงานวันหยุด';
        if (approveBtnModal) approveBtnModal.style.display = 'none';
        if (rejectBtnModal) rejectBtnModal.style.display = 'block';
    } else {
        if (approvalModalTitle) approvalModalTitle.textContent = '✅ อนุมัติการทำงานวันหยุด';
        if (approveBtnModal) approveBtnModal.style.display = 'block';
        if (rejectBtnModal) rejectBtnModal.style.display = 'block';
    }

    holidayApprovalModal.classList.remove('hidden');
}

/**
 * Close holiday approval modal
 */
export function closeHolidayApprovalModal() {
    if (holidayApprovalModal) {
        holidayApprovalModal.classList.add('hidden');
    }
    if (holidayApprovalForm) {
        holidayApprovalForm.reset();
    }
}

/**
 * Handle holiday approval form submit
 * @param {Event} event - Form submit event
 * @param {Object} liff - LIFF instance for getting profile
 */
export async function handleHolidayApprovalSubmit(event, liff) {
    event.preventDefault();

    const reference = approvalReferenceInput?.value;
    const action = approvalAction?.value;
    const comment = approvalComment?.value.trim();

    if (action === 'reject' && !comment) {
        showNotification('กรุณาระบุเหตุผลในการปฏิเสธ', 'error');
        return;
    }

    try {
        const lineProfile = await liff.getProfile();
        const adminName = lineProfile.displayName;

        const updateData = {
            holiday_work_approved: action === 'approve',
            holiday_work_approved_by: lineProfile.userId,
            holiday_work_approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (comment) {
            updateData.holiday_work_notes = (approvalNotes?.textContent || '') +
                `\n\n[${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} โดย ${adminName}]\n${comment}`;
        }

        const { error, count } = await supabase
            .from('jobdata')
            .update(updateData)
            .eq('reference', reference)
            .eq('is_holiday_work', true);

        if (error) throw error;

        const successMsg = action === 'approve'
            ? `✅ อนุมัติการทำงานวันหยุดสำเร็จ: ${reference}`
            : `❌ ปฏิเสธการทำงานวันหยุดแล้ว: ${reference}`;

        showNotification(successMsg, 'success');
        closeHolidayApprovalModal();
        await loadHolidayWorkJobs(holidayWorkSearch?.value, holidayStatusFilter?.value);
    } catch (error) {
        console.error('Error updating holiday approval:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}
