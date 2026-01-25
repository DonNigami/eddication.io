/**
 * Reports Module
 * Handles driver report generation
 */

import { supabase } from '../../shared/config.js';
import { showNotification } from './utils.js';

// DOM elements
let reportDriverSelect = null;
let reportStartDate = null;
let reportEndDate = null;
let reportTotalJobs = null;
let reportCompletedJobs = null;
let reportAlcoholChecks = null;
let driverJobsTableBody = null;

/**
 * Set report-related DOM elements
 * @param {Object} elements - DOM elements for reports
 */
export function setReportElements(elements) {
    reportDriverSelect = elements.driverSelect;
    reportStartDate = elements.startDate;
    reportEndDate = elements.endDate;
    reportTotalJobs = elements.totalJobs;
    reportCompletedJobs = elements.completedJobs;
    reportAlcoholChecks = elements.alcoholChecks;
    driverJobsTableBody = elements.jobsTableBody;
}

const DRIVER_JOBS_TABLE_COLUMNS = 6;

/**
 * Load driver reports - populate driver select and set default dates
 */
export async function loadDriverReports() {
    if (!reportDriverSelect) {
        console.error('Report driver select not set');
        return;
    }

    reportDriverSelect.innerHTML = '<option value="">Loading drivers...</option>';

    try {
        const { data: users, error } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name', { ascending: true });

        if (error) throw error;

        reportDriverSelect.innerHTML = '<option value="">-- Select Driver --</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.user_id;
            option.textContent = user.display_name || user.user_id;
            reportDriverSelect.appendChild(option);
        });

        // Set default dates (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        if (reportStartDate) reportStartDate.value = startDate.toISOString().split('T')[0];
        if (reportEndDate) reportEndDate.value = endDate.toISOString().split('T')[0];

    } catch (error) {
        console.error('Error loading drivers for report:', error);
        reportDriverSelect.innerHTML = '<option value="">Error loading drivers</option>';
    }
}

/**
 * Generate driver report
 */
export async function generateDriverReport() {
    const driverId = reportDriverSelect?.value;
    const startDate = reportStartDate?.value;
    const endDate = reportEndDate?.value;

    if (!driverId) {
        showNotification('Please select a driver.', 'error');
        return;
    }
    if (!startDate || !endDate) {
        showNotification('Please select a date range.', 'error');
        return;
    }

    // Clear previous results
    if (reportTotalJobs) reportTotalJobs.textContent = '...';
    if (reportCompletedJobs) reportCompletedJobs.textContent = '...';
    if (reportAlcoholChecks) reportAlcoholChecks.textContent = '...';
    if (driverJobsTableBody) {
        driverJobsTableBody.innerHTML = `<tr><td colspan="${DRIVER_JOBS_TABLE_COLUMNS}">Generating report...</td></tr>`;
    }

    try {
        // Fetch jobs for the driver within the date range
        const { data: jobs, error: jobsError } = await supabase
            .from('driver_jobs')
            .select('*')
            .ilike('drivers', `%${driverId}%`)
            .gte('created_at', startDate + 'T00:00:00Z')
            .lte('created_at', endDate + 'T23:59:59Z')
            .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;

        // Fetch alcohol checks for the driver within the date range
        const { count: alcoholChecksCount, error: alcoholError } = await supabase
            .from('driver_alcohol_checks')
            .select('id', { count: 'exact' })
            .eq('driver_user_id', driverId)
            .gte('checked_at', startDate + 'T00:00:00Z')
            .lte('checked_at', endDate + 'T23:59:59Z');

        if (alcoholError) throw alcoholError;

        // Update Summary
        if (reportTotalJobs) reportTotalJobs.textContent = jobs.length;
        if (reportCompletedJobs) {
            reportCompletedJobs.textContent = jobs.filter(job => job.status === 'completed' || job.trip_ended).length;
        }
        if (reportAlcoholChecks) reportAlcoholChecks.textContent = alcoholChecksCount;

        // Display Jobs in Period
        if (driverJobsTableBody) {
            driverJobsTableBody.innerHTML = '';
            if (jobs.length === 0) {
                driverJobsTableBody.innerHTML = `<tr><td colspan="${DRIVER_JOBS_TABLE_COLUMNS}">No jobs found for this driver in the selected period.</td></tr>`;
            } else {
                jobs.forEach(job => {
                    const row = driverJobsTableBody.insertRow();
                    row.insertCell().textContent = job.reference || 'N/A';
                    row.insertCell().textContent = job.shipment_no || 'N/A';
                    row.insertCell().textContent = job.drivers || 'N/A';
                    row.insertCell().textContent = job.status || 'N/A';
                    row.insertCell().textContent = job.trip_ended ? 'Yes' : 'No';
                    row.insertCell().textContent = new Date(job.created_at).toLocaleString();
                });
            }
        }

    } catch (error) {
        console.error('Error generating driver report:', error);
        showNotification(`Failed to generate report: ${error.message}`, 'error');
        if (reportTotalJobs) reportTotalJobs.textContent = 'Error';
        if (reportCompletedJobs) reportCompletedJobs.textContent = 'Error';
        if (reportAlcoholChecks) reportAlcoholChecks.textContent = 'Error';
        if (driverJobsTableBody) {
            driverJobsTableBody.innerHTML = `<tr><td colspan="${DRIVER_JOBS_TABLE_COLUMNS}">Error generating report.</td></tr>`;
        }
    }
}
