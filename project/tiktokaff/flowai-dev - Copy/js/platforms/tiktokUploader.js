/**
 * TikTok Uploader - Platform-specific Implementation
 * Extends BaseUploader for TikTok functionality
 */

import BaseUploader from './baseUploader.js';

class TikTokUploader extends BaseUploader {
    constructor() {
        super('tiktok');
    }

    /**
     * Find TikTok upload page tab
     * @returns {Promise<chrome.tabs.Tab>}
     */
    async findUploadButton() {
        await this.initialize();

        const tabs = await chrome.tabs.query({
            url: this.config.urlPatterns
        });

        if (tabs.length === 0) {
            // Try to open upload page
            const newTab = await chrome.tabs.create({
                url: this.config.uploadUrl,
                active: false
            });

            // Wait for page to load
            await this.delay(3000);

            return newTab;
        }

        // Check if any tab is on upload page
        const uploadTab = tabs.find(tab =>
            tab.url.includes('/upload') ||
            tab.url.includes('/creator-center/upload')
        );

        if (uploadTab) {
            return uploadTab;
        }

        // Navigate first TikTok tab to upload page
        await chrome.tabs.update(tabs[0].id, {
            url: this.config.uploadUrl
        });

        await this.delay(2000);

        return tabs[0];
    }

    /**
     * Upload video to TikTok
     * @param {File} file - Video file
     * @returns {Promise<Object>}
     */
    async uploadVideo(file) {
        this.log('log', 'Starting video upload...');

        // Validate video
        const validation = await this.validateVideo(file);
        if (!validation.valid) {
            throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
        }

        // Get upload tab
        const tab = await this.findUploadButton();

        // Convert file to base64
        const fileData = await this.convertToBase64(file);

        // Send to content script
        const result = await this.sendMessage(tab.id, {
            action: 'uploadToTikTok',
            files: [fileData]
        });

        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }

        this.log('log', 'Video uploaded successfully');
        return result;
    }

    /**
     * Fill caption/description
     * @param {string} caption - Caption text
     * @returns {Promise<Object>}
     */
    async fillCaption(caption) {
        this.log('log', 'Filling caption...');

        // Check caption length
        if (caption.length > this.config.captionRequirements.maxLength) {
            this.log('warn', `Caption length (${caption.length}) exceeds maximum (${this.config.captionRequirements.maxLength})`);
            caption = caption.substring(0, this.config.captionRequirements.maxLength);
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'fillCaption',
            caption: caption
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to fill caption');
        }

        this.log('log', 'Caption filled successfully');
        return result;
    }

    /**
     * Add product (Pin Cart)
     * @param {string} productId - Product ID
     * @param {string} cartName - Cart name (optional)
     * @returns {Promise<Object>}
     */
    async addProduct(productId, cartName = '') {
        this.log('log', `Adding product: ${productId}`);

        if (!productId) {
            throw new Error('Product ID is required');
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'pinCart',
            productId: productId,
            cartName: cartName
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to pin cart');
        }

        this.log('log', 'Product pinned successfully');
        return result;
    }

    /**
     * Schedule post
     * @param {string|Date} scheduleTime - Schedule time
     * @param {string} postInterval - Post interval (for multiple posts)
     * @returns {Promise<Object>}
     */
    async schedulePost(scheduleTime, postInterval = '0') {
        this.log('log', `Scheduling post for: ${scheduleTime}`);

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'schedulePost',
            scheduleTime: scheduleTime,
            postInterval: postInterval
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to schedule post');
        }

        this.log('log', 'Post scheduled successfully');
        return result;
    }

    /**
     * Scan products from TikTok Shop
     * @returns {Promise<Object>}
     */
    async scanProducts() {
        this.log('log', 'Scanning products...');

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'scanProducts'
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to scan products');
        }

        this.log('log', `Found ${result.products?.length || 0} products`);
        return result;
    }

    /**
     * Get products for warehouse mode
     * @returns {Promise<Object>}
     */
    async getProductsForWarehouse() {
        this.log('log', 'Getting products for warehouse...');

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'getProductsForWarehouse'
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to get products');
        }

        return result;
    }

    /**
     * Check if current tab is on upload page
     * @param {number} tabId - Tab ID
     * @returns {Promise<boolean>}
     */
    async checkIfUploadPage(tabId) {
        try {
            const result = await this.sendMessage(tabId, {
                action: 'checkUploadPage'
            });
            return result.isUploadPage || false;
        } catch (error) {
            this.log('warn', 'Failed to check upload page:', error);
            return false;
        }
    }

    /**
     * Reset schedule index
     * @returns {Promise<Object>}
     */
    async resetScheduleIndex() {
        this.log('log', 'Resetting schedule index...');

        try {
            const tab = await this.findUploadButton();

            const result = await this.sendMessage(tab.id, {
                action: 'resetScheduleIndex'
            });

            return result;
        } catch (error) {
            this.log('warn', 'Failed to reset schedule index:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get video requirements for TikTok
     * @returns {Object}
     */
    getVideoRequirements() {
        return this.config?.videoRequirements || {
            maxSize: 2 * 1024 * 1024 * 1024, // 2GB
            maxDuration: 600, // 10 minutes
            minDuration: 3,
            formats: ['mp4', 'mov', 'webm'],
            aspectRatio: '9:16',
            minWidth: 720,
            minHeight: 1280
        };
    }

    /**
     * Complete upload workflow (upload + caption + product + schedule)
     * @param {Object} options - Upload options
     * @returns {Promise<Object>}
     */
    async uploadComplete(options) {
        const {
            file,
            caption = '',
            productId = '',
            cartName = '',
            scheduleTime = '',
            postInterval = '0'
        } = options;

        this.log('log', 'Starting complete upload workflow...');

        try {
            // 1. Upload video
            await this.uploadVideo(file);
            await this.delay(2000);

            // 2. Fill caption
            if (caption) {
                await this.fillCaption(caption);
                await this.delay(1000);
            }

            // 3. Add product
            if (productId) {
                await this.addProduct(productId, cartName);
                await this.delay(1500);
            }

            // 4. Schedule post
            if (scheduleTime) {
                await this.schedulePost(scheduleTime, postInterval);
                await this.delay(1000);
            }

            this.log('log', 'Complete upload workflow finished successfully');
            return {
                success: true,
                message: 'Upload completed successfully'
            };

        } catch (error) {
            this.log('error', 'Upload workflow failed:', error);
            throw error;
        }
    }

    /**
     * Batch upload multiple videos
     * @param {Array} uploads - Array of upload options
     * @param {string} mode - 'sequential' or 'parallel'
     * @returns {Promise<Array>}
     */
    async uploadBatch(uploads, mode = 'sequential') {
        this.log('log', `Starting batch upload (${mode} mode) with ${uploads.length} videos...`);

        const results = [];

        if (mode === 'sequential') {
            // Upload one by one
            for (let i = 0; i < uploads.length; i++) {
                try {
                    this.log('log', `Uploading video ${i + 1}/${uploads.length}...`);
                    const result = await this.uploadComplete(uploads[i]);
                    results.push({ index: i, success: true, result });

                    // Delay between uploads (3-5 seconds)
                    if (i < uploads.length - 1) {
                        await this.delay(3000 + Math.random() * 2000);
                    }
                } catch (error) {
                    this.log('error', `Upload ${i + 1} failed:`, error);
                    results.push({ index: i, success: false, error: error.message });
                }
            }
        } else {
            // Upload in parallel (not recommended for TikTok - may cause rate limiting)
            this.log('warn', 'Parallel upload mode is not recommended for TikTok');
            const promises = uploads.map((options, index) =>
                this.uploadComplete(options)
                    .then(result => ({ index, success: true, result }))
                    .catch(error => ({ index, success: false, error: error.message }))
            );
            const settled = await Promise.allSettled(promises);
            results.push(...settled.map(s => s.value || { success: false, error: 'Unknown error' }));
        }

        const successCount = results.filter(r => r.success).length;
        this.log('log', `Batch upload complete: ${successCount}/${uploads.length} successful`);

        return results;
    }
}

// Export
export default TikTokUploader;
