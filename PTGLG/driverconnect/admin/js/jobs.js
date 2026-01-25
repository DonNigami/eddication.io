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
let detailJobStatus = null;
let detailJobTripEnded = null;
let detailJobCreatedAt = null;
let detailJobUpdatedAt = null;
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
    detailJobStatus = elements.detailStatus;
    detailJobTripEnded = elements.detailTripEnded;
    detailJobCreatedAt = elements.detailCreatedAt;
    detailJobUpdatedAt = elements.detailUpdatedAt;
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
        let query = supabase
            .from('driver_jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,shipment_no.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        const { data: jobs, error } = await query;

        if (error) throw error;

        jobsTableBody.innerHTML = '';
        if (jobs.length === 0) {
            jobsTableBody.innerHTML = `<tr><td colspan="${JOBS_TABLE_COLUMNS}">No jobs found.</td></tr>`;
            return;
        }

        jobs.forEach(job => {
            const row = jobsTableBody.insertRow();
            row.dataset.jobId = job.id;

            row.insertCell().textContent = job.reference || 'N/A';
            row.insertCell().textContent = job.shipment_no || 'N/A';
            row.insertCell().textContent = job.drivers || 'N/A';
            row.insertCell().textContent = job.status || 'N/A';
            row.insertCell().textContent = job.trip_ended ? 'Yes' : 'No';

            const actionCell = row.insertCell();

            // Edit button
            const editButton = createActionButton('edit-job-btn', 'Edit', () => {
                openJobModal(job);
            });
            actionCell.appendChild(editButton);

            // Delete button
            const deleteButton = createActionButton('delete-job-btn', 'Delete', () => {
                handleDeleteJob(job.id);
            });
            deleteButton.style.backgroundColor = '#e74c3c';
            actionCell.appendChild(deleteButton);

            // Details button
            const detailsButton = document.createElement('button');
            detailsButton.className = 'view-details-btn';
            detailsButton.dataset.jobId = job.id;
            detailsButton.textContent = 'Details';
            detailsButton.addEventListener('click', () => openJobDetailsModal(job.id));
            actionCell.appendChild(detailsButton);
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
        if (jobTripEndedInput) jobTripEndedInput.checked = job.trip_ended || false;
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
    const jobData = {
        reference: jobReferenceInput?.value || '',
        shipment_no: jobShipmentNoInput?.value || '',
        drivers: jobDriverInput?.value || '',
        status: jobStatusInput?.value || 'pending',
        trip_ended: jobTripEndedInput?.checked || false,
        updated_at: new Date().toISOString()
    };

    try {
        let error = null;
        if (jobId) {
            // Update existing job
            ({ error } = await supabase.from('driver_jobs').update(jobData).eq('id', jobId));
        } else {
            // Create new job
            jobData.created_at = new Date().toISOString();
            ({ error } = await supabase.from('driver_jobs').insert([jobData]));
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
 * @param {string} jobId - Job ID to delete
 */
export async function handleDeleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('driver_jobs')
            .delete()
            .eq('id', jobId);

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
 * @param {string} jobId - Job ID to show details for
 */
export async function openJobDetailsModal(jobId) {
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
    if (detailJobStatus) detailJobStatus.textContent = 'Loading...';
    if (detailJobTripEnded) detailJobTripEnded.textContent = 'Loading...';
    if (detailJobCreatedAt) detailJobCreatedAt.textContent = 'Loading...';
    if (detailJobUpdatedAt) detailJobUpdatedAt.textContent = 'Loading...';
    if (jobDetailsStopsTableBody) jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="5">Loading stops...</td></tr>';
    if (jobDetailsAlcoholTableBody) jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">Loading alcohol checks...</td></tr>';
    if (jobDetailsLogsTableBody) jobDetailsLogsTableBody.innerHTML = '<tr><td colspan="4">Loading driver logs...</td></tr>';

    try {
        // Fetch Job Data
        const { data: job, error: jobError } = await supabase
            .from('driver_jobs')
            .select('*')
            .eq('id', jobId)
            .single();
        if (jobError) throw jobError;

        if (jobDetailsReferenceTitle) jobDetailsReferenceTitle.textContent = job.reference || 'N/A';
        if (detailJobReference) detailJobReference.textContent = job.reference || 'N/A';
        if (detailJobShipmentNo) detailJobShipmentNo.textContent = job.shipment_no || 'N/A';
        if (detailJobDriver) detailJobDriver.textContent = job.drivers || 'N/A';
        if (detailJobStatus) detailJobStatus.textContent = job.status || 'N/A';
        if (detailJobTripEnded) detailJobTripEnded.textContent = job.trip_ended ? 'Yes' : 'No';
        if (detailJobCreatedAt) detailJobCreatedAt.textContent = new Date(job.created_at).toLocaleString();
        if (detailJobUpdatedAt) detailJobUpdatedAt.textContent = new Date(job.updated_at).toLocaleString();

        // Fetch Trip Stops
        const { data: driverStops, error: stopsError } = await supabase
            .from('driver_stop')
            .select('*')
            .eq('reference', job.reference)
            .order('sequence', { ascending: true });
        if (stopsError) throw stopsError;

        if (jobDetailsStopsTableBody) {
            jobDetailsStopsTableBody.innerHTML = '';
            if (driverStops.length === 0) {
                jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="5">No stops found.</td></tr>';
            } else {
                driverStops.forEach(stop => {
                    const row = jobDetailsStopsTableBody.insertRow();
                    row.insertCell().textContent = stop.sequence || 'N/A';
                    row.insertCell().textContent = stop.destination_name || 'N/A';
                    row.insertCell().textContent = stop.status || 'N/A';
                    row.insertCell().textContent = stop.check_in_time ? new Date(stop.check_in_time).toLocaleString() : 'N/A';
                    row.insertCell().textContent = stop.check_out_time ? new Date(stop.check_out_time).toLocaleString() : 'N/A';
                });
            }
        }

        // Fetch Alcohol Checks
        const { data: driverAlcoholChecks, error: alcoholError } = await supabase
            .from('driver_alcohol_checks')
            .select('*')
            .eq('job_id', jobId)
            .order('checked_at', { ascending: false });
        if (alcoholError) throw alcoholError;

        if (jobDetailsAlcoholTableBody) {
            jobDetailsAlcoholTableBody.innerHTML = '';
            if (driverAlcoholChecks.length === 0) {
                jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">No alcohol checks found.</td></tr>';
            } else {
                driverAlcoholChecks.forEach(check => {
                    const row = jobDetailsAlcoholTableBody.insertRow();
                    row.insertCell().textContent = check.checked_by || 'N/A';
                    row.insertCell().textContent = check.alcohol_value || 'N/A';
                    row.insertCell().textContent = new Date(check.checked_at).toLocaleString();
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

        // Fetch Driver Logs
        const { data: driverLogs, error: logsError } = await supabase
            .from('driver_logs')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (logsError) throw logsError;

        if (jobDetailsLogsTableBody) {
            jobDetailsLogsTableBody.innerHTML = '';
            if (driverLogs.length === 0) {
                jobDetailsLogsTableBody.innerHTML = '<tr><td colspan="4">No driver logs found.</td></tr>';
            } else {
                driverLogs.forEach(log => {
                    const row = jobDetailsLogsTableBody.insertRow();
                    row.insertCell().textContent = new Date(log.created_at).toLocaleString();
                    row.insertCell().textContent = log.action || 'N/A';
                    row.insertCell().textContent = log.user_id || 'N/A';
                    row.insertCell().textContent = log.location ? `Lat: ${log.location.lat}, Lng: ${log.location.lng}` : 'N/A';
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
