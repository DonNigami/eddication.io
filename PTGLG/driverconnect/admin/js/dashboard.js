/**
 * Dashboard Module
 * Handles dashboard analytics and KPI displays
 */

import { supabase } from '../../shared/config.js';
import { formatNumber } from './utils.js';

// DOM elements
let kpiTotalUsers = null;
let kpiActiveJobs = null;
let kpiPendingApprovals = null;

/**
 * Set dashboard DOM elements
 * @param {Object} elements - DOM elements for dashboard
 */
export function setDashboardElements(elements) {
    kpiTotalUsers = elements.totalUsers;
    kpiActiveJobs = elements.activeJobs;
    kpiPendingApprovals = elements.pendingApprovals;
}

/**
 * Load dashboard analytics from database
 */
export async function loadDashboardAnalytics() {
    try {
        // Total Users
        const { count: totalUsers, error: usersError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' });

        if (usersError) throw usersError;
        if (kpiTotalUsers) kpiTotalUsers.textContent = formatNumber(totalUsers);

        // Active Jobs (status 'active' and trip_ended is false)
        const { count: activeJobs, error: jobsError } = await supabase
            .from('jobdata')
            .select('*', { count: 'exact' })
            .eq('status', 'active')
            .eq('trip_ended', false);

        if (jobsError) throw jobsError;
        if (kpiActiveJobs) kpiActiveJobs.textContent = formatNumber(activeJobs);

        // Pending Approvals
        const { count: pendingApprovals, error: pendingError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' })
            .eq('status', 'PENDING');

        if (pendingError) throw pendingError;
        if (kpiPendingApprovals) kpiPendingApprovals.textContent = formatNumber(pendingApprovals);

    } catch (error) {
        console.error('Error loading dashboard analytics:', error);
        if (kpiTotalUsers) kpiTotalUsers.textContent = 'Error';
        if (kpiActiveJobs) kpiActiveJobs.textContent = 'Error';
        if (kpiPendingApprovals) kpiPendingApprovals.textContent = 'Error';
    }
}

/**
 * Refresh dashboard analytics
 */
export async function refreshDashboard() {
    await loadDashboardAnalytics();
}
