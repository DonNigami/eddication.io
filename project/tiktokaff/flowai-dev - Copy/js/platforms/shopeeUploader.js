/**
 * Shopee Uploader - Platform-specific Implementation
 * Extends BaseUploader for Shopee functionality
 */

import BaseUploader from './baseUploader.js';

class ShopeeUploader extends BaseUploader {
    constructor() {
        super('shopee');
    }

    /**
     * Find Shopee seller page tab
     * @returns {Promise<chrome.tabs.Tab>}
     */
    async findUploadButton() {
        await this.initialize();

        const tabs = await chrome.tabs.query({
            url: this.config.urlPatterns
        });

        if (tabs.length === 0) {
            // Try to open Shopee seller center
            const newTab = await chrome.tabs.create({
                url: this.config.uploadUrl,
                active: false
            });

            // Wait for page to load
            await this.delay(3000);

            this.log('log', 'Opened new Shopee seller tab');
            return newTab;
        }

        // Check if any tab is on video upload page
        const uploadTab = tabs.find(tab =>
            tab.url.includes('/video') ||
            tab.url.includes('seller.shopee')
        );

        if (uploadTab) {
            this.log('log', 'Found existing Shopee seller tab');
            return uploadTab;
        }

        // Navigate first Shopee tab to upload page
        await chrome.tabs.update(tabs[0].id, {
            url: this.config.uploadUrl
        });

        await this.delay(2000);

        this.log('log', 'Navigated to Shopee upload page');
        return tabs[0];
    }

    /**
     * Upload video to Shopee
     * @param {File} file - Video file
     * @returns {Promise<Object>}
     */
    async uploadVideo(file) {
        this.log('log', 'Starting video upload to Shopee...');

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
            action: 'uploadToShopee',
            files: [fileData]
        });

        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }

        this.log('log', 'Video uploaded successfully to Shopee');
        return result;
    }

    /**
     * Fill caption/title
     * @param {string} caption - Caption text
     * @returns {Promise<Object>}
     */
    async fillCaption(caption) {
        this.log('log', 'Filling caption...');

        // Check caption length
        if (caption.length > this.config.captionRequirements.maxLength) {
            this.log('warn', `Caption length (${caption.length}) exceeds Shopee maximum (${this.config.captionRequirements.maxLength})`);
            caption = caption.substring(0, this.config.captionRequirements.maxLength);
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'fillShopeeCaption',
            caption: caption
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to fill caption');
        }

        this.log('log', 'Caption filled successfully');
        return result;
    }

    /**
     * Add product to video
     * @param {string} productId - Product ID
     * @returns {Promise<Object>}
     */
    async addProduct(productId) {
        this.log('log', `Adding product: ${productId}`);

        if (!productId) {
            throw new Error('Product ID is required');
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'linkShopeeProduct',
            productId: productId
        });

        if (!result.success) {
            // Product linking may not be available - log warning but don't fail
            this.log('warn', 'Product linking may not be available:', result.error);
            return { success: true, message: 'Product linking skipped' };
        }

        this.log('log', 'Product added successfully');
        return result;
    }

    /**
     * Schedule post (Shopee may not support this)
     * @param {string|Date} scheduleTime - Schedule time
     * @returns {Promise<Object>}
     */
    async schedulePost(scheduleTime) {
        this.log('warn', 'Shopee does not support post scheduling');

        // Publish immediately instead
        return await this.publishVideo();
    }

    /**
     * Publish video immediately
     * @returns {Promise<Object>}
     */
    async publishVideo() {
        this.log('log', 'Publishing video...');

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'publishShopeeVideo'
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to publish video');
        }

        this.log('log', 'Video published successfully');
        return result;
    }

    /**
     * Get video requirements for Shopee
     * @returns {Object}
     */
    getVideoRequirements() {
        return this.config?.videoRequirements || {
            maxSize: 100 * 1024 * 1024, // 100MB
            maxDuration: 60, // 60 seconds
            minDuration: 1,
            formats: ['mp4', 'mov'],
            aspectRatio: '9:16',
            minWidth: 720,
            minHeight: 1280
        };
    }

    /**
     * Complete upload workflow
     * @param {Object} options - Upload options
     * @returns {Promise<Object>}
     */
    async uploadComplete(options) {
        const {
            file,
            caption = '',
            productId = ''
        } = options;

        this.log('log', 'Starting complete upload workflow for Shopee...');

        try {
            // 1. Upload video
            await this.uploadVideo(file);
            await this.delay(2000);

            // 2. Fill caption
            if (caption) {
                await this.fillCaption(caption);
                await this.delay(1000);
            }

            // 3. Add product (if available)
            if (productId) {
                try {
                    await this.addProduct(productId);
                    await this.delay(1500);
                } catch (error) {
                    this.log('warn', 'Product linking failed, continuing...', error);
                }
            }

            // 4. Publish video
            await this.publishVideo();
            await this.delay(1000);

            this.log('log', 'Complete upload workflow finished successfully');
            return {
                success: true,
                message: 'Video uploaded and published to Shopee successfully'
            };

        } catch (error) {
            this.log('error', 'Upload workflow failed:', error);
            throw error;
        }
    }

    /**
     * Batch upload multiple videos
     * @param {Array} uploads - Array of upload options
     * @param {string} mode - 'sequential' only (Shopee doesn't support parallel)
     * @returns {Promise<Array>}
     */
    async uploadBatch(uploads, mode = 'sequential') {
        this.log('log', `Starting batch upload to Shopee with ${uploads.length} videos...`);

        // Shopee only supports sequential upload
        if (mode !== 'sequential') {
            this.log('warn', 'Shopee only supports sequential upload mode');
        }

        const results = [];

        // Upload one by one
        for (let i = 0; i < uploads.length; i++) {
            try {
                this.log('log', `Uploading video ${i + 1}/${uploads.length} to Shopee...`);
                const result = await this.uploadComplete(uploads[i]);
                results.push({ index: i, success: true, result });

                // Delay between uploads (5-7 seconds)
                if (i < uploads.length - 1) {
                    const delay = 5000 + Math.random() * 2000;
                    this.log('log', `Waiting ${Math.round(delay / 1000)}s before next upload...`);
                    await this.delay(delay);
                }
            } catch (error) {
                this.log('error', `Upload ${i + 1} failed:`, error);
                results.push({ index: i, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        this.log('log', `Batch upload complete: ${successCount}/${uploads.length} successful`);

        return results;
    }

    /**
     * Check if current tab is on Shopee seller page
     * @param {number} tabId - Tab ID
     * @returns {Promise<boolean>}
     */
    async checkIfSellerPage(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            return tab.url && tab.url.includes('seller.shopee');
        } catch (error) {
            this.log('warn', 'Failed to check seller page:', error);
            return false;
        }
    }
}

// Export
export default ShopeeUploader;
