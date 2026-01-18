// Supabase & LIFF Configuration
const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_Nmy5t1j7YhdEZVwWUsJ8'; // CORRECTED KEY
const LIFF_ID = '2007705394-Fgx9wdHu'; // Using driver app LIFF ID for now

// DOM Elements - General
const authContainer = document.getElementById('auth-container');
const authStatus = document.getElementById('auth-status');
const adminContainer = document.getElementById('admin-container');
const adminUsername = document.getElementById('admin-username');
const logoutButton = document.getElementById('logout-button');
const navLinks = document.querySelectorAll('.nav-link');

// DOM elements for Dashboard Analytics
const kpiTotalUsers = document.getElementById('kpi-total-users');
const kpiActiveJobs = document.getElementById('kpi-active-jobs');
const kpiPendingApprovals = document.getElementById('kpi-pending-approvals');

// DOM elements for Job Management (Edit/Create Modal)
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

// DOM elements for Job Details Modal
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

// DOM elements for Driver Reports
const reportDriverSelect = document.getElementById('report-driver-select');
const reportStartDate = document.getElementById('report-start-date');
const reportEndDate = document.getElementById('report-end-date');
const generateReportBtn = document.getElementById('generate-report-btn');
const reportTotalJobs = document.getElementById('report-total-jobs');
const reportCompletedJobs = document.getElementById('report-completed-jobs');
const reportAlcoholChecks = document.getElementById('report-alcohol-checks');
const driverJobsTableBody = document.querySelector('#driver-jobs-table tbody');

// DOM elements for Settings
const settingsForm = document.getElementById('settings-form');
const geofencingRadiusInput = document.getElementById('geofencing_radius_m');
const driverAppAutoRefreshInput = document.getElementById('driver_app_auto_refresh_interval_s');
const adminPanelMapZoomInput = document.getElementById('admin_panel_map_zoom');
const adminPanelMapCenterLatInput = document.getElementById('admin_panel_map_center_lat');
const adminPanelMapCenterLngInput = document.getElementById('admin_panel_map_center_lng');

// DOM elements for Map Playback
const playbackDriverSelect = document.getElementById('playback-driver-select');
const playbackStartDatetime = document.getElementById('playback-start-datetime');
const playbackEndDatetime = document.getElementById('playback-end-datetime');
const playbackSpeed = document.getElementById('playback-speed');
const loadPlaybackDataBtn = document.getElementById('load-playback-data-btn');
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');
const stopButton = document.getElementById('stop-button');

// DOM elements for Alerts
const alertsBadge = document.getElementById('alerts-badge');
const alertsTableBody = document.querySelector('#alerts-table tbody');

// DOM elements for Scheduled Reports
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


// DOM elements for Log Viewer
const logsTableBody = document.querySelector('#logs-table tbody');
const logSearchReferenceInput = document.getElementById('log-search-reference');
const logSearchActionInput = document.getElementById('log-search-action');
const logSearchUserIdInput = document.getElementById('log-search-user-id');

// DOM elements for Real-time Notifications
const notificationContainer = document.getElementById('notification-container');


// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
            .from('jobdata')
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
                .single();

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
            .from('jobdata')
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
    const row = button.closest('tr');
    const userId = row.dataset.id; // UserProfile ID (serial)
    const status = row.querySelector('.status-select').value;
    const userType = row.querySelector('.role-select').value;

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
        let query = supabase.from('jobdata').select('*').order('created_at', { ascending: false });

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
            ({ error } = await supabase.from('jobdata').update(jobData).eq('id', jobId));
        } else {
            // Create new job
            jobData.created_at = new Date().toISOString();
            ({ error } = await supabase.from('jobdata').insert([jobData]));
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
            .from('jobdata')
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
            .from('jobdata')
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

        // Fetch Trip Stops
        const { data: tripStops, error: stopsError } = await supabase
            .from('trip_stops') // Assuming 'trip_stops' table has 'trip_id' matching 'jobdata.id'
            .select('*')
            .eq('trip_id', jobId)
            .order('sequence', { ascending: true });
        if (stopsError) throw stopsError;

        jobDetailsStopsTableBody.innerHTML = '';
        if (tripStops.length === 0) {
            jobDetailsStopsTableBody.innerHTML = '<tr><td colspan="5">No stops found.</td></tr>';
        } else {
            tripStops.forEach(stop => {
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
        const { data: alcoholChecks, error: alcoholError } = await supabase
            .from('alcohol_checks')
            .select('*')
            .eq('trip_id', jobId)
            .order('checked_at', { ascending: false });
        if (alcoholError) throw alcoholError;

        jobDetailsAlcoholTableBody.innerHTML = '';
        if (alcoholChecks.length === 0) {
            jobDetailsAlcoholTableBody.innerHTML = '<tr><td colspan="4">No alcohol checks found.</td></tr>';
        } else {
            alcoholChecks.forEach(check => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${check.driver_name || 'N/A'}</td>
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
            .eq('trip_id', jobId) // Assuming driver_logs uses trip_id now
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
            .from('jobdata')
            .select('*')
            .ilike('drivers', `%${driverId}%`) // Assuming 'drivers' column contains driver_id or name
            .gte('created_at', startDate + 'T00:00:00Z')
            .lte('created_at', endDate + 'T23:59:59Z')
            .order('created_at', { ascending: false });
        if (jobsError) throw jobsError;

        // Fetch alcohol checks for the driver within the date range
        const { count: alcoholChecksCount, error: alcoholError } = await supabase
            .from('alcohol_checks')
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

// --- Real-time Subscriptions ---
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
}

// --- Event Listeners Setup ---
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
}

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
        case 'reports':
            loadDriverReports();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'alerts':
            loadAlerts();
            break;
        case 'playback':
            // Populate driver select for playback
            loadDriverReports(); // Reusing the function to populate driver select
            break;
        case 'schedules':
            loadReportSchedules();
            break;
        case 'logs':
            loadLogs();
            break;
        default:
            console.warn('Unknown section:', targetId);
            break;
    }
}