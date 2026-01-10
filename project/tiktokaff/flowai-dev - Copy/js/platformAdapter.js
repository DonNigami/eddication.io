/**
 * Platform Uploader Adapter
 * 
 * This adapter bridges the old UI-based TikTokUploader object
 * with the new class-based platform uploader architecture.
 * 
 * It allows the existing UI code to work without major changes
 * while using the new BaseUploader system under the hood.
 */

import { getUploader, PlatformRegistry } from './platforms/index.js';

const PlatformAdapter = {
    /**
     * Current platform uploader instance
     */
    currentUploader: null,
    currentPlatform: 'tiktok', // Default to TikTok

    /**
     * Initialize adapter with a platform
     */
    async init(platformName = 'tiktok') {
        console.log(`[PlatformAdapter] Initializing for platform: ${platformName}`);

        try {
            this.currentPlatform = platformName;
            this.currentUploader = await getUploader(platformName);

            if (!this.currentUploader) {
                throw new Error(`Failed to get uploader for platform: ${platformName}`);
            }

            console.log(`[PlatformAdapter] ✅ Initialized for ${platformName}`);
            return true;
        } catch (error) {
            console.error('[PlatformAdapter] Initialization failed:', error);
            return false;
        }
    },

    /**
     * Switch to a different platform
     */
    async switchPlatform(platformName) {
        return await this.init(platformName);
    },

    /**
     * Get current platform name
     */
    getCurrentPlatform() {
        return this.currentPlatform;
    },

    /**
     * Check if adapter is ready
     */
    isReady() {
        return this.currentUploader !== null && this.currentUploader.isReady();
    },

    /**
     * Upload video
     */
    async uploadVideo(file) {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }
        return await this.currentUploader.uploadVideo(file);
    },

    /**
     * Fill caption
     */
    async fillCaption(caption) {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }
        return await this.currentUploader.fillCaption(caption);
    },

    /**
     * Add product
     */
    async addProduct(productId, cartName = '') {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }
        return await this.currentUploader.addProduct(productId, cartName);
    },

    /**
     * Schedule post
     */
    async schedulePost(scheduleTime, postInterval = '0') {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }
        return await this.currentUploader.schedulePost(scheduleTime, postInterval);
    },

    /**
     * Complete upload workflow
     */
    async uploadComplete(options) {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }

        // TikTok uploader has this method
        if (typeof this.currentUploader.uploadComplete === 'function') {
            return await this.currentUploader.uploadComplete(options);
        }

        // Fallback: execute steps manually
        const {
            file,
            caption = '',
            productId = '',
            cartName = '',
            scheduleTime = '',
            postInterval = '0'
        } = options;

        await this.uploadVideo(file);
        await this.delay(2000);

        if (caption) {
            await this.fillCaption(caption);
            await this.delay(1000);
        }

        if (productId) {
            await this.addProduct(productId, cartName);
            await this.delay(1500);
        }

        if (scheduleTime) {
            await this.schedulePost(scheduleTime, postInterval);
            await this.delay(1000);
        }

        return { success: true, message: 'Upload completed' };
    },

    /**
     * Batch upload
     */
    async uploadBatch(uploads, mode = 'sequential') {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }

        // TikTok uploader has this method
        if (typeof this.currentUploader.uploadBatch === 'function') {
            return await this.currentUploader.uploadBatch(uploads, mode);
        }

        // Fallback: execute sequentially
        const results = [];
        for (let i = 0; i < uploads.length; i++) {
            try {
                const result = await this.uploadComplete(uploads[i]);
                results.push({ index: i, success: true, result });
                if (i < uploads.length - 1) {
                    await this.delay(3000);
                }
            } catch (error) {
                results.push({ index: i, success: false, error: error.message });
            }
        }
        return results;
    },

    /**
     * Validate video
     */
    async validateVideo(file) {
        if (!this.isReady()) {
            throw new Error('Platform adapter not initialized');
        }
        return await this.currentUploader.validateVideo(file);
    },

    /**
     * Get video requirements
     */
    getVideoRequirements() {
        if (!this.currentUploader) {
            return null;
        }
        return this.currentUploader.getVideoRequirements();
    },

    /**
     * Get platform config
     */
    getConfig() {
        if (!this.currentUploader) {
            return null;
        }
        return this.currentUploader.getConfig();
    },

    /**
     * Platform-specific methods (proxied to uploader)
     */

    // TikTok-specific
    async scanProducts() {
        if (this.currentPlatform !== 'tiktok') {
            throw new Error('scanProducts is only available for TikTok');
        }
        if (typeof this.currentUploader.scanProducts === 'function') {
            return await this.currentUploader.scanProducts();
        }
        throw new Error('scanProducts not implemented');
    },

    async getProductsForWarehouse() {
        if (this.currentPlatform !== 'tiktok') {
            throw new Error('getProductsForWarehouse is only available for TikTok');
        }
        if (typeof this.currentUploader.getProductsForWarehouse === 'function') {
            return await this.currentUploader.getProductsForWarehouse();
        }
        throw new Error('getProductsForWarehouse not implemented');
    },

    async checkIfUploadPage(tabId) {
        if (this.currentPlatform !== 'tiktok') {
            return false;
        }
        if (typeof this.currentUploader.checkIfUploadPage === 'function') {
            return await this.currentUploader.checkIfUploadPage(tabId);
        }
        return false;
    },

    async resetScheduleIndex() {
        if (this.currentPlatform !== 'tiktok') {
            return { success: false, message: 'Not supported' };
        }
        if (typeof this.currentUploader.resetScheduleIndex === 'function') {
            return await this.currentUploader.resetScheduleIndex();
        }
        return { success: false, message: 'Not implemented' };
    },

    /**
     * Helper: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Get all available platforms
     */
    getAvailablePlatforms() {
        return PlatformRegistry.getAllPlatforms();
    },

    /**
     * Get platform info
     */
    async getPlatformInfo(platformName = null) {
        if (platformName) {
            const uploader = await getUploader(platformName);
            if (!uploader) return null;
            return {
                name: platformName,
                config: uploader.getConfig(),
                requirements: uploader.getVideoRequirements()
            };
        }

        // Get all platforms info
        return await PlatformRegistry.getAllInfo();
    },

    /**
     * Detect platform from URL
     */
    async detectPlatformFromUrl(url) {
        return await PlatformRegistry.detectPlatformFromUrl(url);
    }
};

// Auto-initialize with TikTok
PlatformAdapter.init('tiktok').then(success => {
    if (success) {
        console.log('[PlatformAdapter] ✅ Ready to use');

        // Make globally available for existing UI code
        window.PlatformAdapter = PlatformAdapter;
    } else {
        console.error('[PlatformAdapter] ❌ Failed to initialize');
    }
});

// Export
export default PlatformAdapter;
