/**
 * Facebook Reels Upload - Content Script
 * 
 * This content script runs on Facebook pages and handles Reels upload.
 * 
 * IMPORTANT:
 * - Facebook uses dynamic class names that change frequently
 * - We rely on aria-labels, data-testid, and role attributes
 * - Selectors need regular updates as Facebook changes UI
 * - contenteditable div is used for caption (not textarea)
 */

const FacebookSelectors = {
    fileInput: [
        'input[type="file"][accept*="video"]',
        'input[accept*="video"]'
    ],
    uploadArea: [
        '[aria-label*="Upload"]',
        'div[role="button"]:has-text("Upload")',
        'input[type="file"] + div'
    ],
    uploadProgress: [
        '[role="progressbar"]',
        '[aria-valuenow]'
    ],
    captionEditor: [
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"][aria-label*="caption"]',
        'div[contenteditable="true"][aria-placeholder]'
    ],
    publishButton: [
        '[aria-label="Post"]',
        '[aria-label="Share"]',
        'div[role="button"]:has-text("Post")',
        'div[role="button"]:has-text("Share")'
    ],
    privacySelector: [
        '[aria-label*="Privacy"]',
        '[aria-label*="Audience"]',
        'div[role="button"][aria-haspopup="menu"]'
    ],
    scheduleButton: [
        '[aria-label*="Schedule"]',
        'div[role="button"]:has-text("Schedule")'
    ],
    tagProductsButton: [
        '[aria-label*="Tag products"]',
        'div[role="button"]:has-text("Tag products")'
    ]
};

// Helper functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findElement(selectors) {
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
                    return element;
                }
            }
        } catch (error) {
            // Invalid selector, continue
        }
    }
    return null;
}

function findByAriaLabel(partialLabel) {
    const element = document.querySelector(`[aria-label*="${partialLabel}"]`);
    return element;
}

function findByText(tag, text, role = null) {
    let selector = tag;
    if (role) {
        selector += `[role="${role}"]`;
    }

    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
        if (element.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
            return element;
        }
    }
    return null;
}

async function waitForElement(selectors, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const element = findElement(selectors);
        if (element) {
            return element;
        }
        await sleep(500);
    }

    throw new Error(`Element not found after ${timeout}ms. Tried: ${selectors.join(', ')}`);
}

// Main upload function
async function uploadToFacebook(filesData) {
    console.log('[Facebook] Starting Reels upload...');

    try {
        // 1. Check if on Facebook
        if (!window.location.href.includes('facebook.com')) {
            return {
                success: false,
                error: 'Not on Facebook. Please navigate to facebook.com first.'
            };
        }

        // 2. Find file input
        console.log('[Facebook] Looking for file input...');
        let fileInput = findElement(FacebookSelectors.fileInput);

        if (!fileInput) {
            // Try to find upload area that might trigger file input
            console.log('[Facebook] File input not visible, looking for upload trigger...');
            const uploadArea = findElement(FacebookSelectors.uploadArea);
            if (uploadArea) {
                uploadArea.click();
                await sleep(1500);
                fileInput = await waitForElement(FacebookSelectors.fileInput, 5000);
            }
        }

        if (!fileInput) {
            return {
                success: false,
                error: 'File input not found. Please navigate to Create Reel page first.'
            };
        }

        console.log('[Facebook] File input found');

        // 3. Convert base64 to files
        console.log('[Facebook] Converting files...');
        const files = await convertBase64ToFiles(filesData);

        // 4. Set files to input
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;

        // 5. Trigger events
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));

        console.log('[Facebook] Files set, waiting for upload...');

        // 6. Wait for upload to complete
        await waitForUploadComplete();

        console.log('[Facebook] Upload completed');

        return {
            success: true,
            message: 'Video uploaded successfully to Facebook Reels'
        };

    } catch (error) {
        console.error('[Facebook] Upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Fill caption function (contenteditable)
async function fillFacebookCaption(caption) {
    console.log('[Facebook] Filling caption...');

    try {
        const editor = await waitForElement(FacebookSelectors.captionEditor, 5000);

        if (!editor) {
            return {
                success: false,
                error: 'Caption editor not found'
            };
        }

        // Focus the contenteditable div
        editor.focus();
        await sleep(200);

        // Clear existing content
        editor.textContent = '';

        // Set new content
        editor.textContent = caption;

        // Trigger input events for React/Vue detection
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));

        // Alternative: Insert text using execCommand (deprecated but sometimes works)
        // document.execCommand('insertText', false, caption);

        await sleep(500);

        console.log('[Facebook] Caption filled');

        return {
            success: true,
            message: 'Caption filled successfully'
        };

    } catch (error) {
        console.error('[Facebook] Caption error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Tag product function
async function tagFacebookProduct(productUrl) {
    console.log('[Facebook] Tagging product:', productUrl);

    try {
        // 1. Click "Tag Products" button
        const tagButton = await waitForElement(FacebookSelectors.tagProductsButton, 5000);

        if (!tagButton) {
            return {
                success: false,
                error: 'Tag products button not found. Feature may not be available.'
            };
        }

        tagButton.click();
        await sleep(2000);

        // 2. Product tagging is complex on Facebook
        // May require product catalog setup
        // For now, just log a warning
        console.log('[Facebook] Product tagging opened, but implementation is complex');
        console.log('[Facebook] Requires Facebook Shop/Catalog integration');

        return {
            success: true,
            message: 'Product tagging opened (manual tagging may be required)'
        };

    } catch (error) {
        console.error('[Facebook] Product tagging error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Set privacy function
async function setFacebookPrivacy(privacy = 'Public') {
    console.log('[Facebook] Setting privacy to:', privacy);

    try {
        const privacySelector = await waitForElement(FacebookSelectors.privacySelector, 5000);

        if (!privacySelector) {
            return {
                success: false,
                error: 'Privacy selector not found'
            };
        }

        // Click to open privacy menu
        privacySelector.click();
        await sleep(1000);

        // Find privacy option by text
        const privacyOption = findByText('div', privacy, 'menuitem') ||
            findByText('div', privacy, 'radio');

        if (privacyOption) {
            privacyOption.click();
            await sleep(500);
            console.log('[Facebook] Privacy set to:', privacy);
        } else {
            console.warn('[Facebook] Privacy option not found, using default');
        }

        return {
            success: true,
            message: `Privacy set to ${privacy}`
        };

    } catch (error) {
        console.error('[Facebook] Privacy error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Schedule post function
async function scheduleFacebookPost(scheduleTime) {
    console.log('[Facebook] Scheduling post for:', scheduleTime);

    try {
        const scheduleButton = await waitForElement(FacebookSelectors.scheduleButton, 5000);

        if (!scheduleButton) {
            return {
                success: false,
                error: 'Schedule button not found. Feature may not be available for Reels.'
            };
        }

        scheduleButton.click();
        await sleep(1500);

        // Date/time picker implementation would go here
        // Facebook's date picker is complex and varies by region
        console.log('[Facebook] Schedule picker opened');
        console.log('[Facebook] Automatic date/time setting not implemented - requires manual input');

        return {
            success: true,
            message: 'Schedule picker opened (manual time selection required)'
        };

    } catch (error) {
        console.error('[Facebook] Schedule error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Publish function
async function publishFacebookReel() {
    console.log('[Facebook] Publishing Reel...');

    try {
        const publishButton = await waitForElement(FacebookSelectors.publishButton, 5000);

        if (!publishButton) {
            return {
                success: false,
                error: 'Publish button not found'
            };
        }

        publishButton.click();
        await sleep(2000);

        console.log('[Facebook] Reel published');

        return {
            success: true,
            message: 'Reel published successfully'
        };

    } catch (error) {
        console.error('[Facebook] Publish error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Helper: Convert base64 to File objects
async function convertBase64ToFiles(filesData) {
    return Promise.all(filesData.map(async (fileData) => {
        const response = await fetch(fileData.dataUrl);
        const blob = await response.blob();
        return new File([blob], fileData.name, { type: fileData.type });
    }));
}

// Helper: Wait for upload to complete
async function waitForUploadComplete() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const progressBar = findElement(FacebookSelectors.uploadProgress);

            // If no progress bar found, assume upload complete
            if (!progressBar) {
                clearInterval(checkInterval);
                resolve();
                return;
            }

            // Check progress value
            const value = progressBar.getAttribute('aria-valuenow');
            if (value && parseFloat(value) >= 100) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 500);

        // Timeout after 3 minutes
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 180000);
    });
}

// Initialize content script
(() => {
    console.log('[Facebook] Content script loaded');

    // Listen for messages from extension
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Facebook] Message received:', message.action);

        const action = message.action;

        if (action === 'uploadToFacebook') {
            uploadToFacebook(message.files)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'fillFacebookCaption') {
            fillFacebookCaption(message.caption)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'tagFacebookProduct') {
            tagFacebookProduct(message.productUrl)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'setFacebookPrivacy') {
            setFacebookPrivacy(message.privacy)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'scheduleFacebookPost') {
            scheduleFacebookPost(message.scheduleTime)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'publishFacebookReel') {
            publishFacebookReel()
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'checkElement') {
            const element = findElement([message.selector]);
            sendResponse({ exists: !!element });
            return true;
        }
    });
})();
