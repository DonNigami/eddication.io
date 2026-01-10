/**
 * Platform Registry
 * 
 * Centralized registry for all platform uploaders.
 * Manages registration, initialization, and access to platform uploaders.
 */

class PlatformRegistry {
    constructor() {
        this.uploaders = new Map();
        this.initialized = false;
    }

    /**
     * Register a platform uploader
     * 
     * @param {string} platformName - Platform name (e.g., 'tiktok', 'shopee')
     * @param {Class} UploaderClass - Uploader class (must extend BaseUploader)
     */
    register(platformName, UploaderClass) {
        if (!platformName) {
            throw new Error('Platform name is required');
        }

        if (!UploaderClass) {
            throw new Error('Uploader class is required');
        }

        // Validate that it's a class
        if (typeof UploaderClass !== 'function') {
            throw new Error('UploaderClass must be a class/constructor function');
        }

        if (this.uploaders.has(platformName)) {
            console.warn(`[PlatformRegistry] Overwriting existing uploader for: ${platformName}`);
        }

        this.uploaders.set(platformName, UploaderClass);
        console.log(`[PlatformRegistry] Registered uploader for: ${platformName}`);
    }

    /**
     * Unregister a platform uploader
     * 
     * @param {string} platformName - Platform name
     * @returns {boolean} True if unregistered, false if not found
     */
    unregister(platformName) {
        if (this.uploaders.has(platformName)) {
            this.uploaders.delete(platformName);
            console.log(`[PlatformRegistry] Unregistered uploader for: ${platformName}`);
            return true;
        }
        return false;
    }

    /**
     * Get uploader instance for a platform
     * 
     * @param {string} platformName - Platform name
     * @returns {BaseUploader|null} Uploader instance or null if not found
     */
    get(platformName) {
        if (!this.uploaders.has(platformName)) {
            console.error(`[PlatformRegistry] Uploader not found for platform: ${platformName}`);
            return null;
        }

        const UploaderClass = this.uploaders.get(platformName);

        try {
            const instance = new UploaderClass();
            return instance;
        } catch (error) {
            console.error(`[PlatformRegistry] Failed to instantiate uploader for ${platformName}:`, error);
            return null;
        }
    }

    /**
     * Get uploader instance and initialize it
     * 
     * @param {string} platformName - Platform name
     * @returns {Promise<BaseUploader|null>} Initialized uploader instance
     */
    async getInitialized(platformName) {
        const uploader = this.get(platformName);
        if (!uploader) {
            return null;
        }

        try {
            await uploader.initialize();
            return uploader;
        } catch (error) {
            console.error(`[PlatformRegistry] Failed to initialize uploader for ${platformName}:`, error);
            return null;
        }
    }

    /**
     * Check if platform is registered
     * 
     * @param {string} platformName - Platform name
     * @returns {boolean}
     */
    has(platformName) {
        return this.uploaders.has(platformName);
    }

    /**
     * Get all registered platform names
     * 
     * @returns {string[]} Array of platform names
     */
    getAllPlatforms() {
        return Array.from(this.uploaders.keys());
    }

    /**
     * Get count of registered platforms
     * 
     * @returns {number}
     */
    count() {
        return this.uploaders.size;
    }

    /**
     * Check if any platforms are registered
     * 
     * @returns {boolean}
     */
    isEmpty() {
        return this.uploaders.size === 0;
    }

    /**
     * Clear all registered uploaders
     */
    clear() {
        this.uploaders.clear();
        console.log('[PlatformRegistry] Cleared all uploaders');
    }

    /**
     * Initialize all registered uploaders
     * 
     * @returns {Promise<Object>} Results { success: string[], failed: string[] }
     */
    async initializeAll() {
        const results = {
            success: [],
            failed: []
        };

        for (const platformName of this.getAllPlatforms()) {
            try {
                const uploader = await this.getInitialized(platformName);
                if (uploader) {
                    results.success.push(platformName);
                } else {
                    results.failed.push(platformName);
                }
            } catch (error) {
                console.error(`[PlatformRegistry] Failed to initialize ${platformName}:`, error);
                results.failed.push(platformName);
            }
        }

        this.initialized = true;
        console.log('[PlatformRegistry] Initialization complete:', results);
        return results;
    }

    /**
     * Register multiple platforms at once
     * 
     * @param {Object} platformMap - Map of platform names to uploader classes
     * @example
     * registry.registerMultiple({
     *   tiktok: TikTokUploader,
     *   shopee: ShopeeUploader
     * })
     */
    registerMultiple(platformMap) {
        if (typeof platformMap !== 'object' || platformMap === null) {
            throw new Error('platformMap must be an object');
        }

        let registered = 0;
        let failed = 0;

        for (const [platformName, UploaderClass] of Object.entries(platformMap)) {
            try {
                this.register(platformName, UploaderClass);
                registered++;
            } catch (error) {
                console.error(`[PlatformRegistry] Failed to register ${platformName}:`, error);
                failed++;
            }
        }

        console.log(`[PlatformRegistry] Bulk registration complete: ${registered} succeeded, ${failed} failed`);
    }

    /**
     * Get info about all registered platforms
     * 
     * @returns {Array<Object>} Array of platform info objects
     */
    async getAllInfo() {
        const info = [];

        for (const platformName of this.getAllPlatforms()) {
            try {
                const uploader = await this.getInitialized(platformName);
                if (uploader) {
                    info.push({
                        name: platformName,
                        displayName: uploader.config?.displayName || platformName,
                        features: uploader.config?.features || {},
                        requirements: uploader.getVideoRequirements(),
                        initialized: uploader.isReady()
                    });
                }
            } catch (error) {
                console.error(`[PlatformRegistry] Failed to get info for ${platformName}:`, error);
            }
        }

        return info;
    }

    /**
     * Detect platform from current tab URL and return uploader
     * 
     * @param {string} url - Current tab URL
     * @returns {Promise<Object|null>} { platform: string, uploader: BaseUploader } or null
     */
    async detectPlatformFromUrl(url) {
        if (!url) {
            console.warn('[PlatformRegistry] No URL provided');
            return null;
        }

        // Import PlatformConfig
        const PlatformConfig = (await import('./platformConfig.js')).default;

        // Try to detect platform
        const platformName = PlatformConfig.detectPlatform(url);

        if (!platformName) {
            console.log('[PlatformRegistry] No platform detected for URL:', url);
            return null;
        }

        // Get uploader
        const uploader = await this.getInitialized(platformName);

        if (!uploader) {
            console.error(`[PlatformRegistry] Platform detected (${platformName}) but uploader not available`);
            return null;
        }

        return {
            platform: platformName,
            uploader: uploader
        };
    }

    /**
     * Get platforms that support a specific feature
     * 
     * @param {string} feature - Feature name (e.g., 'schedulePost')
     * @returns {Promise<string[]>} Array of platform names
     */
    async getPlatformsWithFeature(feature) {
        const platforms = [];

        for (const platformName of this.getAllPlatforms()) {
            try {
                const uploader = await this.getInitialized(platformName);
                if (uploader && uploader.config?.features?.[feature]) {
                    platforms.push(platformName);
                }
            } catch (error) {
                console.error(`[PlatformRegistry] Error checking feature for ${platformName}:`, error);
            }
        }

        return platforms;
    }

    /**
     * Validate video against all or specific platforms
     * 
     * @param {File} file - Video file
     * @param {string[]} platforms - Platform names (optional, validates against all if not provided)
     * @returns {Promise<Object>} Validation results { platform: { valid, errors } }
     */
    async validateVideoForPlatforms(file, platforms = null) {
        const targetPlatforms = platforms || this.getAllPlatforms();
        const results = {};

        for (const platformName of targetPlatforms) {
            try {
                const uploader = await this.getInitialized(platformName);
                if (uploader) {
                    results[platformName] = await uploader.validateVideo(file);
                }
            } catch (error) {
                results[platformName] = {
                    valid: false,
                    errors: [`Validation failed: ${error.message}`]
                };
            }
        }

        return results;
    }
}

// Create singleton instance
const registryInstance = new PlatformRegistry();

// Export singleton instance as default
export default registryInstance;

// Also export class for testing or creating custom instances
export { PlatformRegistry };
