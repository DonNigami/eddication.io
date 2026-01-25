/**
 * Main Entry Point
 * Initializes all modules and sets up event listeners
 */

import { supabase } from '../../shared/config.js';
import { setNotificationContainer, showNotification } from './utils.js';
import { initMap, setPlaybackElements } from './map.js';
import { setDashboardElements, loadDashboardAnalytics } from './dashboard.js';
import { loadUsers } from './users.js';
import {
    setJobElements,
    loadJobs,
    openJobModal,
    closeJobModal,
    handleJobSubmit,
    handleDeleteJob,
    openJobDetailsModal,
    closeJobDetailsModal
} from './jobs.js';
import { setReportElements, loadDriverReports, generateDriverReport } from './reports.js';
import { setSettingsElements, loadSettings, saveSettings } from './settings.js';
import { setAlertsElements, loadAlerts, updateAlertsBadge } from './alerts.js';
import { setLogsElements, loadLogs } from './logs.js';
import {
    setHolidayWorkElements,
    loadHolidayWorkJobs,
    subscribeToHolidayWorkUpdates,
    unsubscribeFromHolidayWorkUpdates,
    openHolidayApprovalModal,
    closeHolidayApprovalModal,
    handleHolidayApprovalSubmit
} from './holiday-work.js';
import {
    setBreakdownElements,
    loadVehicleBreakdowns,
    openBreakdownModal,
    closeBreakdownModal,
    handleBreakdownJobSelect,
    handleBreakdownSubmit
} from './breakdown.js';
import {
    setSiphoningElements,
    loadFuelSiphoning,
    openSiphoningModal,
    closeSiphoningModal,
    handleSiphoningSubmit
} from './siphoning.js';
import {
    setB100Elements,
    loadB100Jobs,
    openB100Modal,
    closeB100Modal,
    handleB100Submit,
    updateB100Status
} from './b100.js';
import { initNotificationBell, toggleNotificationDropdown, markAllNotificationsAsRead } from './notifications.js';
import { setupRealtimeSubscriptions, cleanupRealtimeSubscriptions } from './realtime.js';

// Global LIFF instance
let liff = null;

/**
 * Initialize the application
 */
export async function initializeApp() {
    console.log('🚀 Initializing DriverConnect Admin Panel...');

    // Set notification container
    const notificationContainer = document.getElementById('notification-container');
    if (notificationContainer) {
        setNotificationContainer(notificationContainer);
    }

    // Setup DOM elements for all modules
    setupDOMElements();

    // Setup event listeners
    setupEventListeners();

    console.log('✅ App initialized');
}

/**
 * Setup DOM elements for all modules
 */
function setupDOMElements() {
    // Dashboard
    setDashboardElements({
        totalUsers: document.getElementById('kpi-total-users'),
        activeJobs: document.getElementById('kpi-active-jobs'),
        pendingApprovals: document.getElementById('kpi-pending-approvals')
    });

    // Jobs
    setJobElements({
        tableBody: document.querySelector('#jobs-table tbody'),
        modal: document.getElementById('job-modal'),
        form: document.getElementById('job-form'),
        idInput: document.getElementById('job-id'),
        referenceInput: document.getElementById('job-reference'),
        shipmentNoInput: document.getElementById('job-shipment-no'),
        driverInput: document.getElementById('job-driver'),
        statusInput: document.getElementById('job-status'),
        tripEndedInput: document.getElementById('job-trip-ended'),
        detailsModal: document.getElementById('job-details-modal'),
        detailsReferenceTitle: document.getElementById('job-details-reference'),
        detailReference: document.getElementById('detail-job-reference'),
        detailShipmentNo: document.getElementById('detail-job-shipment-no'),
        detailDriver: document.getElementById('detail-job-driver'),
        detailStatus: document.getElementById('detail-job-status'),
        detailTripEnded: document.getElementById('detail-job-trip-ended'),
        detailCreatedAt: document.getElementById('detail-job-created-at'),
        detailUpdatedAt: document.getElementById('detail-job-updated-at'),
        stopsTableBody: document.querySelector('#job-details-stops-table tbody'),
        alcoholTableBody: document.querySelector('#job-details-alcohol-table tbody'),
        logsTableBody: document.querySelector('#job-details-logs-table tbody')
    });

    // Reports
    setReportElements({
        driverSelect: document.getElementById('report-driver-select'),
        startDate: document.getElementById('report-start-date'),
        endDate: document.getElementById('report-end-date'),
        totalJobs: document.getElementById('report-total-jobs'),
        completedJobs: document.getElementById('report-completed-jobs'),
        alcoholChecks: document.getElementById('report-alcohol-checks'),
        jobsTableBody: document.querySelector('#driver-jobs-table tbody')
    });

    // Settings
    setSettingsElements({
        form: document.getElementById('settings-form')
    });

    // Alerts
    setAlertsElements({
        tableBody: document.querySelector('#alerts-table tbody'),
        badge: document.getElementById('alerts-badge')
    });

    // Logs
    setLogsElements({
        tableBody: document.querySelector('#logs-table tbody'),
        searchReference: document.getElementById('log-search-reference'),
        searchAction: document.getElementById('log-search-action'),
        searchUserId: document.getElementById('log-search-user-id')
    });

    // Holiday Work
    setHolidayWorkElements({
        tableBody: document.getElementById('holiday-work-tbody'),
        search: document.getElementById('holiday-work-search'),
        statusFilter: document.getElementById('holiday-status-filter'),
        dateFrom: document.getElementById('holiday-date-from'),
        dateTo: document.getElementById('holiday-date-to'),
        refreshBtn: document.getElementById('holiday-refresh-btn'),
        pendingCount: document.getElementById('pending-holiday-count'),
        approvedCount: document.getElementById('approved-holiday-count'),
        rejectedCount: document.getElementById('rejected-holiday-count'),
        approvalModal: document.getElementById('holiday-approval-modal'),
        approvalForm: document.getElementById('holiday-approval-form'),
        referenceInput: document.getElementById('approval-reference-input'),
        reference: document.getElementById('approval-reference'),
        driver: document.getElementById('approval-driver'),
        vehicle: document.getElementById('approval-vehicle'),
        date: document.getElementById('approval-date'),
        notes: document.getElementById('approval-notes'),
        comment: document.getElementById('approval-comment'),
        action: document.getElementById('approval-action'),
        modalTitle: document.getElementById('approval-modal-title'),
        approveBtn: document.getElementById('approve-btn'),
        rejectBtn: document.getElementById('reject-btn')
    });

    // Breakdown
    setBreakdownElements({
        tableBody: document.querySelector('#breakdown-table tbody'),
        search: document.getElementById('breakdown-search'),
        processBtn: document.getElementById('process-breakdown-btn'),
        modal: document.getElementById('breakdown-modal'),
        form: document.getElementById('breakdown-form'),
        jobSelect: document.getElementById('breakdown-job-select'),
        jobDetails: document.getElementById('breakdown-job-details'),
        originalRef: document.getElementById('breakdown-original-ref'),
        driver: document.getElementById('breakdown-driver'),
        vehicle: document.getElementById('breakdown-vehicle'),
        reason: document.getElementById('breakdown-reason'),
        newVehicle: document.getElementById('breakdown-new-vehicle')
    });

    // Siphoning
    setSiphoningElements({
        tableBody: document.querySelector('#siphoning-table tbody'),
        search: document.getElementById('siphoning-search'),
        dateFilter: document.getElementById('siphoning-date-filter'),
        createBtn: document.getElementById('create-siphoning-btn'),
        modal: document.getElementById('siphoning-modal'),
        form: document.getElementById('siphoning-form'),
        idInput: document.getElementById('siphoning-id'),
        referenceInput: document.getElementById('siphoning-reference'),
        station: document.getElementById('siphoning-station'),
        driver: document.getElementById('siphoning-driver'),
        vehicleInput: document.getElementById('siphoning-vehicle'),
        dateInput: document.getElementById('siphoning-date'),
        timeInput: document.getElementById('siphoning-time'),
        litersInput: document.getElementById('siphoning-liters'),
        evidenceInput: document.getElementById('siphoning-evidence'),
        evidencePreview: document.getElementById('siphoning-evidence-preview'),
        evidenceImg: document.getElementById('siphoning-evidence-img'),
        notesInput: document.getElementById('siphoning-notes')
    });

    // B100
    setB100Elements({
        tableBody: document.querySelector('#b100-jobs-table tbody'),
        search: document.getElementById('b100-search'),
        statusFilter: document.getElementById('b100-status-filter'),
        createBtn: document.getElementById('create-b100-btn'),
        modal: document.getElementById('b100-modal'),
        form: document.getElementById('b100-form'),
        jobIdInput: document.getElementById('b100-job-id'),
        referenceInput: document.getElementById('b100-reference'),
        driverSelect: document.getElementById('b100-driver'),
        vehicleInput: document.getElementById('b100-vehicle'),
        originSelect: document.getElementById('b100-origin'),
        destinationSelect: document.getElementById('b100-destination'),
        materialsSelect: document.getElementById('b100-materials'),
        quantityInput: document.getElementById('b100-quantity'),
        amountInput: document.getElementById('b100-amount'),
        notesInput: document.getElementById('b100-notes')
    });

    // Map Playback
    setPlaybackElements({
        driverSelect: document.getElementById('playback-driver-select'),
        startDatetime: document.getElementById('playback-start-datetime'),
        endDatetime: document.getElementById('playback-end-datetime'),
        speed: document.getElementById('playback-speed')
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Navigation is handled by admin.js setupNavigation() which calls navigateTo()

    // Job search
    const jobSearchInput = document.getElementById('job-search-input');
    if (jobSearchInput) {
        jobSearchInput.addEventListener('input', debounce((e) => {
            loadJobs(e.target.value);
        }, 300));
    }

    // Create job button
    const createJobButton = document.getElementById('create-job-btn');
    if (createJobButton) {
        createJobButton.addEventListener('click', () => openJobModal());
    }

    // Job modal close
    const jobModalCloseButton = document.getElementById('job-modal')?.querySelector('.close-button');
    if (jobModalCloseButton) {
        jobModalCloseButton.addEventListener('click', closeJobModal);
    }

    // Job form submit
    const jobForm = document.getElementById('job-form');
    if (jobForm) {
        jobForm.addEventListener('submit', handleJobSubmit);
    }

    // Job details modal close
    const jobDetailsCloseButton = document.getElementById('job-details-close');
    if (jobDetailsCloseButton) {
        jobDetailsCloseButton.addEventListener('click', closeJobDetailsModal);
    }

    // Generate report button
    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateDriverReport);
    }

    // Settings form
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', saveSettings);
    }

    // Holiday work search
    const holidayWorkSearch = document.getElementById('holiday-work-search');
    const holidayStatusFilter = document.getElementById('holiday-status-filter');
    const holidayRefreshBtn = document.getElementById('holiday-refresh-btn');

    if (holidayWorkSearch) {
        holidayWorkSearch.addEventListener('input', debounce((e) => {
            loadHolidayWorkJobs(e.target.value, holidayStatusFilter?.value);
        }, 300));
    }

    if (holidayStatusFilter) {
        holidayStatusFilter.addEventListener('change', () => {
            loadHolidayWorkJobs(holidayWorkSearch?.value, holidayStatusFilter.value);
        });
    }

    if (holidayRefreshBtn) {
        holidayRefreshBtn.addEventListener('click', () => {
            loadHolidayWorkJobs(holidayWorkSearch?.value, holidayStatusFilter?.value);
        });
    }

    // Holiday approval modal
    const holidayApprovalModalClose = document.getElementById('holiday-approval-modal-close');
    if (holidayApprovalModalClose) {
        holidayApprovalModalClose.addEventListener('click', closeHolidayApprovalModal);
    }

    const holidayApprovalForm = document.getElementById('holiday-approval-form');
    if (holidayApprovalForm) {
        holidayApprovalForm.addEventListener('submit', (e) => handleHolidayApprovalSubmit(e, liff));
    }

    // Vehicle breakdown
    const breakdownSearch = document.getElementById('breakdown-search');
    if (breakdownSearch) {
        breakdownSearch.addEventListener('input', debounce((e) => {
            loadVehicleBreakdowns(e.target.value);
        }, 300));
    }

    const processBreakdownBtn = document.getElementById('process-breakdown-btn');
    if (processBreakdownBtn) {
        processBreakdownBtn.addEventListener('click', openBreakdownModal);
    }

    const breakdownModalClose = document.getElementById('breakdown-modal-close');
    if (breakdownModalClose) {
        breakdownModalClose.addEventListener('click', closeBreakdownModal);
    }

    const breakdownJobSelect = document.getElementById('breakdown-job-select');
    if (breakdownJobSelect) {
        breakdownJobSelect.addEventListener('change', handleBreakdownJobSelect);
    }

    const breakdownForm = document.getElementById('breakdown-form');
    if (breakdownForm) {
        breakdownForm.addEventListener('submit', handleBreakdownSubmit);
    }

    // Fuel siphoning
    const siphoningSearch = document.getElementById('siphoning-search');
    if (siphoningSearch) {
        siphoningSearch.addEventListener('input', debounce((e) => {
            loadFuelSiphoning(e.target.value);
        }, 300));
    }

    const createSiphoningBtn = document.getElementById('create-siphoning-btn');
    if (createSiphoningBtn) {
        createSiphoningBtn.addEventListener('click', () => openSiphoningModal());
    }

    const siphoningModalClose = document.getElementById('siphoning-modal-close');
    if (siphoningModalClose) {
        siphoningModalClose.addEventListener('click', closeSiphoningModal);
    }

    const siphoningForm = document.getElementById('siphoning-form');
    if (siphoningForm) {
        siphoningForm.addEventListener('submit', handleSiphoningSubmit);
    }

    // B100 jobs
    const b100Search = document.getElementById('b100-search');
    const b100StatusFilter = document.getElementById('b100-status-filter');

    const loadB100Filtered = () => {
        loadB100Jobs(b100Search?.value, b100StatusFilter?.value);
    };

    if (b100Search) {
        b100Search.addEventListener('input', debounce(loadB100Filtered, 300));
    }

    if (b100StatusFilter) {
        b100StatusFilter.addEventListener('change', loadB100Filtered);
    }

    const createB100Btn = document.getElementById('create-b100-btn');
    if (createB100Btn) {
        createB100Btn.addEventListener('click', openB100Modal);
    }

    const b100ModalClose = document.getElementById('b100-modal-close');
    if (b100ModalClose) {
        b100ModalClose.addEventListener('click', closeB100Modal);
    }

    const b100Form = document.getElementById('b100-form');
    if (b100Form) {
        b100Form.addEventListener('submit', handleB100Submit);
    }

    // Map playback controls
    const loadPlaybackDataBtn = document.getElementById('load-playback-data-btn');
    const playButton = document.getElementById('play-button');
    const pauseButton = document.getElementById('pause-button');
    const stopButton = document.getElementById('stop-button');

    if (loadPlaybackDataBtn) {
        loadPlaybackDataBtn.addEventListener('click', () => import('./map.js').then(m => m.loadPlaybackData()));
    }
    if (playButton) {
        playButton.addEventListener('click', () => import('./map.js').then(m => m.startPlayback()));
    }
    if (pauseButton) {
        pauseButton.addEventListener('click', () => import('./map.js').then(m => m.pausePlayback()));
    }
    if (stopButton) {
        stopButton.addEventListener('click', () => import('./map.js').then(m => m.stopPlayback()));
    }

    // Log search filters
    const logSearchReference = document.getElementById('log-search-reference');
    const logSearchAction = document.getElementById('log-search-action');
    const logSearchUserId = document.getElementById('log-search-user-id');

    const loadLogsWithFilters = () => import('./logs.js').then(m => {
        return m.loadLogs({
            reference: logSearchReference?.value,
            action: logSearchAction?.value,
            userId: logSearchUserId?.value
        });
    });

    if (logSearchReference) logSearchReference.addEventListener('input', debounce(loadLogsWithFilters, 300));
    if (logSearchAction) logSearchAction.addEventListener('input', debounce(loadLogsWithFilters, 300));
    if (logSearchUserId) logSearchUserId.addEventListener('input', debounce(loadLogsWithFilters, 300));

    // Logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

/**
 * Load section data based on active section
 * @param {string} targetId - Target section ID
 */
export async function loadSectionData(targetId) {
    console.log('Loading section:', targetId);

    switch (targetId) {
        case 'dashboard':
            await loadDashboardAnalytics();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'jobs':
            await loadJobs();
            break;
        case 'reports':
            await loadDriverReports();
            break;
        case 'settings':
            await loadSettings();
            break;
        case 'alerts':
            await loadAlerts();
            await updateAlertsBadge();
            break;
        case 'logs':
            await import('./logs.js').then(m => m.loadLogs());
            break;
        case 'holiday-work':
            await loadHolidayWorkJobs();
            break;
        case 'breakdown':
            await loadVehicleBreakdowns();
            break;
        case 'siphoning':
            await loadFuelSiphoning();
            break;
        case 'b100':
            await loadB100Jobs();
            break;
        case 'map':
            await import('./map.js').then(m => m.initMap());
            break;
    }
}

/**
 * Navigate to a section
 * @param {string} targetId - Target section ID
 */
export function navigateTo(targetId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.target === targetId) {
            link.classList.add('active');
        }
    });

    // Load section data
    loadSectionData(targetId);
}

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        if (liff) {
            await liff.logout();
        }
        window.location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        window.location.reload();
    }
}

/**
 * Show admin panel after successful auth
 * @param {Object} profile - User profile
 * @param {Object} liffInstance - LIFF instance
 */
export async function showAdminPanel(profile, liffInstance) {
    liff = liffInstance;

    console.log('👤 Admin logged in:', profile);

    // Hide auth, show admin
    const authContainer = document.getElementById('auth-container');
    const adminContainer = document.getElementById('admin-container');
    const adminUsername = document.getElementById('admin-username');

    if (authContainer) authContainer.classList.add('hidden');
    if (adminContainer) adminContainer.classList.remove('hidden');
    if (adminUsername) adminUsername.textContent = profile.displayName || 'Admin';

    // Initialize notification bell
    initNotificationBell();

    // Load initial data
    await loadDashboardAnalytics();
    await loadAlerts();
    await updateAlertsBadge();

    // Setup realtime subscriptions
    setupRealtimeSubscriptions();

    // Initialize map if map section exists
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        await import('./map.js').then(m => m.initMap());
    }
}

/**
 * Show access denied message
 */
export function showAccessDenied() {
    const authStatus = document.getElementById('auth-status');
    if (authStatus) {
        authStatus.textContent = '❌ คุณไม่มีสิทธิ์เข้าถึงหน้านี้';
        authStatus.style.color = 'red';
    }
}

/**
 * Debounce utility
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export LIFF instance for use in other modules
export function getLiff() {
    return liff;
}
