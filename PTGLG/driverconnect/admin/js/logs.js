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
    if (!details) return '-';
    if (typeof details === 'string') {
        try {
            details = JSON.parse(details);
        } catch {
            return sanitizeHTML(details.substring(0, 50));
        }
    }

    // Format specific detail types - more compact
    const parts = [];

    // Driver/Station info (common fields)
    if (details.driver_name) parts.push(sanitizeHTML(details.driver_name));
    if (details.station_name) parts.push(sanitizeHTML(details.station_name));
    if (details.vehicle) parts.push(sanitizeHTML(details.vehicle));

    // Stop info
    if (details.stop_name) parts.push(`📍${sanitizeHTML(details.stop_name)}`);

    // Odometer/Distance
    if (details.odometer) parts.push(`Odo: ${details.odometer}`);
    if (details.distance) parts.push(`Dist: ${details.distance}`);

    // Status/Action info
    if (details.status) parts.push(sanitizeHTML(details.status));
    if (details.previous_status) parts.push(`from: ${sanitizeHTML(details.previous_status)}`);

    // Notes (truncate if too long)
    if (details.note) {
        const note = sanitizeHTML(details.note);
        parts.push(note.length > 30 ? note.substring(0, 30) + '...' : note);
    }

    // If nothing matched, show a summary of keys
    if (parts.length === 0) {
        const keys = Object.keys(details).slice(0, 3);
        if (keys.length > 0) {
            return keys.map(k => `${k}: ${JSON.stringify(details[k]).substring(0, 20)}`).join(' | ');
        }
        return '-';
    }

    return parts.join(' • ').substring(0, 80);
}

/**
 * Format location from JSONB to readable string
 * @param {Object} location - Location object from database
 * @returns {string} Formatted location string
 */
function formatLocation(location) {
    if (!location) return '-';
    if (typeof location === 'string') {
        try {
            location = JSON.parse(location);
        } catch {
            return sanitizeHTML(location.substring(0, 30));
        }
    }

    let lat, lng;
    if (location.lat !== undefined) lat = location.lat;
    else if (location.latitude !== undefined) lat = location.latitude;

    if (location.lng !== undefined) lng = location.lng;
    else if (location.longitude !== undefined) lng = location.longitude;

    if (lat !== undefined && lng !== undefined) {
        // More compact format: show 4 decimal places
        return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    }

    // If has address, show that instead
    if (location.address) {
        return sanitizeHTML(location.address).substring(0, 30);
    }

    return '-';
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
            const timeCell = row.insertCell();
            timeCell.textContent = log.created_at ? new Date(log.created_at).toLocaleString('th-TH', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }) : '-';
            timeCell.style.whiteSpace = 'nowrap';

            // Reference
            const refCell = row.insertCell();
            refCell.textContent = sanitizeHTML(log.reference || '-');
            refCell.style.fontFamily = 'monospace';

            // Action
            const actionCell = row.insertCell();
            const action = log.action || '-';
            actionCell.textContent = sanitizeHTML(action);
            // Color code actions
            if (action === 'search') actionCell.style.color = '#2196F3';
            else if (action === 'checkin') actionCell.style.color = '#4CAF50';
            else if (action === 'checkout') actionCell.style.color = '#FF9800';
            else if (action === 'close_job') actionCell.style.color = '#9C27B0';

            // User ID
            const userCell = row.insertCell();
            userCell.textContent = sanitizeHTML(log.user_id || '-');
            userCell.style.fontFamily = 'monospace';
            userCell.style.fontSize = '0.9em';

            // Details
            const detailsCell = row.insertCell();
            const detailsText = formatDetails(log.details);
            detailsCell.textContent = detailsText;
            detailsCell.title = typeof log.details === 'object'
                ? JSON.stringify(log.details, null, 2)
                : (log.details || '-');
            detailsCell.style.maxWidth = '250px';
            detailsCell.style.overflow = 'hidden';
            detailsCell.style.textOverflow = 'ellipsis';
            detailsCell.style.whiteSpace = 'nowrap';
            detailsCell.style.cursor = 'help';

            // Location
            const locCell = row.insertCell();
            const locText = formatLocation(log.location);
            locCell.textContent = locText;
            locCell.style.fontFamily = 'monospace';
            locCell.style.fontSize = '0.9em';
            if (log.location && (log.location.lat || log.location.latitude)) {
                const lat = log.location.lat || log.location.latitude;
                const lng = log.location.lng || log.location.longitude;
                locCell.title = `📍 ${lat}, ${lng}\nClick to open in Maps`;
                locCell.style.cursor = 'pointer';
                locCell.style.color = '#1976D2';
                locCell.style.textDecoration = 'underline';
            }
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
