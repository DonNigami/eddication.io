/**
 * Facebook Uploader - Platform-specific Implementation
 * Extends BaseUploader for Facebook Reels functionality
 */

import BaseUploader from './baseUploader.js';

class FacebookUploader extends BaseUploader {
    constructor() {
        super('facebook');
    }

    /**
     * Find Facebook tab
     * @returns {Promise<chrome.tabs.Tab>}
     */
    async findUploadButton() {
        await this.initialize();

        const tabs = await chrome.tabs.query({
            url: this.config.urlPatterns
        });

        if (tabs.length === 0) {
            // Open Facebook Reels create page
            const newTab = await chrome.tabs.create({
                url: this.config.uploadUrl,
                active: false
            });

            // Wait for page to load
            await this.delay(3000);

            this.log('log', 'Opened new Facebook tab');
            return newTab;
        }

        // Check if any tab is on create page
        const createTab = tabs.find(tab =>
            tab.url.includes('/reel/create') ||
            tab.url.includes('/composer')
        );

        if (createTab) {
            this.log('log', 'Found existing Facebook create tab');
            return createTab;
        }

        // Use first Facebook tab and navigate to create page
        await chrome.tabs.update(tabs[0].id, {
            url: this.config.uploadUrl
        });

        await this.delay(2000);

        this.log('log', 'Navigated to Facebook create page');
        return tabs[0];
    }

    /**
     * Upload video to Facebook Reels
     * @param {File} file - Video file
     * @returns {Promise<Object>}
     */
    async uploadVideo(file) {
        this.log('log', 'Starting video upload to Facebook Reels...');

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
            action: 'uploadToFacebook',
            files: [fileData]
        });

        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }

        this.log('log', 'Video uploaded successfully to Facebook');
        return result;
    }

    /**
     * Fill caption (contenteditable div)
     * @param {string} caption - Caption text
     * @returns {Promise<Object>}
     */
    async fillCaption(caption) {
        this.log('log', 'Filling caption...');

        // Check caption length
        if (caption.length > this.config.captionRequirements.maxLength) {
            this.log('warn', `Caption length (${caption.length}) exceeds Facebook maximum (${this.config.captionRequirements.maxLength})`);
            caption = caption.substring(0, this.config.captionRequirements.maxLength);
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'fillFacebookCaption',
            caption: caption
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to fill caption');
        }

        this.log('log', 'Caption filled successfully');
        return result;
    }

    /**
     * Add product/tag (Facebook Shop integration)
     * @param {string} productUrl - Product URL or ID
     * @returns {Promise<Object>}
     */
    async addProduct(productUrl) {
        this.log('log', `Tagging product: ${productUrl}`);

        if (!productUrl) {
            throw new Error('Product URL is required');
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'tagFacebookProduct',
            productUrl: productUrl
        });

        if (!result.success) {
            // Product tagging is complex - log warning but don't fail
            this.log('warn', 'Product tagging may require manual setup:', result.error);
            return { success: true, message: 'Product tagging skipped (may require Facebook Shop)' };
        }

        this.log('log', 'Product tagged successfully');
        return result;
    }

    /**
     * Set privacy/audience
     * @param {string} privacy - Privacy level ('Public', 'Friends', 'Only me')
     * @returns {Promise<Object>}
     */
    async setPrivacy(privacy = 'Public') {
        this.log('log', `Setting privacy to: ${privacy}`);

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'setFacebookPrivacy',
            privacy: privacy
        });

        if (!result.success) {
            this.log('warn', 'Failed to set privacy:', result.error);
        }

        return result;
    }

    /**
     * Schedule post
     * @param {string|Date} scheduleTime - Schedule time
     * @returns {Promise<Object>}
     */
    async schedulePost(scheduleTime) {
        this.log('log', `Scheduling post for: ${scheduleTime}`);

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'scheduleFacebookPost',
            scheduleTime: scheduleTime
        });

        if (!result.success) {
            // Scheduling may not be available for Reels
            this.log('warn', 'Scheduling may not be available for Reels:', result.error);
            return await this.publishReel();
        }

        this.log('log', 'Post scheduled successfully');
        return result;
    }

    /**
     * Publish reel immediately
     * @returns {Promise<Object>}
     */
    async publishReel() {
        this.log('log', 'Publishing reel...');

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'publishFacebookReel'
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to publish reel');
        }

        this.log('log', 'Reel published successfully');
        return result;
    }

    /**
     * Get video requirements for Facebook Reels
     * @returns {Object}
     */
    getVideoRequirements() {
        return this.config?.videoRequirements || {
            maxSize: 4 * 1024 * 1024 * 1024, // 4GB
            maxDuration: 90, // 90 seconds for Reels
            minDuration: 3,
            formats: ['mp4', 'mov'],
            aspectRatio: '9:16',
            minWidth: 540,
            minHeight: 960
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
            productUrl = '',
            privacy = 'Public',
            scheduleTime = ''
        } = options;

        this.log('log', 'Starting complete upload workflow for Facebook Reels...');

        try {
            // 1. Upload video
            await this.uploadVideo(file);
            await this.delay(2000);

            // 2. Fill caption
            if (caption) {
                await this.fillCaption(caption);
                await this.delay(1000);
            }

            // 3. Set privacy
            if (privacy && privacy !== 'Public') {
                try {
                    await this.setPrivacy(privacy);
                    await this.delay(1000);
                } catch (error) {
                    this.log('warn', 'Privacy setting failed, continuing...', error);
                }
            }

            // 4. Tag product (optional)
            if (productUrl) {
                try {
                    await this.addProduct(productUrl);
                    await this.delay(1500);
                } catch (error) {
                    this.log('warn', 'Product tagging failed, continuing...', error);
                }
            }

            // 5. Schedule or publish
            if (scheduleTime) {
                await this.schedulePost(scheduleTime);
            } else {
                await this.publishReel();
            }

            await this.delay(1000);

            this.log('log', 'Complete upload workflow finished successfully');
            return {
                success: true,
                message: 'Reel uploaded and published to Facebook successfully'
            };

        } catch (error) {
            this.log('error', 'Upload workflow failed:', error);
            throw error;
        }
    }

    /**
     * Batch upload multiple videos
     * @param {Array} uploads - Array of upload options
     * @param {string} mode - 'sequential' only (Facebook limits)
     * @returns {Promise<Array>}
     */
    async uploadBatch(uploads, mode = 'sequential') {
        this.log('log', `Starting batch upload to Facebook with ${uploads.length} videos...`);

        // Facebook enforces rate limits
        if (mode !== 'sequential') {
            this.log('warn', 'Facebook only supports sequential upload mode');
        }

        const results = [];

        // Upload one by one
        for (let i = 0; i < uploads.length; i++) {
            try {
                this.log('log', `Uploading video ${i + 1}/${uploads.length} to Facebook...`);
                const result = await this.uploadComplete(uploads[i]);
                results.push({ index: i, success: true, result });

                // Longer delay for Facebook (10-15 seconds)
                if (i < uploads.length - 1) {
                    const delay = 10000 + Math.random() * 5000;
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
     * Check if current tab is on Facebook
     * @param {number} tabId - Tab ID
     * @returns {Promise<boolean>}
     */
    async checkIfFacebookPage(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            return tab.url && tab.url.includes('facebook.com');
        } catch (error) {
            this.log('warn', 'Failed to check Facebook page:', error);
            return false;
        }
    }
}

// Export
export default FacebookUploader;
