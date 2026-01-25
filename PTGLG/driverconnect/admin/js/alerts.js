/**
 * Alerts Module
 * Handles triggered alerts display and badge updates
 */

import { supabase } from '../admin.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let alertsTableBody = null;
let alertsBadge = null;

const ALERTS_TABLE_COLUMNS = 7;

/**
 * Set alerts-related DOM elements
 * @param {Object} elements - DOM elements for alerts
 */
export function setAlertsElements(elements) {
    alertsTableBody = elements.tableBody;
    alertsBadge = elements.badge;
}

/**
 * Load alerts from database and populate table
 */
export async function loadAlerts() {
    if (!alertsTableBody) {
        console.error('Alerts table body not set');
        return;
    }

    alertsTableBody.innerHTML = `<tr><td colspan="${ALERTS_TABLE_COLUMNS}">Loading alerts...</td></tr>`;

    try {
        const { data: alerts, error } = await supabase
            .from('triggered_alerts')
            .select('*')
            .order('triggered_at', { ascending: false });

        if (error) throw error;

        alertsTableBody.innerHTML = '';
        if (alerts.length === 0) {
            alertsTableBody.innerHTML = `<tr><td colspan="${ALERTS_TABLE_COLUMNS}">No alerts found.</td></tr>`;
            return;
        }

        alerts.forEach(alert => {
            const row = alertsTableBody.insertRow();
            row.dataset.alertId = alert.id;

            row.insertCell().textContent = alert.alert_type || 'N/A';
            row.insertCell().textContent = alert.severity || 'N/A';
            row.insertCell().textContent = alert.reference || 'N/A';
            row.insertCell().textContent = alert.driver_user_id || 'N/A';
            row.insertCell().textContent = alert.message || 'N/A';
            row.insertCell().textContent = alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : 'N/A';

            const statusCell = row.insertCell();
            statusCell.textContent = alert.acknowledged ? 'Acknowledged' : 'Pending';
            statusCell.style.fontWeight = alert.acknowledged ? 'normal' : 'bold';
            statusCell.style.color = alert.acknowledged ? 'green' : 'orange';
        });

    } catch (error) {
        console.error('Error loading alerts:', error);
        alertsTableBody.innerHTML = `<tr><td colspan="${ALERTS_TABLE_COLUMNS}">Error loading alerts: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Update alerts badge with unread count
 */
export async function updateAlertsBadge() {
    if (!alertsBadge) return;

    try {
        const { count, error } = await supabase
            .from('triggered_alerts')
            .select('*', { count: 'exact' })
            .eq('acknowledged', false);

        if (error) throw error;

        if (count > 0) {
            alertsBadge.textContent = count;
            alertsBadge.style.display = 'inline-block';
        } else {
            alertsBadge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating alerts badge:', error);
    }
}
