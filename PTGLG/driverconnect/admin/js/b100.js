/**
 * B100 Jobs Module
 * Handles B100 (special fuel) jobs management
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let b100JobsTableBody = null;
let b100Search = null;
let b100StatusFilter = null;
let createB100Btn = null;
let b100Modal = null;
let b100Form = null;
let b100JobIdInput = null;
let b100ReferenceInput = null;
let b100DriverSelect = null;
let b100VehicleInput = null;
let b100OriginSelect = null;
let b100DestinationSelect = null;
let b100MaterialsSelect = null;
let b100QuantityInput = null;

const B100_TABLE_COLUMNS = 7;

/**
 * Set B100 DOM elements
 * @param {Object} elements - DOM elements
 */
export function setB100Elements(elements) {
    b100JobsTableBody = elements.tableBody;
    b100Search = elements.search;
    b100StatusFilter = elements.statusFilter;
    createB100Btn = elements.createBtn;
    b100Modal = elements.modal;
    b100Form = elements.form;
    b100JobIdInput = elements.jobIdInput;
    b100ReferenceInput = elements.referenceInput;
    b100DriverSelect = elements.driverSelect;
    b100VehicleInput = elements.vehicleInput;
    b100OriginSelect = elements.originSelect;
    b100DestinationSelect = elements.destinationSelect;
    b100MaterialsSelect = elements.materialsSelect;
    b100QuantityInput = elements.quantityInput;
}

/**
 * Load B100 jobs
 * @param {string} searchTerm - Search term
 * @param {string} statusFilter - Status filter
 */
export async function loadB100Jobs(searchTerm = '', statusFilter = '') {
    if (!b100JobsTableBody) {
        console.error('B100 jobs table body not set');
        return;
    }

    b100JobsTableBody.innerHTML = `<tr><td colspan="${B100_TABLE_COLUMNS}">Loading B100 jobs...</td></tr>`;

    try {
        let query = supabase
            .from('jobdata')
            .select('*')
            .like('reference', 'B100-%')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`reference.ilike.%${searchTerm}%,drivers.ilike.%${searchTerm}%`);
        }

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data: jobs, error } = await query;
        if (error) throw error;

        b100JobsTableBody.innerHTML = '';
        if (!jobs || jobs.length === 0) {
            b100JobsTableBody.innerHTML = `<tr><td colspan="${B100_TABLE_COLUMNS}">No B100 jobs found.</td></tr>`;
            return;
        }

        jobs.forEach(job => {
            const row = b100JobsTableBody.insertRow();

            row.insertCell().textContent = job.reference || 'N/A';
            row.insertCell().textContent = job.drivers || 'N/A';
            row.insertCell().textContent = job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A';
            row.insertCell().textContent = job.vehicle_desc || 'N/A';
            row.insertCell().textContent = job.total_qty
                ? parseFloat(job.total_qty).toLocaleString('th-TH', { minimumFractionDigits: 2 })
                : '0.00';

            // Status
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge badge-b100-${job.status}`;
            statusSpan.textContent = job.status || 'pending';
            statusCell.appendChild(statusSpan);

            // Actions
            const actionCell = row.insertCell();
            if (job.status !== 'paid') {
                const paidButton = document.createElement('button');
                paidButton.className = 'mark-paid-btn';
                paidButton.dataset.jobId = job.id;
                paidButton.textContent = 'Mark Paid';
                paidButton.addEventListener('click', () => updateB100Status(job.id, 'paid'));
                actionCell.appendChild(paidButton);
            }
            if (job.status === 'pending') {
                const outstandingButton = document.createElement('button');
                outstandingButton.className = 'mark-outstanding-btn';
                outstandingButton.dataset.jobId = job.id;
                outstandingButton.textContent = 'Outstanding';
                outstandingButton.addEventListener('click', () => updateB100Status(job.id, 'outstanding'));
                actionCell.appendChild(outstandingButton);
            }
        });

    } catch (error) {
        console.error('Error loading B100 jobs:', error);
        b100JobsTableBody.innerHTML = `<tr><td colspan="${B100_TABLE_COLUMNS}">Error: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Load origins from database and populate dropdowns
 */
async function loadOrigins() {
    try {
        const { data: origins, error } = await supabase
            .from('origin')
            .select('originKey, name')
            .order('name');

        if (error) throw error;

        const optionsHTML = '<option value="">-- Select Origin/Destination --</option>' +
            (origins?.map(origin =>
                `<option value="${origin.originKey}">${sanitizeHTML(origin.name)} (${origin.originKey})</option>`
            ).join('') || '');

        if (b100OriginSelect) {
            b100OriginSelect.innerHTML = optionsHTML;
        }
        if (b100DestinationSelect) {
            b100DestinationSelect.innerHTML = optionsHTML;
        }
    } catch (error) {
        console.error('Error loading origins:', error);
        const defaultOption = '<option value="">-- Select Location --</option>';
        if (b100OriginSelect) b100OriginSelect.innerHTML = defaultOption;
        if (b100DestinationSelect) b100DestinationSelect.innerHTML = defaultOption;
    }
}

/**
 * Load drivers from jobdata and populate dropdown
 */
async function loadDrivers() {
    try {
        // Fetch unique drivers from jobdata table
        const { data: jobData, error } = await supabase
            .from('jobdata')
            .select('drivers')
            .not('drivers', 'is', null)
            .not('drivers', 'eq', '')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Parse and collect unique drivers (drivers field is comma-separated)
        const driversSet = new Set();
        jobData?.forEach(row => {
            if (row.drivers) {
                // Split by comma and trim each name
                const names = row.drivers.split(',').map(d => d.trim()).filter(d => d);
                names.forEach(name => driversSet.add(name));
            }
        });

        // Convert to array and sort
        const uniqueDrivers = Array.from(driversSet).sort();

        if (b100DriverSelect) {
            b100DriverSelect.innerHTML = '<option value="">-- เลือกคนขับ --</option>';
            uniqueDrivers.forEach(driverName => {
                const option = document.createElement('option');
                option.value = driverName;
                option.textContent = sanitizeHTML(driverName);
                b100DriverSelect.appendChild(option);
            });
        }

        console.log(`Loaded ${uniqueDrivers.length} unique drivers from jobdata`);
    } catch (e) {
        console.warn('Could not load drivers from jobdata:', e);
        if (b100DriverSelect) {
            b100DriverSelect.innerHTML = '<option value="">-- เลือกคนขับ --</option>';
        }
    }
}

/**
 * Load vehicles from jobdata and populate datalist for searchable input
 */
async function loadVehicles() {
    try {
        // Fetch unique vehicles from jobdata table
        const { data: jobData, error } = await supabase
            .from('jobdata')
            .select('vehicle_desc')
            .not('vehicle_desc', 'is', null)
            .not('vehicle_desc', 'eq', '')
            .order('vehicle_desc', { ascending: true });

        if (error) throw error;

        // Collect unique vehicles
        const vehiclesSet = new Set();
        jobData?.forEach(row => {
            if (row.vehicle_desc) {
                vehiclesSet.add(row.vehicle_desc.trim());
            }
        });

        // Convert to array and sort
        const uniqueVehicles = Array.from(vehiclesSet).sort();

        // Get the vehicle input and its datalist
        const vehicleInput = document.getElementById('b100-vehicle');
        const vehicleDatalist = document.getElementById('b100-vehicle-list');

        if (vehicleDatalist) {
            vehicleDatalist.innerHTML = '';
            uniqueVehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle;
                vehicleDatalist.appendChild(option);
            });
        }

        console.log(`Loaded ${uniqueVehicles.length} unique vehicles from jobdata`);
    } catch (e) {
        console.warn('Could not load vehicles from jobdata:', e);
    }
}

/**
 * Open B100 modal for create
 */
export async function openB100Modal() {
    if (!b100Modal) return;

    if (b100Form) b100Form.reset();
    if (b100JobIdInput) b100JobIdInput.value = '';

    // Generate default reference: B100-YYMMDD-XXX
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
    const { count } = await supabase
        .from('jobdata')
        .select('*', { count: 'exact', head: true })
        .ilike('reference', `B100-${today}%`);

    if (b100ReferenceInput) {
        b100ReferenceInput.value = `B100-${today}-${String((count || 0) + 1).padStart(3, '0')}`;
    }

    // Load origins, drivers, and vehicles in parallel
    await Promise.all([
        loadOrigins(),
        loadDrivers(),
        loadVehicles()
    ]);

    b100Modal.classList.remove('hidden');
}

/**
 * Close B100 modal
 */
export function closeB100Modal() {
    if (b100Modal) {
        b100Modal.classList.add('hidden');
    }
}

/**
 * Handle B100 form submit
 * @param {Event} event - Form submit event
 */
export async function handleB100Submit(event) {
    event.preventDefault();

    const driverData = b100DriverSelect?.value;
    const vehicle = b100VehicleInput?.value;
    const originKey = b100OriginSelect?.value;
    const destinationKey = b100DestinationSelect?.value;
    const materials = b100MaterialsSelect?.value;
    const quantity = parseFloat(b100QuantityInput?.value) || 0;
    const reference = b100ReferenceInput?.value;

    if (!driverData || !vehicle || !originKey || !destinationKey || quantity <= 0) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    try {
        // Fetch origin and destination names from origin table
        const { data: originData } = await supabase
            .from('origin')
            .select('name, lat, lng')
            .eq('originKey', originKey)
            .single();

        const { data: destinationData } = await supabase
            .from('origin')
            .select('name, lat, lng')
            .eq('originKey', destinationKey)
            .single();

        const now = new Date().toISOString();

        // สร้าง 2 records: 1 จุดสำหรับต้นทาง (origin) และ 1 จุดสำหรับปลายทาง (destination)
        const jobsToInsert = [
            // จุดที่ 1: ต้นทาง (Origin Stop)
            {
                reference: reference,
                drivers: driverData,
                vehicle_desc: vehicle,
                ship_to_code: originKey,
                ship_to_name: originData?.name || originKey,
                dest_lat: originData?.lat || null,
                dest_lng: originData?.lng || null,
                materials: materials,
                total_qty: 0, // ต้นทางไม่มีปริมาณ
                status: 'pending',
                seq: 1,
                is_origin_stop: true,
                created_at: now,
                updated_at: now
            },
            // จุดที่ 2: ปลายทาง (Destination Stop)
            {
                reference: reference,
                drivers: driverData,
                vehicle_desc: vehicle,
                ship_to_code: destinationKey,
                ship_to_name: destinationData?.name || destinationKey,
                dest_lat: destinationData?.lat || null,
                dest_lng: destinationData?.lng || null,
                materials: materials,
                total_qty: quantity, // ปลายทางมีปริมาณ
                status: 'pending',
                seq: 2,
                is_origin_stop: false,
                created_at: now,
                updated_at: now
            }
        ];

        const { error } = await supabase.from('jobdata').insert(jobsToInsert);
        if (error) throw error;

        showNotification('B100 job created successfully', 'success');
        closeB100Modal();
        await loadB100Jobs(b100Search?.value, b100StatusFilter?.value);

    } catch (error) {
        console.error('Error creating B100 job:', error);
        showNotification(`Failed to create job: ${error.message}`, 'error');
    }
}

/**
 * Update B100 job status
 * @param {string} jobId - Job ID
 * @param {string} newStatus - New status
 */
export async function updateB100Status(jobId, newStatus) {
    try {
        const { error } = await supabase
            .from('jobdata')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', jobId);

        if (error) throw error;

        showNotification(`Status updated to ${newStatus}`, 'success');
        await loadB100Jobs(b100Search?.value, b100StatusFilter?.value);

    } catch (error) {
        console.error('Error updating B100 status:', error);
        showNotification(`Failed to update status: ${error.message}`, 'error');
    }
}
