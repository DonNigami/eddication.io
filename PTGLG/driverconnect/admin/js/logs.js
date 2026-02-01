/**
 * Logs Module
 * Handles driver logs display and filtering
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let logsTableBody = null;
let logSearchReferenceInput = null;
let logSearchActionInput = null;
let logSearchUserIdInput = null;

const LOGS_TABLE_COLUMNS = 6;

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
 * Format details from JSONB to readable string
 * @param {Object} details - Details object from database
 * @returns {string} Formatted details string
 */
function formatDetails(details) {
    if (!details) return 'N/A';
    if (typeof details === 'string') {
        try {
            details = JSON.parse(details);
        } catch {
            return sanitizeHTML(details);
        }
    }

    // Format specific detail types
    const parts = [];
    if (details.user_name) parts.push(`User: ${sanitizeHTML(details.user_name)}`);
    if (details.stop_name) parts.push(`Stop: ${sanitizeHTML(details.stop_name)}`);
    if (details.odometer) parts.push(`Odo: ${sanitizeHTML(details.odometer)} km`);
    if (details.status) parts.push(`Status: ${sanitizeHTML(details.status)}`);
    if (details.note) parts.push(`Note: ${sanitizeHTML(details.note)}`);

    return parts.length > 0 ? parts.join(' | ') : 'N/A';
}

/**
 * Format location from JSONB to readable string
 * @param {Object} location - Location object from database
 * @returns {string} Formatted location string
 */
function formatLocation(location) {
    if (!location) return 'N/A';
    if (typeof location === 'string') {
        try {
            location = JSON.parse(location);
        } catch {
            return sanitizeHTML(location);
        }
    }

    if (location.lat && location.lng) {
        return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
    }
    if (location.latitude && location.longitude) {
        return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
    }
    return 'N/A';
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
            .from('admin_logs')
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
            // Timestamp
            row.insertCell().textContent = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
            // Reference
            row.insertCell().textContent = sanitizeHTML(log.reference || 'N/A');
            // Action
            row.insertCell().textContent = sanitizeHTML(log.action || 'N/A');
            // User ID
            row.insertCell().textContent = sanitizeHTML(log.user_id || 'N/A');
            // Details
            row.insertCell().textContent = formatDetails(log.details);
            // Location
            row.insertCell().textContent = formatLocation(log.location);
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
export async function clearLogFilters() {
    if (logSearchReferenceInput) logSearchReferenceInput.value = '';
    if (logSearchActionInput) logSearchActionInput.value = '';
    if (logSearchUserIdInput) logSearchUserIdInput.value = '';
    await loadLogs();
}
