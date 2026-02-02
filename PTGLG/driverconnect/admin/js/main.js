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
    setIncentiveApprovalElements,
    loadIncentiveJobs,
    subscribeToIncentiveUpdates,
    unsubscribeFromIncentiveUpdates,
    openDetailModal as openIncentiveDetailModal,
    closeDetailModal as closeIncentiveDetailModal,
    approveIncentive,
    rejectIncentive,
    requestCorrection,
    editIncentive,
    openCorrectionModal,
    closeCorrectionModal
} from './incentive-approval.js';
import {
    setPaymentProcessingElements,
    loadPayments,
    selectAll,
    clearSelection,
    openDetailModal as openPaymentDetailModal,
    closeDetailModal as closePaymentDetailModal,
    markAsPaid,
    markForTransfer,
    bulkMarkAsPaid,
    bulkMarkForTransfer,
    savePaymentNotes,
    exportPaymentSummary
} from './payment-processing.js';
import {
    setBreakdownElements,
    loadVehicleBreakdowns,
    openBreakdownModal,
    closeBreakdownModal,
    handleBreakdownJobSelect,
    handleBreakdownSubmit
} from './breakdown.js';
import {
    setBreakdownReportsElements,
    loadBreakdownReports,
    openReportModal,
    closeReportModal,
    handleReportActionSubmit
} from './breakdown-reports.js';
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
import { initAutoRefresh } from './auto-refresh.js';

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

    // Initialize auto-refresh
    initAutoRefresh();

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
        detailVehicle: document.getElementById('detail-job-vehicle'),
        detailRoute: document.getElementById('detail-job-route'),
        detailStatus: document.getElementById('detail-job-status'),
        detailClosed: document.getElementById('detail-job-closed'),
        detailCreatedAt: document.getElementById('detail-job-created-at'),
        detailUpdatedAt: document.getElementById('detail-job-updated-at'),
        detailIncentiveApproved: document.getElementById('detail-job-incentive-approved'),
        detailIncentiveAmount: document.getElementById('detail-job-incentive-amount'),
        detailIncentiveStops: document.getElementById('detail-job-incentive-stops'),
        detailPaymentStatus: document.getElementById('detail-job-payment-status'),
        detailPaidAt: document.getElementById('detail-job-paid-at'),
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

    // Incentive Approval
    setIncentiveApprovalElements({
        tbody: document.getElementById('incentive-tbody'),
        search: document.getElementById('incentive-search'),
        statusFilter: document.getElementById('incentive-status-filter'),
        dateFrom: document.getElementById('incentive-date-from'),
        dateTo: document.getElementById('incentive-date-to'),
        refreshBtn: document.getElementById('incentive-refresh-btn'),
        pendingCount: document.getElementById('pending-incentive-count'),
        readyPaymentCount: document.getElementById('ready-payment-count'),
        paidCount: document.getElementById('paid-incentive-count'),
        rejectedCount: document.getElementById('rejected-incentive-count'),
        detailModal: document.getElementById('incentive-detail-modal'),
        modalClose: document.getElementById('incentive-modal-close'),
        detailReference: document.getElementById('detail-reference'),
        detailDriver: document.getElementById('detail-driver'),
        detailDriverCount: document.getElementById('detail-driver-count'),
        detailVehicle: document.getElementById('detail-vehicle'),
        detailDate: document.getElementById('detail-date'),
        detailHolidayWork: document.getElementById('detail-holiday-work'),
        detailPumping: document.getElementById('detail-pumping'),
        detailTransfer: document.getElementById('detail-transfer'),
        detailMaterials: document.getElementById('detail-materials'),
        detailQuantity: document.getElementById('detail-quantity'),
        detailReceiver: document.getElementById('detail-receiver'),
        detailDeliverySummary: document.getElementById('detail-delivery-summary'),
        detailStops: document.getElementById('detail-stops'),
        detailDistance: document.getElementById('detail-distance'),
        detailStopsCount: document.getElementById('detail-stops-count'),
        detailRate: document.getElementById('detail-rate'),
        detailAmount: document.getElementById('detail-amount'),
        detailNotes: document.getElementById('detail-notes'),
        // Performance Summary elements
        perfTotalTime: document.getElementById('perf-total-time'),
        perfTotalDistance: document.getElementById('perf-total-distance'),
        perfHolidayWork: document.getElementById('perf-holiday-work'),
        perfDriverCount: document.getElementById('perf-driver-count'),
        perfDriverNames: document.getElementById('perf-driver-names'),
        perfVehicleStatus: document.getElementById('perf-vehicle-status'),
        editDeliveryBtn: document.getElementById('btn-edit-delivery'),
        editForm: document.getElementById('incentive-edit-form'),
        editReference: document.getElementById('edit-reference'),
        editDistance: document.getElementById('edit-distance'),
        editStopsCount: document.getElementById('edit-stops-count'),
        editRate: document.getElementById('edit-rate'),
        editAmount: document.getElementById('edit-amount'),
        editNotes: document.getElementById('edit-notes'),
        correctionModal: document.getElementById('correction-modal'),
        correctionModalClose: document.getElementById('correction-modal-close'),
        correctionForm: document.getElementById('correction-form'),
        correctionReference: document.getElementById('correction-reference'),
        correctionReason: document.getElementById('correction-reason'),
        correctionDetail: document.getElementById('correction-detail'),
        incentiveMap: document.getElementById('incentive-map')
    });

    // Payment Processing
    setPaymentProcessingElements({
        tbody: document.getElementById('payment-tbody'),
        search: document.getElementById('payment-search'),
        statusFilter: document.getElementById('payment-status-filter'),
        driverFilter: document.getElementById('payment-driver-filter'),
        periodFilter: document.getElementById('payment-period-filter'),
        refreshBtn: document.getElementById('payment-refresh-btn'),
        exportBtn: document.getElementById('payment-export-btn'),
        selectAllCheckbox: document.getElementById('payment-select-all'),
        bulkActionsBar: document.getElementById('payment-bulk-actions'),
        selectedCount: document.getElementById('payment-selected-count'),
        selectedAmount: document.getElementById('payment-selected-amount'),
        bankTransferBtn: document.getElementById('payment-bank-transfer-btn'),
        bulkPaidBtn: document.getElementById('payment-bulk-paid-btn'),
        clearSelectionBtn: document.getElementById('payment-clear-selection-btn'),
        pendingCount: document.getElementById('payment-pending-count'),
        pendingAmount: document.getElementById('payment-pending-amount'),
        processingCount: document.getElementById('payment-processing-count'),
        processingAmount: document.getElementById('payment-processing-amount'),
        completedCount: document.getElementById('payment-completed-count'),
        completedAmount: document.getElementById('payment-completed-amount'),
        transferCount: document.getElementById('payment-transfer-count'),
        transferAmount: document.getElementById('payment-transfer-amount'),
        detailModal: document.getElementById('payment-detail-modal'),
        modalClose: document.getElementById('payment-modal-close'),
        detailReference: document.getElementById('payment-detail-reference'),
        detailDriver: document.getElementById('payment-detail-driver'),
        detailBank: document.getElementById('payment-detail-bank'),
        detailAccount: document.getElementById('payment-detail-account'),
        detailAmount: document.getElementById('payment-detail-amount'),
        detailStatus: document.getElementById('payment-detail-status'),
        detailDistance: document.getElementById('payment-detail-distance'),
        detailStops: document.getElementById('payment-detail-stops'),
        detailRate: document.getElementById('payment-detail-rate'),
        detailNotes: document.getElementById('payment-detail-notes')
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

    // Breakdown Reports (Driver-Submitted)
    setBreakdownReportsElements({
        tableBody: document.getElementById('breakdown-reports-tbody'),
        searchInput: document.getElementById('br-search'),
        statusFilter: document.getElementById('br-status-filter'),
        typeFilter: document.getElementById('br-type-filter'),
        refreshBtn: document.getElementById('br-refresh-btn'),
        modal: document.getElementById('breakdown-report-modal'),
        modalClose: document.getElementById('br-modal-close'),
        modalCancel: document.getElementById('br-modal-cancel'),
        actionForm: document.getElementById('br-action-form'),
        pendingCount: document.getElementById('br-pending-count'),
        inProgressCount: document.getElementById('br-in-progress-count'),
        resolvedCount: document.getElementById('br-resolved-count'),
        totalCount: document.getElementById('br-total-count'),
        modalTitle: document.getElementById('br-modal-title'),
        detailType: document.getElementById('br-detail-type'),
        detailStatus: document.getElementById('br-detail-status'),
        detailTime: document.getElementById('br-detail-time'),
        detailDriverName: document.getElementById('br-detail-driver-name'),
        detailDriverId: document.getElementById('br-detail-driver-id'),
        detailVehicle: document.getElementById('br-detail-vehicle'),
        detailReference: document.getElementById('br-detail-reference'),
        detailIncompleteStops: document.getElementById('br-detail-incomplete-stops'),
        detailLocation: document.getElementById('br-detail-location'),
        detailLatLng: document.getElementById('br-detail-lat-lng'),
        detailMapLink: document.getElementById('br-detail-map-link'),
        detailPhotoContainer: document.getElementById('br-detail-photo-container'),
        detailPhoto: document.getElementById('br-detail-photo'),
        detailDescription: document.getElementById('br-detail-description'),
        detailRequestNewVehicle: document.getElementById('br-detail-request-new-vehicle'),
        detailRequestCloseTrip: document.getElementById('br-detail-request-close-trip'),
        actionReportId: document.getElementById('br-report-id'),
        actionStatus: document.getElementById('br-action-status'),
        actionVehicle: document.getElementById('br-action-vehicle'),
        actionNotes: document.getElementById('br-action-notes')
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
        quantityInput: document.getElementById('b100-quantity')
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

    // Incentive Approval
    const incentiveSearch = document.getElementById('incentive-search');
    const incentiveStatusFilter = document.getElementById('incentive-status-filter');
    const incentiveRefreshBtn = document.getElementById('incentive-refresh-btn');

    if (incentiveSearch) {
        incentiveSearch.addEventListener('input', debounce((e) => {
            loadIncentiveJobs(e.target.value, incentiveStatusFilter?.value);
        }, 300));
    }

    if (incentiveStatusFilter) {
        incentiveStatusFilter.addEventListener('change', () => {
            loadIncentiveJobs(incentiveSearch?.value, incentiveStatusFilter.value);
        });
    }

    if (incentiveRefreshBtn) {
        incentiveRefreshBtn.addEventListener('click', () => {
            loadIncentiveJobs(incentiveSearch?.value, incentiveStatusFilter?.value);
        });
    }

    // Incentive detail modal
    const incentiveModalClose = document.getElementById('incentive-modal-close');
    if (incentiveModalClose) {
        incentiveModalClose.addEventListener('click', closeIncentiveDetailModal);
    }

    const btnCancelIncentive = document.getElementById('btn-cancel-incentive');
    if (btnCancelIncentive) {
        btnCancelIncentive.addEventListener('click', closeIncentiveDetailModal);
    }

    const btnApproveIncentive = document.getElementById('btn-approve-incentive');
    if (btnApproveIncentive) {
        btnApproveIncentive.addEventListener('click', () => approveIncentive(liff));
    }

    const btnRequestCorrection = document.getElementById('btn-request-correction');
    if (btnRequestCorrection) {
        btnRequestCorrection.addEventListener('click', openCorrectionModal);
    }

    const btnRejectIncentive = document.getElementById('btn-reject-incentive');
    if (btnRejectIncentive) {
        btnRejectIncentive.addEventListener('click', () => {
            const reason = prompt('ระบุเหตุผลในการปฏิเสธ:');
            if (reason) {
                rejectIncentive(reason);
            }
        });
    }

    // Incentive edit form
    const incentiveEditForm = document.getElementById('incentive-edit-form');
    if (incentiveEditForm) {
        incentiveEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            editIncentive({
                distance: parseFloat(document.getElementById('edit-distance').value),
                stops: parseInt(document.getElementById('edit-stops-count').value),
                rate: parseFloat(document.getElementById('edit-rate').value),
                amount: parseFloat(document.getElementById('edit-amount').value),
                notes: document.getElementById('edit-notes').value
            });
        });
    }

    // Auto-calculate amount when distance or rate changes
    const editDistance = document.getElementById('edit-distance');
    const editRate = document.getElementById('edit-rate');
    const editAmount = document.getElementById('edit-amount');

    const calculateAmount = () => {
        if (editDistance && editRate && editAmount) {
            const distance = parseFloat(editDistance.value) || 0;
            const rate = parseFloat(editRate.value) || 0;
            editAmount.value = (distance * rate).toFixed(2);
        }
    };

    if (editDistance) editDistance.addEventListener('input', calculateAmount);
    if (editRate) editRate.addEventListener('input', calculateAmount);

    // Correction modal
    const correctionModalClose = document.getElementById('correction-modal-close');
    if (correctionModalClose) {
        correctionModalClose.addEventListener('click', closeCorrectionModal);
    }

    const correctionForm = document.getElementById('correction-form');
    if (correctionForm) {
        correctionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reason = document.getElementById('correction-reason').value;
            const detail = document.getElementById('correction-detail').value;
            requestCorrection(reason, detail);
        });
    }

    // Payment Processing
    const paymentSearch = document.getElementById('payment-search');
    const paymentStatusFilter = document.getElementById('payment-status-filter');
    const paymentDriverFilter = document.getElementById('payment-driver-filter');
    const paymentPeriodFilter = document.getElementById('payment-period-filter');
    const paymentRefreshBtn = document.getElementById('payment-refresh-btn');

    const loadPaymentFiltered = () => {
        loadPayments({
            search: paymentSearch?.value,
            status: paymentStatusFilter?.value,
            driver: paymentDriverFilter?.value,
            period: paymentPeriodFilter?.value
        });
    };

    if (paymentSearch) paymentSearch.addEventListener('input', debounce(loadPaymentFiltered, 300));
    if (paymentStatusFilter) paymentStatusFilter.addEventListener('change', loadPaymentFiltered);
    if (paymentDriverFilter) paymentDriverFilter.addEventListener('change', loadPaymentFiltered);
    if (paymentPeriodFilter) paymentPeriodFilter.addEventListener('change', loadPaymentFiltered);
    if (paymentRefreshBtn) paymentRefreshBtn.addEventListener('click', loadPaymentFiltered);

    // Payment select all
    const paymentSelectAll = document.getElementById('payment-select-all');
    if (paymentSelectAll) {
        paymentSelectAll.addEventListener('change', (e) => selectAll(e.target.checked));
    }

    // Payment bulk actions
    const paymentClearSelectionBtn = document.getElementById('payment-clear-selection-btn');
    if (paymentClearSelectionBtn) {
        paymentClearSelectionBtn.addEventListener('click', clearSelection);
    }

    const paymentBulkPaidBtn = document.getElementById('payment-bulk-paid-btn');
    if (paymentBulkPaidBtn) {
        paymentBulkPaidBtn.addEventListener('click', bulkMarkAsPaid);
    }

    const paymentBankTransferBtn = document.getElementById('payment-bank-transfer-btn');
    if (paymentBankTransferBtn) {
        paymentBankTransferBtn.addEventListener('click', bulkMarkForTransfer);
    }

    const paymentExportBtn = document.getElementById('payment-export-btn');
    if (paymentExportBtn) {
        paymentExportBtn.addEventListener('click', exportPaymentSummary);
    }

    // Payment detail modal
    const paymentModalClose = document.getElementById('payment-modal-close');
    if (paymentModalClose) {
        paymentModalClose.addEventListener('click', closePaymentDetailModal);
    }

    const btnClosePayment = document.getElementById('btn-close-payment');
    if (btnClosePayment) {
        btnClosePayment.addEventListener('click', closePaymentDetailModal);
    }

    const btnMarkPaid = document.getElementById('btn-mark-paid');
    if (btnMarkPaid) {
        btnMarkPaid.addEventListener('click', () => {
            const reference = document.getElementById('payment-detail-modal')?.dataset.reference;
            if (reference) markAsPaid(reference);
        });
    }

    const btnBankTransfer = document.getElementById('btn-bank-transfer');
    if (btnBankTransfer) {
        btnBankTransfer.addEventListener('click', () => {
            const reference = document.getElementById('payment-detail-modal')?.dataset.reference;
            if (reference) markForTransfer(reference);
        });
    }

    const btnSavePaymentNotes = document.getElementById('btn-save-payment-notes');
    if (btnSavePaymentNotes) {
        btnSavePaymentNotes.addEventListener('click', () => {
            const reference = document.getElementById('payment-detail-modal')?.dataset.reference;
            const notes = document.getElementById('payment-detail-notes')?.value;
            if (reference) savePaymentNotes(reference, notes);
        });
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

    // Breakdown Reports (Driver-Submitted)
    const brSearch = document.getElementById('br-search');
    const brStatusFilter = document.getElementById('br-status-filter');
    const brTypeFilter = document.getElementById('br-type-filter');
    const brRefreshBtn = document.getElementById('br-refresh-btn');

    if (brSearch) {
        brSearch.addEventListener('input', debounce(() => {
            loadBreakdownReports();
        }, 300));
    }

    if (brStatusFilter) {
        brStatusFilter.addEventListener('change', () => {
            loadBreakdownReports();
        });
    }

    if (brTypeFilter) {
        brTypeFilter.addEventListener('change', () => {
            loadBreakdownReports();
        });
    }

    if (brRefreshBtn) {
        brRefreshBtn.addEventListener('click', () => {
            loadBreakdownReports();
        });
    }

    const brModalClose = document.getElementById('br-modal-close');
    if (brModalClose) {
        brModalClose.addEventListener('click', closeReportModal);
    }

    const brModalCancel = document.getElementById('br-modal-cancel');
    if (brModalCancel) {
        brModalCancel.addEventListener('click', closeReportModal);
    }

    const brActionForm = document.getElementById('br-action-form');
    if (brActionForm) {
        brActionForm.addEventListener('submit', handleReportActionSubmit);
    }
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

    // Logout button (both sidebar and header)
    const logoutButtons = [
        document.getElementById('logout-button'),
        document.getElementById('logout-button-header')
    ];
    logoutButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', handleLogout);
        }
    });

    // Mobile menu functionality
    setupMobileMenu();

    // Map filter buttons
    setupMapFilters();
}

/**
 * Setup map filter functionality
 */
function setupMapFilters() {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            import('./map.js').then(m => m.setMapFilter(filter));
        });
    });

    // Status cards (also act as filters)
    const statusCards = document.querySelectorAll('.status-card');
    statusCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.status;
            import('./map.js').then(m => m.setMapFilter(filter));
        });
    });
}

/**
 * Setup mobile menu functionality
 */
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const navLinks = document.querySelectorAll('.nav-link');

    // Toggle sidebar when hamburger is clicked
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            sidebar?.classList.toggle('active');
            sidebarOverlay?.classList.toggle('active');
        });
    }

    // Close sidebar when overlay is clicked
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close sidebar when a nav link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenu();
        }
    });
}

/**
 * Close mobile menu
 */
function closeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    mobileMenuBtn?.classList.remove('active');
    sidebar?.classList.remove('active');
    sidebarOverlay?.classList.remove('active');
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
        case 'debug-import-tool':
            await loadDebugImportTool();
            break;
        case 'incentive-approval':
            await loadIncentiveJobs();
            break;
        case 'payment-processing':
            await loadPayments();
            break;
        case 'breakdown-reports':
            await loadBreakdownReports();
            break;
        case 'vehicle-breakdown':
        case 'breakdown':
            await loadVehicleBreakdowns();
            break;
        case 'fuel-siphoning':
        case 'siphoning':
            await loadFuelSiphoning();
            break;
        case 'b100-jobs':
        case 'b100':
            await loadB100Jobs();
            break;
        case 'logistics-performance':
            // Handled by dashboard section
            await loadDashboardAnalytics();
            break;
        case 'driver-reports':
            // Handled by reports section
            await loadDriverReports();
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
    // Hide all sections - remove active and add hidden
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });

    // Show target section - remove hidden and add active
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
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
    const adminUsernameHeader = document.getElementById('admin-username-header');

    if (authContainer) authContainer.classList.add('hidden');
    if (adminContainer) adminContainer.classList.remove('hidden');
    if (adminUsername) adminUsername.textContent = profile.displayName || 'Admin';
    if (adminUsernameHeader) adminUsernameHeader.textContent = profile.displayName || 'Admin';

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
 * Load Debug Import Tool content dynamically
 */
async function loadDebugImportTool() {
    const debugImportSection = document.getElementById('debug-import-tool');

    // If already loaded, skip
    if (debugImportSection.querySelector('.container')) {
        return;
    }

    try {
        const response = await fetch('debug-import-content.html');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const content = await response.text();
        debugImportSection.innerHTML = content;

        // Load available sheet names after content is loaded
        if (window.loadSheetNames) {
            await window.loadSheetNames();
        }
    } catch (error) {
        console.error('Error loading debug import tool:', error);
        debugImportSection.innerHTML = `
            <div class="container">
                <h1>🔍 Debug Import Tool</h1>
                <p style="color: #e74c3c;">Failed to load: ${error.message}</p>
            </div>
        `;
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
