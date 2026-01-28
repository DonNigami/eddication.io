/**
 * Vehicle Breakdown Module
 * Handles vehicle breakdown and replacement job creation
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let breakdownTableBody = null;
let breakdownSearch = null;
let processBreakdownBtn = null;
let breakdownModal = null;
let breakdownForm = null;
let breakdownJobSelect = null;
let breakdownJobDetails = null;
let breakdownOriginalRef = null;
let breakdownDriver = null;
let breakdownVehicle = null;
let breakdownReason = null;
let breakdownNewVehicle = null;

// Cache for active jobs
let activeJobsCache = [];

const BREAKDOWN_TABLE_COLUMNS = 6;

/**
 * Set breakdown DOM elements
 * @param {Object} elements - DOM elements
 */
export function setBreakdownElements(elements) {
    breakdownTableBody = elements.tableBody;
    breakdownSearch = elements.search;
    processBreakdownBtn = elements.processBtn;
    breakdownModal = elements.modal;
    breakdownForm = elements.form;
    breakdownJobSelect = elements.jobSelect;
    breakdownJobDetails = elements.jobDetails;
    breakdownOriginalRef = elements.originalRef;
    breakdownDriver = elements.driver;
    breakdownVehicle = elements.vehicle;
    breakdownReason = elements.reason;
    breakdownNewVehicle = elements.newVehicle;
}

/**
 * Load vehicle breakdown records
 * @param {string} searchTerm - Search term
 */
export async function loadVehicleBreakdowns(searchTerm = '') {
    if (!breakdownTableBody) {
        console.error('Breakdown table body not set');
        return;
    }

    breakdownTableBody.innerHTML = `<tr><td colspan="${BREAKDOWN_TABLE_COLUMNS}">Loading breakdown records...</td></tr>`;

    try {
        let query = supabase
            .from('vehicle_breakdown')
            .select('*')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,original_ref.ilike.%${searchTerm}%,driver_name.ilike.%${searchTerm}%`);
        }

        const { data: breakdowns, error } = await query;
        if (error) throw error;

        breakdownTableBody.innerHTML = '';
        if (!breakdowns || breakdowns.length === 0) {
            breakdownTableBody.innerHTML = `<tr><td colspan="${BREAKDOWN_TABLE_COLUMNS}">No breakdown records found.</td></tr>`;
            return;
        }

        breakdowns.forEach(bd => {
            const row = breakdownTableBody.insertRow();

            row.insertCell().textContent = bd.original_ref || 'N/A';
            row.insertCell().textContent = bd.reference || 'N/A';
            row.insertCell().textContent = bd.driver_name || 'N/A';
            row.insertCell().textContent = `${bd.original_vehicle} → ${bd.new_vehicle}` || 'N/A';
            row.insertCell().textContent = bd.reason || 'N/A';

            // Status cell
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge badge-${bd.status || 'pending'}`;
            statusSpan.textContent = bd.status || 'pending';
            statusCell.appendChild(statusSpan);
        });

    } catch (error) {
        console.error('Error loading breakdowns:', error);

        // Check if table doesn't exist
        if (error.code === 'PGRST204' || error.code === 'PGRST116' || error.message?.includes('Could not find the table')) {
            breakdownTableBody.innerHTML = `
                <tr>
                    <td colspan="${BREAKDOWN_TABLE_COLUMNS}" style="text-align: center; padding: 30px;">
                        <div style="color: #ff9800; font-size: 48px; margin-bottom: 15px;">⚠️</div>
                        <h4 style="margin-bottom: 10px;">Table Not Found</h4>
                        <p style="color: #888; margin-bottom: 15px;">The <code>vehicle_breakdown</code> table doesn't exist.</p>
                        <details style="text-align: left; max-width: 700px; margin: 0 auto;">
                            <summary style="cursor: pointer; color: #2196f3; padding: 10px; background: #333; border-radius: 5px; margin-bottom: 10px;">
                                📋 Click to view SQL to create the table
                            </summary>
                            <pre style="background: #1a1a1a; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; color: #a5d6a7;">-- Migration file created: supabase/migrations/20260128_create_vehicle_breakdown_table.sql
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.vehicle_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE,
    original_ref TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_user_id TEXT,
    original_vehicle TEXT NOT NULL,
    new_vehicle TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled')),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_reference ON public.vehicle_breakdown(reference);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_original_ref ON public.vehicle_breakdown(original_ref);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_driver_user_id ON public.vehicle_breakdown(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_status ON public.vehicle_breakdown(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_created_at ON public.vehicle_breakdown(created_at DESC);

-- Enable RLS
ALTER TABLE public.vehicle_breakdown ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "vehicle_breakdown_select_policy" ON public.vehicle_breakdown
    FOR SELECT USING (true);

CREATE POLICY "vehicle_breakdown_insert_policy" ON public.vehicle_breakdown
    FOR INSERT WITH CHECK (true);

CREATE POLICY "vehicle_breakdown_update_policy" ON public.vehicle_breakdown
    FOR UPDATE USING (true);</pre>
                        </details>
                        <p style="color: #666; font-size: 12px; margin-top: 15px;">
                            <a href="https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new" target="_blank" style="color: #2196f3;">
                                🔗 Open Supabase SQL Editor
                            </a>
                        </p>
                    </td>
                </tr>
            `;
        } else {
            breakdownTableBody.innerHTML = `<tr><td colspan="${BREAKDOWN_TABLE_COLUMNS}">Error: ${sanitizeHTML(error.message)}</td></tr>`;
        }
    }
}

/**
 * Open breakdown modal
 */
export async function openBreakdownModal() {
    if (!breakdownModal) return;

    if (breakdownForm) breakdownForm.reset();
    if (breakdownJobDetails) breakdownJobDetails.classList.add('hidden');

    // Load active jobs for selection (jobs not yet closed)
    try {
        const { data: activeJobs, error } = await supabase
            .from('jobdata')
            .select('id, reference, drivers, vehicle_desc, job_closed_at, ship_to_name, ship_to_code')
            .is('job_closed_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group jobs by reference + ship_to_name combination
        const groupedJobs = [];
        const groupKeyMap = new Map(); // key -> index in groupedJobs

        (activeJobs || []).forEach(job => {
            const shipToName = job.ship_to_name || job.ship_to_code || 'shiptoname';
            const groupKey = `${job.reference}-${shipToName}`;

            if (groupKeyMap.has(groupKey)) {
                // Add to existing group
                const existingIndex = groupKeyMap.get(groupKey);
                groupedJobs[existingIndex].jobIds.push(job.id);
            } else {
                // Create new group
                groupKeyMap.set(groupKey, groupedJobs.length);
                groupedJobs.push({
                    groupKey: groupKey,
                    reference: job.reference,
                    shipToName: shipToName,
                    drivers: job.drivers,
                    vehicleDesc: job.vehicle_desc,
                    jobIds: [job.id]
                });
            }
        });

        activeJobsCache = groupedJobs;

        if (breakdownJobSelect) {
            breakdownJobSelect.innerHTML = '<option value="">-- เลือกงานที่กำลังดำเนินการ --</option>';
            groupedJobs.forEach(group => {
                const option = document.createElement('option');
                option.value = group.groupKey;
                option.textContent = `${group.groupKey} - ${group.drivers} (${group.vehicleDesc || 'N/A'})`;
                breakdownJobSelect.appendChild(option);
            });
        }

        breakdownModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading jobs:', error);
        showNotification('Failed to load jobs', 'error');
    }
}

/**
 * Close breakdown modal
 */
export function closeBreakdownModal() {
    if (breakdownModal) {
        breakdownModal.classList.add('hidden');
    }
}

/**
 * Handle breakdown job selection change
 */
export async function handleBreakdownJobSelect() {
    const groupKey = breakdownJobSelect?.value;
    if (!groupKey) {
        if (breakdownJobDetails) breakdownJobDetails.classList.add('hidden');
        return;
    }

    const group = activeJobsCache.find(g => g.groupKey === groupKey);
    if (!group) return;

    if (breakdownOriginalRef) breakdownOriginalRef.textContent = group.reference || 'N/A';
    if (breakdownDriver) breakdownDriver.textContent = group.drivers || 'N/A';
    if (breakdownVehicle) breakdownVehicle.textContent = group.vehicleDesc || 'N/A';

    if (breakdownJobDetails) breakdownJobDetails.classList.remove('hidden');
}

/**
 * Generate breakdown reference
 * @param {string} originalRef - Original job reference
 * @returns {string} New reference (format: originalRef-shiptoname)
 */
export function generateBreakdownReference(originalRef, newShipToName = 'shiptoname') {
    return `${originalRef}-${newShipToName}`;
}

/**
 * Handle breakdown form submit
 * @param {Event} event - Form submit event
 */
export async function handleBreakdownSubmit(event) {
    event.preventDefault();

    const groupKey = breakdownJobSelect?.value;
    const reason = breakdownReason?.value;
    const newVehicle = breakdownNewVehicle?.value;

    if (!groupKey) {
        showNotification('Please select a job', 'error');
        return;
    }
    if (!reason) {
        showNotification('Please enter breakdown reason', 'error');
        return;
    }
    if (!newVehicle) {
        showNotification('Please enter new vehicle', 'error');
        return;
    }

    try {
        // Get the selected group
        const group = activeJobsCache.find(g => g.groupKey === groupKey);
        if (!group) {
            showNotification('Selected job group not found', 'error');
            return;
        }

        // Get first job from group to fetch additional details
        const { data: firstJob, error: jobError } = await supabase
            .from('jobdata')
            .select('*')
            .eq('id', group.jobIds[0])
            .single();

        if (jobError) throw jobError;

        // Generate new reference for breakdown (format: reference-shipToName)
        const newRef = generateBreakdownReference(group.reference, group.shipToName);

        // Get driver user_id if available
        const driverUserId = firstJob.driver_user_id || null;

        // Create breakdown record
        const breakdownRecord = {
            reference: newRef,
            original_ref: group.reference,
            driver_name: group.drivers || 'N/A',
            driver_user_id: driverUserId,
            original_vehicle: group.vehicleDesc || 'N/A',
            new_vehicle: newVehicle,
            reason: reason,
            status: 'pending'
        };

        const { error: breakdownError } = await supabase
            .from('vehicle_breakdown')
            .insert([breakdownRecord]);

        if (breakdownError) throw breakdownError;

        // Mark all jobs in the group as breakdown
        await supabase
            .from('jobdata')
            .update({ status: 'breakdown' })
            .in('id', group.jobIds);

        showNotification(`Breakdown processed. New reference: ${newRef}`, 'success');
        closeBreakdownModal();
        await loadVehicleBreakdowns(breakdownSearch?.value);

    } catch (error) {
        console.error('Error processing breakdown:', error);
        showNotification(`Failed to process breakdown: ${error.message}`, 'error');
    }
}
