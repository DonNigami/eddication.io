/**
 * Map Module
 * Handles map initialization, markers, and playback functionality
 */

import { supabase } from '../../shared/config.js';
import { sanitizeHTML, showNotification } from './utils.js';

// Default map settings (Bangkok)
const DEFAULT_MAP_CENTER = { lat: 13.736717, lng: 100.523186 };
const DEFAULT_ZOOM = 10;

// Map state
let map = null;
let markers = null;
let mapCenterLat = DEFAULT_MAP_CENTER.lat;
let mapCenterLng = DEFAULT_MAP_CENTER.lng;
let mapZoom = DEFAULT_ZOOM;

// Playback state
let playbackPath = null;
let playbackMarker = null;
let playbackData = [];
let playbackIndex = 0;
let playbackInterval = null;

// Playback DOM elements (set these during initialization)
let playbackDriverSelect = null;
let playbackStartDatetime = null;
let playbackEndDatetime = null;
let playbackSpeed = null;

/**
 * Set playback DOM elements
 * @param {Object} elements - DOM elements for playback controls
 */
export function setPlaybackElements(elements) {
    playbackDriverSelect = elements.driverSelect;
    playbackStartDatetime = elements.startDatetime;
    playbackEndDatetime = elements.endDatetime;
    playbackSpeed = elements.speed;
}

/**
 * Load map settings from database
 */
export async function loadMapSettings() {
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

/**
 * Initialize the map
 */
export async function initMap() {
    // Check if map container already has a Leaflet instance
    const mapContainer = document.getElementById('map');
    if (mapContainer && mapContainer._leaflet_id && map) {
        map.remove(); // Remove existing map
    }

    await loadMapSettings(); // Load map settings before initializing

    map = L.map('map').setView([mapCenterLat, mapCenterLng], mapZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markers = L.featureGroup();
    markers.addTo(map);

    await updateMapMarkers();
}

/**
 * Update map markers with active drivers
 * Fetches latest locations from driver_live_locations table
 */
export async function updateMapMarkers() {
    if (!markers) return;

    markers.clearLayers(); // Clear existing markers

    try {
        // Fetch all driver locations
        const { data: locations, error } = await supabase
            .from('driver_live_locations')
            .select('*');

        if (error) throw error;

        // Fetch user profiles for all drivers
        const driverIds = locations?.map(loc => loc.driver_user_id).filter(Boolean) || [];
        let profilesMap = new Map();

        if (driverIds.length > 0) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('user_id, display_name, picture_url, status_message, last_seen_at')
                .in('user_id', driverIds);

            if (profiles) {
                profiles.forEach(p => profilesMap.set(p.user_id, p));
            }
        }

        if (!locations || locations.length === 0) {
            console.log('No driver locations found in driver_live_locations.');
            return;
        }

        console.log(`Found ${locations.length} driver locations:`);
        console.table(locations.map(loc => {
            const profile = profilesMap.get(loc.driver_user_id);
            return {
                driver_user_id: loc.driver_user_id,
                display_name: profile?.display_name || 'N/A',
                lat: loc.lat,
                lng: loc.lng,
                updated: loc.last_updated
            };
        }));

        // Create marker for each driver
        for (const loc of locations) {
            const lat = loc.lat;
            const lng = loc.lng;

            if (lat && lng) {
                const profile = profilesMap.get(loc.driver_user_id) || {};
                const driverId = loc.driver_user_id || 'N/A';
                const driverName = profile.display_name || driverId;
                const time = loc.last_updated ? new Date(loc.last_updated).toLocaleString() : 'N/A';
                const tracked = loc.is_tracked_in_realtime ? '🟢 Live' : '⚪ Offline';

                const marker = L.marker([lat, lng]).bindPopup(`
                    <b>Driver:</b> ${sanitizeHTML(driverName)}<br>
                    <b>Driver ID:</b> ${sanitizeHTML(String(driverId))}<br>
                    <b>Status:</b> ${tracked}<br>
                    <b>Updated:</b> ${sanitizeHTML(time)}<br>
                    <b>Position:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}
                `);
                markers.addLayer(marker);
            }
        }

        if (markers.getLayers().length > 0) {
            map.fitBounds(markers.getBounds(), { padding: [50, 50] });
        }

    } catch (error) {
        console.error('Error updating map markers:', error);
    }
}

/**
 * Load playback data for a driver
 */
export async function loadPlaybackData() {
    if (!playbackDriverSelect || !playbackStartDatetime || !playbackEndDatetime) {
        console.error('Playback elements not set');
        return;
    }

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
        // Fetch location data from driver_logs
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

/**
 * Start map playback
 */
export function startPlayback() {
    if (playbackData.length < 2 || !playbackMarker) {
        showNotification('Please load playback data first.', 'error');
        return;
    }

    if (playbackInterval) clearInterval(playplaybackInterval);

    // Ensure playback starts from current index or beginning if stopped
    if (playbackIndex >= playbackData.length - 1) {
        playbackIndex = 0; // Reset to start if already at end
        playbackMarker.setLatLng([playbackData[0].lat, playbackData[0].lng]);
        playbackMarker.getPopup().setContent(`Driver: ${playbackDriverSelect.options[playbackDriverSelect.selectedIndex].text}<br>Time: ${new Date(playbackData[0].created_at).toLocaleString()}`);
    }

    const speed = parseFloat(playbackSpeed?.value) || 1;
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

/**
 * Pause map playback
 */
export function pausePlayback() {
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
        showNotification('Playback paused.', 'info');
    }
}

/**
 * Stop map playback and clean up
 */
export function stopPlayback() {
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
    if (markers) {
        markers.clearLayers(); // Clear active job markers too for cleaner view
        updateMapMarkers(); // Re-add active job markers
    }
    showNotification('Playback stopped and map cleared.', 'info');
}

/**
 * Get the map instance
 * @returns {Object} Leaflet map instance
 */
export function getMap() {
    return map;
}

/**
 * Get the markers feature group
 * @returns {Object} Leaflet feature group
 */
export function getMarkers() {
    return markers;
}
