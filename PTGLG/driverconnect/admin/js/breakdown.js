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
            query = query.or(`reference.ilike.%${searchTerm}%,original_ref.ilike.%${searchTerm}%,driver.ilike.%${searchTerm}%`);
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
            row.insertCell().textContent = bd.driver || 'N/A';
            row.insertCell().textContent = bd.reason || 'N/A';
            row.insertCell().textContent = bd.created_at ? new Date(bd.created_at).toLocaleDateString() : 'N/A';

            // Status cell
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge badge-${bd.status || 'pending'}`;
            statusSpan.textContent = bd.status || 'pending';
            statusCell.appendChild(statusSpan);
        });

    } catch (error) {
        console.error('Error loading breakdowns:', error);
        breakdownTableBody.innerHTML = `<tr><td colspan="${BREAKDOWN_TABLE_COLUMNS}">Error: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Open breakdown modal
 */
export async function openBreakdownModal() {
    if (!breakdownModal) return;

    if (breakdownForm) breakdownForm.reset();
    if (breakdownJobDetails) breakdownJobDetails.classList.add('hidden');

    // Load active jobs for selection
    try {
        const { data: activeJobs, error } = await supabase
            .from('jobdata')
            .select('id, reference, drivers, vehicle_desc')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;

        activeJobsCache = activeJobs || [];

        if (breakdownJobSelect) {
            breakdownJobSelect.innerHTML = '<option value="">-- Select Job --</option>';
            activeJobsCache.forEach(job => {
                const option = document.createElement('option');
                option.value = job.id;
                option.textContent = `${job.reference} - ${job.drivers} (${job.vehicle_desc || 'N/A'})`;
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
    const jobId = breakdownJobSelect?.value;
    if (!jobId) {
        if (breakdownJobDetails) breakdownJobDetails.classList.add('hidden');
        return;
    }

    const job = activeJobsCache.find(j => j.id === jobId);
    if (!job) return;

    if (breakdownOriginalRef) breakdownOriginalRef.textContent = job.reference || 'N/A';
    if (breakdownDriver) breakdownDriver.textContent = job.drivers || 'N/A';
    if (breakdownVehicle) breakdownVehicle.textContent = job.vehicle_desc || 'N/A';

    if (breakdownJobDetails) breakdownJobDetails.classList.remove('hidden');
}

/**
 * Generate breakdown reference
 * @param {string} originalRef - Original job reference
 * @returns {string} New reference
 */
export function generateBreakdownReference(originalRef) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `BRK-${dateStr}-${random}`;
}

/**
 * Handle breakdown form submit
 * @param {Event} event - Form submit event
 */
export async function handleBreakdownSubmit(event) {
    event.preventDefault();

    const jobId = breakdownJobSelect?.value;
    const reason = breakdownReason?.value;
    const newVehicle = breakdownNewVehicle?.value;

    if (!jobId) {
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
        // Get original job
        const { data: originalJob, error: jobError } = await supabase
            .from('jobdata')
            .select('*')
            .eq('id', jobId)
            .single();

        if (jobError) throw jobError;

        // Generate new reference for breakdown
        const newRef = generateBreakdownReference(originalJob.reference);

        // Create breakdown record
        const breakdownRecord = {
            reference: newRef,
            original_ref: originalJob.reference,
            driver: originalJob.drivers,
            vehicle: newVehicle,
            reason: reason,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        const { error: breakdownError } = await supabase
            .from('vehicle_breakdown')
            .insert([breakdownRecord]);

        if (breakdownError) throw breakdownError;

        // Mark original job status as breakdown
        await supabase
            .from('jobdata')
            .update({ status: 'breakdown' })
            .eq('id', jobId);

        showNotification(`Breakdown processed. New reference: ${newRef}`, 'success');
        closeBreakdownModal();
        await loadVehicleBreakdowns(breakdownSearch?.value);

    } catch (error) {
        console.error('Error processing breakdown:', error);
        showNotification(`Failed to process breakdown: ${error.message}`, 'error');
    }
}
