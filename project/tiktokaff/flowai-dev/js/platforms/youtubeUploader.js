/**
 * YouTube Uploader - Platform-specific Implementation
 * Extends BaseUploader for YouTube Shorts functionality
 */

import BaseUploader from './baseUploader.js';

class YouTubeUploader extends BaseUploader {
    constructor() {
        super('youtube');
    }

    /**
     * Find YouTube Studio tab
     * @returns {Promise<chrome.tabs.Tab>}
     */
    async findUploadButton() {
        await this.initialize();

        const tabs = await chrome.tabs.query({
            url: this.config.urlPatterns
        });

        if (tabs.length === 0) {
            const newTab = await chrome.tabs.create({
                url: this.config.uploadUrl,
                active: false
            });

            await this.delay(3000);

            this.log('log', 'Opened new YouTube Studio tab');
            return newTab;
        }

        const uploadTab = tabs.find(tab =>
            tab.url.includes('/upload') ||
            tab.url.includes('studio.youtube.com')
        );

        if (uploadTab) {
            this.log('log', 'Found existing YouTube Studio tab');
            return uploadTab;
        }

        await chrome.tabs.update(tabs[0].id, {
            url: this.config.uploadUrl
        });

        await this.delay(2000);

        this.log('log', 'Navigated to YouTube Studio');
        return tabs[0];
    }

    /**
     * Upload video to YouTube
     * @param {File} file - Video file
     * @returns {Promise<Object>}
     */
    async uploadVideo(file) {
        this.log('log', 'Starting video upload to YouTube...');

        const validation = await this.validateVideo(file);
        if (!validation.valid) {
            throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
        }

        const tab = await this.findUploadButton();
        const fileData = await this.convertToBase64(file);

        const result = await this.sendMessage(tab.id, {
            action: 'uploadToYouTube',
            files: [fileData]
        });

        if (!result.success) {
            throw new Error(result.error || 'Upload failed');
        }

        this.log('log', 'Video uploaded successfully to YouTube');
        return result;
    }

    /**
     * Fill title (YouTube uses title instead of caption)
     * @param {string} title - Video title
     * @returns {Promise<Object>}
     */
    async fillCaption(title) {
        return await this.fillTitle(title);
    }

    /**
     * Fill title
     * @param {string} title - Video title
     * @returns {Promise<Object>}
     */
    async fillTitle(title) {
        this.log('log', 'Filling title...');

        if (title.length > this.config.titleRequirements.maxLength) {
            this.log('warn', `Title length (${title.length}) exceeds YouTube maximum (${this.config.titleRequirements.maxLength})`);
            title = title.substring(0, this.config.titleRequirements.maxLength);
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'fillYouTubeTitle',
            title: title
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to fill title');
        }

        this.log('log', 'Title filled successfully');
        return result;
    }

    /**
     * Fill description
     * @param {string} description - Video description
     * @returns {Promise<Object>}
     */
    async fillDescription(description) {
        this.log('log', 'Filling description...');

        if (description.length > this.config.descriptionRequirements.maxLength) {
            this.log('warn', `Description length (${description.length}) exceeds maximum`);
            description = description.substring(0, this.config.descriptionRequirements.maxLength);
        }

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'fillYouTubeDescription',
            description: description
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to fill description');
        }

        this.log('log', 'Description filled successfully');
        return result;
    }

    /**
     * Mark video as Short
     * @returns {Promise<Object>}
     */
    async markAsShort() {
        this.log('log', 'Marking as Short...');

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'markAsShort'
        });

        if (!result.success) {
            this.log('warn', 'Failed to mark as Short (may be auto-detected)');
        }

        return result;
    }

    /**
     * Add product (use description link)
     * @param {string} productUrl - Product URL
     * @returns {Promise<Object>}
     */
    async addProduct(productUrl) {
        this.log('log', `Adding product link to description: ${productUrl}`);

        // YouTube doesn't have direct product linking
        // Add link to description instead
        const description = `\n\nProduct: ${productUrl}`;

        try {
            return await this.fillDescription(description);
        } catch (error) {
            this.log('warn', 'Failed to add product link to description');
            return { success: true, message: 'Product link skipped' };
        }
    }

    /**
     * Set visibility
     * @param {string} visibility - 'Public', 'Private', 'Unlisted'
     * @returns {Promise<Object>}
     */
    async setVisibility(visibility = 'Public') {
        this.log('log', `Setting visibility to: ${visibility}`);

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'setYouTubeVisibility',
            visibility: visibility
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to set visibility');
        }

        this.log('log', 'Visibility set successfully');
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
            action: 'scheduleYouTubePost',
            scheduleTime: scheduleTime
        });

        if (!result.success) {
            this.log('warn', 'Scheduling requires manual input');
        }

        return result;
    }

    /**
     * Publish video
     * @returns {Promise<Object>}
     */
    async publishVideo() {
        this.log('log', 'Publishing video...');

        const tab = await this.findUploadButton();

        const result = await this.sendMessage(tab.id, {
            action: 'publishYouTubeVideo'
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to publish video');
        }

        this.log('log', 'Video published successfully');
        return result;
    }

    /**
     * Get video requirements
     * @returns {Object}
     */
    getVideoRequirements() {
        return this.config?.videoRequirements || {
            maxSize: 256 * 1024 * 1024 * 1024, // 256GB
            maxDuration: 60, // 60 seconds for Shorts
            minDuration: 1,
            formats: ['mp4', 'mov', 'avi', 'flv', 'wmv', 'webm'],
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
            title = '',
            description = '',
            visibility = 'Public',
            scheduleTime = ''
        } = options;

        this.log('log', 'Starting complete upload workflow for YouTube Shorts...');

        try {
            // 1. Upload video
            await this.uploadVideo(file);
            await this.delay(3000);

            // 2. Fill title
            if (title) {
                await this.fillTitle(title);
                await this.delay(1000);
            }

            // 3. Fill description
            if (description) {
                await this.fillDescription(description);
                await this.delay(1000);
            }

            // 4. Mark as Short
            await this.markAsShort();
            await this.delay(1000);

            // 5. Set visibility and publish
            await this.setVisibility(visibility);
            await this.delay(1500);

            if (scheduleTime) {
                await this.schedulePost(scheduleTime);
            } else {
                await this.publishVideo();
            }

            await this.delay(2000);

            this.log('log', 'Complete upload workflow finished successfully');
            return {
                success: true,
                message: 'Video uploaded to YouTube Shorts successfully'
            };

        } catch (error) {
            this.log('error', 'Upload workflow failed:', error);
            throw error;
        }
    }

    /**
     * Batch upload
     * @param {Array} uploads - Array of upload options
     * @param {string} mode - 'sequential' only
     * @returns {Promise<Array>}
     */
    async uploadBatch(uploads, mode = 'sequential') {
        this.log('log', `Starting batch upload to YouTube with ${uploads.length} videos...`);

        if (mode !== 'sequential') {
            this.log('warn', 'YouTube only supports sequential upload mode');
        }

        const results = [];

        for (let i = 0; i < uploads.length; i++) {
            try {
                this.log('log', `Uploading video ${i + 1}/${uploads.length} to YouTube...`);
                const result = await this.uploadComplete(uploads[i]);
                results.push({ index: i, success: true, result });

                if (i < uploads.length - 1) {
                    const delay = 15000 + Math.random() * 5000; // 15-20 seconds
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
}

export default YouTubeUploader;
