/**
 * Fuel Siphoning Module
 * Handles fuel siphoning records management
 */

import { supabase } from '../admin.js';
import { sanitizeHTML, showNotification } from './utils.js';

// DOM elements
let siphoningTableBody = null;
let siphoningSearch = null;
let siphoningDateFilter = null;
let createSiphoningBtn = null;
let siphoningModal = null;
let siphoningForm = null;
let siphoningIdInput = null;
let siphoningReferenceInput = null;
let siphoningStation = null;
let siphoningDriver = null;
let siphoningVehicleInput = null;
let siphoningDateInput = null;
let siphoningTimeInput = null;
let siphoningLitersInput = null;
let siphoningEvidenceInput = null;
let siphoningEvidencePreview = null;
let siphoningEvidenceImg = null;
let siphoningNotesInput = null;

const SIPHONING_TABLE_COLUMNS = 8;

/**
 * Set siphoning DOM elements
 * @param {Object} elements - DOM elements
 */
export function setSiphoningElements(elements) {
    siphoningTableBody = elements.tableBody;
    siphoningSearch = elements.search;
    siphoningDateFilter = elements.dateFilter;
    createSiphoningBtn = elements.createBtn;
    siphoningModal = elements.modal;
    siphoningForm = elements.form;
    siphoningIdInput = elements.idInput;
    siphoningReferenceInput = elements.referenceInput;
    siphoningStation = elements.station;
    siphoningDriver = elements.driver;
    siphoningVehicleInput = elements.vehicleInput;
    siphoningDateInput = elements.dateInput;
    siphoningTimeInput = elements.timeInput;
    siphoningLitersInput = elements.litersInput;
    siphoningEvidenceInput = elements.evidenceInput;
    siphoningEvidencePreview = elements.evidencePreview;
    siphoningEvidenceImg = elements.evidenceImg;
    siphoningNotesInput = elements.notesInput;
}

/**
 * Load fuel siphoning records
 * @param {string} searchTerm - Search term
 * @param {string} dateFilter - Date filter
 */
export async function loadFuelSiphoning(searchTerm = '', dateFilter = '') {
    if (!siphoningTableBody) {
        console.error('Siphoning table body not set');
        return;
    }

    siphoningTableBody.innerHTML = `<tr><td colspan="${SIPHONING_TABLE_COLUMNS}">Loading records...</td></tr>`;

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
            siphoningTableBody.innerHTML = `<tr><td colspan="${SIPHONING_TABLE_COLUMNS}">No siphoning records found.</td></tr>`;
            return;
        }

        records.forEach(record => {
            const row = siphoningTableBody.insertRow();

            row.insertCell().textContent = record.siphon_date || 'N/A';
            row.insertCell().textContent = record.station_name || 'N/A';
            row.insertCell().textContent = record.driver_name || 'N/A';
            row.insertCell().textContent = record.vehicle_plate || 'N/A';
            row.insertCell().textContent = record.liters ? record.liters.toFixed(2) : '0.00';

            // Evidence
            const evidenceCell = row.insertCell();
            if (record.evidence_image_url) {
                const link = document.createElement('a');
                link.href = record.evidence_image_url;
                link.target = '_blank';
                link.textContent = 'View';
                evidenceCell.appendChild(link);
            } else {
                evidenceCell.textContent = 'N/A';
            }

            // Status
            const statusCell = row.insertCell();
            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge badge-siphoning-${record.status}`;
            statusSpan.textContent = record.status;
            statusCell.appendChild(statusSpan);

            // Actions
            const actionCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.className = 'edit-siphoning-btn';
            editButton.dataset.id = record.id;
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', async () => {
                const foundRecord = records.find(r => r.id === record.id);
                await openSiphoningModal(foundRecord);
            });
            actionCell.appendChild(editButton);
        });

    } catch (error) {
        console.error('Error loading fuel siphoning:', error);
        siphoningTableBody.innerHTML = `<tr><td colspan="${SIPHONING_TABLE_COLUMNS}">Error: ${sanitizeHTML(error.message)}</td></tr>`;
    }
}

/**
 * Open siphoning modal
 * @param {Object} record - Record to edit (null for create)
 */
export async function openSiphoningModal(record = null) {
    if (!siphoningModal) return;

    if (siphoningForm) siphoningForm.reset();
    if (siphoningEvidencePreview) siphoningEvidencePreview.classList.add('hidden');
    if (siphoningIdInput) siphoningIdInput.value = '';

    // Load stations
    try {
        const { data: stations } = await supabase
            .from('station')
            .select('station_name, stationKey, "plant code"')
            .order('station_name');

        const { data: customers } = await supabase
            .from('customer')
            .select('name, stationKey')
            .order('name');

        if (siphoningStation) {
            siphoningStation.innerHTML = '<option value="">-- Select Station --</option>';

            // Add stations optgroup
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

            // Add customers optgroup
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

        if (siphoningDriver) {
            siphoningDriver.innerHTML = '<option value="">-- Select Driver --</option>';
            drivers?.forEach(driver => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ id: driver.user_id, name: driver.display_name });
                option.textContent = driver.display_name || driver.user_id;
                siphoningDriver.appendChild(option);
            });
        }
    } catch (e) {
        console.warn('Could not load drivers:', e);
    }

    // Fill form if editing
    if (record) {
        if (siphoningIdInput) siphoningIdInput.value = record.id;
        if (siphoningReferenceInput) siphoningReferenceInput.value = record.reference || '';
        if (siphoningVehicleInput) siphoningVehicleInput.value = record.vehicle_plate || '';
        if (siphoningDateInput) siphoningDateInput.value = record.siphon_date || '';
        if (siphoningTimeInput) siphoningTimeInput.value = record.siphon_time || '';
        if (siphoningLitersInput) siphoningLitersInput.value = record.liters || '';
        if (siphoningNotesInput) siphoningNotesInput.value = record.notes || '';

        if (record.evidence_image_url && siphoningEvidencePreview) {
            if (siphoningEvidenceImg) siphoningEvidenceImg.src = record.evidence_image_url;
            siphoningEvidencePreview.classList.remove('hidden');
        }
    }

    siphoningModal.classList.remove('hidden');
}

/**
 * Close siphoning modal
 */
export function closeSiphoningModal() {
    if (siphoningModal) {
        siphoningModal.classList.add('hidden');
    }
}

/**
 * Upload siphoning evidence
 * @param {File} file - File to upload
 * @returns {Promise<string>} Public URL
 */
export async function uploadSiphoningEvidence(file) {
    if (!file) return null;

    const fileName = `siphoning-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from('evidence')
        .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('evidence')
        .getPublicUrl(fileName);

    return publicUrl;
}

/**
 * Handle siphoning form submit
 * @param {Event} event - Form submit event
 */
export async function handleSiphoningSubmit(event) {
    event.preventDefault();

    const id = siphoningIdInput?.value;
    const stationData = siphoningStation?.value;
    const driverData = siphoningDriver?.value;
    const vehicle = siphoningVehicleInput?.value;
    const date = siphoningDateInput?.value;
    const time = siphoningTimeInput?.value;
    const liters = parseFloat(siphoningLitersInput?.value) || 0;
    const notes = siphoningNotesInput?.value;
    const evidenceFile = siphoningEvidenceInput?.files[0];

    if (!stationData || !driverData || !vehicle || !date || liters <= 0) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    const station = JSON.parse(stationData);
    const driver = JSON.parse(driverData);

    try {
        let evidenceUrl = null;
        if (evidenceFile) {
            evidenceUrl = await uploadSiphoningEvidence(evidenceFile);
        }

        const recordData = {
            reference: siphoningReferenceInput?.value || `SIPH-${Date.now()}`,
            station_name: station.name,
            station_code: station.code,
            driver_id: driver.id,
            driver_name: driver.name,
            vehicle_plate: vehicle,
            siphon_date: date,
            siphon_time: time,
            liters: liters,
            notes: notes,
            status: 'pending'
        };

        if (evidenceUrl) {
            recordData.evidence_image_url = evidenceUrl;
        }

        let error;
        if (id) {
            ({ error } = await supabase.from('fuel_siphoning').update(recordData).eq('id', id));
        } else {
            recordData.created_at = new Date().toISOString();
            ({ error } = await supabase.from('fuel_siphoning').insert([recordData]));
        }

        if (error) throw error;

        showNotification(`Record ${id ? 'updated' : 'created'} successfully`, 'success');
        closeSiphoningModal();
        await loadFuelSiphoning(siphoningSearch?.value, siphoningDateFilter?.value);

    } catch (error) {
        console.error('Error saving siphoning record:', error);
        showNotification(`Failed to save record: ${error.message}`, 'error');
    }
}
