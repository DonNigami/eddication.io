/**
 * Logs Module
 * Handles driver logs display and filtering
 */

import { supabase } from '../admin.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let logsTableBody = null;
let logSearchReferenceInput = null;
let logSearchActionInput = null;
let logSearchUserIdInput = null;

const LOGS_TABLE_COLUMNS = 4;

/**
 * Set logs-related DOM elements
 * @param {Object} elements - DOM elements for logs
 */
export function setLogsElements(elements) {
    logsTableBody = elements.tableBody;
    logSearchReferenceInput = elements.searchReference;
    logSearchActionInput = elements.searchAction;
    logSearchUserIdInput = elements.searchUserId;
}

/**
 * Load logs from database and populate table
 * @param {Object} filters - Optional filters { reference, action, userId }
 */
export async function loadLogs(filters = {}) {
    if (!logsTableBody) {
        console.error('Logs table body not set');
        return;
    }

    logsTableBody.innerHTML = `<tr><td colspan="${LOGS_TABLE_COLUMNS}">Loading logs...</td></tr>`;

    try {
        let query = supabase
            .from('driver_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100); // Limit to recent 100 logs for performance

        // Apply filters if provided
        if (filters.reference) {
            query = query.ilike('reference', `%${filters.reference}%`);
        }
        if (filters.action) {
            query = query.ilike('action', `%${filters.action}%`);
        }
        if (filters.userId) {
            query = query.eq('user_id', filters.userId);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        logsTableBody.innerHTML = '';
        if (logs.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="${LOGS_TABLE_COLUMNS}">No logs found.</td></tr>`;
            return;
        }

        logs.forEach(log => {
            const row = logsTableBody.insertRow();
            row.insertCell().textContent = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
            row.insertCell().textContent = sanitizeHTML(log.action || 'N/A');
            row.insertCell().textContent = sanitizeHTML(log.user_id || 'N/A');
            row.insertCell().textContent = log.location
                ? `Lat: ${log.location.lat.toFixed(5)}, Lng: ${log.location.lng.toFixed(5)}`
                : 'N/A';
        });

    } catch (error) {
        console.error('Error loading logs:', error);
        logsTableBody.innerHTML = `<tr><td colspan="${LOGS_TABLE_COLUMNS}">Error loading logs: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Get filter values from DOM inputs
 * @returns {Object} Filters object
 */
export function getLogFilters() {
    return {
        reference: logSearchReferenceInput?.value || '',
        action: logSearchActionInput?.value || '',
        userId: logSearchUserIdInput?.value || ''
    };
}

/**
 * Clear log filters and reload
 */
export function clearLogFilters() {
    if (logSearchReferenceInput) logSearchReferenceInput.value = '';
    if (logSearchActionInput) logSearchActionInput.value = '';
    if (logSearchUserIdInput) logSearchUserIdInput.value = '';
    await loadLogs();
}
