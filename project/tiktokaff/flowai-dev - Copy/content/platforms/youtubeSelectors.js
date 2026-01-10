/**
 * YouTube Shorts Selectors
 * 
 * DOM selectors for YouTube Studio upload
 * 
 * NOTE: YouTube Studio has complex React-based UI
 * Focus on stable selectors (id, data-*, aria-*)
 */

const YouTubeSelectors = {
    // ==================== Navigation ====================

    /**
     * Create/Upload button
     */
    createButton: [
        '#create-icon',
        'button#create-icon-button',
        '[aria-label="Create"]',
        '[aria-label="สร้าง"]'
    ],

    /**
     * Upload videos option
     */
    uploadOption: [
        '#text-item-0',
        'tp-yt-paper-item#text-item-0',
        '[test-id="upload-beta"]',
        'ytcp-ve[style-target="host"] tp-yt-paper-item:first-child'
    ],

    // ==================== Upload ====================

    /**
     * File input for video upload
     */
    fileInput: [
        'input#upload-input',
        'input[type="file"][accept*="video"]',
        '#upload-input',
        'input#content-upload-input'
    ],

    /**
     * Select files button
     */
    selectFilesButton: [
        '#select-files-button',
        'ytcp-button#select-files-button',
        '[aria-label="SELECT FILES"]'
    ],

    /**
     * Upload progress
     */
    uploadProgress: [
        '#progress-label',
        'ytcp-video-upload-progress',
        '[aria-label*="Upload progress"]'
    ],

    // ==================== Details Form ====================

    /**
     * Title input
     */
    titleInput: [
        '#textbox',
        'div#textbox[contenteditable="true"]',
        'ytcp-social-suggestions-textbox #textbox'
    ],

    /**
     * Description textarea/div
     */
    descriptionInput: [
        '#description-container #textbox',
        'ytcp-social-suggestions-textbox#description-textarea #textbox',
        'div#textbox[aria-label*="description"]'
    ],

    /**
     * Thumbnail upload
     */
    thumbnailInput: [
        '#file-loader',
        'input[type="file"][accept*="image"]',
        '#upload-thumbnail input'
    ],

    // ==================== Shorts Settings ====================

    /**
     * Shorts checkbox/toggle
     */
    shortsToggle: [
        '#shorts-toggle',
        'ytcp-checkbox-lit[label*="Shorts"]',
        '[aria-label*="Shorts"]',
        '#shorts-checkbox'
    ],

    // ==================== Visibility ====================

    /**
     * Next button (Details → Visibility)
     */
    nextButton: [
        '#next-button',
        'ytcp-button#next-button',
        '[aria-label="Next"]'
    ],

    /**
     * Public radio button
     */
    publicRadio: [
        '#public-radio-button',
        'tp-yt-paper-radio-button[name="PUBLIC"]',
        '[name="PUBLIC"]'
    ],

    /**
     * Unlisted radio button
     */
    unlistedRadio: [
        '#unlisted-radio-button',
        'tp-yt-paper-radio-button[name="UNLISTED"]'
    ],

    /**
     * Private radio button
     */
    privateRadio: [
        '#private-radio-button',
        'tp-yt-paper-radio-button[name="PRIVATE"]'
    ],

    /**
     * Schedule radio button
     */
    scheduleRadio: [
        'tp-yt-paper-radio-button[name="SCHEDULE"]',
        '[name="SCHEDULE"]'
    ],

    /**
     * Schedule date input
     */
    scheduleDateInput: [
        '#datepicker-input',
        'input[aria-label*="date"]',
        '#schedule-date-input'
    ],

    /**
     * Schedule time input
     */
    scheduleTimeInput: [
        '#timepicker-input',
        'input[aria-label*="time"]',
        '#schedule-time-input'
    ],

    // ==================== Publish ====================

    /**
     * Publish/Save button
     */
    publishButton: [
        '#done-button',
        'ytcp-button#done-button',
        '[aria-label="Publish"]',
        '[aria-label="Save"]'
    ],

    /**
     * Close button (after publish)
     */
    closeButton: [
        '#close-button',
        'ytcp-button#close-button',
        '[aria-label="Close"]'
    ],

    // ==================== Modal/Dialog ====================

    /**
     * Dialog container
     */
    dialog: [
        'ytcp-dialog',
        '[role="dialog"]',
        'ytcp-upload-dialog'
    ],

    /**
     * Upload complete message
     */
    uploadComplete: [
        '#video-upload-success',
        '[aria-label*="Upload complete"]',
        'ytcp-video-upload-progress[complete]'
    ],

    // ==================== Helpers ====================

    findElement(selectors) {
        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`[YouTube] Found element: ${selector}`);
                    return element;
                }
            } catch (error) {
                // Invalid selector
            }
        }
        console.warn('[YouTube] Element not found. Tried:', selectors);
        return null;
    },

    async waitForElement(selectors, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkInterval = setInterval(() => {
                const element = this.findElement(selectors);
                if (element) {
                    clearInterval(checkInterval);
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Element not found after ${timeout}ms`));
                }
            }, 500);
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = YouTubeSelectors;
}
