/**
 * Jobs Module
 * Handles job management functions
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements (will be set during initialization)
let jobsTableBody = null;
let jobModal = null;
let jobForm = null;
let jobIdInput = null;
let jobReferenceInput = null;
let jobShipmentNoInput = null;
let jobDriverInput = null;
let jobStatusInput = null;
let jobTripEndedInput = null;
let jobDetailsModal = null;
let jobDetailsReferenceTitle = null;
let detailJobReference = null;
let detailJobShipmentNo = null;
let detailJobDriver = null;
let detailJobVehicle = null;
let detailJobRoute = null;
let detailJobStatus = null;
let detailJobClosed = null;
let detailJobCreatedAt = null;
let detailJobUpdatedAt = null;
// Incentive & Payment fields
let detailJobIncentiveApproved = null;
let detailJobIncentiveAmount = null;
let detailJobIncentiveStops = null;
let detailJobPaymentStatus = null;
let detailJobPaidAt = null;
let jobDetailsStopsTableBody = null;
let jobDetailsAlcoholTableBody = null;
let jobDetailsLogsTableBody = null;

const JOBS_TABLE_COLUMNS = 6;

/**
 * Set job-related DOM elements
 * @param {Object} elements - DOM elements for job management
 */
export function setJobElements(elements) {
    jobsTableBody = elements.tableBody;
    jobModal = elements.modal;
    jobForm = elements.form;
    jobIdInput = elements.idInput;
    jobReferenceInput = elements.referenceInput;
    jobShipmentNoInput = elements.shipmentNoInput;
    jobDriverInput = elements.driverInput;
    jobStatusInput = elements.statusInput;
    jobTripEndedInput = elements.tripEndedInput;
    jobDetailsModal = elements.detailsModal;
    jobDetailsReferenceTitle = elements.detailsReferenceTitle;
    detailJobReference = elements.detailReference;
    detailJobShipmentNo = elements.detailShipmentNo;
    detailJobDriver = elements.detailDriver;
    detailJobVehicle = elements.detailVehicle;
    detailJobRoute = elements.detailRoute;
    detailJobStatus = elements.detailStatus;
    detailJobClosed = elements.detailClosed;
    detailJobCreatedAt = elements.detailCreatedAt;
    detailJobUpdatedAt = elements.detailUpdatedAt;
    // Incentive & Payment
    detailJobIncentiveApproved = elements.detailIncentiveApproved;
    detailJobIncentiveAmount = elements.detailIncentiveAmount;
    detailJobIncentiveStops = elements.detailIncentiveStops;
    detailJobPaymentStatus = elements.detailPaymentStatus;
    detailJobPaidAt = elements.detailPaidAt;
    // Tables
    jobDetailsStopsTableBody = elements.stopsTableBody;
    jobDetailsAlcoholTableBody = elements.alcoholTableBody;
    jobDetailsLogsTableBody = elements.logsTableBody;
}

/**
 * Load jobs from database and populate table
 * @param {string} searchTerm - Search term for filtering
 */
export async function loadJobs(searchTerm = '') {
    if (!jobsTableBody) {
        console.error('Jobs table body not set');
        return;
    }

    jobsTableBody.innerHTML = `<tr><td colspan="${JOBS_TABLE_COLUMNS}">Loading jobs...</td></tr>`;

    try {
        // Query from jobdata table - get unique references with their data
        // jobdata has one row per stop, so we need to get distinct references
        let query = supabase
            .from('jobdata')
            .select('*')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,shipment_no.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        const { data: allRows, error } = await query;

        if (error) throw error;

        jobsTableBody.innerHTML = '';

        if (!allRows || allRows.length === 0) {
            jobsTableBody.innerHTML = `<tr><td colspan="${JOBS_TABLE_COLUMNS}">No jobs found.</td></tr>`;
            return;
        }

        // Group by reference (since jobdata has one row per stop)
        const jobsMap = new Map();
        allRows.forEach(row => {
            if (!jobsMap.has(row.reference)) {
                jobsMap.set(row.reference, row);
            }
        });

        const jobs = Array.from(jobsMap.values());

        jobs.forEach(job => {
            const row = jobsTableBody.insertRow();
            row.dataset.jobId = job.id;
            row.dataset.reference = job.reference;

            row.insertCell().textContent = job.reference || 'N/A';
            row.insertCell().textContent = job.shipment_no || 'N/A';
            row.insertCell().textContent = job.drivers || 'N/A';
            row.insertCell().textContent = job.status || 'N/A';
            row.insertCell().textContent = job.job_closed_at ? 'Yes' : 'No';

            const actionCell = row.insertCell();

            // Edit button
            const editButton = createActionButton('edit-job-btn', 'Edit', () => {
                openJobModal(job);
            });
            actionCell.appendChild(editButton);

            // Details button
            const detailsButton = document.createElement('button');
            detailsButton.className = 'view-details-btn';
            detailsButton.dataset.jobId = job.id;
            detailsButton.dataset.reference = job.reference;
            detailsButton.textContent = 'Details';
            detailsButton.addEventListener('click', () => openJobDetailsModal(job.reference));
            detailsButton.style.marginLeft = '5px';
            actionCell.appendChild(detailsButton);

            // Delete button
            const deleteButton = createActionButton('delete-job-btn', 'Delete', () => {
                handleDeleteJob(job.reference);
            });
            deleteButton.style.backgroundColor = '#e74c3c';
            deleteButton.style.marginLeft = '5px';
            actionCell.appendChild(deleteButton);
        });

    } catch (error) {
        console.error('Error loading jobs:', error);
        jobsTableBody.innerHTML = `<tr><td colspan="${JOBS_TABLE_COLUMNS}">Error loading jobs: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Create an action button
 * @param {string} className - CSS class name
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @returns {HTMLButtonElement} Button element
 */
function createActionButton(className, text, onClick) {
    const button = document.createElement('button');
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
}

/**
 * Open job modal for create/edit
 * @param {Object} job - Job object (null for create)
 */
export function openJobModal(job = null) {
    if (!jobForm) {
        console.error('Job form not set');
        return;
    }

    jobForm.reset();
    if (jobIdInput) jobIdInput.value = '';

    if (job) {
        if (jobIdInput) jobIdInput.value = job.id;
        if (jobReferenceInput) jobReferenceInput.value = job.reference || '';
        if (jobShipmentNoInput) jobShipmentNoInput.value = job.shipment_no || '';
        if (jobDriverInput) jobDriverInput.value = job.drivers || '';
        if (jobStatusInput) jobStatusInput.value = job.status || 'pending';
        // Use job_closed_at instead of trip_ended
        if (jobTripEndedInput) jobTripEndedInput.checked = !!job.job_closed_at;
    }
    if (jobModal) jobModal.classList.remove('hidden');
}

/**
 * Close job modal
 */
export function closeJobModal() {
    if (jobModal) jobModal.classList.add('hidden');
}

/**
 * Handle job form submit
 * @param {Event} event - Form submit event
 */
export async function handleJobSubmit(event) {
    event.preventDefault();

    const jobId = jobIdInput?.value;
    const reference = jobReferenceInput?.value || '';

    const jobData = {
        reference: reference,
        shipment_no: jobShipmentNoInput?.value || '',
        drivers: jobDriverInput?.value || '',
        status: jobStatusInput?.value || 'pending',
        job_closed_at: jobTripEndedInput?.checked ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
    };

    try {
        let error = null;
        if (jobId) {
            // Update existing job (by id in jobdata)
            ({ error } = await supabase.from('jobdata').update(jobData).eq('id', jobId));
        } else {
            // Create new job
            jobData.created_at = new Date().toISOString();
            jobData.seq = 1; // Default sequence
            jobData.is_origin_stop = true; // Mark as origin stop by default
            ({ error } = await supabase.from('jobdata').insert([jobData]));
        }

        if (error) throw error;

        showNotification(`Job ${jobId ? 'updated' : 'created'} successfully!`, 'success');
        closeJobModal();
        await loadJobs();

    } catch (error) {
        console.error(`Error ${jobId ? 'updating' : 'creating'} job:`, error);
        showNotification(`Failed to ${jobId ? 'update' : 'create'} job: ${error.message}`, 'error');
    }
}

/**
 * Handle job delete
 * @param {string} reference - Job reference to delete (deletes all rows with same reference)
 */
export async function handleDeleteJob(reference) {
    if (!confirm(`Are you sure you want to delete job ${reference}? This will delete all stops for this job.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('jobdata')
            .delete()
            .eq('reference', reference);

        if (error) throw error;

        showNotification('Job deleted successfully!', 'success');
        await loadJobs();
    } catch (error) {
        console.error('Error deleting job:', error);
        showNotification(`Failed to delete job: ${error.message}`, 'error');
    }
}

/**
 * Open job details modal
 * @param {string} reference - Job reference to show details for
 */
export async function openJobDetailsModal(reference) {
    if (!jobDetailsModal) {
        console.error('Job details modal not set');
        return;
    }

    jobDetailsModal.classList.remove('hidden');

    // Clear previous data
    if (jobDetailsReferenceTitle) jobDetailsReferenceTitle.textContent = 'Loading...';
    if (detailJobReference) detailJobReference.textContent = 'Loading...';
    if (detailJobShipmentNo) detailJobShipmentNo.textContent = 'Loading...';
    if (detailJobDriver) detailJobDriver.textContent = 'Loading...';
    if (detailJobVehicle) detailJobVehicle.textContent = 'Loading...';
    if (detailJobRoute) detailJobRoute.textContent = 'Loading...';
    if (detailJobStatus) detailJobStatus.textContent = 'Loading...';
    if (detailJobClosed) detailJobClosed.textContent = 'Loading...';
    if (detailJobCreatedAt) detailJobCreatedAt.textContent = 'Loading...';
    if (detailJobUpdatedAt) detailJobUpdatedAt.textContent = 'Loading...';
    // Incentive & Payment
    if (detailJobIncentiveApproved) detailJobIncentiveApproved.textContent = 'Loading...';
    if (detailJobIncentiveAmount) detailJobIncentiveAmount.textContent = 'Loading...';
    if (detailJobIncentiveStops) detailJobIncentiveStops.textContent = 'Loading...';
    if (detailJobPaymentStatus) detailJobPaymentStatus.textContent = 'Loading...';
    if (detailJobPaidAt) detailJobPaidAt.textContent = 'Loading...';
    // Tables
    if (jobDetailsStopsTableBody) jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="7">Loading stops...</td></tr>';
    if (jobDetailsAlcoholTableBody) jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">Loading alcohol checks...</td></tr>';
    if (jobDetailsLogsTableBody) jobDetailsLogsTableBody.innerHTML = '<tr><td colspan="5">Loading driver logs...</td></tr>';

    try {
        // Fetch all rows for this reference from jobdata
        const { data: jobRows, error: jobError } = await supabase
            .from('jobdata')
            .select('*')
            .eq('reference', reference)
            .order('seq', { ascending: true });

        if (jobError) throw jobError;

        if (!jobRows || jobRows.length === 0) {
            showNotification('Job not found', 'error');
            closeJobDetailsModal();
            return;
        }

        // Get first row as the main job data
        const job = jobRows[0];

        // Basic Info
        if (jobDetailsReferenceTitle) jobDetailsReferenceTitle.textContent = job.reference || 'N/A';
        if (detailJobReference) detailJobReference.textContent = job.reference || 'N/A';
        if (detailJobShipmentNo) detailJobShipmentNo.textContent = job.shipment_no || 'N/A';
        if (detailJobDriver) detailJobDriver.textContent = job.drivers || 'N/A';
        if (detailJobVehicle) detailJobVehicle.textContent = job.vehicle_desc || 'N/A';
        if (detailJobRoute) detailJobRoute.textContent = job.route || 'N/A';
        if (detailJobStatus) detailJobStatus.textContent = job.status || 'N/A';
        if (detailJobClosed) detailJobClosed.textContent = job.job_closed_at ? (job.job_closed_at instanceof Date ? job.job_closed_at.toLocaleString() : new Date(job.job_closed_at).toLocaleString()) : 'No';
        if (detailJobCreatedAt) detailJobCreatedAt.textContent = job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A';
        if (detailJobUpdatedAt) detailJobUpdatedAt.textContent = job.updated_at ? new Date(job.updated_at).toLocaleString() : 'N/A';

        // Incentive & Payment
        if (detailJobIncentiveApproved) detailJobIncentiveApproved.textContent = job.incentive_approved ? 'Yes' : 'No';
        if (detailJobIncentiveAmount) detailJobIncentiveAmount.textContent = job.incentive_amount ? `฿${parseFloat(job.incentive_amount).toFixed(2)}` : 'N/A';
        if (detailJobIncentiveStops) detailJobIncentiveStops.textContent = job.incentive_stops || jobRows.length || '0';
        if (detailJobPaymentStatus) detailJobPaymentStatus.textContent = job.payment_status || 'N/A';
        if (detailJobPaidAt) detailJobPaidAt.textContent = job.paid_at ? new Date(job.paid_at).toLocaleString() : 'N/A';

        // Display all stops from jobdata (each row is a stop)
        if (jobDetailsStopsTableBody) {
            jobDetailsStopsTableBody.innerHTML = '';
            if (!jobRows || jobRows.length === 0) {
                jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="7">No stops found.</td></tr>';
            } else {
                jobRows.forEach(stop => {
                    const row = jobDetailsStopsTableBody.insertRow();
                    row.insertCell().textContent = stop.seq || 'N/A';
                    row.insertCell().textContent = stop.ship_to_code || 'N/A';
                    row.insertCell().textContent = stop.destination || 'N/A';
                    row.insertCell().textContent = stop.is_origin_stop ? 'Yes' : 'No';
                    row.insertCell().textContent = stop.status || 'N/A';
                    row.insertCell().textContent = stop.checkin_time ? new Date(stop.checkin_time).toLocaleString() : 'N/A';
                    row.insertCell().textContent = stop.checkout_time ? new Date(stop.checkout_time).toLocaleString() : 'N/A';
                });
            }
        }

        // Fetch Alcohol Checks from driver_alcohol_checks table (uses reference)
        const { data: alcoholChecks, error: alcoholError } = await supabase
            .from('driver_alcohol_checks')
            .select('*')
            .eq('reference', reference)
            .order('checked_at', { ascending: false });
        if (alcoholError) console.warn('Alcohol checks error:', alcoholError);
        console.log('Alcohol checks for', reference, ':', alcoholChecks);

        if (jobDetailsAlcoholTableBody) {
            jobDetailsAlcoholTableBody.innerHTML = '';
            if (!alcoholChecks || alcoholChecks.length === 0) {
                jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">No alcohol checks found.</td></tr>';
            } else {
                alcoholChecks.forEach(check => {
                    const row = jobDetailsAlcoholTableBody.insertRow();
                    row.insertCell().textContent = check.driver_name || 'N/A';
                    row.insertCell().textContent = check.alcohol_value || 'N/A';
                    row.insertCell().textContent = check.checked_at ? new Date(check.checked_at).toLocaleString() : 'N/A';
                    const imageCell = row.insertCell();
                    if (check.image_url) {
                        const link = document.createElement('a');
                        link.href = check.image_url;
                        link.target = '_blank';
                        link.textContent = 'View Image';
                        imageCell.appendChild(link);
                    } else {
                        imageCell.textContent = 'N/A';
                    }
                });
            }
        }

        // Fetch Driver Logs from driver_logs table
        const { data: driverLogs, error: logsError } = await supabase
            .from('driver_logs')
            .select('*')
            .eq('reference', reference)
            .order('created_at', { ascending: false })
            .limit(50);
        if (logsError) console.warn('Driver logs error:', logsError);
        console.log('Driver logs for', reference, ':', driverLogs);

        if (jobDetailsLogsTableBody) {
            jobDetailsLogsTableBody.innerHTML = '';
            if (!driverLogs || driverLogs.length === 0) {
                jobDetailsLogsTableBody.innerHTML = '<tr><td colspan="5">No logs found.</td></tr>';
            } else {
                driverLogs.forEach(log => {
                    const row = jobDetailsLogsTableBody.insertRow();
                    row.insertCell().textContent = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
                    row.insertCell().textContent = log.action || 'N/A';
                    row.insertCell().textContent = log.user_id || 'N/A';
                    row.insertCell().textContent = log.user_name || 'N/A';
                    row.insertCell().textContent = log.location ? `Lat: ${log.location?.lat}, Lng: ${log.location?.lng}` : 'N/A';
                });
            }
        }

    } catch (error) {
        console.error('Error loading job details:', error);
        showNotification(`Failed to load job details: ${error.message}`, 'error');
        closeJobDetailsModal();
    }
}

/**
 * Close job details modal
 */
export function closeJobDetailsModal() {
    if (jobDetailsModal) jobDetailsModal.classList.add('hidden');
}
