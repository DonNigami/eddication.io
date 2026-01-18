// Supabase & LIFF Configuration
const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';
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


// DOM elements for Log Viewer
const logsTableBody = document.querySelector('#logs-table tbody');
const logSearchReferenceInput = document.getElementById('log-search-reference');
const logSearchActionInput = document.getElementById('log-search-action');
const logSearchUserIdInput = document.getElementById('log-search-user-id');

// DOM elements for Real-time Notifications
const notificationContainer = document.getElementById('notification-container');


// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Main App Logic
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupRealtimeSubscriptions(); // Setup real-time listeners
});


async function initializeApp() {
    try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            authStatus.textContent = 'กรุณา Login...';
            liff.login({ redirectUri: window.location.href });
            return;
        }

        const lineProfile = await liff.getProfile();
        
        const { data: userProfile, error } = await supabase
            .from('user_profiles')
            .select('*')
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

function showAdminPanel(profile) {
    authContainer.classList.add('hidden');
    adminContainer.classList.remove('hidden');
    adminUsername.textContent = profile.displayName;

    setupEventListeners();
    // Default to dashboard view
    navigateTo('dashboard');
}

function showAccessDenied() {
    authStatus.innerHTML = 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้<br>กรุณาติดต่อผู้ดูแลระบบ';
}

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

function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'dashboard':
            initMap();
            loadDashboardAnalytics();
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
        case 'logs':
            loadLogs();
            break;
    }
}

// Real-time Subscriptions
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
            }
        })
        .subscribe();
}

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

// Map Functions
let map;
let markers = L.featureGroup(); // Group to manage markers
let mapCenterLat = 13.736717; // Default to Bangkok
let mapCenterLng = 100.523186;
let mapZoom = 10;

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

// Dashboard Analytics Functions
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


// User Management Functions
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
            row.dataset.userId = user.id;

            const statusOptions = ['PENDING', 'APPROVED', 'REJECTED']
                .map(s => `<option value="${s}" ${user.status === s ? 'selected' : ''}>${s}</option>`).join('');

            const roleOptions = ['DRIVER', 'ADMIN']
                .map(r => `<option value="${r}" ${user.user_type === r ? 'selected' : ''}>${r}</option>`).join('');

            row.innerHTML = `
                <td>${user.display_name || 'N/A'}</td>
                <td>${user.user_id}</td>
                <td><select class="status-select">${statusOptions}</select></td>
                <td><select class="role-select">${roleOptions}</select></td>
                <td><button class="save-user-btn">Save</button></td>
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
    const userId = row.dataset.userId;
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
            .eq('id', userId);

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

// Job Management Functions
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

// Job Details Functions
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

// Driver Reports Functions
async function loadDriverReports() {
    reportDriverSelect.innerHTML = '<option value="">Loading drivers...</option>';
    try {
        const { data: drivers, error } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name', { ascending: true });

        if (error) throw error;

        reportDriverSelect.innerHTML = '<option value="">-- Select Driver --</option>';
        drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.user_id;
            option.textContent = driver.display_name || driver.user_id;
            reportDriverSelect.appendChild(option);
        });

        // Set default dates (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        reportEndDate.value = startDate.toISOString().split('T')[0];
        reportStartDate.value = startDate.toISOString().split('T')[0]; // Fixed: start date should be startDate
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

// Settings Functions
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


// Log Viewer Functions
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