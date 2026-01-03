/**
 * Platform Configuration
 * 
 * Centralized configuration for all supported platforms
 */

const PlatformConfig = {
    /**
     * TikTok Configuration
     */
    tiktok: {
        name: 'TikTok',
        displayName: 'TikTok',
        icon: '../icons/tiktok.png',
        uploadUrl: 'https://www.tiktok.com/creator-center/upload',
        studioUrl: 'https://www.tiktok.com/creator-center',
        urlPatterns: [
            '*://*.tiktok.com/*'
        ],
        features: {
            uploadVideo: true,
            addCaption: true,
            addProduct: true,
            addHashtags: true,
            schedulePost: true,
            addThumbnail: false,
            addLocation: true,
            addMentions: true,
            privacySettings: true,
            allowComments: true,
            allowDuet: true,
            allowStitch: true
        },
        videoRequirements: {
            maxSize: 2 * 1024 * 1024 * 1024, // 2GB
            maxDuration: 600, // 10 minutes
            minDuration: 3, // 3 seconds
            formats: ['mp4', 'mov', 'webm'],
            aspectRatio: '9:16',
            minWidth: 720,
            minHeight: 1280,
            maxWidth: 1920,
            maxHeight: 1920
        },
        captionRequirements: {
            maxLength: 2200,
            maxHashtags: 30,
            maxMentions: 20
        },
        selectors: {
            // Will be loaded from content script
        }
    },

    /**
     * Shopee Configuration
     */
    shopee: {
        name: 'shopee',
        displayName: 'Shopee Video',
        icon: '../icons/shopee.png',
        uploadUrl: 'https://seller.shopee.co.th/portal/video',
        studioUrl: 'https://seller.shopee.co.th/',
        urlPatterns: [
            '*://seller.shopee.co.th/*',
            '*://seller.shopee.com/*',
            '*://seller.shopee.com.my/*'
        ],
        features: {
            uploadVideo: true,
            addCaption: true,
            addProduct: true,
            addHashtags: true,
            schedulePost: false, // Shopee may not support scheduling
            addThumbnail: false,
            addLocation: false,
            addMentions: false,
            privacySettings: false,
            allowComments: true,
            allowDuet: false,
            allowStitch: false
        },
        videoRequirements: {
            maxSize: 100 * 1024 * 1024, // 100MB
            maxDuration: 60, // 60 seconds for Shopee Live/Video
            minDuration: 1,
            formats: ['mp4', 'mov'],
            aspectRatio: '9:16',
            minWidth: 720,
            minHeight: 1280,
            maxWidth: 1920,
            maxHeight: 1920
        },
        captionRequirements: {
            maxLength: 500,
            maxHashtags: 10,
            maxMentions: 0
        },
        selectors: {
            // To be determined during Phase 2 research
        }
    },

    /**
     * Facebook Configuration
     */
    facebook: {
        name: 'facebook',
        displayName: 'Facebook Reels',
        icon: '../icons/facebook.png',
        uploadUrl: 'https://www.facebook.com/reel/create',
        studioUrl: 'https://www.facebook.com/',
        urlPatterns: [
            '*://*.facebook.com/*'
        ],
        features: {
            uploadVideo: true,
            addCaption: true,
            addProduct: true, // Product tagging available
            addHashtags: true,
            schedulePost: true,
            addThumbnail: false,
            addLocation: true,
            addMentions: true,
            privacySettings: true,
            allowComments: true,
            allowDuet: false,
            allowStitch: false
        },
        videoRequirements: {
            maxSize: 4 * 1024 * 1024 * 1024, // 4GB
            maxDuration: 90, // 90 seconds for Reels
            minDuration: 3,
            formats: ['mp4', 'mov'],
            aspectRatio: '9:16',
            minWidth: 540,
            minHeight: 960,
            maxWidth: 1920,
            maxHeight: 1920
        },
        captionRequirements: {
            maxLength: 2200,
            maxHashtags: 30,
            maxMentions: 50
        },
        selectors: {
            // To be determined during Phase 3 research
        }
    },

    /**
     * YouTube Configuration
     */
    youtube: {
        name: 'youtube',
        displayName: 'YouTube Shorts',
        icon: '../icons/youtube.png',
        uploadUrl: 'https://studio.youtube.com/channel/upload',
        studioUrl: 'https://studio.youtube.com/',
        urlPatterns: [
            '*://studio.youtube.com/*'
        ],
        features: {
            uploadVideo: true,
            addCaption: false, // YouTube uses Title + Description
            addProduct: false, // Use description links
            addHashtags: true,
            schedulePost: true,
            addThumbnail: true,
            addLocation: false,
            addMentions: false,
            privacySettings: true,
            allowComments: true,
            allowDuet: false,
            allowStitch: false
        },
        videoRequirements: {
            maxSize: 256 * 1024 * 1024 * 1024, // 256GB
            maxDuration: 60, // 60 seconds for Shorts
            minDuration: 1,
            formats: ['mp4', 'mov', 'avi', 'flv', 'wmv', 'webm'],
            aspectRatio: '9:16',
            minWidth: 720,
            minHeight: 1280,
            maxWidth: 1920,
            maxHeight: 1920
        },
        captionRequirements: {
            maxLength: 0, // No caption field
            maxHashtags: 15, // In description
            maxMentions: 0
        },
        descriptionRequirements: {
            maxLength: 5000
        },
        titleRequirements: {
            maxLength: 100
        },
        selectors: {
            // To be determined during Phase 4 research
        }
    }
};

/**
 * PlatformConfigManager
 * 
 * Utility class to manage platform configurations
 */
class PlatformConfigManager {
    /**
     * Get configuration for a specific platform
     * 
     * @param {string} platformName - Platform name
     * @returns {Object|null} Platform configuration or null if not found
     */
    static get(platformName) {
        const config = PlatformConfig[platformName];
        if (!config) {
            console.warn(`Configuration not found for platform: ${platformName}`);
            return null;
        }
        return { ...config }; // Return a copy
    }

    /**
     * Get all platform names
     * 
     * @returns {string[]} Array of platform names
     */
    static getAllPlatforms() {
        return Object.keys(PlatformConfig);
    }

    /**
     * Get all platform configurations
     * 
     * @returns {Object} All configurations
     */
    static getAll() {
        return { ...PlatformConfig };
    }

    /**
     * Check if platform is supported
     * 
     * @param {string} platformName - Platform name
     * @returns {boolean}
     */
    static isSupported(platformName) {
        return platformName in PlatformConfig;
    }

    /**
     * Get platforms that support a specific feature
     * 
     * @param {string} feature - Feature name (e.g., 'schedulePost')
     * @returns {string[]} Array of platform names
     */
    static getPlatformsWithFeature(feature) {
        return Object.keys(PlatformConfig).filter(platform =>
            PlatformConfig[platform].features[feature] === true
        );
    }

    /**
     * Get upload URL for a platform
     * 
     * @param {string} platformName - Platform name
     * @returns {string|null} Upload URL or null
     */
    static getUploadUrl(platformName) {
        const config = this.get(platformName);
        return config ? config.uploadUrl : null;
    }

    /**
     * Check if URL matches platform
     * 
     * @param {string} url - URL to check
     * @param {string} platformName - Platform name
     * @returns {boolean}
     */
    static matchesUrl(url, platformName) {
        const config = this.get(platformName);
        if (!config) return false;

        return config.urlPatterns.some(pattern => {
            // Convert wildcard pattern to regex
            const regexPattern = pattern
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(url);
        });
    }

    /**
     * Detect platform from URL
     * 
     * @param {string} url - URL to check
     * @returns {string|null} Platform name or null
     */
    static detectPlatform(url) {
        for (const platform of this.getAllPlatforms()) {
            if (this.matchesUrl(url, platform)) {
                return platform;
            }
        }
        return null;
    }

    /**
     * Validate video file against platform requirements
     * 
     * @param {string} platformName - Platform name
     * @param {File} file - Video file
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    static validateVideo(platformName, file) {
        const config = this.get(platformName);
        if (!config) {
            return { valid: false, errors: [`Platform not supported: ${platformName}`] };
        }

        const requirements = config.videoRequirements;
        const errors = [];

        // Check size
        if (file.size > requirements.maxSize) {
            const maxSizeMB = Math.round(requirements.maxSize / 1024 / 1024);
            const fileSizeMB = Math.round(file.size / 1024 / 1024);
            errors.push(`File size (${fileSizeMB}MB) exceeds ${config.displayName} maximum (${maxSizeMB}MB)`);
        }

        // Check format
        const extension = file.name.split('.').pop().toLowerCase();
        if (!requirements.formats.includes(extension)) {
            errors.push(`Format '${extension}' not supported by ${config.displayName}. Supported: ${requirements.formats.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get formatted requirements for display
     * 
     * @param {string} platformName - Platform name
     * @returns {string} Formatted requirements text
     */
    static getRequirementsText(platformName) {
        const config = this.get(platformName);
        if (!config) return '';

        const req = config.videoRequirements;
        const maxSizeMB = Math.round(req.maxSize / 1024 / 1024);
        const maxDurationMin = Math.round(req.maxDuration / 60);

        return `
      Max Size: ${maxSizeMB}MB
      Max Duration: ${maxDurationMin > 0 ? maxDurationMin + ' min' : req.maxDuration + ' sec'}
      Formats: ${req.formats.join(', ')}
      Aspect Ratio: ${req.aspectRatio}
    `.trim();
    }
}

// Export
export default PlatformConfigManager;
export { PlatformConfig };
