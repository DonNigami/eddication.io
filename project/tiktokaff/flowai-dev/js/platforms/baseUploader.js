/**
 * BaseUploader - Abstract Base Class for Multi-Platform Video Uploaders
 * 
 * This class provides common functionality for all platform uploaders.
 * Each platform-specific uploader should extend this class and implement
 * the abstract methods.
 * 
 * @abstract
 */
class BaseUploader {
    /**
     * @param {string} platformName - Name of the platform (e.g., 'tiktok', 'shopee')
     */
    constructor(platformName) {
        if (new.target === BaseUploader) {
            throw new Error('BaseUploader is an abstract class and cannot be instantiated directly');
        }

        this.platform = platformName;
        this.config = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the uploader with platform configuration
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        // Load platform config
        const PlatformConfig = (await import('./platformConfig.js')).default;
        this.config = PlatformConfig.get(this.platform);

        if (!this.config) {
            throw new Error(`Configuration not found for platform: ${this.platform}`);
        }

        this.isInitialized = true;
        console.log(`[${this.platform}] Uploader initialized`, this.config);
    }

    /**
     * Find and return the upload page tab
     * Must be implemented by child classes
     * 
     * @abstract
     * @returns {Promise<chrome.tabs.Tab>}
     * @throws {Error} If not implemented
     */
    async findUploadButton() {
        throw new Error(`findUploadButton() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Upload video file to the platform
     * Must be implemented by child classes
     * 
     * @abstract
     * @param {File} file - Video file to upload
     * @returns {Promise<Object>} Upload result
     * @throws {Error} If not implemented
     */
    async uploadVideo(file) {
        throw new Error(`uploadVideo() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Fill caption/description field
     * Must be implemented by child classes
     * 
     * @abstract
     * @param {string} caption - Caption text
     * @returns {Promise<Object>} Result
     * @throws {Error} If not implemented
     */
    async fillCaption(caption) {
        throw new Error(`fillCaption() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Add product to the post
     * Must be implemented by child classes
     * 
     * @abstract
     * @param {string} productId - Product ID or URL
     * @returns {Promise<Object>} Result
     * @throws {Error} If not implemented
     */
    async addProduct(productId) {
        throw new Error(`addProduct() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Schedule post for later (optional, not all platforms support)
     * 
     * @param {Date|string} scheduleTime - Time to schedule
     * @returns {Promise<Object>} Result
     */
    async schedulePost(scheduleTime) {
        console.warn(`[${this.platform}] schedulePost() not implemented, posting immediately`);
        return { success: true, message: 'Posted immediately (scheduling not supported)' };
    }

    /**
     * Convert File object to Base64 data URL
     * Common utility method
     * 
     * @param {File} file - File to convert
     * @returns {Promise<Object>} Object with dataUrl, name, type, size
     */
    async convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                resolve({
                    dataUrl: reader.result,
                    name: file.name,
                    type: file.type,
                    size: file.size
                });
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert Base64 data URL to File object
     * Common utility method
     * 
     * @param {string} dataUrl - Base64 data URL
     * @param {string} filename - Desired filename
     * @returns {Promise<File>} File object
     */
    async convertBase64ToFile(dataUrl, filename) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type });
    }

    /**
     * Send message to content script
     * Common utility method
     * 
     * @param {number} tabId - Tab ID
     * @param {Object} message - Message to send
     * @returns {Promise<any>} Response from content script
     */
    async sendMessage(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });
    }

    /**
     * Wait for element to appear in content script
     * Common utility method
     * 
     * @param {number} tabId - Tab ID
     * @param {string} selector - CSS selector
     * @param {number} timeout - Timeout in milliseconds (default: 10000)
     * @returns {Promise<boolean>} True if element found
     */
    async waitForElement(tabId, selector, timeout = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const result = await this.sendMessage(tabId, {
                    action: 'checkElement',
                    selector: selector
                });

                if (result && result.exists) {
                    return true;
                }
            } catch (error) {
                // Continue waiting
            }

            await this.delay(500);
        }

        throw new Error(`Element not found: ${selector} (timeout: ${timeout}ms)`);
    }

    /**
     * Delay/sleep utility
     * 
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get platform-specific video requirements
     * Should be overridden by child classes
     * 
     * @returns {Object} Video requirements
     */
    getVideoRequirements() {
        return {
            maxSize: 100 * 1024 * 1024, // 100MB default
            maxDuration: 60, // 60 seconds default
            formats: ['mp4', 'mov', 'avi'],
            aspectRatio: '9:16',
            minWidth: 720,
            minHeight: 1280
        };
    }

    /**
     * Validate video file against platform requirements
     * 
     * @param {File} file - Video file to validate
     * @returns {Object} Validation result { valid: boolean, errors: string[] }
     */
    async validateVideo(file) {
        const requirements = this.getVideoRequirements();
        const errors = [];

        // Check size
        if (file.size > requirements.maxSize) {
            const maxSizeMB = Math.round(requirements.maxSize / 1024 / 1024);
            const fileSizeMB = Math.round(file.size / 1024 / 1024);
            errors.push(`File size (${fileSizeMB}MB) exceeds maximum (${maxSizeMB}MB)`);
        }

        // Check format
        const extension = file.name.split('.').pop().toLowerCase();
        if (!requirements.formats.includes(extension)) {
            errors.push(`File format '${extension}' not supported. Supported: ${requirements.formats.join(', ')}`);
        }

        // Check MIME type
        if (!file.type.startsWith('video/')) {
            errors.push(`File type '${file.type}' is not a video`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get platform name
     * 
     * @returns {string}
     */
    getPlatformName() {
        return this.platform;
    }

    /**
     * Get platform configuration
     * 
     * @returns {Object}
     */
    getConfig() {
        return this.config;
    }

    /**
     * Check if uploader is initialized
     * 
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Log message with platform prefix
     * 
     * @param {string} level - Log level (log, warn, error)
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    log(level, message, ...args) {
        const prefix = `[${this.platform.toUpperCase()}]`;
        console[level](prefix, message, ...args);
    }
}

// Export for ES6 modules
export default BaseUploader;
