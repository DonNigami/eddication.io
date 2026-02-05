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

// Filter state
let currentFilter = 'all'; // 'all', 'online', 'recent', 'offline', 'stale', 'nodata'
let allDriverLocations = []; // Store all locations for filtering

// Driver status thresholds (in milliseconds)
const ONLINE_THRESHOLD = 5 * 60 * 1000;      // 5 minutes - considered online
const OFFLINE_RECENT_THRESHOLD = 30 * 60 * 1000;  // 30 minutes - recently offline
const STALE_THRESHOLD = 60 * 60 * 1000;     // 60 minutes - stale/offline long time

/**
 * Create a custom SVG marker icon with specified color
 * @param {string} color - Marker color (hex or named)
 * @param {string} label - Optional label to display on marker
 * @returns {L.DivIcon} Leaflet div icon
 */
function createCustomMarkerIcon(color, label = '') {
    const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
            <circle cx="16" cy="16" r="6" fill="#ffffff"/>
            ${label ? `<text x="16" y="20" text-anchor="middle" font-size="8" font-weight="bold" fill="${color}">${label}</text>` : ''}
        </svg>
    `;

    return L.divIcon({
        className: 'custom-marker',
        html: svgContent,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42],
        shadowUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDMyIDEwIj4KICA8ZWxsaXBzZSBjeD0iMTYiIGN5PSI1IiByeD0iMTIiIHJ5PSIzIiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjMiLz4KPC9zdmc+',
        shadowSize: [32, 10],
        shadowAnchor: [16, 10]
    });
}

/**
 * Get driver status based on tracking state and last update time
 * @param {boolean} isTracked - Whether driver is tracked in real-time
 * @param {string} lastUpdated - ISO timestamp of last update
 * @returns {Object} Status object with color, label, and description
 */
function getDriverStatus(isTracked, lastUpdated) {
    if (isTracked) {
        return {
            color: '#22c55e',  // Green - Online/Live
            label: '●',
            status: '🟢 Online',
            statusText: 'Online'
        };
    }

    if (!lastUpdated) {
        return {
            color: '#94a3b8',  // Gray - No data
            label: '?',
            status: '⚪ No Data',
            statusText: 'No Data'
        };
    }

    const now = Date.now();
    const lastUpdate = new Date(lastUpdated).getTime();
    const timeDiff = now - lastUpdate;

    if (timeDiff <= OFFLINE_RECENT_THRESHOLD) {
        return {
            color: '#f59e0b',  // Orange - Recently offline
            label: '○',
            status: '🟠 Offline (Recent)',
            statusText: 'Recently Offline'
        };
    }

    if (timeDiff <= STALE_THRESHOLD) {
        return {
            color: '#ef4444',  // Red - Offline for a while
            label: '○',
            status: '🔴 Offline',
            statusText: 'Offline'
        };
    }

    return {
        color: '#6b7280',  // Dark gray - Stale
        label: '○',
        status: '⚫ Stale',
        statusText: 'Stale'
    };
}

/**
 * Get status color for display in popup
 * @param {Object} status - Status object from getDriverStatus
 * @returns {string} HTML span with colored indicator
 */
function getStatusIndicator(status) {
    return `<span style="color: ${status.color}; font-weight: bold;">${status.status}</span>`;
}

/**
 * Get status filter key for a driver
 * @param {boolean} isTracked - Whether driver is tracked in real-time
 * @param {string} lastUpdated - ISO timestamp of last update
 * @returns {string} Status filter key: 'online', 'recent', 'offline', 'stale', 'nodata'
 */
function getStatusFilterKey(isTracked, lastUpdated) {
    if (isTracked) return 'online';
    if (!lastUpdated) return 'nodata';

    const now = Date.now();
    const lastUpdate = new Date(lastUpdated).getTime();
    const timeDiff = now - lastUpdate;

    if (timeDiff <= OFFLINE_RECENT_THRESHOLD) return 'recent';
    if (timeDiff <= STALE_THRESHOLD) return 'offline';
    return 'stale';
}

/**
 * Update driver status counts in the dashboard
 * @param {Array} locations - Array of driver location objects
 */
function updateDriverStatusCounts(locations) {
    const counts = {
        all: locations.length,
        online: 0,
        recent: 0,
        offline: 0,
        stale: 0,
        nodata: 0
    };

    locations.forEach(loc => {
        const statusKey = getStatusFilterKey(loc.is_tracked_in_realtime, loc.last_updated);
        counts[statusKey]++;
    });

    // Update the count elements
    for (const [key, count] of Object.entries(counts)) {
        const el = document.getElementById(`driver-count-${key}`);
        if (el) {
            // Animate the number change
            const currentVal = parseInt(el.textContent) || 0;
            animateCount(el, currentVal, count);
        }
    }
}

/**
 * Animate count change
 * @param {HTMLElement} element - Target element
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 */
function animateCount(element, start, end) {
    if (start === end) return;
    const duration = 300;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        const current = Math.round(start + (end - start) * easeProgress);

        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

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
 * Create legend control for driver status
 * @returns {L.Control} Leaflet control
 */
function createLegendControl() {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'legend');
        div.style.cssText = `
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
            font-size: 12px;
            line-height: 1.8;
            min-width: 140px;
        `;

        const statuses = [
            { color: '#22c55e', label: 'Online', desc: 'Currently tracking' },
            { color: '#f59e0b', label: 'Recent Offline', desc: 'Offline < 30 min' },
            { color: '#ef4444', label: 'Offline', desc: 'Offline 30-60 min' },
            { color: '#6b7280', label: 'Stale', desc: 'Offline > 60 min' },
            { color: '#94a3b8', label: 'No Data', desc: 'No updates' }
        ];

        div.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                Driver Status
            </div>
            ${statuses.map(s => `
                <div style="display: flex; align-items: center;">
                    <span style="
                        width: 14px;
                        height: 14px;
                        background: ${s.color};
                        border-radius: 50%;
                        margin-right: 8px;
                        border: 2px solid white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    "></span>
                    <span style="color: #334155;">${s.label}</span>
                </div>
            `).join('')}
        `;

        return div;
    };

    return legend;
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

    // Add legend control
    createLegendControl().addTo(map);

    // Initialize filter state on UI
    setMapFilter(currentFilter);

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
            // Still update counts (all zeros)
            updateDriverStatusCounts([]);
            return;
        }

        // Store all locations with profile data for filtering
        allDriverLocations = locations.map(loc => ({
            ...loc,
            profile: profilesMap.get(loc.driver_user_id) || null
        }));

        console.log(`Found ${allDriverLocations.length} driver locations:`);
        console.table(allDriverLocations.map(loc => {
            const profile = loc.profile;
            return {
                driver_user_id: loc.driver_user_id,
                display_name: profile?.display_name || 'N/A',
                lat: loc.lat,
                lng: loc.lng,
                updated: loc.last_updated
            };
        }));

        // Update driver status counts
        updateDriverStatusCounts(allDriverLocations);

        // Filter locations based on current filter
        const filteredLocations = filterLocationsByStatus(allDriverLocations, currentFilter);

        console.log(`Showing ${filteredLocations.length} of ${allDriverLocations.length} drivers (filter: ${currentFilter})`);

        // Create marker for each driver
        for (const loc of filteredLocations) {
            const lat = loc.lat;
            const lng = loc.lng;

            if (lat && lng) {
                const profile = loc.profile || {};
                const driverId = loc.driver_user_id || 'N/A';
                const driverName = profile.display_name || driverId;
                const time = loc.last_updated ? new Date(loc.last_updated).toLocaleString() : 'N/A';

                // Get driver status and appropriate marker icon
                const status = getDriverStatus(loc.is_tracked_in_realtime, loc.last_updated);
                const markerIcon = createCustomMarkerIcon(status.color, status.label);

                // Calculate time ago for display
                let timeAgo = 'N/A';
                if (loc.last_updated) {
                    const now = Date.now();
                    const lastUpdate = new Date(loc.last_updated).getTime();
                    const diff = now - lastUpdate;
                    const minutes = Math.floor(diff / 60000);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);

                    if (days > 0) {
                        timeAgo = `${days}d ago`;
                    } else if (hours > 0) {
                        timeAgo = `${hours}h ago`;
                    } else if (minutes > 0) {
                        timeAgo = `${minutes}m ago`;
                    } else {
                        timeAgo = 'Just now';
                    }
                }

                const marker = L.marker([lat, lng], { icon: markerIcon }).bindPopup(`
                    <div style="min-width: 180px;">
                        <div style="font-size: 14px; margin-bottom: 6px;">
                            <strong>${sanitizeHTML(driverName)}</strong>
                        </div>
                        <div style="font-size: 12px; line-height: 1.6;">
                            <div><span style="color: #64748b;">Driver ID:</span> ${sanitizeHTML(String(driverId))}</div>
                            <div><span style="color: #64748b;">Status:</span> ${getStatusIndicator(status)}</div>
                            <div><span style="color: #64748b;">Updated:</span> ${timeAgo}</div>
                            <div style="font-size: 10px; color: #94a3b8;">${sanitizeHTML(time)}</div>
                            <div><span style="color: #64748b;">Position:</span> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                        </div>
                    </div>
                `);
                markers.addLayer(marker);
            }
        }

        if (markers.getLayers().length > 0) {
            const bounds = markers.getBounds();
            map.fitBounds(bounds, { padding: [20, 20] });
            // Lock map bounds to prevent panning outside the markers area
            map.setMaxBounds(bounds.pad(0.1));
            map.setMinZoom(map.getZoom());
        }

    } catch (error) {
        console.error('Error updating map markers:', error);
    }
}

/**
 * Filter locations by status
 * @param {Array} locations - All driver locations
 * @param {string} filter - Filter key: 'all', 'online', 'recent', 'offline', 'stale', 'nodata'
 * @returns {Array} Filtered locations
 */
function filterLocationsByStatus(locations, filter) {
    if (filter === 'all') return locations;

    return locations.filter(loc => {
        const statusKey = getStatusFilterKey(loc.is_tracked_in_realtime, loc.last_updated);
        return statusKey === filter;
    });
}

/**
 * Set the current filter and refresh the map
 * @param {string} filter - Filter key
 */
export function setMapFilter(filter) {
    currentFilter = filter;

    // Update filter button active states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'var(--card-bg)';
            btn.style.color = 'var(--text-color)';
        }
    });

    // Update status card active states
    document.querySelectorAll('.status-card').forEach(card => {
        if (card.dataset.status === filter) {
            card.style.transform = 'scale(1.05)';
            card.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        } else {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = 'none';
        }
    });

    // Re-render markers with new filter
    refreshMarkersWithFilter();
}

/**
 * Refresh markers with current filter (without re-fetching data)
 */
function refreshMarkersWithFilter() {
    if (!markers) return;

    markers.clearLayers();

    const filteredLocations = filterLocationsByStatus(allDriverLocations, currentFilter);

    console.log(`Showing ${filteredLocations.length} of ${allDriverLocations.length} drivers (filter: ${currentFilter})`);

    // Create marker for each driver
    for (const loc of filteredLocations) {
        const lat = loc.lat;
        const lng = loc.lng;

        if (lat && lng) {
            const profile = loc.profile || {};
            const driverId = loc.driver_user_id || 'N/A';
            const driverName = profile.display_name || driverId;
            const time = loc.last_updated ? new Date(loc.last_updated).toLocaleString() : 'N/A';

            // Get driver status and appropriate marker icon
            const status = getDriverStatus(loc.is_tracked_in_realtime, loc.last_updated);
            const markerIcon = createCustomMarkerIcon(status.color, status.label);

            // Calculate time ago for display
            let timeAgo = 'N/A';
            if (loc.last_updated) {
                const now = Date.now();
                const lastUpdate = new Date(loc.last_updated).getTime();
                const diff = now - lastUpdate;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                if (days > 0) {
                    timeAgo = `${days}d ago`;
                } else if (hours > 0) {
                    timeAgo = `${hours}h ago`;
                } else if (minutes > 0) {
                    timeAgo = `${minutes}m ago`;
                } else {
                    timeAgo = 'Just now';
                }
            }

            const marker = L.marker([lat, lng], { icon: markerIcon }).bindPopup(`
                <div style="min-width: 180px;">
                    <div style="font-size: 14px; margin-bottom: 6px;">
                        <strong>${sanitizeHTML(driverName)}</strong>
                    </div>
                    <div style="font-size: 12px; line-height: 1.6;">
                        <div><span style="color: #64748b;">Driver ID:</span> ${sanitizeHTML(String(driverId))}</div>
                        <div><span style="color: #64748b;">Status:</span> ${getStatusIndicator(status)}</div>
                        <div><span style="color: #64748b;">Updated:</span> ${timeAgo}</div>
                        <div style="font-size: 10px; color: #94a3b8;">${sanitizeHTML(time)}</div>
                        <div><span style="color: #64748b;">Position:</span> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                    </div>
                </div>
            `);
            markers.addLayer(marker);
        }
    }

    if (markers.getLayers().length > 0) {
        const bounds = markers.getBounds();
        map.fitBounds(bounds, { padding: [20, 20] });
        // Lock map bounds to prevent panning outside the markers area
        map.setMaxBounds(bounds.pad(0.1));
        map.setMinZoom(map.getZoom());
    }
}

/**
 * Get the current filter
 * @returns {string} Current filter key
 */
export function getCurrentFilter() {
    return currentFilter;
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
        const bounds = playbackPath.getBounds();
        map.fitBounds(bounds, { padding: [20, 20] });
        // Lock map bounds to the playback path
        map.setMaxBounds(bounds.pad(0.1));
        map.setMinZoom(map.getZoom());

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
    // Clear maxBounds to allow map to be re-locked to driver markers
    map.setMaxBounds(null);
    map.setMinZoom(null);

    if (markers) {
        markers.clearLayers(); // Clear active job markers too for cleaner view
        updateMapMarkers(); // Re-add active job markers (will re-lock bounds)
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
