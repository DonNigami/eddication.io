/**
 * Platform Validator
 * Validates upload requirements for each platform
 */

class PlatformValidator {
    /**
     * Validate video file for platform
     */
    static async validateVideo(file, platformId) {
        const errors = [];
        const warnings = [];

        // Get platform requirements
        const requirements = this.getPlatformRequirements(platformId);

        if (!requirements) {
            errors.push(`Platform ${platformId} not found`);
            return { valid: false, errors, warnings };
        }

        // Check file type
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (!requirements.formats.includes(fileExt)) {
            errors.push(`Format ${fileExt} not supported. Allowed: ${requirements.formats.join(', ')}`);
        }

        // Check file size
        if (file.size > requirements.maxSize) {
            const maxSizeMB = (requirements.maxSize / (1024 * 1024)).toFixed(0);
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            errors.push(`File size ${fileSizeMB}MB exceeds maximum ${maxSizeMB}MB`);
        }

        // Check duration (if available)
        try {
            const duration = await this.getVideoDuration(file);

            if (duration > requirements.maxDuration) {
                errors.push(`Duration ${duration}s exceeds maximum ${requirements.maxDuration}s`);
            }

            if (duration < requirements.minDuration) {
                warnings.push(`Duration ${duration}s is below recommended minimum ${requirements.minDuration}s`);
            }
        } catch (error) {
            warnings.push('Could not verify video duration');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get video duration
     */
    static getVideoDuration(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(Math.round(video.duration));
            };

            video.onerror = () => {
                reject(new Error('Failed to load video metadata'));
            };

            video.src = URL.createObjectURL(file);
        });
    }

    /**
     * Get platform requirements
     */
    static getPlatformRequirements(platformId) {
        const requirements = {
            tiktok: {
                maxSize: 4 * 1024 * 1024 * 1024, // 4GB
                maxDuration: 600, // 10 minutes
                minDuration: 3,
                formats: ['mp4', 'mov', 'webm'],
                captionMaxLength: 2200
            },
            shopee: {
                maxSize: 100 * 1024 * 1024, // 100MB
                maxDuration: 60,
                minDuration: 1,
                formats: ['mp4', 'mov'],
                captionMaxLength: 500
            },
            facebook: {
                maxSize: 4 * 1024 * 1024 * 1024, // 4GB
                maxDuration: 90,
                minDuration: 3,
                formats: ['mp4', 'mov'],
                captionMaxLength: 2200
            },
            youtube: {
                maxSize: 256 * 1024 * 1024 * 1024, // 256GB
                maxDuration: 60, // For Shorts
                minDuration: 1,
                formats: ['mp4', 'mov', 'avi', 'flv', 'wmv', 'webm'],
                titleMaxLength: 100,
                descriptionMaxLength: 5000
            }
        };

        return requirements[platformId];
    }

    /**
     * Validate caption for platform
     */
    static validateCaption(caption, platformId) {
        const errors = [];
        const warnings = [];
        const requirements = this.getPlatformRequirements(platformId);

        if (!requirements) {
            return { valid: true, errors, warnings };
        }

        if (platformId === 'youtube') {
            // YouTube uses title, not caption
            if (caption.length > requirements.titleMaxLength) {
                errors.push(`Title exceeds ${requirements.titleMaxLength} characters`);
            }
        } else {
            if (requirements.captionMaxLength && caption.length > requirements.captionMaxLength) {
                errors.push(`Caption exceeds ${requirements.captionMaxLength} characters`);
            }
        }

        // Check for empty caption
        if (!caption.trim()) {
            errors.push('Caption/Title cannot be empty');
        }

        // Check for potentially problematic content
        if (caption.includes('http://') || caption.includes('https://')) {
            warnings.push('Links in caption may be blocked by some platforms');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate multiple platforms at once
     */
    static async validateForMultiplePlatforms(file, caption, platformIds) {
        const results = {};

        for (const platformId of platformIds) {
            const videoValidation = await this.validateVideo(file, platformId);
            const captionValidation = this.validateCaption(caption, platformId);

            results[platformId] = {
                video: videoValidation,
                caption: captionValidation,
                valid: videoValidation.valid && captionValidation.valid,
                allErrors: [...videoValidation.errors, ...captionValidation.errors],
                allWarnings: [...videoValidation.warnings, ...captionValidation.warnings]
            };
        }

        return results;
    }

    /**
     * Get validation summary for UI
     */
    static getValidationSummary(results) {
        const platformNames = {
            tiktok: 'TikTok',
            shopee: 'Shopee',
            facebook: 'Facebook Reels',
            youtube: 'YouTube Shorts'
        };

        const summary = [];

        for (const [platformId, result] of Object.entries(results)) {
            const name = platformNames[platformId] || platformId;

            if (result.valid) {
                summary.push({
                    platform: name,
                    status: 'valid',
                    icon: '✅',
                    message: 'ผ่านการตรวจสอบ'
                });
            } else {
                summary.push({
                    platform: name,
                    status: 'invalid',
                    icon: '❌',
                    message: result.allErrors.join(', ')
                });
            }

            if (result.allWarnings.length > 0) {
                summary.push({
                    platform: name,
                    status: 'warning',
                    icon: '⚠️',
                    message: result.allWarnings.join(', ')
                });
            }
        }

        return summary;
    }

    /**
     * Check if tab is ready for upload
     */
    static async checkPlatformReady(platformId) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.url) {
                return {
                    ready: false,
                    message: 'ไม่พบ tab ที่ใช้งาน'
                };
            }

            const urlPatterns = {
                tiktok: /tiktok\.com/,
                shopee: /seller\.shopee/,
                facebook: /facebook\.com/,
                youtube: /studio\.youtube\.com/
            };

            const pattern = urlPatterns[platformId];

            if (!pattern) {
                return {
                    ready: false,
                    message: 'Platform ไม่รองรับ'
                };
            }

            if (!pattern.test(tab.url)) {
                return {
                    ready: false,
                    message: `กรุณาเปิด ${this.getPlatformName(platformId)} ก่อน`
                };
            }

            return {
                ready: true,
                message: 'พร้อมอัพโหลด'
            };

        } catch (error) {
            return {
                ready: false,
                message: 'ไม่สามารถตรวจสอบได้'
            };
        }
    }

    /**
     * Get platform display name
     */
    static getPlatformName(platformId) {
        const names = {
            tiktok: 'TikTok',
            shopee: 'Shopee Seller Center',
            facebook: 'Facebook',
            youtube: 'YouTube Studio'
        };
        return names[platformId] || platformId;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlatformValidator;
}

if (typeof window !== 'undefined') {
    window.PlatformValidator = PlatformValidator;
}
