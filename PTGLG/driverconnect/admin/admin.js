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

// DOM elements for Job Management
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

// DOM elements for Log Viewer
const logsTableBody = document.querySelector('#logs-table tbody');
const logSearchReferenceInput = document.getElementById('log-search-reference');
const logSearchActionInput = document.getElementById('log-search-action');
const logSearchUserIdInput = document.getElementById('log-search-user-id');


// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Main App Logic
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
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

    // Job Management Event Listeners
    jobSearchInput.addEventListener('keyup', (e) => loadJobs(e.target.value));
    createJobButton.addEventListener('click', () => openJobModal());
    jobModalCloseButton.addEventListener('click', closeJobModal);
    jobModal.addEventListener('click', (e) => {
        if (e.target === jobModal) {
            closeJobModal();
        }
    });
    jobForm.addEventListener('submit', handleJobSubmit);

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
            break;
        case 'users':
            loadUsers();
            break;
        case 'jobs':
            loadJobs();
            break;
        case 'logs':
            loadLogs();
            break;
    }
}

// Map Functions
let map;
let markers = L.featureGroup(); // Group to manage markers

function initMap() {
    if (map) {
        map.remove(); // Remove existing map if it was already initialized
    }

    map = L.map('map').setView([13.736717, 100.523186], 10); // Default to Bangkok

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
    } catch (error) {
        console.error('Error deleting job:', error);
        alert(`Failed to delete job: ${error.message}`);
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