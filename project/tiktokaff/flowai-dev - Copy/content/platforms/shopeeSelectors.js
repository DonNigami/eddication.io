/**
 * Shopee Selectors
 * 
 * DOM selectors for Shopee Seller Center video upload
 * 
 * NOTE: These selectors are placeholders based on typical e-commerce platforms.
 * They need to be verified and updated when testing on actual Shopee Seller Center.
 * 
 * How to find correct selectors:
 * 1. Open Shopee Seller Center: https://seller.shopee.co.th/
 * 2. Navigate to Video section
 * 3. Open Chrome DevTools (F12)
 * 4. Inspect elements and note down selectors
 * 5. Test selectors in console: document.querySelector('selector')
 * 6. Update this file with correct selectors
 */

const ShopeeSelectors = {
    // ==================== Upload Page ====================

    /**
     * Main upload button/area (initial click to start upload)
     * Possible selectors:
     * - Button with text "Upload Video" / "อัพโหลดวิดีโอ"
     * - Input type="file" for direct access
     * - Drag-drop zone
     */
    uploadButton: [
        'button[data-testid="upload-video-button"]',
        'button:contains("Upload Video")',
        'button:contains("อัพโหลดวิดีโอ")',
        '[class*="upload-button"]',
        '[class*="video-upload"]',
        'input[type="file"][accept*="video"]'
    ],

    /**
     * File input element (where we set files)
     */
    fileInput: [
        'input[type="file"][accept*="video"]',
        'input[type="file"][accept*="mp4"]',
        'input[name="video"]',
        'input#video-upload',
        '[data-testid="video-file-input"]'
    ],

    /**
     * Upload progress indicator
     */
    uploadProgress: [
        '[class*="upload-progress"]',
        '[class*="progress-bar"]',
        '.upload-status',
        '[data-testid="upload-progress"]',
        'progress[value]'
    ],

    // ==================== Content Fields ====================

    /**
     * Video title/caption field
     * Shopee may use title or description field
     */
    captionField: [
        'textarea[name="title"]',
        'textarea[name="description"]',
        'input[name="title"]',
        '[data-testid="video-title"]',
        '[placeholder*="title"]',
        '[placeholder*="caption"]',
        'textarea[class*="title"]',
        'textarea[class*="description"]'
    ],

    /**
     * Description field (if separate from title)
     */
    descriptionField: [
        'textarea[name="description"]',
        'textarea[name="content"]',
        '[data-testid="video-description"]',
        '[placeholder*="description"]',
        'textarea[class*="description"]'
    ],

    // ==================== Product Linking ====================

    /**
     * Add Product button
     */
    addProductButton: [
        'button:contains("Add Product")',
        'button:contains("เพิ่มสินค้า")',
        'button[data-testid="add-product"]',
        '[class*="add-product-button"]',
        'button[class*="link-product"]'
    ],

    /**
     * Product search input (in modal/panel)
     */
    productSearchInput: [
        'input[name="product-search"]',
        'input[placeholder*="search product"]',
        'input[placeholder*="ค้นหาสินค้า"]',
        '[data-testid="product-search-input"]',
        'input[class*="product-search"]'
    ],

    /**
     * Product list items (search results)
     */
    productListItem: [
        '[data-testid="product-item"]',
        '[class*="product-item"]',
        '[class*="product-card"]',
        '.product-list > div',
        '[role="listitem"]'
    ],

    /**
     * First product in search results
     */
    firstProductCard: [
        '[data-testid="product-item"]:first-child',
        '[class*="product-item"]:first-child',
        '[class*="product-card"]:first-child',
        '.product-list > div:first-child'
    ],

    /**
     * Product selection checkbox/button
     */
    productSelectButton: [
        'input[type="checkbox"]',
        'button[class*="select"]',
        '[data-testid="product-select"]'
    ],

    /**
     * Confirm product selection button
     */
    confirmButton: [
        'button:contains("Confirm")',
        'button:contains("ยืนยัน")',
        'button[data-testid="confirm"]',
        'button[type="submit"]',
        'button[class*="confirm"]'
    ],

    // ==================== Settings & Actions ====================

    /**
     * Privacy/Visibility settings
     */
    privacySelect: [
        'select[name="privacy"]',
        '[data-testid="privacy-select"]',
        'select[class*="visibility"]'
    ],

    /**
     * Publish/Post button (final submit)
     */
    publishButton: [
        'button:contains("Publish")',
        'button:contains("Post")',
        'button:contains("โพสต์")',
        'button[data-testid="publish"]',
        'button[type="submit"]',
        'button[class*="publish"]'
    ],

    /**
     * Schedule post option (if available)
     */
    scheduleButton: [
        'button:contains("Schedule")',
        'button:contains("กำหนดเวลา")',
        '[data-testid="schedule-toggle"]',
        'input[type="checkbox"][name="schedule"]'
    ],

    /**
     * Schedule date/time input
     */
    scheduleTimeInput: [
        'input[type="datetime-local"]',
        'input[name="schedule_time"]',
        '[data-testid="schedule-time"]'
    ],

    // ==================== Modal/Dialog ====================

    /**
     * Modal backdrop/overlay
     */
    modalBackdrop: [
        '[class*="modal-backdrop"]',
        '[class*="overlay"]',
        '.modal-overlay'
    ],

    /**
     * Modal container
     */
    modalContainer: [
        '[role="dialog"]',
        '[class*="modal"]',
        '.modal-content'
    ],

    /**
     * Modal close button
     */
    modalCloseButton: [
        'button[aria-label="Close"]',
        'button[class*="close"]',
        '[data-testid="modal-close"]',
        'button.close'
    ],

    // ==================== Helpers ====================

    /**
     * Try multiple selectors until one is found
     * @param {string[]} selectors - Array of selectors to try
     * @returns {Element|null}
     */
    findElement(selectors) {
        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`[Shopee] Found element with selector: ${selector}`);
                    return element;
                }
            } catch (error) {
                // Invalid selector, continue
            }
        }
        console.warn('[Shopee] Element not found. Tried selectors:', selectors);
        return null;
    },

    /**
     * Wait for element to appear
     * @param {string[]} selectors - Array of selectors to try
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Element>}
     */
    waitForElement(selectors, timeout = 10000) {
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
                    reject(new Error(`Element not found after ${timeout}ms. Tried: ${selectors.join(', ')}`));
                }
            }, 500);
        });
    }
};

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopeeSelectors;
}
