/**
 * Platform Uploader Initialization
 * 
 * This file initializes and registers all platform uploaders
 */

import PlatformRegistry from './platformRegistry.js';
import TikTokUploader from './tiktokUploader.js';
import ShopeeUploader from './shopeeUploader.js';
import FacebookUploader from './facebookUploader.js';
import YouTubeUploader from './youtubeUploader.js';

/**
 * Initialize all platform uploaders
 * Call this on extension startup
 */
async function initializePlatforms() {
    console.log('[Platform Init] Registering platform uploaders...');

    try {
        // Register TikTok uploader
        PlatformRegistry.register('tiktok', TikTokUploader);

        // Register Shopee uploader
        PlatformRegistry.register('shopee', ShopeeUploader);

        // Register Facebook uploader
        PlatformRegistry.register('facebook', FacebookUploader);

        // Register YouTube uploader
        PlatformRegistry.register('youtube', YouTubeUploader);

        // Initialize all registered uploaders
        const results = await PlatformRegistry.initializeAll();

        console.log('[Platform Init] Platform initialization complete:', results);

        if (results.failed.length > 0) {
            console.warn('[Platform Init] Some platforms failed to initialize:', results.failed);
        }

        return {
            success: true,
            initialized: results.success,
            failed: results.failed
        };

    } catch (error) {
        console.error('[Platform Init] Failed to initialize platforms:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get uploader for a specific platform
 * @param {string} platformName - Platform name
 * @returns {Promise<BaseUploader|null>}
 */
async function getUploader(platformName) {
    return await PlatformRegistry.getInitialized(platformName);
}

/**
 * Get all available platforms
 * @returns {string[]}
 */
function getAvailablePlatforms() {
    return PlatformRegistry.getAllPlatforms();
}

/**
 * Detect platform from current tab URL
 * @param {string} url - Tab URL
 * @returns {Promise<Object|null>}
 */
async function detectPlatform(url) {
    return await PlatformRegistry.detectPlatformFromUrl(url);
}

/**
 * Validate video for specific platforms
 * @param {File} file - Video file
 * @param {string[]} platforms - Platform names (optional)
 * @returns {Promise<Object>}
 */
async function validateVideo(file, platforms = null) {
    return await PlatformRegistry.validateVideoForPlatforms(file, platforms);
}

// Export functions
export {
    initializePlatforms,
    getUploader,
    getAvailablePlatforms,
    detectPlatform,
    validateVideo,
    PlatformRegistry
};

// Auto-initialize on module load
initializePlatforms().then(result => {
    if (result.success) {
        console.log('[Platform Init] ✅ All platforms ready');
    } else {
        console.error('[Platform Init] ❌ Initialization failed:', result.error);
    }
});
