/**
 * Auto-Refresh Module
 * Handles automatic refresh of data every 5 minutes
 */

import { loadB100Jobs } from './b100.js';
import { loadJobs } from './jobs.js';
import { loadUsers } from './users.js';
import { loadDriverReports } from './reports.js';
import { loadAlerts } from './alerts.js';
import { loadLogs } from './logs.js';
import { loadIncentiveJobs } from './incentive-approval.js';
import { loadPayments } from './payment-processing.js';
import { loadBreakdownReports } from './breakdown-reports.js';
import { loadPerformanceData } from '../logistics-performance.js';
import { refreshDashboard } from './dashboard.js';
import { loadVehicleBreakdowns } from './breakdown.js';
import { loadFuelSiphoning } from './siphoning.js';

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
let autoRefreshTimer = null;
let isAutoRefreshEnabled = true;

// Track which section is currently active
let currentSection = 'dashboard';

/**
 * Initialize auto-refresh functionality
 */
export function initAutoRefresh() {
    // Set up visibility change detection
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up auto-refresh timer
    startAutoRefresh();

    // Set up navigation event listeners to track current section
    setupNavigationTracking();

    // Set up manual refresh buttons
    setupRefreshButtons();

    console.log('✅ Auto-refresh initialized (5 minutes)');
}

/**
 * Handle visibility change - pause when tab is hidden
 */
function handleVisibilityChange() {
    if (document.hidden) {
        stopAutoRefresh();
        console.log('⏸️ Auto-refresh paused (tab hidden)');
    } else {
        startAutoRefresh();
        console.log('▶️ Auto-refresh resumed (tab visible)');
    }
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    autoRefreshTimer = setInterval(() => {
        if (isAutoRefreshEnabled && !document.hidden) {
            refreshCurrentSection();
        }
    }, AUTO_REFRESH_INTERVAL);
}

/**
 * Stop auto-refresh timer
 */
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

/**
 * Setup navigation tracking to know which section is active
 */
function setupNavigationTracking() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            currentSection = link.dataset.target;
        });
    });
}

/**
 * Setup manual refresh buttons
 */
function setupRefreshButtons() {
    // Dashboard refresh
    const dashboardRefreshBtn = document.getElementById('dashboard-refresh-btn');
    if (dashboardRefreshBtn) {
        dashboardRefreshBtn.addEventListener('click', () => {
            refreshSection('dashboard');
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Dashboard');
        });
    }

    // Jobs refresh
    const jobsRefreshBtn = document.getElementById('jobs-refresh-btn');
    if (jobsRefreshBtn) {
        jobsRefreshBtn.addEventListener('click', () => {
            refreshSection('jobs');
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Jobs');
        });
    }

    // B100 refresh
    const b100RefreshBtn = document.getElementById('b100-refresh-btn');
    if (b100RefreshBtn) {
        b100RefreshBtn.addEventListener('click', () => {
            const search = document.getElementById('b100-search')?.value || '';
            const statusFilter = document.getElementById('b100-status-filter')?.value || '';
            loadB100Jobs(search, statusFilter);
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('B100 Jobs');
        });
    }

    // Vehicle Breakdown refresh
    const vehicleBreakdownRefreshBtn = document.getElementById('vehicle-breakdown-refresh-btn');
    if (vehicleBreakdownRefreshBtn) {
        vehicleBreakdownRefreshBtn.addEventListener('click', () => {
            refreshSection('vehicle-breakdown');
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Vehicle Breakdown');
        });
    }

    // Fuel Siphoning refresh
    const fuelSiphoningRefreshBtn = document.getElementById('fuel-siphoning-refresh-btn');
    if (fuelSiphoningRefreshBtn) {
        fuelSiphoningRefreshBtn.addEventListener('click', () => {
            refreshSection('fuel-siphoning');
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Fuel Siphoning');
        });
    }

    // Incentive Approval (existing button - add animation)
    const incentiveRefreshBtn = document.getElementById('incentive-refresh-btn');
    if (incentiveRefreshBtn) {
        incentiveRefreshBtn.addEventListener('click', () => {
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Incentive Approval');
        });
    }

    // Payment Processing (existing button - add animation)
    const paymentRefreshBtn = document.getElementById('payment-refresh-btn');
    if (paymentRefreshBtn) {
        paymentRefreshBtn.addEventListener('click', () => {
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Payment Processing');
        });
    }

    // Breakdown Reports (existing button - add animation)
    const brRefreshBtn = document.getElementById('br-refresh-btn');
    if (brRefreshBtn) {
        brRefreshBtn.addEventListener('click', () => {
            const indicator = document.getElementById('last-refresh-indicator');
            if (indicator) {
                const now = new Date();
                indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
            }
            showRefreshNotification('Breakdown Reports');
        });
    }
}

/**
 * Refresh the current/active section
 */
function refreshCurrentSection() {
    const activeSection = document.querySelector('.content-section.active');
    if (!activeSection) return;

    const sectionId = activeSection.id;
    refreshSection(sectionId);

    // Update last refresh indicator
    const indicator = document.getElementById('last-refresh-indicator');
    if (indicator) {
        const now = new Date();
        indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
    }
}

/**
 * Refresh a specific section by ID
 */
async function refreshSection(sectionId) {
    try {
        switch (sectionId) {
            case 'dashboard':
                if (typeof refreshDashboard === 'function') {
                    await refreshDashboard();
                }
                break;
            case 'jobs':
                await loadJobs();
                break;
            case 'b100-jobs':
                const b100Search = document.getElementById('b100-search')?.value || '';
                const b100StatusFilter = document.getElementById('b100-status-filter')?.value || '';
                await loadB100Jobs(b100Search, b100StatusFilter);
                break;
            case 'users':
                if (typeof loadUsers === 'function') {
                    await loadUsers();
                }
                break;
            case 'driver-reports':
                if (typeof loadDriverReports === 'function') {
                    await loadDriverReports();
                }
                break;
            case 'alerts':
                if (typeof loadAlerts === 'function') {
                    await loadAlerts();
                }
                break;
            case 'logs':
                if (typeof loadLogs === 'function') {
                    await loadLogs();
                }
                break;
            case 'incentive-approval':
                if (typeof loadIncentiveJobs === 'function') {
                    await loadIncentiveJobs();
                }
                break;
            case 'payment-processing':
                if (typeof loadPayments === 'function') {
                    await loadPayments();
                }
                break;
            case 'breakdown-reports':
                if (typeof loadBreakdownReports === 'function') {
                    await loadBreakdownReports();
                }
                break;
            case 'vehicle-breakdown':
                if (typeof loadVehicleBreakdowns === 'function') {
                    await loadVehicleBreakdowns();
                }
                break;
            case 'fuel-siphoning':
                if (typeof loadFuelSiphoning === 'function') {
                    await loadFuelSiphoning();
                }
                break;
            case 'logistics-performance':
                if (typeof loadPerformanceData === 'function') {
                    await loadPerformanceData();
                }
                break;
        }
    } catch (error) {
        console.error(`Error refreshing section ${sectionId}:`, error);
    }
}

/**
 * Show refresh notification
 */
function showRefreshNotification(sectionName = 'Data') {
    // Update last refresh indicator
    const indicator = document.getElementById('last-refresh-indicator');
    if (indicator) {
        const now = new Date();
        indicator.textContent = `Last refresh: ${now.toLocaleTimeString()}`;
    }

    // Show a subtle notification
    console.log(`🔄 ${sectionName} refreshed`);
}

/**
 * Enable/disable auto-refresh
 */
export function setAutoRefreshEnabled(enabled) {
    isAutoRefreshEnabled = enabled;
    if (enabled) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
}

/**
 * Get current auto-refresh status
 */
export function isAutoRefreshEnabledStatus() {
    return isAutoRefreshEnabled;
}

/**
 * Manually trigger refresh of current section
 */
export function triggerRefresh() {
    refreshCurrentSection();
}
