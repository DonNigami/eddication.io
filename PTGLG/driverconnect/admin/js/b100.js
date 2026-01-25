/**
 * B100 Jobs Module
 * Handles B100 (special fuel) jobs management
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let b100JobsTableBody = null;
let b100Search = null;
let b100StatusFilter = null;
let createB100Btn = null;
let b100Modal = null;
let b100Form = null;
let b100JobIdInput = null;
let b100ReferenceInput = null;
let b100DriverSelect = null;
let b100VehicleInput = null;
let b100OriginSelect = null;
let b100DestinationSelect = null;
let b100MaterialsSelect = null;
let b100QuantityInput = null;
let b100AmountInput = null;
let b100NotesInput = null;

const B100_TABLE_COLUMNS = 7;

/**
 * Set B100 DOM elements
 * @param {Object} elements - DOM elements
 */
export function setB100Elements(elements) {
    b100JobsTableBody = elements.tableBody;
    b100Search = elements.search;
    b100StatusFilter = elements.statusFilter;
    createB100Btn = elements.createBtn;
    b100Modal = elements.modal;
    b100Form = elements.form;
    b100JobIdInput = elements.jobIdInput;
    b100ReferenceInput = elements.referenceInput;
    b100DriverSelect = elements.driverSelect;
    b100VehicleInput = elements.vehicleInput;
    b100OriginSelect = elements.originSelect;
    b100DestinationSelect = elements.destinationSelect;
    b100MaterialsSelect = elements.materialsSelect;
    b100QuantityInput = elements.quantityInput;
    b100AmountInput = elements.amountInput;
    b100NotesInput = elements.notesInput;
}

/**
 * Load B100 jobs
 * @param {string} searchTerm - Search term
 * @param {string} statusFilter - Status filter
 */
export async function loadB100Jobs(searchTerm = '', statusFilter = '') {
    if (!b100JobsTableBody) {
        console.error('B100 jobs table body not set');
        return;
    }

    b100JobsTableBody.innerHTML = `<tr><td colspan="${B100_TABLE_COLUMNS}">Loading B100 jobs...</td></tr>`;

    try {
        let query = supabase
            .from('driver_jobs')
            .select('*')
            .eq('is_b100', true)
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        if (statusFilter) {
            query = query.eq('b100_status', statusFilter);
        }

        const { data: jobs, error } = await query;
        if (error) throw error;

        b100JobsTableBody.innerHTML = '';
        if (!jobs || jobs.length === 0) {
            b100JobsTableBody.innerHTML = `<tr><td colspan="${B100_TABLE_COLUMNS}">No B100 jobs found.</td></tr>`;
            return;
        }

        jobs.forEach(job => {
            const row = b100JobsTableBody.insertRow();

            row.insertCell().textContent = job.reference || 'N/A';
            row.insertCell().textContent = job.drivers || 'N/A';
            row.insertCell().textContent = job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A';
            row.insertCell().textContent = job.vehicle_plate || 'N/A';
            row.insertCell().textContent = job.b100_amount
                ? job.b100_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                : '0.00';

            // Status
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge badge-b100-${job.b100_status}`;
            statusSpan.textContent = job.b100_status || 'pending';
            statusCell.appendChild(statusSpan);

            // Actions
            const actionCell = row.insertCell();
            if (job.b100_status !== 'paid') {
                const paidButton = document.createElement('button');
                paidButton.className = 'mark-paid-btn';
                paidButton.dataset.jobId = job.id;
                paidButton.textContent = 'Mark Paid';
                paidButton.addEventListener('click', () => updateB100Status(job.id, 'paid'));
                actionCell.appendChild(paidButton);
            }
            if (job.b100_status === 'pending') {
                const outstandingButton = document.createElement('button');
                outstandingButton.className = 'mark-outstanding-btn';
                outstandingButton.dataset.jobId = job.id;
                outstandingButton.textContent = 'Outstanding';
                outstandingButton.addEventListener('click', () => updateB100Status(job.id, 'outstanding'));
                actionCell.appendChild(outstandingButton);
            }
        });

    } catch (error) {
        console.error('Error loading B100 jobs:', error);
        b100JobsTableBody.innerHTML = `<tr><td colspan="${B100_TABLE_COLUMNS}">Error: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Open B100 modal for create
 */
export async function openB100Modal() {
    if (!b100Modal) return;

    if (b100Form) b100Form.reset();
    if (b100JobIdInput) b100JobIdInput.value = '';

    // Generate default reference: B100-YYMMDD-XXX
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
    const { count } = await supabase
        .from('jobdata')
        .select('*', { count: 'exact', head: true })
        .ilike('reference', `B100-${today}%`);

    if (b100ReferenceInput) {
        b100ReferenceInput.value = `B100-${today}-${String((count || 0) + 1).padStart(3, '0')}`;
    }

    // Load drivers
    try {
        const { data: drivers } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name');

        if (b100DriverSelect) {
            b100DriverSelect.innerHTML = '<option value="">-- Select Driver --</option>';
            drivers?.forEach(driver => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ id: driver.user_id, name: driver.display_name });
                option.textContent = driver.display_name || driver.user_id;
                b100DriverSelect.appendChild(option);
            });
        }
    } catch (e) {
        console.warn('Could not load drivers:', e);
    }

    b100Modal.classList.remove('hidden');
}

/**
 * Close B100 modal
 */
export function closeB100Modal() {
    if (b100Modal) {
        b100Modal.classList.add('hidden');
    }
}

/**
 * Handle B100 form submit
 * @param {Event} event - Form submit event
 */
export async function handleB100Submit(event) {
    event.preventDefault();

    const driverData = b100DriverSelect?.value;
    const vehicle = b100VehicleInput?.value;
    const origin = b100OriginSelect?.value;
    const destination = b100DestinationSelect?.value;
    const materials = b100MaterialsSelect?.value;
    const quantity = parseFloat(b100QuantityInput?.value) || 0;
    const amount = parseFloat(b100AmountInput?.value) || 0;
    const notes = b100NotesInput?.value;
    const reference = b100ReferenceInput?.value;

    if (!driverData || !vehicle || !origin || !destination || quantity <= 0 || amount <= 0) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    const driver = JSON.parse(driverData);

    try {
        const jobData = {
            reference: reference,
            drivers: driver.name,
            driver_user_id: driver.id,
            vehicle_plate: vehicle,
            b100_origin: origin,
            b100_destination: destination,
            b100_materials: materials,
            b100_quantity: quantity,
            b100_amount: amount,
            b100_notes: notes,
            b100_status: 'pending',
            is_b100: true,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('driver_jobs').insert([jobData]);
        if (error) throw error;

        showNotification('B100 job created successfully', 'success');
        closeB100Modal();
        await loadB100Jobs(b100Search?.value, b100StatusFilter?.value);

    } catch (error) {
        console.error('Error creating B100 job:', error);
        showNotification(`Failed to create job: ${error.message}`, 'error');
    }
}

/**
 * Update B100 job status
 * @param {string} jobId - Job ID
 * @param {string} newStatus - New status
 */
export async function updateB100Status(jobId, newStatus) {
    try {
        const { error } = await supabase
            .from('driver_jobs')
            .update({ b100_status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', jobId);

        if (error) throw error;

        showNotification(`Status updated to ${newStatus}`, 'success');
        await loadB100Jobs(b100Search?.value, b100StatusFilter?.value);

    } catch (error) {
        console.error('Error updating B100 status:', error);
        showNotification(`Failed to update status: ${error.message}`, 'error');
    }
}
