/**
 * DriverConnect Admin Panel - Main Entry Point
 * This file refactored from original monolithic admin.js
 * Now imports modularized code from js/ directory
 *
 * Original file backed up as admin.old.js
 */

console.log('🚀 DriverConnect Admin Panel v2.0 (Modular)');

// Import configuration and shared Supabase client
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, LIFF_IDS } from '../shared/config.js';

// Supabase & LIFF Configuration
const LIFF_ID = LIFF_IDS.ADMIN;

// Export supabase and LIFF_ID for use in other modules
export { supabase, LIFF_ID };

// Import main app initialization
import {
    initializeApp,
    showAdminPanel,
    showAccessDenied,
    navigateTo,
    getLiff
} from './js/main.js';

// Import auto-refresh
import { initAutoRefresh } from './js/auto-refresh.js';

// Import registration approval
import { loadRegistrations as loadRegistrationApprovals } from './js/registration-approval.js';

// Global state (for backwards compatibility)
let holidayWorkRealtimeChannel = null;
let jobActivityRealtimeChannel = null;

// Global state for map playback (kept for potential direct access)
let map;
let markers;
let mapCenterLat = 13.736717;
let mapCenterLng = 100.523186;
let mapZoom = 10;
let playbackPath = null;
let playbackMarker = null;
let playbackData = [];
let playbackIndex = 0;
let playbackInterval = null;

// Export globals for potential external access
export {
    holidayWorkRealtimeChannel,
    jobActivityRealtimeChannel,
    map,
    markers,
    mapCenterLat,
    mapCenterLng,
    mapZoom,
    playbackPath,
    playbackMarker,
    playbackData,
    playbackIndex,
    playbackInterval
};

// DOM Elements (for backwards compatibility with inline scripts)
const authContainer = document.getElementById('auth-container');
const authStatus = document.getElementById('auth-status');
const adminContainer = document.getElementById('admin-container');
const adminUsername = document.getElementById('admin-username');
const logoutButton = document.getElementById('logout-button');
const navLinks = document.querySelectorAll('.nav-link');

/**
 * Initialize LIFF and authenticate user
 */
async function initializeLIFF() {
    try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        const profile = await liff.getProfile();

        // Check if user is admin
        const { data: userProfile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', profile.userId)
            .single();

        if (error || !userProfile) {
            console.error('Error fetching user profile:', error);
            showAccessDenied();
            return;
        }

        if (userProfile.user_type !== 'ADMIN' && userProfile.status !== 'APPROVED') {
            console.warn('User is not an approved admin:', userProfile);
            showAccessDenied();
            return;
        }

        // Show admin panel
        await showAdminPanel(profile, liff);

    } catch (error) {
        console.error('LIFF initialization error:', error);
        if (authStatus) {
            authStatus.textContent = '❌ เกิดข้อผิดพลาดในการเชื่อมต่อ LIFF';
            authStatus.style.color = 'red';
        }
    }
}

/**
 * Setup navigation handlers
 */
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;
            if (targetId) {
                navigateTo(targetId);
            }
        });
    });
}

/**
 * Load section data based on active section
 */
async function loadSectionData(targetId) {
    const { loadSectionData } = await import('./js/main.js');
    await loadSectionData(targetId);

    // Load registration approvals if needed
    if (targetId === 'registration-approval') {
        await loadRegistrationApprovals();
    }
}

// DOM Content Loaded handler
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM Content Loaded');

    // Initialize app
    await initializeApp();

    // Initialize LIFF
    await initializeLIFF();

    // Setup navigation
    setupNavigation();

    // Initialize auto-refresh (5 minutes)
    initAutoRefresh();

    console.log('✅ DriverConnect Admin Panel initialized');
});

// Export functions for external access (if needed)
export {
    initializeLIFF,
    setupNavigation,
    loadSectionData,
    loadRegistrationApprovals
};
