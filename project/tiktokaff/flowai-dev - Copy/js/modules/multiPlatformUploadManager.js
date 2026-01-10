/**
 * Multi-Platform Upload Manager
 * 
 * Manages uploads across multiple platforms simultaneously
 */

class MultiPlatformUploadManager {
    constructor() {
        this.uploaders = new Map();
        this.uploadQueue = [];
        this.activeUploads = new Map();
        this.results = [];
        this.onProgressCallbacks = [];
        this.onCompleteCallbacks = [];
        this.errorHandler = null;
        this.validator = null;
    }

    /**
     * Initialize manager with platform uploaders
     */
    async init() {
        console.log('[UploadManager] Initializing...');

        // Import platform module
        try {
            const platformModule = await import('../platforms/index.js');
            this.platformModule = platformModule;
            console.log('[UploadManager] Platform module loaded');
        } catch (error) {
            console.error('[UploadManager] Failed to load platform module:', error);
        }

        // Initialize error handler and validator
        if (window.ErrorHandler) {
            this.errorHandler = new window.ErrorHandler();
            console.log('[UploadManager] ErrorHandler initialized');
        }

        if (window.PlatformValidator) {
            this.validator = window.PlatformValidator;
            console.log('[UploadManager] PlatformValidator initialized');
        }
    }

    /**
     * Get uploader for platform
     */
    getUploader(platformId) {
        if (!this.platformModule) {
            throw new Error('Platform module not initialized');
        }

        return this.platformModule.getUploader(platformId);
    }

    /**
     * Upload to multiple platforms
     * @param {Object} uploadData - Upload configuration
     * @param {File} uploadData.file - Video file
     * @param {string} uploadData.caption - Caption/title
     * @param {string} uploadData.description - Description (for YouTube)
     * @param {Array<string>} uploadData.platforms - Platform IDs
     * @param {Object} uploadData.options - Platform-specific options
     */
    async uploadToMultiplePlatforms(uploadData) {
        const { file, caption, description, platforms, options = {} } = uploadData;

        console.log('[UploadManager] Starting multi-platform upload:', platforms);

        this.results = [];
        this.activeUploads.clear();

        // Validate upload data with error handler
        if (this.errorHandler) {
            const validationResult = this.errorHandler.validateUploadData(uploadData);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: 'Upload data validation failed',
                    details: validationResult.errors
                };
            }
        }

        // Validate video for all platforms using PlatformValidator
        if (this.validator) {
            const validation = this.validator.validateForMultiplePlatforms(file, caption, platforms);
            if (!validation.valid) {
                console.error('[UploadManager] Validation failed:', validation.errors);
                return {
                    success: false,
                    error: 'Video validation failed',
                    details: validation.errors,
                    warnings: validation.warnings
                };
            }

            if (validation.warnings.length > 0) {
                console.warn('[UploadManager] Validation warnings:', validation.warnings);
            }
        } else {
            // Fallback to old validation method
            const validation = await this.validateForPlatforms(file, platforms);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'Video validation failed',
                    details: validation.errors
                };
            }
        }

        // Create upload tasks
        const uploadTasks = platforms.map(platformId => ({
            platformId,
            file,
            caption,
            description,
            options: options[platformId] || {}
        }));

        // Upload in parallel
        const uploadPromises = uploadTasks.map(task =>
            this.uploadToPlatform(task)
        );

        try {
            const results = await Promise.allSettled(uploadPromises);

            this.results = results.map((result, index) => ({
                platformId: uploadTasks[index].platformId,
                success: result.status === 'fulfilled' && result.value.success,
                data: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason.message :
                    (result.value && result.value.error) || null
            }));

            const successCount = this.results.filter(r => r.success).length;

            console.log(`[UploadManager] Upload complete: ${successCount}/${platforms.length} successful`);

            this.notifyComplete(this.results);

            return {
                success: successCount > 0,
                results: this.results,
                successCount,
                totalCount: platforms.length
            };

        } catch (error) {
            console.error('[UploadManager] Upload failed:', error);
            return {
                success: false,
                error: error.message,
                results: this.results
            };
        }
    }

    /**
     * Upload to single platform
     */
    async uploadToPlatform(task) {
        const { platformId, file, caption, description, options } = task;

        console.log(`[UploadManager] Uploading to ${platformId}...`);
        this.activeUploads.set(platformId, { status: 'uploading', progress: 0 });
        this.notifyProgress(platformId, 'uploading', 0);

        try {
            // Check if platform is ready (correct tab open)
            if (this.validator) {
                const platformReady = await this.validator.checkPlatformReady(platformId);
                if (!platformReady.ready) {
                    throw new Error(platformReady.message);
                }
            }

            const uploader = this.getUploader(platformId);

            if (!uploader) {
                throw new Error(`Uploader not found for ${platformId}`);
            }

            // Build upload options based on platform
            const uploadOptions = {
                file,
                ...options
            };

            // Platform-specific fields
            if (platformId === 'youtube') {
                uploadOptions.title = caption;
                uploadOptions.description = description || caption;
            } else {
                uploadOptions.caption = caption;
            }

            // Execute upload with retry logic
            let result;
            if (this.errorHandler) {
                result = await this.errorHandler.retry(
                    () => uploader.uploadComplete(uploadOptions),
                    {
                        retries: 3,
                        delay: 2000,
                        backoffMultiplier: 2
                    }
                );
            } else {
                result = await uploader.uploadComplete(uploadOptions);
            }

            this.activeUploads.set(platformId, { status: 'complete', progress: 100 });
            this.notifyProgress(platformId, 'complete', 100);

            return {
                success: true,
                platformId,
                result
            };

        } catch (error) {
            console.error(`[UploadManager] ${platformId} upload failed:`, error);

            // Log error with context
            if (this.errorHandler) {
                this.errorHandler.logError(error, {
                    platform: platformId,
                    action: 'upload',
                    fileName: file.name,
                    fileSize: file.size
                });
            }

            this.activeUploads.set(platformId, { status: 'error', progress: 0, error: error.message });
            this.notifyProgress(platformId, 'error', 0, error.message);

            return {
                success: false,
                platformId,
                error: error.message,
                userMessage: this.errorHandler ?
                    this.errorHandler.getUserFriendlyMessage(platformId, error) :
                    error.message
            };
        }
    }

    /**
     * Validate video for platforms
     */
    async validateForPlatforms(file, platforms) {
        console.log('[UploadManager] Validating video for platforms:', platforms);

        const errors = [];

        for (const platformId of platforms) {
            try {
                const uploader = this.getUploader(platformId);
                if (!uploader) {
                    errors.push(`${platformId}: Uploader not available`);
                    continue;
                }

                const validation = await uploader.validateVideo(file);
                if (!validation.valid) {
                    errors.push(`${platformId}: ${validation.errors.join(', ')}`);
                }
            } catch (error) {
                errors.push(`${platformId}: Validation error - ${error.message}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get upload status for all platforms
     */
    getStatus() {
        const status = {};
        this.activeUploads.forEach((value, key) => {
            status[key] = value;
        });
        return status;
    }

    /**
     * Get results
     */
    getResults() {
        return this.results;
    }

    /**
     * Register progress callback
     */
    onProgress(callback) {
        this.onProgressCallbacks.push(callback);
    }

    /**
     * Register complete callback
     */
    onComplete(callback) {
        this.onCompleteCallbacks.push(callback);
    }

    /**
     * Notify progress
     */
    notifyProgress(platformId, status, progress, error = null) {
        this.onProgressCallbacks.forEach(callback => {
            callback(platformId, status, progress, error);
        });
    }

    /**
     * Notify complete
     */
    notifyComplete(results) {
        this.onCompleteCallbacks.forEach(callback => {
            callback(results);
        });
    }

    /**
     * Cancel uploads
     */
    cancelAll() {
        console.log('[UploadManager] Cancelling all uploads...');
        this.activeUploads.clear();
        this.uploadQueue = [];
    }

    /**
     * Reset manager
     */
    reset() {
        this.activeUploads.clear();
        this.uploadQueue = [];
        this.results = [];
    }

    /**
     * Batch upload to multiple platforms
     * @param {Array} uploads - Array of upload data objects
     * @param {string} mode - 'parallel' or 'sequential'
     */
    async batchUploadToMultiplePlatforms(uploads, mode = 'parallel') {
        console.log(`[UploadManager] Starting batch upload (${mode}): ${uploads.length} items`);

        if (mode === 'sequential') {
            const allResults = [];

            for (let i = 0; i < uploads.length; i++) {
                console.log(`[UploadManager] Processing ${i + 1}/${uploads.length}...`);
                const result = await this.uploadToMultiplePlatforms(uploads[i]);
                allResults.push(result);

                // Delay between batches
                if (i < uploads.length - 1) {
                    const delay = 5000 + Math.random() * 3000; // 5-8s
                    console.log(`[UploadManager] Waiting ${Math.round(delay / 1000)}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            return allResults;
        } else {
            // Parallel mode
            const uploadPromises = uploads.map(uploadData =>
                this.uploadToMultiplePlatforms(uploadData)
            );

            return await Promise.all(uploadPromises);
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiPlatformUploadManager;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.MultiPlatformUploadManager = MultiPlatformUploadManager;
}
