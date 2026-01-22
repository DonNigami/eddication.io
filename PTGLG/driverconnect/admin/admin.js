// Supabase & LIFF Configuration
const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8'; // CORRECTED KEY
const LIFF_ID = '2007705394-Lq3mMYKA'; // Admin panel LIFF ID

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export supabase for use in other modules
export { supabase };

// Global state for realtime
let holidayWorkRealtimeChannel = null;
let jobActivityRealtimeChannel = null;

// Global state for map playback
let map;
let markers = L.featureGroup(); // Group to manage markers
let mapCenterLat = 13.736717; // Default to Bangkok
let mapCenterLng = 100.523186;
let mapZoom = 10;
let playbackPath = null;
let playbackMarker = null;
let playbackData = []; // Stores [{lat, lng, created_at}, ...]
let playbackIndex = 0;
let playbackInterval = null;


// --- DOM Elements ---
// General
const authContainer = document.getElementById('auth-container');
const authStatus = document.getElementById('auth-status');
const adminContainer = document.getElementById('admin-container');
const adminUsername = document.getElementById('admin-username');
const logoutButton = document.getElementById('logout-button');
const navLinks = document.querySelectorAll('.nav-link');

// Dashboard Analytics
const kpiTotalUsers = document.getElementById('kpi-total-users');
const kpiActiveJobs = document.getElementById('kpi-active-jobs');
const kpiPendingApprovals = document.getElementById('kpi-pending-approvals');

// Job Management (Edit/Create Modal)
const jobsTableBody = document.querySelector('#jobs-table tbody');
const jobSearchInput = document.getElementById('job-search-input');
const createJobButton = document.getElementById('create-job-btn');
const jobModal = document.getElementById('job-modal');
const jobModalCloseButton = jobModal.querySelector('.close-button');
const jobForm = document.getElementById('job-form');
const jobIdInput = document.getElementById('job-id');
const jobReferenceInput = document.getElementById('job-reference');
const jobShipmentNoInput = document.getElementById('job-shipment-no');
const jobDriverInput = document.getElementById('job-driver');
const jobStatusInput = document.getElementById('job-status');
const jobTripEndedInput = document.getElementById('job-trip-ended');

// Job Details Modal
const jobDetailsModal = document.getElementById('job-details-modal');
const jobDetailsCloseButton = document.getElementById('job-details-close');
const jobDetailsReferenceTitle = document.getElementById('job-details-reference');
const detailJobReference = document.getElementById('detail-job-reference');
const detailJobShipmentNo = document.getElementById('detail-job-shipment-no');
const detailJobDriver = document.getElementById('detail-job-driver');
const detailJobStatus = document.getElementById('detail-job-status');
const detailJobTripEnded = document.getElementById('detail-job-trip-ended');
const detailJobCreatedAt = document.getElementById('detail-job-created-at');
const detailJobUpdatedAt = document.getElementById('detail-job-updated-at');
const jobDetailsStopsTableBody = document.querySelector('#job-details-stops-table tbody');
const jobDetailsAlcoholTableBody = document.querySelector('#job-details-alcohol-table tbody');
const jobDetailsLogsTableBody = document.querySelector('#job-details-logs-table tbody');

// Driver Reports
const reportDriverSelect = document.getElementById('report-driver-select');
const reportStartDate = document.getElementById('report-start-date');
const reportEndDate = document.getElementById('report-end-date');
const generateReportBtn = document.getElementById('generate-report-btn');
const reportTotalJobs = document.getElementById('report-total-jobs');
const reportCompletedJobs = document.getElementById('report-completed-jobs');
const reportAlcoholChecks = document.getElementById('report-alcohol-checks');
const driverJobsTableBody = document.querySelector('#driver-jobs-table tbody');

// Settings
const settingsForm = document.getElementById('settings-form');
const geofencingRadiusInput = document.getElementById('geofencing_radius_m');
const driverAppAutoRefreshInput = document.getElementById('driver_app_auto_refresh_interval_s');
const adminPanelMapZoomInput = document.getElementById('admin_panel_map_zoom');
const adminPanelMapCenterLatInput = document.getElementById('admin_panel_map_center_lat');
const adminPanelMapCenterLngInput = document.getElementById('admin_panel_map_center_lng');

// Map Playback
const playbackDriverSelect = document.getElementById('playback-driver-select');
const playbackStartDatetime = document.getElementById('playback-start-datetime');
const playbackEndDatetime = document.getElementById('playback-end-datetime');
const playbackSpeed = document.getElementById('playback-speed');
const loadPlaybackDataBtn = document.getElementById('load-playback-data-btn');
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');
const stopButton = document.getElementById('stop-button');

// Alerts
const alertsBadge = document.getElementById('alerts-badge');
const alertsTableBody = document.querySelector('#alerts-table tbody');

// Scheduled Reports
const createReportScheduleBtn = document.getElementById('create-report-schedule-btn');
const reportSchedulesTableBody = document.querySelector('#report-schedules-table tbody');
const reportScheduleModal = document.getElementById('report-schedule-modal');
const reportScheduleModalCloseButton = reportScheduleModal.querySelector('.close-button');
const reportScheduleForm = document.getElementById('report-schedule-form');
const scheduleIdInput = document.getElementById('schedule-id');
const scheduleReportNameInput = document.getElementById('schedule-report-name');
const scheduleReportTypeInput = document.getElementById('schedule-report-type');
const scheduleFrequencyInput = document.getElementById('schedule-frequency');
const scheduleRecipientsInput = document.getElementById('schedule-recipients');
const scheduleStatusInput = document.getElementById('schedule-status');

// Log Viewer
const logsTableBody = document.querySelector('#logs-table tbody');
const logSearchReferenceInput = document.getElementById('log-search-reference');
const logSearchActionInput = document.getElementById('log-search-action');
const logSearchUserIdInput = document.getElementById('log-search-user-id');

// Real-time Notifications
const notificationContainer = document.getElementById('notification-container');

// Holiday Work
const holidayWorkTableBody = document.querySelector('#holiday-work-table tbody');
const holidayWorkSearch = document.getElementById('holiday-work-search');
const holidayStatusFilter = document.getElementById('holiday-status-filter');
const holidayDateFrom = document.getElementById('holiday-date-from');
const holidayDateTo = document.getElementById('holiday-date-to');
const holidayRefreshBtn = document.getElementById('holiday-refresh-btn');
const pendingHolidayCount = document.getElementById('pending-holiday-count');
const approvedHolidayCount = document.getElementById('approved-holiday-count');
const rejectedHolidayCount = document.getElementById('rejected-holiday-count');

// Holiday Approval Modal
const holidayApprovalModal = document.getElementById('holiday-approval-modal');
const holidayApprovalModalClose = document.getElementById('holiday-approval-modal-close');
const holidayApprovalForm = document.getElementById('holiday-approval-form');
const approvalJobId = document.getElementById('approval-job-id');
const approvalReference = document.getElementById('approval-reference');
const approvalReferenceInput = document.getElementById('approval-reference-input');
const approvalDriver = document.getElementById('approval-driver');
const approvalVehicle = document.getElementById('approval-vehicle');
const approvalDate = document.getElementById('approval-date');
const approvalNotes = document.getElementById('approval-notes');
const approvalComment = document.getElementById('approval-comment');
const approvalCommentRequired = document.getElementById('approval-comment-required');
const approvalAction = document.getElementById('approval-action');
const approvalModalTitle = document.getElementById('approval-modal-title');
const approveBtnModal = document.getElementById('approve-btn');
const rejectBtnModal = document.getElementById('reject-btn');

// Vehicle Breakdown
const breakdownTableBody = document.querySelector('#breakdown-table tbody');
const breakdownSearch = document.getElementById('breakdown-search');
const processBreakdownBtn = document.getElementById('process-breakdown-btn');
const breakdownModal = document.getElementById('breakdown-modal');
const breakdownModalClose = document.getElementById('breakdown-modal-close');
const breakdownForm = document.getElementById('breakdown-form');
const breakdownJobSelect = document.getElementById('breakdown-job-select');
const breakdownJobDetails = document.getElementById('breakdown-job-details');
const breakdownOriginalRef = document.getElementById('breakdown-original-ref');
const breakdownDriver = document.getElementById('breakdown-driver');
const breakdownVehicle = document.getElementById('breakdown-vehicle');
const breakdownReason = document.getElementById('breakdown-reason');
const breakdownNewVehicle = document.getElementById('breakdown-new-vehicle');
const breakdownPreview = document.getElementById('breakdown-preview');
const breakdownNewRefPreview = document.getElementById('breakdown-new-ref-preview');

// Fuel Siphoning
const siphoningTableBody = document.querySelector('#siphoning-table tbody');
const siphoningSearch = document.getElementById('siphoning-search');
const siphoningDateFilter = document.getElementById('siphoning-date-filter');
const createSiphoningBtn = document.getElementById('create-siphoning-btn');
const siphoningModal = document.getElementById('siphoning-modal');
const siphoningModalClose = document.getElementById('siphoning-modal-close');
const siphoningModalTitle = document.getElementById('siphoning-modal-title');
const siphoningForm = document.getElementById('siphoning-form');
const siphoningIdInput = document.getElementById('siphoning-id');
const siphoningReferenceInput = document.getElementById('siphoning-reference');
const siphoningStation = document.getElementById('siphoning-station');
const siphoningDriver = document.getElementById('siphoning-driver');
const siphoningVehicleInput = document.getElementById('siphoning-vehicle');
const siphoningDateInput = document.getElementById('siphoning-date');
const siphoningTimeInput = document.getElementById('siphoning-time');
const siphoningLitersInput = document.getElementById('siphoning-liters');
const siphoningEvidenceInput = document.getElementById('siphoning-evidence');
const siphoningEvidencePreview = document.getElementById('siphoning-evidence-preview');
const siphoningEvidenceImg = document.getElementById('siphoning-evidence-img');
const siphoningNotesInput = document.getElementById('siphoning-notes');

// B100 Jobs
const b100JobsTableBody = document.querySelector('#b100-jobs-table tbody');
const b100Search = document.getElementById('b100-search');
const b100StatusFilter = document.getElementById('b100-status-filter');
const createB100Btn = document.getElementById('create-b100-btn');
const b100Modal = document.getElementById('b100-modal');
const b100ModalClose = document.getElementById('b100-modal-close');
const b100Form = document.getElementById('b100-form');
const b100JobIdInput = document.getElementById('b100-job-id');
const b100ReferenceInput = document.getElementById('b100-reference');
const b100DriverSelect = document.getElementById('b100-driver');
const b100VehicleInput = document.getElementById('b100-vehicle');
const b100AmountInput = document.getElementById('b100-amount');
const b100NotesInput = document.getElementById('b100-notes');

// B100 Outstanding
const b100TotalJobs = document.getElementById('b100-total-jobs');
const b100TotalAmount = document.getElementById('b100-total-amount');
const b100DriverCount = document.getElementById('b100-driver-count');
const b100OutstandingTableBody = document.querySelector('#b100-outstanding-table tbody');
const b100DetailModal = document.getElementById('b100-detail-modal');
const b100DetailModalClose = document.getElementById('b100-detail-modal-close');
const b100DetailDriverName = document.getElementById('b100-detail-driver-name');
const b100DetailTableBody = document.querySelector('#b100-detail-table tbody');
const b100DetailTotal = document.getElementById('b100-detail-total');


// --- Utility Functions ---

// Notification Helper
function showNotification(message, type = 'info') {
    const notificationItem = document.createElement('div');
    notificationItem.classList.add('notification-item', type);
    notificationItem.innerHTML = `
        <span class="icon">${type === 'error' ? '!' : 'ℹ️'}</span>
        <span class="message">${message}</span>
    `;
    notificationContainer.prepend(notificationItem); // Add to top

    // Automatically remove after 5 seconds
    setTimeout(() => {
        notificationItem.remove();
    }, 5000);
}

// --- Map Related Functions ---

async function loadMapSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('app_settings')
            .select('*')
            .in('id', ['admin_panel_map_zoom', 'admin_panel_map_center_lat', 'admin_panel_map_center_lng']);
        if (error) throw error;

        settings.forEach(setting => {
            if (setting.id === 'admin_panel_map_zoom') mapZoom = parseInt(setting.value);
            if (setting.id === 'admin_panel_map_center_lat') mapCenterLat = parseFloat(setting.value);
            if (setting.id === 'admin_panel_map_center_lng') mapCenterLng = parseFloat(setting.value);
        });
    } catch (error) {
        console.error('Error loading map settings, using defaults:', error);
    }
}

async function initMap() {
    if (map) {
        map.remove(); // Remove existing map if it was already initialized
    }

    await loadMapSettings(); // Load map settings before initializing

    map = L.map('map').setView([mapCenterLat, mapCenterLng], mapZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markers.addTo(map);
    updateMapMarkers();
}

async function updateMapMarkers() {
    markers.clearLayers(); // Clear existing markers

    try {
        // Fetch active jobs (or all jobs for now) to get relevant driver_logs
        const { data: activeJobs, error: jobsError } = await supabase
            .from('jobdata') // Use jobdata for trip_ended/status fields
            .select('reference, drivers')
            .not('trip_ended', 'is', true); // Only jobs not ended

        if (jobsError) throw jobsError;

        if (activeJobs.length === 0) {
            console.log('No active jobs found for map markers.');
            return;
        }

        for (const job of activeJobs) {
            // Fetch the latest log entry with location for this job reference
            const { data: latestLog, error: logError } = await supabase
                .from('driver_logs')
                .select('location, action, created_at')
                .eq('reference', job.reference)
                .not('location', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 or 1 result

            if (logError && logError.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error(`Error fetching latest log for job ${job.reference}:`, logError);
                continue;
            }

            if (latestLog && latestLog.location && latestLog.location.lat && latestLog.location.lng) {
                const lat = latestLog.location.lat;
                const lng = latestLog.location.lng;
                const action = latestLog.action;
                const time = new Date(latestLog.created_at).toLocaleString();

                const marker = L.marker([lat, lng]).bindPopup(`
                    <b>Job:</b> ${job.reference}<br>
                    <b>Driver:</b> ${job.drivers || 'N/A'}<br>
                    <b>Last Action:</b> ${action}<br>
                    <b>Time:</b> ${time}
                `);
                markers.addLayer(marker);
            }
        }

        if (markers.getLayers().length > 0) {
            map.fitBounds(markers.getBounds());
        }

    } catch (error) {
        console.error('Error updating map markers:', error);
    }
}

// Map Playback Functions
async function loadPlaybackData() {
    const driverId = playbackDriverSelect.value;
    const startDatetime = playbackStartDatetime.value;
    const endDatetime = playbackEndDatetime.value;

    if (!driverId) {
        showNotification('Please select a driver for playback.', 'error');
        return;
    }
    if (!startDatetime || !endDatetime) {
        showNotification('Please select a start and end date/time for playback.', 'error');
        return;
    }

    stopPlayback(); // Stop any ongoing playback and clear map

    try {
        // Fetch location data from driver_logs. For more granular data, a dedicated table would be better.
        const { data: logs, error } = await supabase
            .from('driver_logs')
            .select('location, created_at')
            .eq('user_id', driverId)
            .not('location', 'is', null)
            .gte('created_at', startDatetime)
            .lte('created_at', endDatetime)
            .order('created_at', { ascending: true });

        if (error) throw error;

        playbackData = logs.filter(log => log.location && log.location.lat && log.location.lng)
            .map(log => ({ lat: log.location.lat, lng: log.location.lng, created_at: log.created_at }));

        if (playbackData.length < 2) {
            showNotification('Not enough location data for playback in the selected period.', 'info');
            return;
        }

        // Draw entire path
        const pathCoordinates = playbackData.map(point => [point.lat, point.lng]);
        playbackPath = L.polyline(pathCoordinates, { color: 'blue', weight: 3 }).addTo(map);
        map.fitBounds(playbackPath.getBounds());

        // Create animated marker
        const driverIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3356/3356611.png', // Generic car icon
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        playbackMarker = L.marker([playbackData[0].lat, playbackData[0].lng], { icon: driverIcon }).addTo(map)
            .bindPopup(`Driver: ${playbackDriverSelect.options[playbackDriverSelect.selectedIndex].text}<br>Time: ${new Date(playbackData[0].created_at).toLocaleString()}`);

        showNotification(`Loaded ${playbackData.length} points for playback.`, 'info');

    } catch (error) {
        console.error('Error loading playback data:', error);
        showNotification(`Failed to load playback data: ${error.message}`, 'error');
    }
}

function startPlayback() {
    if (playbackData.length < 2 || !playbackMarker) {
        showNotification('Please load playback data first.', 'error');
        return;
    }

    if (playbackInterval) clearInterval(playbackInterval); // Clear any existing interval

    // Ensure playback starts from current index or beginning if stopped
    if (playbackIndex >= playbackData.length - 1) {
        playbackIndex = 0; // Reset to start if already at end
        playbackMarker.setLatLng([playbackData[0].lat, playbackData[0].lng]);
        playbackMarker.getPopup().setContent(`Driver: ${playbackDriverSelect.options[playbackDriverSelect.selectedIndex].text}<br>Time: ${new Date(playbackData[0].created_at).toLocaleString()}`);
    }

    const speed = parseFloat(playbackSpeed.value) || 1;
    const intervalTime = 500 / speed; // Base interval 500ms, faster for higher speed

    playbackInterval = setInterval(() => {
        if (playbackIndex < playbackData.length - 1) {
            playbackIndex++;
            const currentPoint = playbackData[playbackIndex];
            playbackMarker.setLatLng([currentPoint.lat, currentPoint.lng]);
            playbackMarker.getPopup().setContent(`Driver: ${playbackDriverSelect.options[playbackDriverSelect.selectedIndex].text}<br>Time: ${new Date(currentPoint.created_at).toLocaleString()}`);
            map.panTo([currentPoint.lat, currentPoint.lng]); // Keep marker centered
        } else {
            stopPlayback();
            showNotification('Playback finished.', 'info');
        }
    }, intervalTime);
}

function pausePlayback() {
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        showNotification('Playback paused.', 'info');
    }
}

function stopPlayback() {
    if (playbackInterval) clearInterval(playbackInterval);
    playbackInterval = null;
    playbackIndex = 0;

    if (playbackPath) {
        map.removeLayer(playbackPath);
        playbackPath = null;
    }
    if (playbackMarker) {
        map.removeLayer(playbackMarker);
        playbackMarker = null;
    }
    markers.clearLayers(); // Clear active job markers too for cleaner view
    updateMapMarkers(); // Re-add active job markers
    showNotification('Playback stopped and map cleared.', 'info');
}


// --- Dashboard Analytics Functions ---
async function loadDashboardAnalytics() {
    try {
        // Total Users
        const { count: totalUsers, error: usersError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' });
        if (usersError) throw usersError;
        kpiTotalUsers.textContent = totalUsers;

        // Active Jobs (e.g., status 'active' and trip_ended is false)
        const { count: activeJobs, error: jobsError } = await supabase
            .from('jobdata') // Use jobdata for trip_ended/status fields
            .select('*', { count: 'exact' })
            .eq('status', 'active')
            .eq('trip_ended', false);
        if (jobsError) throw jobsError;
        kpiActiveJobs.textContent = activeJobs;

        // Pending Approvals
        const { count: pendingApprovals, error: pendingError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' })
            .eq('status', 'PENDING');
        if (pendingError) throw pendingError;
        kpiPendingApprovals.textContent = pendingApprovals;

    } catch (error) {
        console.error('Error loading dashboard analytics:', error);
        kpiTotalUsers.textContent = 'Error';
        kpiActiveJobs.textContent = 'Error';
        kpiPendingApprovals.textContent = 'Error';
    }
}


// --- User Management Functions ---
async function loadUsers() {
    const usersTableBody = document.querySelector('#users-table tbody');
    usersTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const { data: users, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
            return;
        }

        usersTableBody.innerHTML = ''; // Clear loading state
        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.id; // UserProfile ID (serial)

            const statusOptions = ['PENDING', 'APPROVED', 'REJECTED']
                .map(s => `<option value="${s}" ${user.status === s ? 'selected' : ''}>${s}</option>`).join('');

            const roleOptions = ['DRIVER', 'ADMIN']
                .map(r => `<option value="${r}" ${user.user_type === r ? 'selected' : ''}>${r}</option>`).join('');

            row.innerHTML = `
                <td>${user.display_name || 'N/A'}</td>
                <td>${user.user_id}</td>
                <td><select class="status-select">${statusOptions}</select></td>
                <td><select class="role-select">${roleOptions}</select></td>
                <td><button class="save-user-btn" data-id="${user.id}">Save</button></td>
            `;
            usersTableBody.appendChild(row);
        });

        // Add event listeners to save buttons
        document.querySelectorAll('.save-user-btn').forEach(button => {
            button.addEventListener('click', handleUserUpdate);
        });

    } catch (error) {
        console.error('Error loading users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="5">Error loading users: ${error.message}</td></tr>`;
    }
}

async function handleUserUpdate(event) {
    const button = event.currentTarget;
    const userId = button.dataset.id; // Get ID from button's data-id
    const row = button.closest('tr');
    const status = row.querySelector('.status-select').value;
    const userType = row.querySelector('.role-select').value;

    // Validate userId
    if (!userId || userId === 'undefined') {
        alert('ไม่สามารถอัพเดทได้: ไม่พบ User ID');
        return;
    }

    button.textContent = 'Saving...';
    button.disabled = true;

    try {
        const { error } = await supabase
            .from('user_profiles')
            .update({
                status: status,
                user_type: userType,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId); // Use user_profiles.id (serial) for update

        if (error) throw error;

        alert('User updated successfully!');

    } catch (error) {
        console.error('Error updating user:', error);
        alert(`Failed to update user: ${error.message}`);
    } finally {
        button.textContent = 'Save';
        button.disabled = false;
    }
}


// --- Job Management Functions ---
async function loadJobs(searchTerm = '') {
    jobsTableBody.innerHTML = '<tr><td colspan="6">Loading jobs...</td></tr>';
    try {
        let query = supabase.from('driver_jobs').select('*').order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,shipment_no.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        const { data: jobs, error } = await query;

        if (error) throw error;

        jobsTableBody.innerHTML = '';
        if (jobs.length === 0) {
            jobsTableBody.innerHTML = '<tr><td colspan="6">No jobs found.</td></tr>';
            return;
        }

        jobs.forEach(job => {
            const row = document.createElement('tr');
            row.dataset.jobId = job.id;
            row.innerHTML = `
                <td>${job.reference || 'N/A'}</td>
                <td>${job.shipment_no || 'N/A'}</td>
                <td>${job.drivers || 'N/A'}</td>
                <td>${job.status || 'N/A'}</td>
                <td>${job.trip_ended ? 'Yes' : 'No'}</td>
                <td>
                    <button class="edit-job-btn">Edit</button>
                    <button class="delete-job-btn" style="background-color: #e74c3c;">Delete</button>
                    <button class="view-details-btn" data-job-id="${job.id}">Details</button>
                </td>
            `;
            jobsTableBody.appendChild(row);
        });

        document.querySelectorAll('.edit-job-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const jobId = e.target.closest('tr').dataset.jobId;
                const job = jobs.find(j => j.id == jobId);
                openJobModal(job);
            });
        });

        document.querySelectorAll('.delete-job-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const jobId = e.target.closest('tr').dataset.jobId;
                handleDeleteJob(jobId);
            });
        });

        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const jobId = e.target.dataset.jobId;
                openJobDetailsModal(jobId);
            });
        });

    } catch (error) {
        console.error('Error loading jobs:', error);
        jobsTableBody.innerHTML = `<tr><td colspan="6">Error loading jobs: ${error.message}</td></tr>`;
    }
}

function openJobModal(job = null) {
    jobForm.reset();
    jobIdInput.value = ''; // Clear hidden ID

    if (job) {
        jobIdInput.value = job.id;
        jobReferenceInput.value = job.reference || '';
        jobShipmentNoInput.value = job.shipment_no || '';
        jobDriverInput.value = job.drivers || '';
        jobStatusInput.value = job.status || 'pending';
        jobTripEndedInput.checked = job.trip_ended || false;
    }
    jobModal.classList.remove('hidden');
}

function closeJobModal() {
    jobModal.classList.add('hidden');
}

async function handleJobSubmit(event) {
    event.preventDefault();

    const jobId = jobIdInput.value;
    const jobData = {
        reference: jobReferenceInput.value,
        shipment_no: jobShipmentNoInput.value,
        drivers: jobDriverInput.value,
        status: jobStatusInput.value,
        trip_ended: jobTripEndedInput.checked,
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

        alert(`Job ${jobId ? 'updated' : 'created'} successfully!`);
        closeJobModal();
        loadJobs(); // Refresh job list

    } catch (error) {
        console.error(`Error ${jobId ? 'updating' : 'creating'} job:`, error);
        alert(`Failed to ${jobId ? 'update' : 'create'} job: ${error.message}`);
    }
}

async function handleDeleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('driver_jobs') // Changed from jobdata to driver_jobs
            .delete()
            .eq('id', jobId);

        if (error) throw error;

        alert('Job deleted successfully!');
        loadJobs(); // Refresh job list
    } catch (error) { // Added missing catch block
        console.error('Error deleting job:', error);
        alert(`Failed to delete job: ${error.message}`);
    }
}


// --- Job Details Functions ---
async function openJobDetailsModal(jobId) {
    jobDetailsModal.classList.remove('hidden');

    // Clear previous data
    jobDetailsReferenceTitle.textContent = 'Loading...';
    detailJobReference.textContent = 'Loading...';
    detailJobShipmentNo.textContent = 'Loading...';
    detailJobDriver.textContent = 'Loading...';
    detailJobStatus.textContent = 'Loading...';
    detailJobTripEnded.textContent = 'Loading...';
    detailJobCreatedAt.textContent = 'Loading...';
    detailJobUpdatedAt.textContent = 'Loading...';
    jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="5">Loading stops...</td></tr>';
    jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">Loading alcohol checks...</td></tr>';
    jobDetailsLogsTableBody.innerHTML = '<tr><td colspan="4">Loading driver logs...</td></tr>';

    try {
        // Fetch Job Data
        const { data: job, error: jobError } = await supabase
            .from('driver_jobs') // Changed from jobdata to driver_jobs
            .select('*')
            .eq('id', jobId)
            .single();
        if (jobError) throw jobError;

        jobDetailsReferenceTitle.textContent = job.reference || 'N/A';
        detailJobReference.textContent = job.reference || 'N/A';
        detailJobShipmentNo.textContent = job.shipment_no || 'N/A';
        detailJobDriver.textContent = job.drivers || 'N/A';
        detailJobStatus.textContent = job.status || 'N/A';
        detailJobTripEnded.textContent = job.trip_ended ? 'Yes' : 'No';
        detailJobCreatedAt.textContent = new Date(job.created_at).toLocaleString();
        detailJobUpdatedAt.textContent = new Date(job.updated_at).toLocaleString();

        // Fetch Trip Stops (using reference since driver_stop.trip_id is bigint referencing jobdata, not driver_jobs)
        const { data: driverStops, error: stopsError } = await supabase
            .from('driver_stop')
            .select('*')
            .eq('reference', job.reference)
            .order('sequence', { ascending: true });
        if (stopsError) throw stopsError;

        jobDetailsStopsTableBody.innerHTML = '';
        if (driverStops.length === 0) {
            jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="5">No stops found.</td></tr>';
        } else {
            driverStops.forEach(stop => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${stop.sequence || 'N/A'}</td>
                    <td>${stop.destination_name || 'N/A'}</td>
                    <td>${stop.status || 'N/A'}</td>
                    <td>${stop.check_in_time ? new Date(stop.check_in_time).toLocaleString() : 'N/A'}</td>
                    <td>${stop.check_out_time ? new Date(stop.check_out_time).toLocaleString() : 'N/A'}</td>
                `;
                jobDetailsStopsTableBody.appendChild(row);
            });
        }

        // Fetch Alcohol Checks
        const { data: driverAlcoholChecks, error: alcoholError } = await supabase
            .from('driver_alcohol_checks') // Changed from alcohol_checks to driver_alcohol_checks
            .select('*')
            .eq('job_id', jobId) // Changed from trip_id to job_id as per driver_alcohol_checks schema
            .order('checked_at', { ascending: false });
        if (alcoholError) throw alcoholError;

        jobDetailsAlcoholTableBody.innerHTML = '';
        if (driverAlcoholChecks.length === 0) {
            jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">No alcohol checks found.</td></tr>';
        } else {
            driverAlcoholChecks.forEach(check => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${check.checked_by || 'N/A'}</td> <!-- Changed from driver_name to checked_by -->
                    <td>${check.alcohol_value || 'N/A'}</td>
                    <td>${new Date(check.checked_at).toLocaleString()}</td>
                    <td>${check.image_url ? `<a href="${check.image_url}" target="_blank">View Image</a>` : 'N/A'}</td>
                `;
                jobDetailsAlcoholTableBody.appendChild(row);
            });
        }

        // Fetch Driver Logs
        const { data: driverLogs, error: logsError } = await supabase
            .from('driver_logs')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (logsError) throw logsError;

        jobDetailsLogsTableBody.innerHTML = '';
        if (driverLogs.length === 0) {
            jobDetailsLogsTableBody.innerHTML = '<tr><td colspan="4">No driver logs found.</td></tr>';
        } else {
            driverLogs.forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.action || 'N/A'}</td>
                    <td>${log.user_id || 'N/A'}</td>
                    <td>${log.location ? `Lat: ${log.location.lat}, Lng: ${log.location.lng}` : 'N/A'}</td>
                `;
                jobDetailsLogsTableBody.appendChild(row);
            });
        }

    } catch (error) {
        console.error('Error loading job details:', error);
        alert(`Failed to load job details: ${error.message}`);
        closeJobDetailsModal();
    }
}

function closeJobDetailsModal() {
    jobDetailsModal.classList.add('hidden');
}


// --- Driver Reports Functions ---
async function loadDriverReports() {
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
        reportEndDate.value = startDate.toISOString().split('T')[0];
        reportStartDate.value = startDate.toISOString().split('T')[0];
        reportEndDate.value = endDate.toISOString().split('T')[0];


    } catch (error) {
        console.error('Error loading drivers for report:', error);
        reportDriverSelect.innerHTML = '<option value="">Error loading drivers</option>';
    }
}

async function generateDriverReport() {
    const driverId = reportDriverSelect.value;
    const startDate = reportStartDate.value;
    const endDate = reportEndDate.value;

    if (!driverId) {
        alert('Please select a driver.');
        return;
    }
    if (!startDate || !endDate) {
        alert('Please select a date range.');
        return;
    }

    // Clear previous results
    reportTotalJobs.textContent = '...';
    reportCompletedJobs.textContent = '...';
    reportAlcoholChecks.textContent = '...';
    driverJobsTableBody.innerHTML = '<tr><td colspan="5">Generating report...</td></tr>';

    try {
        // Fetch jobs for the driver within the date range
        const { data: jobs, error: jobsError } = await supabase
            .from('driver_jobs') // Changed from jobdata to driver_jobs
            .select('*')
            .ilike('drivers', `%${driverId}%`) // Assuming 'drivers' column contains driver_id or name
            .gte('created_at', startDate + 'T00:00:00Z')
            .lte('created_at', endDate + 'T23:59:59Z')
            .order('created_at', { ascending: false });
        if (jobsError) throw jobsError;

        // Fetch alcohol checks for the driver within the date range
        const { count: alcoholChecksCount, error: alcoholError } = await supabase
            .from('driver_alcohol_checks') // Changed from alcohol_checks to driver_alcohol_checks
            .select('id', { count: 'exact' })
            .eq('driver_user_id', driverId)
            .gte('checked_at', startDate + 'T00:00:00Z')
            .lte('checked_at', endDate + 'T23:59:59Z');
        if (alcoholError) throw alcoholError;

        // Update Summary
        reportTotalJobs.textContent = jobs.length;
        reportCompletedJobs.textContent = jobs.filter(job => job.status === 'completed' || job.trip_ended).length;
        reportAlcoholChecks.textContent = alcoholChecksCount;

        // Display Jobs in Period
        driverJobsTableBody.innerHTML = '';
        if (jobs.length === 0) {
            driverJobsTableBody.innerHTML = '<tr><td colspan="5">No jobs found for this driver in the selected period.</td></tr>';
        } else {
            jobs.forEach(job => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${job.reference || 'N/A'}</td>
                    <td>${job.shipment_no || 'N/A'}</td>
                    <td>${job.drivers || 'N/A'}</td>
                    <td>${job.status || 'N/A'}</td>
                    <td>${job.trip_ended ? 'Yes' : 'No'}</td>
                    <td>${new Date(job.created_at).toLocaleString()}</td>
                `;
                driverJobsTableBody.appendChild(row);
            });
        }

    } catch (error) {
        console.error('Error generating driver report:', error);
        alert(`Failed to generate report: ${error.message}`);
        reportTotalJobs.textContent = 'Error';
        reportCompletedJobs.textContent = 'Error';
        reportAlcoholChecks.textContent = 'Error';
        driverJobsTableBody.innerHTML = '<tr><td colspan="5">Error generating report.</td></tr>';
    }
}


// --- Settings Functions ---
async function loadSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('app_settings')
            .select('*');
        if (error) throw error;

        settings.forEach(setting => {
            const inputElement = document.getElementById(setting.id);
            if (inputElement) {
                if (setting.type === 'number') {
                    inputElement.value = parseFloat(setting.value);
                } else if (setting.type === 'boolean') {
                    inputElement.checked = (setting.value === 'true');
                } else {
                    inputElement.value = setting.value;
                }
            }
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        alert('Failed to load settings.');
    }
}

async function saveSettings(event) {
    event.preventDefault();

    const saveButton = settingsForm.querySelector('button[type="submit"]');
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    try {
        const settingsToUpdate = [];
        const inputs = settingsForm.querySelectorAll('input, select');
        inputs.forEach(input => {
            let value;
            let type = input.type;
            if (input.type === 'checkbox') {
                value = input.checked ? 'true' : 'false';
                type = 'boolean';
            } else {
                value = input.value;
            }
            settingsToUpdate.push({ id: input.id, value: value, type: type });
        });

        for (const setting of settingsToUpdate) {
            const { error } = await supabase
                .from('app_settings')
                .update({ value: setting.value, updated_at: new Date().toISOString() })
                .eq('id', setting.id);
            if (error) throw error;
        }

        alert('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert(`Failed to save settings: ${error.message}`);
    } finally {
        saveButton.textContent = 'Save Settings';
        saveButton.disabled = false;
        // Reload map settings if they were updated
        loadMapSettings();
    }
}


// --- Alerts Functions ---
async function loadAlerts() {
    alertsTableBody.innerHTML = '<tr><td colspan="7">Loading alerts...</td></tr>';
    try {
        const { data: alerts, error } = await supabase
            .from('triggered_alerts')
            .select('*')
            .order('triggered_at', { ascending: false });
        if (error) throw error;

        alertsTableBody.innerHTML = '';
        if (alerts.length === 0) {
            alertsTableBody.innerHTML = '<tr><td colspan="7">No alerts found.</td></tr>';
            return;
        }

        alerts.forEach(alert => {
            const row = document.createElement('tr');
            row.dataset.alertId = alert.id;
            const statusClass = alert.status === 'pending' ? 'status-pending' : 'status-resolved';
            const resolveButton = alert.status === 'pending' ? `<button class="resolve-alert-btn" data-alert-id="${alert.id}">Resolve</button>` : '';

            row.innerHTML = `
                <td>${new Date(alert.triggered_at).toLocaleString()}</td>
                <td>${alert.rule_name || 'N/A'}</td>
                <td>${alert.driver_user_id || 'N/A'}</td>
                <td>${alert.trip_id || 'N/A'}</td>
                <td>${alert.message || 'N/A'}</td>
                <td class="${statusClass}">${alert.status}</td>
                <td>${resolveButton}</td>
            `;
            alertsTableBody.appendChild(row);
        });

        document.querySelectorAll('.resolve-alert-btn').forEach(button => {
            button.addEventListener('click', handleResolveAlert);
        });

    } catch (error) {
        console.error('Error loading alerts:', error);
        alertsTableBody.innerHTML = `<tr><td colspan="7">Error loading alerts: ${error.message}</td></tr>`;
    }
}

async function updateAlertsBadge() {
    try {
        const { count, error } = await supabase
            .from('triggered_alerts')
            .select('*', { count: 'exact' })
            .eq('status', 'pending');

        if (error) throw error;

        if (count > 0) {
            alertsBadge.textContent = count;
            alertsBadge.classList.remove('hidden');
        } else {
            alertsBadge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error updating alerts badge:', error);
    }
}

async function handleResolveAlert(event) {
    const button = event.currentTarget;
    const alertId = button.dataset.alertId;

    button.textContent = 'Resolving...';
    button.disabled = true;

    try {
        const { error } = await supabase
            .from('triggered_alerts')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', alertId);

        if (error) throw error;

        showNotification('Alert resolved successfully!', 'info');
        loadAlerts(); // Refresh alerts list
        updateAlertsBadge(); // Update badge count
    } catch (error) {
        console.error('Error resolving alert:', error);
        showNotification(`Failed to resolve alert: ${error.message}`, 'error');
    } finally {
        button.textContent = 'Resolve';
        button.disabled = false;
    }
}


// --- Scheduled Reports Functions ---
async function loadReportSchedules() {
    reportSchedulesTableBody.innerHTML = '<tr><td colspan="6">Loading report schedules...</td></tr>';
    try {
        const { data: schedules, error } = await supabase
            .from('report_schedules')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        reportSchedulesTableBody.innerHTML = '';
        if (schedules.length === 0) {
            reportSchedulesTableBody.innerHTML = '<tr><td colspan="6">No report schedules found.</td></tr>';
            return;
        }

        schedules.forEach(schedule => {
            const row = document.createElement('tr');
            row.dataset.scheduleId = schedule.id;
            const nextRun = schedule.next_generation_at ? new Date(schedule.next_generation_at).toLocaleString() : 'N/A';
            const statusClass = schedule.status === 'active' ? 'status-active' : 'status-paused';
            row.innerHTML = `
                <td>${schedule.report_name || 'N/A'}</td>
                <td>${schedule.report_type || 'N/A'}</td>
                <td>${schedule.frequency || 'N/A'}</td>
                <td>${nextRun}</td>
                <td class="${statusClass}">${schedule.status}</td>
                <td>
                    <button class="edit-schedule-btn" data-id="${schedule.id}">Edit</button>
                    <button class="delete-schedule-btn" data-id="${schedule.id}" style="background-color: #e74c3c;">Delete</button>
                </td>
            `;
            reportSchedulesTableBody.appendChild(row);
        });

        document.querySelectorAll('.edit-schedule-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const scheduleId = e.target.dataset.id;
                const schedule = schedules.find(s => s.id === scheduleId);
                openReportScheduleModal(schedule);
            });
        });

        document.querySelectorAll('.delete-schedule-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const scheduleId = e.target.dataset.id;
                handleDeleteReportSchedule(scheduleId);
            });
        });

    } catch (error) {
        console.error('Error loading report schedules:', error);
        reportSchedulesTableBody.innerHTML = `<tr><td colspan="6">Error loading report schedules: ${error.message}</td></tr>`;
    }
}

function openReportScheduleModal(schedule = null) {
    reportScheduleForm.reset();
    scheduleIdInput.value = '';

    if (schedule) {
        scheduleIdInput.value = schedule.id;
        scheduleReportNameInput.value = schedule.report_name || '';
        scheduleReportTypeInput.value = schedule.report_type || 'driver_performance';
        scheduleFrequencyInput.value = schedule.frequency || 'daily';
        scheduleRecipientsInput.value = JSON.stringify(schedule.recipients || [], null, 2);
        scheduleStatusInput.value = schedule.status || 'active';
    }
    reportScheduleModal.classList.remove('hidden');
}

function closeReportScheduleModal() {
    reportScheduleModal.classList.add('hidden');
}

async function handleReportScheduleSubmit(event) {
    event.preventDefault();

    const scheduleId = scheduleIdInput.value;
    let recipientsParsed;
    try {
        recipientsParsed = JSON.parse(scheduleRecipientsInput.value);
        if (!Array.isArray(recipientsParsed)) {
            throw new Error('Recipients must be a valid JSON array.');
        }
    } catch (e) {
        alert(`Invalid Recipients JSON: ${e.message}`);
        return;
    }

    const scheduleData = {
        report_name: scheduleReportNameInput.value,
        report_type: scheduleReportTypeInput.value,
        frequency: scheduleFrequencyInput.value,
        recipients: recipientsParsed,
        status: scheduleStatusInput.value,
        updated_at: new Date().toISOString()
        // next_generation_at should be calculated by backend
    };

    try {
        let error = null;
        if (scheduleId) {
            ({ error } = await supabase.from('report_schedules').update(scheduleData).eq('id', scheduleId));
        } else {
            scheduleData.created_at = new Date().toISOString();
            ({ error } = await supabase.from('report_schedules').insert([scheduleData]));
        }

        if (error) throw error;

        alert(`Report schedule ${scheduleId ? 'updated' : 'created'} successfully!`);
        closeReportScheduleModal();
        loadReportSchedules();
    } catch (error) {
        console.error('Error saving report schedule:', error);
        alert(`Failed to save report schedule: ${error.message}`);
    }
}

async function handleDeleteReportSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this report schedule?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('report_schedules')
            .delete()
            .eq('id', scheduleId);

        if (error) throw error;

        alert('Report schedule deleted successfully!');
        loadReportSchedules();
    } catch (error) {
        console.error('Error deleting report schedule:', error);
        alert(`Failed to delete report schedule: ${error.message}`);
    }
}


// --- Log Viewer Functions ---
async function loadLogs() {
    logsTableBody.innerHTML = '<tr><td colspan="6">Loading logs...</td></tr>';
    try {
        let query = supabase.from('driver_logs').select('*').order('created_at', { ascending: false });

        const referenceFilter = logSearchReferenceInput.value;
        const actionFilter = logSearchActionInput.value;
        const userIdFilter = logSearchUserIdInput.value;

        if (referenceFilter) {
            query = query.ilike('reference', `%${referenceFilter}%`);
        }
        if (actionFilter) {
            query = query.ilike('action', `%${actionFilter}%`);
        }
        if (userIdFilter) {
            query = query.ilike('user_id', `%${userIdFilter}%`);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        logsTableBody.innerHTML = '';
        if (logs.length === 0) {
            logsTableBody.innerHTML = '<tr><td colspan="6">No logs found.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(log.created_at).toLocaleString()}</td>
                <td>${log.reference || 'N/A'}</td>
                <td>${log.action || 'N/A'}</td>
                <td>${log.user_id || 'N/A'}</td>
                <td>${JSON.stringify(log.details) || 'N/A'}</td>
                <td>${log.location ? `Lat: ${log.location.lat}, Lng: ${log.location.lng}` : 'N/A'}</td>
            `;
            logsTableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading logs:', error);
        logsTableBody.innerHTML = `<tr><td colspan="6">Error loading logs: ${error.message}</td></tr>`;
    }
}


// --- Holiday Work Functions ---
async function loadHolidayWorkJobs(searchTerm = '', statusFilter = 'pending') {
    const tbody = document.getElementById('holiday-work-tbody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;"><div style="font-size:24px;">⏳</div><p>กำลังโหลดข้อมูล...</p></td></tr>';
    
    try {
        // Query from jobdata table
        let query = supabase.from('jobdata')
            .select('*')
            .eq('is_holiday_work', true)
            .order('job_closed_at', { ascending: false });

        // Filter by status
        if (statusFilter === 'pending') {
            query = query.or('holiday_work_approved.is.null,holiday_work_approved.eq.false')
                        .or('holiday_work_approved_at.is.null');
        } else if (statusFilter === 'approved') {
            query = query.eq('holiday_work_approved', true);
        } else if (statusFilter === 'rejected') {
            query = query.eq('holiday_work_approved', false).not('holiday_work_approved_at', 'is', null);
        }

        // Filter by date range
        if (holidayDateFrom.value) {
            query = query.gte('job_closed_at', holidayDateFrom.value);
        }
        if (holidayDateTo.value) {
            const endDate = new Date(holidayDateTo.value);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('job_closed_at', endDate.toISOString().split('T')[0]);
        }

        const { data: jobs, error } = await query;

        if (error) throw error;
        
        console.log('📊 Holiday work jobs loaded:', jobs.length);
        console.log('📊 Sample job:', jobs[0]);

        // Update summary counts
        await updateHolidaySummary();

        tbody.innerHTML = '';
        if (jobs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-sub);">
                <div style="font-size:48px; margin-bottom:10px;">📭</div>
                <p>ไม่พบรายการ${statusFilter === 'pending' ? 'ที่รออนุมัติ' : statusFilter === 'approved' ? 'ที่อนุมัติแล้ว' : 'ที่ปฏิเสธ'}</p>
            </td></tr>`;
            return;
        }

        // Filter by search term
        let filteredJobs = jobs;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredJobs = jobs.filter(job => 
                (job.reference && job.reference.toLowerCase().includes(term)) ||
                (job.drivers && job.drivers.toLowerCase().includes(term)) ||
                (job.vehicle_desc && job.vehicle_desc.toLowerCase().includes(term))
            );
        }

        if (filteredJobs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">ไม่พบผลลัพธ์สำหรับ "${searchTerm}"</td></tr>`;
            return;
        }

        // Group by reference (แสดงแค่ 1 reference แต่นับจำนวน stops)
        const groupedJobs = {};
        filteredJobs.forEach(job => {
            if (!groupedJobs[job.reference]) {
                groupedJobs[job.reference] = {
                    ...job,
                    stop_count: 1,
                    all_seqs: [job.seq]
                };
            } else {
                groupedJobs[job.reference].stop_count++;
                groupedJobs[job.reference].all_seqs.push(job.seq);
            }
        });
        
        console.log('📊 Grouped jobs:', Object.keys(groupedJobs).length, 'unique references');
        console.log('📊 Grouped data:', groupedJobs);

        // Convert to array and display
        Object.values(groupedJobs).forEach(job => {
            const row = document.createElement('tr');
            
            // Status badge
            let statusBadge = '';
            let actionButtons = '';
            
            if (job.holiday_work_approved === true) {
                statusBadge = '<span style="background:#4caf50; color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">✅ อนุมัติแล้ว</span>';
                actionButtons = '<button disabled style="opacity:0.5; cursor:not-allowed;">อนุมัติแล้ว</button>';
            } else if (job.holiday_work_approved === false && job.holiday_work_approved_at) {
                statusBadge = '<span style="background:#f44336; color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">❌ ปฏิเสธ</span>';
                actionButtons = '<button disabled style="opacity:0.5; cursor:not-allowed;">ปฏิเสธแล้ว</button>';
            } else {
                statusBadge = '<span style="background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem;">⏳ รอดำเนินการ</span>';
                actionButtons = `
                    <button class="approve-holiday-btn" data-reference="${job.reference}" data-stop-count="${job.stop_count}" style="background:#4caf50; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px;">
                        ✅ อนุมัติ
                    </button>
                    <button class="reject-holiday-btn" data-reference="${job.reference}" data-stop-count="${job.stop_count}" style="background:#f44336; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                        ❌ ปฏิเสธ
                    </button>
                `;
            }

            const closedDate = job.job_closed_at ? new Date(job.job_closed_at).toLocaleString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '-';

            const approvedBy = job.holiday_work_approved_by ? 
                `<div>${job.holiday_work_approved_by}</div><small style="color:var(--text-sub);">${job.holiday_work_approved_at ? new Date(job.holiday_work_approved_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : ''}</small>` : 
                '-';

            row.innerHTML = `
                <td><strong>${job.reference || '-'}</strong></td>
                <td style="font-size:0.9rem;">${closedDate}</td>
                <td>${job.drivers || '-'}</td>
                <td style="font-size:0.9rem;">${job.vehicle_desc || '-'}</td>
                <td style="text-align:center;"><span style="background:#2196f3;color:white;padding:2px 8px;border-radius:10px;font-size:0.85rem;">${job.stop_count} จุด</span></td>
                <td style="max-width:200px; font-size:0.85rem; line-height:1.4;">${job.holiday_work_notes || '<span style="color:var(--text-sub);">-</span>'}</td>
                <td>${statusBadge}</td>
                <td style="font-size:0.85rem;">${approvedBy}</td>
                <td>${actionButtons}</td>
            `;
            
            tbody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.approve-holiday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reference = e.target.dataset.reference;
                const stopCount = e.target.dataset.stopCount;
                const job = groupedJobs[reference];
                openHolidayApprovalModal(job, 'approve');
            });
        });

        document.querySelectorAll('.reject-holiday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reference = e.target.dataset.reference;
                const stopCount = e.target.dataset.stopCount;
                const job = groupedJobs[reference];
                openHolidayApprovalModal(job, 'reject');
            });
        });

    } catch (error) {
        console.error('Error loading holiday work jobs:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #f44336;">
            ❌ เกิดข้อผิดพลาด: ${error.message}
        </td></tr>`;
    }
}

async function updateHolidaySummary() {
    try {
        // Query all holiday work jobs (not just count)
        // Pending
        const { data: pendingJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('is_holiday_work', true)
            .or('holiday_work_approved.is.null,holiday_work_approved.eq.false')
            .is('holiday_work_approved_at', null);

        // Approved
        const { data: approvedJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('is_holiday_work', true)
            .eq('holiday_work_approved', true);

        // Rejected
        const { data: rejectedJobs } = await supabase
            .from('jobdata')
            .select('reference')
            .eq('is_holiday_work', true)
            .eq('holiday_work_approved', false)
            .not('holiday_work_approved_at', 'is', null);

        // Count unique references
        const pendingCount = new Set((pendingJobs || []).map(j => j.reference)).size;
        const approvedCount = new Set((approvedJobs || []).map(j => j.reference)).size;
        const rejectedCount = new Set((rejectedJobs || []).map(j => j.reference)).size;
        
        console.log('📊 Summary counts (unique references):', { pendingCount, approvedCount, rejectedCount });

        pendingHolidayCount.textContent = pendingCount;
        approvedHolidayCount.textContent = approvedCount;
        rejectedHolidayCount.textContent = rejectedCount;

        // Update dashboard KPI
        kpiPendingApprovals.textContent = pendingCount;
        
        // Update navigation badge
        updateHolidayNavBadge(pendingCount);
    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

function updateHolidayNavBadge(count) {
    const navLink = document.querySelector('[data-target="holiday-work"]');
    if (!navLink) return;
    
    let badge = navLink.querySelector('.badge');
    
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge';
            badge.style.cssText = 'background: #ff9800; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem; margin-left: 5px; font-weight: bold;';
            navLink.appendChild(badge);
        }
        badge.textContent = count;
        badge.classList.remove('hidden');
        
        // Animate badge
        badge.style.animation = 'none';
        setTimeout(() => {
            badge.style.animation = 'pulse 0.5s ease-in-out';
        }, 10);
    } else {
        if (badge) {
            badge.classList.add('hidden');
        }
    }
}

// Subscribe to realtime updates for holiday work
function subscribeToHolidayWorkUpdates() {
    // Unsubscribe existing channel if any
    if (holidayWorkRealtimeChannel) {
        supabase.removeChannel(holidayWorkRealtimeChannel);
    }

    console.log('🔔 Subscribing to holiday work realtime updates...');

    holidayWorkRealtimeChannel = supabase
        .channel('holiday-work-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'jobdata',
                filter: 'is_holiday_work=eq.true'
            },
            (payload) => {
                console.log('🔔 Holiday work change detected:', payload);
                
                // Show notification
                const eventType = payload.eventType;
                let message = '';
                
                if (eventType === 'INSERT') {
                    message = `🆕 มีคำขอทำงานวันหยุดใหม่: ${payload.new.reference}`;
                    showNotification(message, 'info');
                } else if (eventType === 'UPDATE') {
                    if (payload.new.holiday_work_approved !== payload.old.holiday_work_approved) {
                        const status = payload.new.holiday_work_approved ? 'อนุมัติ' : 'ปฏิเสธ';
                        message = `✅ อัพเดท: ${payload.new.reference} - ${status}`;
                    }
                }
                
                // Refresh data if on holiday work page
                const activeSection = document.querySelector('.content-section.active');
                if (activeSection && activeSection.id === 'holiday-work') {
                    setTimeout(() => {
                        loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value);
                    }, 500);
                } else {
                    // Just update the badge
                    updateHolidaySummary();
                }
            }
        )
        .subscribe((status) => {
            console.log('🔔 Realtime subscription status:', status);
            
            if (status === 'SUBSCRIBED') {
                console.log('✅ Successfully subscribed to holiday work updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Failed to subscribe to realtime updates');
                // Retry after 5 seconds
                setTimeout(() => {
                    console.log('🔄 Retrying subscription...');
                    subscribeToHolidayWorkUpdates();
                }, 5000);
            }
        });
}

// Unsubscribe from realtime updates
function unsubscribeFromHolidayWorkUpdates() {
    if (holidayWorkRealtimeChannel) {
        console.log('👋 Unsubscribing from holiday work updates...');
        supabase.removeChannel(holidayWorkRealtimeChannel);
        holidayWorkRealtimeChannel = null;
    }
}

function openHolidayApprovalModal(job, action) {
    approvalReferenceInput.value = job.reference;
    
    // Show stop count if available
    const stopInfo = job.stop_count > 1 ? ` (${job.stop_count} จุด)` : '';
    approvalReference.textContent = `${job.reference}${stopInfo}`;
    
    approvalDriver.textContent = job.drivers || '-';
    approvalVehicle.textContent = job.vehicle_desc || '-';
    approvalDate.textContent = job.job_closed_at ? 
        new Date(job.job_closed_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
    approvalNotes.textContent = job.holiday_work_notes || '(ไม่มีหมายเหตุ)';
    approvalComment.value = '';
    approvalAction.value = action;

    if (action === 'reject') {
        approvalModalTitle.textContent = '❌ ปฏิเสธการทำงานวันหยุด';
        approvalCommentRequired.style.display = 'inline';
        approveBtnModal.style.display = 'none';
        rejectBtnModal.style.display = 'block';
    } else {
        approvalModalTitle.textContent = '✅ อนุมัติการทำงานวันหยุด';
        approvalCommentRequired.style.display = 'none';
        approveBtnModal.style.display = 'block';
        rejectBtnModal.style.display = 'block';
    }

    holidayApprovalModal.classList.remove('hidden');
}

function closeHolidayApprovalModal() {
    holidayApprovalModal.classList.add('hidden');
    holidayApprovalForm.reset();
}

async function handleHolidayApprovalSubmit(event) {
    event.preventDefault();
    
    const reference = approvalReferenceInput.value;
    const action = approvalAction.value;
    const comment = approvalComment.value.trim();

    // Validate
    if (action === 'reject' && !comment) {
        showNotification('กรุณาระบุเหตุผลในการปฏิเสธ', 'error');
        return;
    }

    try {
        // Get current admin user info
        const lineProfile = await liff.getProfile();
        const adminId = lineProfile.userId;
        const adminName = lineProfile.displayName;
        
        const updateData = {
            holiday_work_approved: action === 'approve',
            holiday_work_approved_by: adminId,
            holiday_work_approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add comment to notes if provided
        if (comment) {
            updateData.holiday_work_notes = (approvalNotes.textContent || '') + `\n\n[${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'} โดย ${adminName}]\n${comment}`;
        }

        // Update ALL rows with the same reference (not just one)
        const { error, count } = await supabase
            .from('jobdata')
            .update(updateData)
            .eq('reference', reference)
            .eq('is_holiday_work', true);

        if (error) throw error;

        const successMsg = action === 'approve' ? 
            `✅ อนุมัติการทำงานวันหยุดสำเร็จ: ${reference} (${count || 'ทุก'} จุด)` : 
            `❌ ปฏิเสธการทำงานวันหยุดแล้ว: ${reference} (${count || 'ทุก'} จุด)`;
        
        showNotification(successMsg, 'info');
        closeHolidayApprovalModal();
        loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value);
    } catch (error) {
        console.error('Error updating holiday approval:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}


// --- Vehicle Breakdown Functions ---

// Subscribe to job activity updates (checkin/checkout)
function subscribeToJobActivityUpdates() {
    // Unsubscribe existing channel if any
    if (jobActivityRealtimeChannel) {
        supabase.removeChannel(jobActivityRealtimeChannel);
    }

    console.log('🔔 Subscribing to job activity updates (checkin/checkout)...');

    jobActivityRealtimeChannel = supabase
        .channel('job-activity-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'jobdata'
            },
            (payload) => {
                console.log('🔔 Job activity detected:', payload);
                console.log('📊 Event type:', payload.eventType);
                console.log('📊 Old data:', payload.old);
                console.log('📊 New data:', payload.new);
                
                const oldData = payload.old;
                const newData = payload.new;
                
                // Check for checkin
                if (!oldData.checkin_time && newData.checkin_time) {
                    const message = `📍 Check-in: ${newData.reference} - ${newData.ship_to_name || 'จุดส่ง'}`;
                    console.log('✅ CHECKIN DETECTED:', message);
                    showNotification(message, 'info', 5000);
                    // Add to notification bell
                    addNotificationToBell('checkin', 'Check-in สำเร็จ', message, { reference: newData.reference });
                    console.log('✅ Driver checked in at:', newData.ship_to_name);
                } else {
                    console.log('❌ Not checkin:', { 
                        oldCheckin: oldData.checkin_time, 
                        newCheckin: newData.checkin_time 
                    });
                }
                
                // Check for checkout
                if (!oldData.checkout_time && newData.checkout_time) {
                    const message = `✅ Check-out: ${newData.reference} - ${newData.ship_to_name || 'จุดส่ง'}`;
                    console.log('✅ CHECKOUT DETECTED:', message);
                    showNotification(message, 'success', 5000);
                    // Add to notification bell
                    addNotificationToBell('checkout', 'Check-out สำเร็จ', message, { reference: newData.reference });
                    console.log('✅ Driver checked out from:', newData.ship_to_name);
                } else {
                    console.log('❌ Not checkout:', { 
                        oldCheckout: oldData.checkout_time, 
                        newCheckout: newData.checkout_time 
                    });
                }
                
                // Check for trip completion
                if (!oldData.trip_ended && newData.trip_ended) {
                    const message = `🎉 Trip จบแล้ว: ${newData.reference}`;
                    console.log('✅ TRIP END DETECTED:', message);
                    showNotification(message, 'success', 7000);
                    // Add to notification bell
                    addNotificationToBell('trip-end', 'Trip เสร็จสมบูรณ์', message, { reference: newData.reference });
                    console.log('🎉 Trip ended:', newData.reference);
                } else {
                    console.log('❌ Not trip end:', { 
                        oldEnded: oldData.trip_ended, 
                        newEnded: newData.trip_ended 
                    });
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to job activity updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Failed to subscribe to job activity updates');
                // Retry after 5 seconds
                setTimeout(() => {
                    console.log('🔄 Retrying job activity subscription...');
                    subscribeToJobActivityUpdates();
                }, 5000);
            }
        });
}

// Unsubscribe from job activity updates
function unsubscribeFromJobActivityUpdates() {
    if (jobActivityRealtimeChannel) {
        console.log('👋 Unsubscribing from job activity updates...');
        supabase.removeChannel(jobActivityRealtimeChannel);
        jobActivityRealtimeChannel = null;
    }
}

// --- Vehicle Breakdown Functions ---
let activeJobsCache = [];

async function loadVehicleBreakdowns(searchTerm = '') {
    breakdownTableBody.innerHTML = '<tr><td colspan="6">Loading breakdown records...</td></tr>';
    try {
        let query = supabase
            .from('driver_jobs')
            .select('*')
            .eq('is_vehicle_breakdown', true)
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        const { data: breakdowns, error } = await query;

        if (error) throw error;

        breakdownTableBody.innerHTML = '';
        if (breakdowns.length === 0) {
            breakdownTableBody.innerHTML = '<tr><td colspan="6">No breakdown records found.</td></tr>';
            return;
        }

        // For each breakdown, fetch the replacement job info
        for (const bd of breakdowns) {
            const row = document.createElement('tr');
            let newRef = '-';
            if (bd.replacement_job_id) {
                const { data: replacement } = await supabase
                    .from('driver_jobs')
                    .select('reference')
                    .eq('id', bd.replacement_job_id)
                    .single();
                if (replacement) newRef = replacement.reference;
            }

            row.innerHTML = `
                <td>${bd.reference || 'N/A'}</td>
                <td>${newRef}</td>
                <td>${bd.drivers || 'N/A'}</td>
                <td>${bd.breakdown_reason || 'N/A'}</td>
                <td>${bd.created_at ? new Date(bd.created_at).toLocaleDateString() : 'N/A'}</td>
                <td><span class="status-badge badge-breakdown">Breakdown</span></td>
            `;
            breakdownTableBody.appendChild(row);
        }

    } catch (error) {
        console.error('Error loading breakdowns:', error);
        breakdownTableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

async function openBreakdownModal() {
    breakdownForm.reset();
    breakdownJobDetails.classList.add('hidden');
    breakdownPreview.classList.add('hidden');

    // Load active jobs for selection
    try {
        const { data: jobs, error } = await supabase
            .from('driver_jobs')
            .select('*')
            .eq('trip_ended', false)
            .eq('is_vehicle_breakdown', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        activeJobsCache = jobs;
        breakdownJobSelect.innerHTML = '<option value="">-- Select Job --</option>';
        jobs.forEach(job => {
            const option = document.createElement('option');
            option.value = job.id;
            option.textContent = `${job.reference} - ${job.drivers || 'Unknown Driver'}`;
            breakdownJobSelect.appendChild(option);
        });

        breakdownModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading active jobs:', error);
        showNotification(`Failed to load jobs: ${error.message}`, 'error');
    }
}

function closeBreakdownModal() {
    breakdownModal.classList.add('hidden');
    breakdownForm.reset();
}

function handleBreakdownJobSelect() {
    const jobId = breakdownJobSelect.value;
    if (!jobId) {
        breakdownJobDetails.classList.add('hidden');
        breakdownPreview.classList.add('hidden');
        return;
    }

    const job = activeJobsCache.find(j => j.id == jobId);
    if (job) {
        breakdownOriginalRef.textContent = job.reference || 'N/A';
        breakdownDriver.textContent = job.drivers || 'N/A';
        breakdownVehicle.textContent = job.vehicle_plate || 'N/A';
        breakdownJobDetails.classList.remove('hidden');

        // Generate new reference preview
        const newRef = generateBreakdownReference(job.reference);
        breakdownNewRefPreview.textContent = newRef;
        breakdownPreview.classList.remove('hidden');
    }
}

function generateBreakdownReference(originalRef) {
    // Add -B suffix for breakdown replacement
    if (!originalRef) return 'NEW-B';
    if (originalRef.includes('-B')) {
        // Already has breakdown suffix, increment
        const match = originalRef.match(/-B(\d*)$/);
        if (match) {
            const num = match[1] ? parseInt(match[1]) + 1 : 2;
            return originalRef.replace(/-B\d*$/, `-B${num}`);
        }
    }
    return `${originalRef}-B`;
}

async function handleBreakdownSubmit(event) {
    event.preventDefault();
    const jobId = breakdownJobSelect.value;
    const reason = breakdownReason.value;
    const newVehicle = breakdownNewVehicle.value;

    if (!jobId) {
        showNotification('Please select a job', 'error');
        return;
    }

    const originalJob = activeJobsCache.find(j => j.id == jobId);
    if (!originalJob) {
        showNotification('Job not found', 'error');
        return;
    }

    try {
        // Create new replacement job
        const newRef = generateBreakdownReference(originalJob.reference);
        const newJobData = {
            reference: newRef,
            shipment_no: originalJob.shipment_no,
            drivers: originalJob.drivers,
            vehicle_plate: newVehicle || originalJob.vehicle_plate,
            status: 'active',
            trip_ended: false,
            original_job_id: originalJob.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: newJob, error: createError } = await supabase
            .from('driver_jobs')
            .insert([newJobData])
            .select()
            .single();

        if (createError) throw createError;

        // Update original job as breakdown
        const { error: updateError } = await supabase
            .from('driver_jobs')
            .update({
                is_vehicle_breakdown: true,
                breakdown_reason: reason,
                replacement_job_id: newJob.id,
                status: 'cancelled',
                trip_ended: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (updateError) throw updateError;

        showNotification(`Breakdown processed! New job created: ${newRef}`, 'info');
        closeBreakdownModal();
        loadVehicleBreakdowns();
    } catch (error) {
        console.error('Error processing breakdown:', error);
        showNotification(`Failed to process breakdown: ${error.message}`, 'error');
    }
}


// --- Fuel Siphoning Functions ---
async function loadFuelSiphoning(searchTerm = '', dateFilter = '') {
    siphoningTableBody.innerHTML = '<tr><td colspan="8">Loading records...</td></tr>';
    try {
        let query = supabase
            .from('fuel_siphoning')
            .select('*')
            .order('siphon_date', { ascending: false });

        if (searchTerm) {
            query = query.or(`station_name.ilike.%${searchTerm}%,driver_name.ilike.%${searchTerm}%,vehicle_plate.ilike.%${searchTerm}%`);
        }

        if (dateFilter) {
            query = query.eq('siphon_date', dateFilter);
        }

        const { data: records, error } = await query;

        if (error) throw error;

        siphoningTableBody.innerHTML = '';
        if (!records || records.length === 0) {
            siphoningTableBody.innerHTML = '<tr><td colspan="8">No siphoning records found.</td></tr>';
            return;
        }

        records.forEach(record => {
            const row = document.createElement('tr');
            const statusClass = `badge-siphoning-${record.status}`;

            row.innerHTML = `
                <td>${record.siphon_date || 'N/A'}</td>
                <td>${record.station_name || 'N/A'}</td>
                <td>${record.driver_name || 'N/A'}</td>
                <td>${record.vehicle_plate || 'N/A'}</td>
                <td>${record.liters ? record.liters.toFixed(2) : '0.00'}</td>
                <td>${record.evidence_image_url ? `<a href="${record.evidence_image_url}" target="_blank">View</a>` : 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${record.status}</span></td>
                <td>
                    <button class="edit-siphoning-btn" data-id="${record.id}">Edit</button>
                </td>
            `;
            siphoningTableBody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.edit-siphoning-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const record = records.find(r => r.id === id);
                await openSiphoningModal(record);
            });
        });

    } catch (error) {
        console.error('Error loading fuel siphoning:', error);
        siphoningTableBody.innerHTML = `<tr><td colspan="8">Error: ${error.message}</td></tr>`;
    }
}

async function openSiphoningModal(record = null) {
    siphoningForm.reset();
    siphoningEvidencePreview.classList.add('hidden');

    // Load stations from station and customer tables for dropdown
    try {
        // Get stations from station table
        const { data: stations } = await supabase
            .from('station')
            .select('station_name, stationKey, "plant code"')
            .order('station_name');

        // Get customers from customer table
        const { data: customers } = await supabase
            .from('customer')
            .select('name, stationKey')
            .order('name');

        siphoningStation.innerHTML = '<option value="">-- Select Station --</option>';
        
        // Add optgroup for stations
        if (stations && stations.length > 0) {
            const stationGroup = document.createElement('optgroup');
            stationGroup.label = 'Stations';
            stations.forEach(station => {
                if (station.station_name) {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({ 
                        name: station.station_name, 
                        code: station.stationKey,
                        plantCode: station['plant code'],
                        type: 'station'
                    });
                    option.textContent = station.station_name;
                    stationGroup.appendChild(option);
                }
            });
            siphoningStation.appendChild(stationGroup);
        }

        // Add optgroup for customers
        if (customers && customers.length > 0) {
            const customerGroup = document.createElement('optgroup');
            customerGroup.label = 'Customers';
            customers.forEach(customer => {
                if (customer.name) {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({ 
                        name: customer.name, 
                        code: customer.stationKey,
                        type: 'customer'
                    });
                    option.textContent = customer.name;
                    customerGroup.appendChild(option);
                }
            });
            siphoningStation.appendChild(customerGroup);
        }
    } catch (e) {
        console.warn('Could not load stations:', e);
    }

    // Load drivers
    try {
        const { data: drivers } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name');

        siphoningDriver.innerHTML = '<option value="">-- Select Driver --</option>';
        drivers?.forEach(driver => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ id: driver.user_id, name: driver.display_name });
            option.textContent = driver.display_name || driver.user_id;
            siphoningDriver.appendChild(option);
        });
    } catch (e) {
        console.warn('Could not load drivers:', e);
    }

    if (record) {
        siphoningModalTitle.textContent = 'Edit Fuel Siphoning Record';
        siphoningIdInput.value = record.id;
        siphoningReferenceInput.value = record.reference || '';
        siphoningVehicleInput.value = record.vehicle_plate || '';
        siphoningDateInput.value = record.siphon_date || '';
        siphoningTimeInput.value = record.siphon_time || '';
        siphoningLitersInput.value = record.liters || '';
        siphoningNotesInput.value = record.notes || '';

        if (record.evidence_image_url) {
            siphoningEvidenceImg.src = record.evidence_image_url;
            siphoningEvidencePreview.classList.remove('hidden');
        }
    } else {
        siphoningModalTitle.textContent = 'Record Fuel Siphoning';
        siphoningIdInput.value = '';
        siphoningDateInput.value = new Date().toISOString().split('T')[0];

        // Auto-generate reference: SIPHON-YYMMDD-XXX
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2); // YYMMDD
        const { count } = await supabase
            .from('jobdata')
            .select('*', { count: 'exact', head: true })
            .ilike('reference', `SIPHON-${today}%`);

        const seqNum = String((count || 0) + 1).padStart(3, '0');
        siphoningReferenceInput.value = `SIPHON-${today}-${seqNum}`;
    }

    siphoningModal.classList.remove('hidden');
}

function closeSiphoningModal() {
    siphoningModal.classList.add('hidden');
    siphoningForm.reset();
    siphoningEvidencePreview.classList.add('hidden');
}

async function uploadSiphoningEvidence(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `evidence/${fileName}`;

    const { data, error } = await supabase.storage
        .from('fuel-siphoning-evidence')
        .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('fuel-siphoning-evidence')
        .getPublicUrl(filePath);

    return publicUrl;
}

async function handleSiphoningSubmit(event) {
    event.preventDefault();
    const id = siphoningIdInput.value;

    try {
        // Parse station and driver selections
        let stationData = { name: '', code: '' };
        let driverData = { id: '', name: '' };

        try {
            if (siphoningStation.value) stationData = JSON.parse(siphoningStation.value);
            if (siphoningDriver.value) driverData = JSON.parse(siphoningDriver.value);
        } catch (e) {
            console.warn('Error parsing selection:', e);
        }

        let evidenceUrl = null;
        const evidenceFile = siphoningEvidenceInput.files[0];
        if (evidenceFile) {
            evidenceUrl = await uploadSiphoningEvidence(evidenceFile);
        }

        const recordData = {
            station_name: stationData.name,
            station_code: stationData.code,
            driver_user_id: driverData.id,
            driver_name: driverData.name,
            vehicle_plate: siphoningVehicleInput.value,
            siphon_date: siphoningDateInput.value,
            siphon_time: siphoningTimeInput.value || null,
            liters: parseFloat(siphoningLitersInput.value),
            notes: siphoningNotesInput.value,
            updated_at: new Date().toISOString()
        };

        if (evidenceUrl) {
            recordData.evidence_image_url = evidenceUrl;
        }

        // Get reference from form
        const reference = siphoningReferenceInput.value;
        recordData.reference = reference;

        let error;
        if (id) {
            ({ error } = await supabase.from('fuel_siphoning').update(recordData).eq('id', id));
        } else {
            recordData.reported_by = adminUsername.textContent || 'Admin';
            recordData.status = 'reported';
            recordData.created_at = new Date().toISOString();
            ({ error } = await supabase.from('fuel_siphoning').insert([recordData]));

            // Also create a record in jobdata table
            if (!error) {
                const siphonDate = siphoningDateInput.value;
                const siphonTime = siphoningTimeInput.value || '00:00';

                const jobdataRecord = {
                    reference: reference,
                    seq: 1,
                    ship_to_code: stationData.code,
                    ship_to_name: stationData.name,
                    vehicle_desc: siphoningVehicleInput.value,
                    drivers: driverData.name,
                    materials: 'FUEL_SIPHONING',
                    total_qty: parseFloat(siphoningLitersInput.value),
                    status: 'COMPLETED',
                    checkin_time: `${siphonDate}T${siphonTime}:00`,
                    checkout_time: `${siphonDate}T${siphonTime}:00`,
                    job_closed: true,
                    updated_by: adminUsername.textContent || 'Admin',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { error: jobdataError } = await supabase.from('jobdata').insert([jobdataRecord]);
                if (jobdataError) {
                    console.warn('Warning: Could not create jobdata record:', jobdataError);
                } else {
                    console.log('✅ Created jobdata record:', reference);
                }
            }
        }

        if (error) throw error;

        showNotification(`Fuel siphoning record ${id ? 'updated' : 'created'} successfully!`, 'info');
        closeSiphoningModal();
        loadFuelSiphoning(siphoningSearch.value, siphoningDateFilter.value);
    } catch (error) {
        console.error('Error saving fuel siphoning:', error);
        showNotification(`Failed to save: ${error.message}`, 'error');
    }
}


// --- B100 Jobs Functions ---
async function loadB100Jobs(searchTerm = '', statusFilter = '') {
    b100JobsTableBody.innerHTML = '<tr><td colspan="7">Loading B100 jobs...</td></tr>';
    try {
        let query = supabase
            .from('driver_jobs')
            .select('*')
            .eq('is_b100', true)
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        if (statusFilter) {
            query = query.eq('b100_status', statusFilter);
        }

        const { data: jobs, error } = await query;

        if (error) throw error;

        b100JobsTableBody.innerHTML = '';
        if (!jobs || jobs.length === 0) {
            b100JobsTableBody.innerHTML = '<tr><td colspan="7">No B100 jobs found.</td></tr>';
            return;
        }

        jobs.forEach(job => {
            const row = document.createElement('tr');
            const statusClass = `badge-b100-${job.b100_status}`;

            row.innerHTML = `
                <td>${job.reference || 'N/A'}</td>
                <td>${job.drivers || 'N/A'}</td>
                <td>${job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>${job.vehicle_plate || 'N/A'}</td>
                <td>${job.b100_amount ? job.b100_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}</td>
                <td><span class="status-badge ${statusClass}">${job.b100_status || 'pending'}</span></td>
                <td>
                    ${job.b100_status !== 'paid' ? `<button class="mark-paid-btn" data-job-id="${job.id}">Mark Paid</button>` : ''}
                    ${job.b100_status === 'pending' ? `<button class="mark-outstanding-btn" data-job-id="${job.id}">Outstanding</button>` : ''}
                </td>
            `;
            b100JobsTableBody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.mark-paid-btn').forEach(button => {
            button.addEventListener('click', (e) => updateB100Status(e.target.dataset.jobId, 'paid'));
        });
        document.querySelectorAll('.mark-outstanding-btn').forEach(button => {
            button.addEventListener('click', (e) => updateB100Status(e.target.dataset.jobId, 'outstanding'));
        });

    } catch (error) {
        console.error('Error loading B100 jobs:', error);
        b100JobsTableBody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
    }
}

async function openB100Modal() {
    b100Form.reset();
    b100JobIdInput.value = '';

    // Generate default reference
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const { count } = await supabase.from('driver_jobs').select('*', { count: 'exact', head: true }).eq('is_b100', true);
    b100ReferenceInput.value = `B100-${today}-${String((count || 0) + 1).padStart(3, '0')}`;

    // Load drivers
    try {
        const { data: drivers } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name');

        b100DriverSelect.innerHTML = '<option value="">-- Select Driver --</option>';
        drivers?.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.display_name || driver.user_id;
            option.textContent = driver.display_name || driver.user_id;
            b100DriverSelect.appendChild(option);
        });
    } catch (e) {
        console.warn('Could not load drivers:', e);
    }

    b100Modal.classList.remove('hidden');
}

function closeB100Modal() {
    b100Modal.classList.add('hidden');
    b100Form.reset();
}

async function handleB100Submit(event) {
    event.preventDefault();

    try {
        const reference = b100ReferenceInput.value;
        const driverName = b100DriverSelect.options[b100DriverSelect.selectedIndex]?.text || b100DriverSelect.value;
        const vehiclePlate = b100VehicleInput.value;
        const amount = parseFloat(b100AmountInput.value);
        const notes = b100NotesInput.value;

        // Create record in driver_jobs for B100 tracking
        const jobData = {
            reference: reference,
            drivers: driverName,
            vehicle_plate: vehiclePlate,
            is_b100: true,
            b100_amount: amount,
            b100_status: 'pending',
            status: 'active',
            trip_ended: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('driver_jobs').insert([jobData]);

        if (error) throw error;

        // Also create a record in jobdata table
        const jobdataRecord = {
            reference: reference,
            seq: 1,
            ship_to_code: 'B100',
            ship_to_name: 'B100 Fuel Delivery',
            vehicle_desc: vehiclePlate,
            drivers: driverName,
            materials: 'B100',
            total_qty: amount, // Use amount as quantity (in Baht, could also represent liters)
            status: 'PENDING',
            job_closed: false,
            trip_ended: false,
            updated_by: adminUsername.textContent || 'Admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error: jobdataError } = await supabase.from('jobdata').insert([jobdataRecord]);
        if (jobdataError) {
            console.warn('Warning: Could not create jobdata record:', jobdataError);
        } else {
            console.log('✅ Created jobdata record for B100:', reference);
        }

        showNotification('B100 job created successfully!', 'info');
        closeB100Modal();
        loadB100Jobs(b100Search.value, b100StatusFilter.value);
    } catch (error) {
        console.error('Error creating B100 job:', error);
        showNotification(`Failed to create: ${error.message}`, 'error');
    }
}

async function updateB100Status(jobId, newStatus) {
    try {
        // First get the job reference
        const { data: job, error: fetchError } = await supabase
            .from('driver_jobs')
            .select('reference')
            .eq('id', jobId)
            .single();

        if (fetchError) throw fetchError;

        // Update driver_jobs table
        const { error } = await supabase
            .from('driver_jobs')
            .update({
                b100_status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (error) throw error;

        // Also update corresponding jobdata record
        if (job?.reference) {
            const jobdataStatus = newStatus === 'paid' ? 'COMPLETED' : 'PENDING';
            const jobClosed = newStatus === 'paid';

            await supabase
                .from('jobdata')
                .update({
                    status: jobdataStatus,
                    job_closed: jobClosed,
                    job_closed_at: jobClosed ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('reference', job.reference);
        }

        showNotification(`B100 status updated to ${newStatus}!`, 'info');
        loadB100Jobs(b100Search.value, b100StatusFilter.value);
    } catch (error) {
        console.error('Error updating B100 status:', error);
        showNotification(`Failed to update: ${error.message}`, 'error');
    }
}


// --- B100 Outstanding Functions ---
async function loadB100Outstanding() {
    b100OutstandingTableBody.innerHTML = '<tr><td colspan="5">Loading outstanding summary...</td></tr>';

    try {
        // Fetch outstanding jobs
        const { data: outstandingJobs, error } = await supabase
            .from('driver_jobs')
            .select('*')
            .eq('is_b100', true)
            .eq('b100_status', 'outstanding')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate summaries
        const totalJobs = outstandingJobs?.length || 0;
        const totalAmount = outstandingJobs?.reduce((sum, job) => sum + (parseFloat(job.b100_amount) || 0), 0) || 0;

        // Group by driver
        const byDriver = {};
        outstandingJobs?.forEach(job => {
            const driver = job.drivers || 'Unknown';
            if (!byDriver[driver]) {
                byDriver[driver] = { jobs: [], total: 0, lastDate: null };
            }
            byDriver[driver].jobs.push(job);
            byDriver[driver].total += parseFloat(job.b100_amount) || 0;
            const jobDate = new Date(job.created_at);
            if (!byDriver[driver].lastDate || jobDate > byDriver[driver].lastDate) {
                byDriver[driver].lastDate = jobDate;
            }
        });

        const driverCount = Object.keys(byDriver).length;

        // Update summary cards
        b100TotalJobs.textContent = totalJobs;
        b100TotalAmount.textContent = `฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
        b100DriverCount.textContent = driverCount;

        // Populate table
        b100OutstandingTableBody.innerHTML = '';
        if (driverCount === 0) {
            b100OutstandingTableBody.innerHTML = '<tr><td colspan="5">No outstanding B100 records.</td></tr>';
            return;
        }

        Object.entries(byDriver).forEach(([driver, data]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${driver}</td>
                <td>${data.jobs.length}</td>
                <td>${data.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td>${data.lastDate ? data.lastDate.toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="view-driver-outstanding-btn" data-driver="${driver}">View Details</button>
                </td>
            `;
            b100OutstandingTableBody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.view-driver-outstanding-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const driver = e.target.dataset.driver;
                openB100DetailModal(driver, byDriver[driver]);
            });
        });

    } catch (error) {
        console.error('Error loading B100 outstanding:', error);
        b100OutstandingTableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

function openB100DetailModal(driver, data) {
    b100DetailDriverName.textContent = driver;
    b100DetailTotal.textContent = data.total.toLocaleString('th-TH', { minimumFractionDigits: 2 });

    b100DetailTableBody.innerHTML = '';
    data.jobs.forEach(job => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${job.reference || 'N/A'}</td>
            <td>${job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>${job.b100_amount ? job.b100_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}</td>
            <td>
                <button class="mark-paid-detail-btn" data-job-id="${job.id}">Mark Paid</button>
            </td>
        `;
        b100DetailTableBody.appendChild(row);
    });

    // Add event listeners for detail modal
    document.querySelectorAll('.mark-paid-detail-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            await updateB100Status(e.target.dataset.jobId, 'paid');
            closeB100DetailModal();
            loadB100Outstanding();
        });
    });

    b100DetailModal.classList.remove('hidden');
}

function closeB100DetailModal() {
    b100DetailModal.classList.add('hidden');
}


// Function to load data for a given section
function loadSectionData(targetId) {
    switch (targetId) {
        case 'dashboard':
            loadDashboardAnalytics();
            initMap();
            break;
        case 'users':
            loadUsers();
            break;
        case 'jobs':
            loadJobs();
            break;
        case 'driver-reports':
            loadDriverReports();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'alerts':
            loadAlerts();
            break;
        case 'playback':
            loadDriverReports(); // Reusing the function to populate driver select
            break;
        case 'scheduled-reports':
            loadReportSchedules();
            break;
        case 'logs':
            loadLogs();
            break;
        case 'holiday-work':
            loadHolidayWorkJobs();
            // Subscribe to realtime updates when viewing holiday work section
            subscribeToHolidayWorkUpdates();
            break;
        case 'vehicle-breakdown':
            loadVehicleBreakdowns();
            break;
        case 'fuel-siphoning':
            loadFuelSiphoning();
            break;
        case 'b100-jobs':
            loadB100Jobs();
            break;
        case 'b100-outstanding':
            loadB100Outstanding();
            break;
        // NEW: Debug Import Tool
        case 'debug-import-tool':
            loadDebugImportTool();
            break;
        default:
            console.warn('Unknown section:', targetId);
            break;
    }
}

// NEW: Function to load debug import tool
async function loadDebugImportTool() {
    const debugImportSection = document.getElementById('debug-import-tool');
    try {
        const response = await fetch('debug-import-content.html');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const content = await response.text();
        debugImportSection.innerHTML = content;
        // Initialize the script functions after content is loaded
        if (window.initDebugImport) {
            window.initDebugImport();
        } else {
            console.error('initDebugImport function not found in debug-import.js');
        }
    } catch (error) {
        console.error('Error loading debug import tool:', error);
        debugImportSection.innerHTML = `<p class="error">Failed to load Debug Import Tool: ${error.message}</p>`;
    }
}

// Function to navigate between sections
function navigateTo(targetId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    // Deactivate all nav links
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Show target section and activate nav link
    const targetSection = document.getElementById(targetId);
    const targetLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);

    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    if (targetLink) {
        targetLink.classList.add('active');
    }

    // Load data for the section if needed
    loadSectionData(targetId);
}

// Function to set up all event listeners
function setupEventListeners() {
    // Sidebar navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.currentTarget.dataset.target;
            navigateTo(targetId);
        });
    });

    // Logout
    logoutButton.addEventListener('click', () => {
        if (liff.isLoggedIn()) {
            liff.logout();
            window.location.reload();
        }
    });

    // Job Management (Edit/Create) Event Listeners
    jobSearchInput.addEventListener('keyup', (e) => loadJobs(e.target.value));
    createJobButton.addEventListener('click', () => openJobModal());
    jobModalCloseButton.addEventListener('click', closeJobModal);
    jobModal.addEventListener('click', (e) => {
        if (e.target === jobModal) {
            closeJobModal();
        }
    });
    jobForm.addEventListener('submit', handleJobSubmit);

    // Job Details Event Listeners
    jobDetailsCloseButton.addEventListener('click', closeJobDetailsModal);
    jobDetailsModal.addEventListener('click', (e) => {
        if (e.target === jobDetailsModal) {
            closeJobDetailsModal();
        }
    });

    // Driver Reports Event Listeners
    generateReportBtn.addEventListener('click', generateDriverReport);

    // Settings Event Listeners
    settingsForm.addEventListener('submit', saveSettings);

    // Map Playback Event Listeners
    loadPlaybackDataBtn.addEventListener('click', loadPlaybackData);
    playButton.addEventListener('click', startPlayback);
    pauseButton.addEventListener('click', pausePlayback);
    stopButton.addEventListener('click', stopPlayback);

    // Scheduled Reports Event Listeners
    createReportScheduleBtn.addEventListener('click', () => openReportScheduleModal());
    reportScheduleForm.addEventListener('submit', handleReportScheduleSubmit);
    reportScheduleModalCloseButton.addEventListener('click', closeReportScheduleModal);
    reportScheduleModal.addEventListener('click', (e) => {
        if (e.target === reportScheduleModal) {
            closeReportScheduleModal();
        }
    });

    // Log Viewer Event Listeners
    logSearchReferenceInput.addEventListener('keyup', () => loadLogs());
    logSearchActionInput.addEventListener('keyup', () => loadLogs());
    logSearchUserIdInput.addEventListener('keyup', () => loadLogs());

    // Holiday Work Event Listeners
    holidayWorkSearch.addEventListener('keyup', () => loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value));
    holidayStatusFilter.addEventListener('change', () => loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value));
    holidayDateFrom.addEventListener('change', () => loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value));
    holidayDateTo.addEventListener('change', () => loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value));
    holidayRefreshBtn.addEventListener('click', () => loadHolidayWorkJobs(holidayWorkSearch.value, holidayStatusFilter.value));
    
    holidayApprovalModalClose.addEventListener('click', closeHolidayApprovalModal);
    holidayApprovalModal.addEventListener('click', (e) => {
        if (e.target === holidayApprovalModal) closeHolidayApprovalModal();
    });
    
    // Handle approve button click
    approveBtnModal.addEventListener('click', (e) => {
        e.preventDefault();
        approvalAction.value = 'approve';
        holidayApprovalForm.dispatchEvent(new Event('submit'));
    });
    
    // Handle reject button click
    rejectBtnModal.addEventListener('click', (e) => {
        e.preventDefault();
        const comment = approvalComment.value.trim();
        if (!comment) {
            showNotification('กรุณาระบุเหตุผลในการปฏิเสธ', 'error');
            return;
        }
        approvalAction.value = 'reject';
        holidayApprovalForm.dispatchEvent(new Event('submit'));
    });
    
    // Cancel buttons
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', closeHolidayApprovalModal);
    });
    
    holidayApprovalForm.addEventListener('submit', handleHolidayApprovalSubmit);

    // Vehicle Breakdown Event Listeners
    breakdownSearch.addEventListener('keyup', () => loadVehicleBreakdowns(breakdownSearch.value));
    processBreakdownBtn.addEventListener('click', openBreakdownModal);
    breakdownModalClose.addEventListener('click', closeBreakdownModal);
    breakdownModal.addEventListener('click', (e) => {
        if (e.target === breakdownModal) closeBreakdownModal();
    });
    breakdownJobSelect.addEventListener('change', handleBreakdownJobSelect);
    breakdownForm.addEventListener('submit', handleBreakdownSubmit);

    // Fuel Siphoning Event Listeners
    siphoningSearch.addEventListener('keyup', () => loadFuelSiphoning(siphoningSearch.value, siphoningDateFilter.value));
    siphoningDateFilter.addEventListener('change', () => loadFuelSiphoning(siphoningSearch.value, siphoningDateFilter.value));
    createSiphoningBtn.addEventListener('click', () => openSiphoningModal());
    siphoningModalClose.addEventListener('click', closeSiphoningModal);
    siphoningModal.addEventListener('click', (e) => {
        if (e.target === siphoningModal) closeSiphoningModal();
    });
    siphoningForm.addEventListener('submit', handleSiphoningSubmit);
    siphoningEvidenceInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                siphoningEvidenceImg.src = e.target.result;
                siphoningEvidencePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // B100 Jobs Event Listeners
    b100Search.addEventListener('keyup', () => loadB100Jobs(b100Search.value, b100StatusFilter.value));
    b100StatusFilter.addEventListener('change', () => loadB100Jobs(b100Search.value, b100StatusFilter.value));
    createB100Btn.addEventListener('click', openB100Modal);
    b100ModalClose.addEventListener('click', closeB100Modal);
    b100Modal.addEventListener('click', (e) => {
        if (e.target === b100Modal) closeB100Modal();
    });
    b100Form.addEventListener('submit', handleB100Submit);

    // B100 Outstanding Event Listeners
    b100DetailModalClose.addEventListener('click', closeB100DetailModal);
    b100DetailModal.addEventListener('click', (e) => {
        if (e.target === b100DetailModal) closeB100DetailModal();
    });
}

// Function to set up real-time subscriptions
function setupRealtimeSubscriptions() {
    supabase
        .channel('user_profiles_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_profiles' }, payload => {
            if (payload.new.status === 'PENDING') {
                showNotification(`New user "${payload.new.display_name || payload.new.user_id}" is awaiting approval.`, 'info');
                // Refresh dashboard KPIs and user list
                if (document.querySelector('.nav-link[data-target="dashboard"]').classList.contains('active')) {
                    loadDashboardAnalytics();
                }
                if (document.querySelector('.nav-link[data-target="users"]').classList.contains('active')) {
                    loadUsers();
                }
                updateAlertsBadge(); // New pending user also affects alerts badge
            }
        })
        .subscribe();

    // Realtime for triggered_alerts
    supabase
        .channel('triggered_alerts_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'triggered_alerts' }, payload => {
            const newAlert = payload.new;
            showNotification(`New Alert: ${newAlert.message} (Driver: ${newAlert.driver_user_id})`, 'error');
            // Refresh dashboard KPIs and user list
            if (document.querySelector('.nav-link[data-target="dashboard"]').classList.contains('active')) {
                loadDashboardAnalytics();
            }
            if (document.querySelector('.nav-link[data-target="alerts"]').classList.contains('active')) {
                loadAlerts();
            }
            updateAlertsBadge();
        })
        .subscribe();
    
    // Start holiday work realtime subscription
    console.log('🔔 Starting holiday work realtime subscription...');
    subscribeToHolidayWorkUpdates();
    
    // Start job activity realtime subscription (checkin/checkout)
    console.log('🔔 Starting job activity realtime subscription...');
    subscribeToJobActivityUpdates();
}

// Function to show the admin panel
function showAdminPanel(profile) {
    authContainer.classList.add('hidden');
    adminContainer.classList.remove('hidden');
    adminUsername.textContent = profile.displayName;

    setupEventListeners();
    // Default to dashboard view
    navigateTo('dashboard');
    updateAlertsBadge(); // Load initial alert count
    
    // Initialize notification bell after admin panel is shown
    initNotificationBell();
    
    // Add test notification after 2 seconds
    setTimeout(() => {
        addNotificationToBell(
            'checkin',
            'ระบบพร้อมใช้งาน',
            'Notification system เปิดใช้งานแล้ว คุณจะได้รับการแจ้งเตือนเมื่อมีกิจกรรมใหม่',
            {}
        );
    }, 2000);
}

// Function to initialize the application
async function initializeApp() {
    // Check for dev mode bypass (add ?dev=1 to URL for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const devMode = urlParams.get('dev') === '1';

    if (devMode) {
        console.warn('DEV MODE: Bypassing LINE authentication');
        showAdminPanel({ displayName: 'Dev Admin', userId: 'dev-user' });
        return;
    }

    try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            authStatus.textContent = 'กรุณา Login...';
            liff.login({ redirectUri: window.location.href });
            return;
        }

        const lineProfile = await liff.getProfile();

        // Check user profile for admin status
        const { data: userProfile, error } = await supabase
            .from('user_profiles')
            .select('*')
            // Using user_id (LINE ID) for lookup as per corrected schema assumption
            .eq('user_id', lineProfile.userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw new Error(`Supabase error: ${error.message}`);
        }

        if (userProfile && userProfile.user_type === 'ADMIN' && userProfile.status === 'APPROVED') {
            showAdminPanel(lineProfile);
        } else {
            showAccessDenied();
        }

    } catch (error) {
        console.error('Initialization failed:', error);
        authStatus.textContent = `เกิดข้อผิดพลาด: ${error.message}`;
    }
}

function showAccessDenied() {
    authStatus.innerHTML = 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้<br>กรุณาติดต่อผู้ดูแลระบบ';
}


// --- Notification Bell Management ---
let notificationBellData = [];
let notificationBell, notificationBadge, notificationDropdown, notificationList, markAllReadBtn;

function initNotificationBell() {
    notificationBell = document.getElementById('notificationBell');
    notificationBadge = document.getElementById('notificationBadge');
    notificationDropdown = document.getElementById('notificationDropdown');
    notificationList = document.getElementById('notificationList');
    markAllReadBtn = document.getElementById('markAllRead');

    if (!notificationBell) {
        console.warn('Notification bell not found in DOM');
        return;
    }

    // Load from localStorage
    const saved = localStorage.getItem('adminNotifications');
    if (saved) {
        try {
            notificationBellData = JSON.parse(saved);
            updateNotificationUI();
        } catch (e) {
            console.error('Failed to parse notifications', e);
            notificationBellData = [];
        }
    }

    // Event listeners
    notificationBell.addEventListener('click', (e) => {
        toggleNotificationDropdown(e);
        // Enable audio on first click (user gesture)
        if (window._audioContextBlocked) {
            window._audioContextBlocked = false;
        }
    });
    markAllReadBtn?.addEventListener('click', markAllNotificationsAsRead);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
    });

    console.log('✅ Notification bell initialized');
}

function toggleNotificationDropdown(e) {
    e.stopPropagation();
    notificationDropdown.classList.toggle('show');
}

function addNotificationToBell(type, title, message, data = {}) {
    const notification = {
        id: Date.now(),
        type, // 'checkin', 'checkout', 'trip-end', 'holiday-work'
        title,
        message,
        data,
        timestamp: new Date().toISOString(),
        read: false
    };

    notificationBellData.unshift(notification);
    
    // Keep only last 100 notifications
    if (notificationBellData.length > 100) {
        notificationBellData = notificationBellData.slice(0, 100);
    }

    saveNotifications();
    updateNotificationUI();
    playNotificationSound();
    
    console.log('🔔 Added notification:', notification);
}

function markNotificationAsRead(notificationId) {
    const notification = notificationBellData.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        saveNotifications();
        updateNotificationUI();
    }
}

function markAllNotificationsAsRead() {
    notificationBellData.forEach(n => n.read = true);
    saveNotifications();
    updateNotificationUI();
}

function saveNotifications() {
    localStorage.setItem('adminNotifications', JSON.stringify(notificationBellData));
}

function updateNotificationUI() {
    const unreadCount = notificationBellData.filter(n => !n.read).length;
    
    // Update badge
    if (unreadCount > 0) {
        notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationBadge.style.display = 'block';
    } else {
        notificationBadge.style.display = 'none';
    }

    // Render list
    renderNotificationList();
}

function renderNotificationList() {
    if (notificationBellData.length === 0) {
        notificationList.innerHTML = `
            <div class="notification-empty">
                <div class="notification-empty-icon">🔕</div>
                <p>ยังไม่มีการแจ้งเตือน</p>
            </div>
        `;
        return;
    }

    notificationList.innerHTML = notificationBellData.map(n => {
        const icon = getNotificationIcon(n.type);
        const timeAgo = getTimeAgo(new Date(n.timestamp));
        
        return `
            <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick(${n.id})">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <div class="title">${n.title}</div>
                    <div class="message">${n.message}</div>
                    <div class="time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function handleNotificationClick(notificationId) {
    markNotificationAsRead(notificationId);
    const notification = notificationBellData.find(n => n.id === notificationId);
    
    if (notification && notification.data.reference) {
        console.log('📍 Clicked notification for:', notification.data.reference);
        // Could navigate to specific section or show details
    }
}

function getNotificationIcon(type) {
    const icons = {
        'checkin': '📍',
        'checkout': '✅',
        'trip-end': '🎉',
        'holiday-work': '🎊',
        'alcohol-check': '🍺',
        'alert': '⚠️'
    };
    return icons[type] || '🔔';
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'เมื่อสักครู่';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
}

function playNotificationSound() {
    // Skip if already tried and failed
    if (window._audioContextBlocked) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Check if context is in suspended state (autoplay blocked)
        if (audioContext.state === 'suspended') {
            // Try to resume (will fail on first load, succeed after user interaction)
            audioContext.resume().then(() => {
                playBeep(audioContext);
            }).catch(() => {
                console.log('🔇 Sound blocked by browser - will work after user interaction');
                window._audioContextBlocked = true;
            });
        } else {
            playBeep(audioContext);
        }
    } catch (e) {
        console.log('Could not play sound', e);
        window._audioContextBlocked = true;
    }
}

function playBeep(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}


// --- Main App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    // Don't init notification bell here - will be called in showAdminPanel()
    setupRealtimeSubscriptions(); // Setup real-time listeners
});
