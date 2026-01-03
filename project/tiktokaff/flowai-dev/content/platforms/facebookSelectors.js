/**
 * Facebook Reels Selectors
 * 
 * DOM selectors for Facebook Reels creation
 * 
 * NOTE: Facebook uses dynamic class names (hashed classes like "_9nwq", "x1n2onr6", etc.)
 * These selectors focus on:
 * - data-* attributes
 * - aria-* attributes
 * - role attributes
 * - Text content matching
 * 
 * How to find correct selectors:
 * 1. Open Facebook: https://www.facebook.com/
 * 2. Navigate to Create Reel section
 * 3. Open Chrome DevTools (F12)
 * 4. Look for stable attributes (data-testid, aria-label, role)
 * 5. Avoid class names (they change frequently)
 * 6. Update this file with verified selectors
 */

const FacebookSelectors = {
    // ==================== Navigation ====================

    /**
     * Create/Upload button on main page
     */
    createButton: [
        '[aria-label="Create"]',
        '[aria-label="สร้าง"]',
        'a[href*="/reel/create"]',
        'div[role="button"]:has-text("Create reel")',
        '[data-testid="create-button"]'
    ],

    /**
     * Reels option in create menu
     */
    reelsOption: [
        '[aria-label="Reel"]',
        '[aria-label="รีล"]',
        'div[role="menuitem"]:has-text("Reel")',
        '[data-testid="reels-option"]'
    ],

    // ==================== Upload ====================

    /**
     * File input for video upload
     */
    fileInput: [
        'input[type="file"][accept*="video"]',
        'input[type="file"][accept*="mp4"]',
        'input[accept*="video"]',
        'input[name="video"]'
    ],

    /**
     * Upload area/button
     */
    uploadArea: [
        '[aria-label="Upload video"]',
        '[aria-label="อัปโหลดวิดีโอ"]',
        'div[role="button"]:has-text("Upload")',
        '[data-testid="upload-area"]',
        'input[type="file"] + label',
        'input[type="file"] + div'
    ],

    /**
     * Upload progress indicator
     */
    uploadProgress: [
        '[role="progressbar"]',
        '[aria-valuenow]',
        '[aria-label*="progress"]',
        '[data-testid="upload-progress"]'
    ],

    /**
     * Upload complete indicator
     */
    uploadComplete: [
        '[aria-label*="Upload complete"]',
        '[aria-label*="Ready"]',
        '[data-testid="upload-complete"]'
    ],

    // ==================== Content Editor ====================

    /**
     * Caption/Description editor (contenteditable div)
     * Facebook uses contenteditable instead of textarea
     */
    captionEditor: [
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"][aria-label*="caption"]',
        'div[contenteditable="true"][aria-label*="description"]',
        'div[contenteditable="true"][data-testid="caption-editor"]',
        'div[contenteditable="true"][aria-placeholder]'
    ],

    /**
     * Alternative: Caption textarea (if exists)
     */
    captionTextarea: [
        'textarea[aria-label*="caption"]',
        'textarea[aria-label*="description"]',
        'textarea[placeholder*="caption"]'
    ],

    // ==================== Product/Shopping ====================

    /**
     * Tag Products button
     */
    tagProductsButton: [
        '[aria-label*="Tag products"]',
        '[aria-label*="แท็กสินค้า"]',
        'div[role="button"]:has-text("Tag products")',
        '[data-testid="tag-products-button"]'
    ],

    /**
     * Product search input
     */
    productSearchInput: [
        'input[aria-label*="Search products"]',
        'input[placeholder*="Search products"]',
        'input[aria-label*="ค้นหาสินค้า"]',
        '[data-testid="product-search"]'
    ],

    /**
     * Product list items
     */
    productItem: [
        '[role="listitem"]',
        '[data-testid="product-item"]',
        'div[role="button"][aria-label*="product"]'
    ],

    /**
     * Product select checkbox
     */
    productCheckbox: [
        'input[type="checkbox"][role="checkbox"]',
        '[role="checkbox"]',
        '[aria-checked]'
    ],

    // ==================== Settings ====================

    /**
     * Privacy/Audience selector
     */
    privacySelector: [
        '[aria-label*="Privacy"]',
        '[aria-label*="Audience"]',
        '[aria-label*="ความเป็นส่วนตัว"]',
        'div[role="button"][aria-haspopup="menu"]',
        '[data-testid="privacy-selector"]'
    ],

    /**
     * Privacy options (Public, Friends, etc.)
     */
    privacyOption: [
        '[role="menuitem"]',
        'div[role="radio"]',
        '[data-testid="privacy-option"]'
    ],

    // ==================== Publish ====================

    /**
     * Post/Publish button (final submit)
     */
    publishButton: [
        '[aria-label="Post"]',
        '[aria-label="Share"]',
        '[aria-label="โพสต์"]',
        '[aria-label="แชร์"]',
        'div[role="button"]:has-text("Post")',
        'div[role="button"]:has-text("Share")',
        '[data-testid="publish-button"]'
    ],

    /**
     * Schedule button
     */
    scheduleButton: [
        '[aria-label*="Schedule"]',
        '[aria-label*="กำหนดเวลา"]',
        'div[role="button"]:has-text("Schedule")',
        '[data-testid="schedule-button"]'
    ],

    /**
     * Schedule date/time picker
     */
    schedulePicker: [
        '[role="dialog"] input[type="date"]',
        '[role="dialog"] input[type="time"]',
        '[aria-label*="date"]',
        '[aria-label*="time"]'
    ],

    // ==================== Modal/Dialog ====================

    /**
     * Modal container
     */
    modal: [
        '[role="dialog"]',
        '[aria-modal="true"]',
        '[data-testid="modal"]'
    ],

    /**
     * Modal close button
     */
    modalClose: [
        '[aria-label="Close"]',
        '[aria-label="ปิด"]',
        'div[role="button"][aria-label*="Close"]',
        '[data-testid="modal-close"]'
    ],

    /**
     * Confirm/Save button in modal
     */
    modalConfirm: [
        '[role="dialog"] [aria-label="Save"]',
        '[role="dialog"] [aria-label="Done"]',
        '[role="dialog"] [aria-label="Confirm"]',
        '[role="dialog"] div[role="button"]:has-text("Save")',
        '[role="dialog"] div[role="button"]:has-text("Done")'
    ],

    // ==================== Helpers ====================

    /**
     * Find element using multiple selectors
     * @param {string[]} selectors - Array of selectors
     * @returns {Element|null}
     */
    findElement(selectors) {
        for (const selector of selectors) {
            try {
                // Handle :has-text() pseudo-selector
                if (selector.includes(':has-text(')) {
                    const match = selector.match(/^([^:]+):has-text\("([^"]+)"\)$/);
                    if (match) {
                        const [, baseSelector, text] = match;
                        const elements = document.querySelectorAll(baseSelector);
                        for (const element of elements) {
                            if (element.textContent.includes(text)) {
                                return element;
                            }
                        }
                    }
                } else {
                    const element = document.querySelector(selector);
                    if (element) {
                        console.log(`[Facebook] Found element with selector: ${selector}`);
                        return element;
                    }
                }
            } catch (error) {
                // Invalid selector, continue
            }
        }
        console.warn('[Facebook] Element not found. Tried selectors:', selectors);
        return null;
    },

    /**
     * Find element by text content
     * @param {string} tag - Element tag (e.g., 'div', 'button')
     * @param {string} text - Text to search for
     * @param {string} role - Optional role attribute
     * @returns {Element|null}
     */
    findByText(tag, text, role = null) {
        let selector = tag;
        if (role) {
            selector += `[role="${role}"]`;
        }

        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            if (element.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
                console.log(`[Facebook] Found element by text: ${text}`);
                return element;
            }
        }
        return null;
    },

    /**
     * Find element by aria-label
     * @param {string} ariaLabel - Aria-label value (partial match)
     * @returns {Element|null}
     */
    findByAriaLabel(ariaLabel) {
        const selector = `[aria-label*="${ariaLabel}"]`;
        const element = document.querySelector(selector);
        if (element) {
            console.log(`[Facebook] Found element by aria-label: ${ariaLabel}`);
        }
        return element;
    },

    /**
     * Wait for element to appear
     * @param {string[]} selectors - Array of selectors
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Element>}
     */
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
                    reject(new Error(`Element not found after ${timeout}ms. Tried: ${selectors.join(', ')}`));
                }
            }, 500);
        });
    },

    /**
     * Wait for element by condition
     * @param {Function} condition - Function that returns element or null
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Element>}
     */
    async waitForCondition(condition, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkInterval = setInterval(() => {
                const element = condition();
                if (element) {
                    clearInterval(checkInterval);
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Condition not met after ${timeout}ms`));
                }
            }, 500);
        });
    }
};

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FacebookSelectors;
}
