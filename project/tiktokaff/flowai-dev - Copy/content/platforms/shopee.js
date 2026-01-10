/**
 * Shopee Video Upload - Content Script
 * 
 * This content script runs on Shopee Seller Center pages
 * and handles video upload, caption filling, and product linking.
 * 
 * IMPORTANT: This is a placeholder implementation.
 * Selectors need to be verified on actual Shopee Seller Center.
 */

// Import selectors (or include inline)
// For now, we'll define a minimal selector set inline

const ShopeeSelectors = {
    uploadButton: [
        'button[data-testid="upload-video-button"]',
        'input[type="file"][accept*="video"]',
        '[class*="upload-button"]'
    ],
    fileInput: [
        'input[type="file"][accept*="video"]',
        'input[type="file"][accept*="mp4"]'
    ],
    uploadProgress: [
        '[class*="upload-progress"]',
        '[class*="progress-bar"]'
    ],
    captionField: [
        'textarea[name="title"]',
        'textarea[name="description"]',
        'textarea[class*="title"]'
    ],
    addProductButton: [
        'button:contains("Add Product")',
        'button:contains("เพิ่มสินค้า")',
        '[class*="add-product-button"]'
    ],
    productSearchInput: [
        'input[name="product-search"]',
        'input[placeholder*="search"]',
        '[class*="product-search"]'
    ],
    firstProductCard: [
        '[data-testid="product-item"]:first-child',
        '[class*="product-item"]:first-child',
        '[class*="product-card"]:first-child'
    ],
    confirmButton: [
        'button:contains("Confirm")',
        'button:contains("ยืนยัน")',
        'button[type="submit"]'
    ],
    publishButton: [
        'button:contains("Publish")',
        'button:contains("Post")',
        'button:contains("โพสต์")',
        'button[type="submit"]'
    ]
};

// Helper functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findElement(selectors) {
    for (const selector of selectors) {
        try {
            // Handle :contains() pseudo-selector
            if (selector.includes(':contains(')) {
                const match = selector.match(/^([^:]+):contains\("([^"]+)"\)$/);
                if (match) {
                    const [, baseSelector, text] = match;
                    const elements = document.querySelectorAll(baseSelector || 'button');
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
async function uploadToShopee(filesData) {
    console.log('[Shopee] Starting video upload...');

    try {
        // 1. Check if on Shopee seller page
        if (!window.location.href.includes('seller.shopee')) {
            return {
                success: false,
                error: 'Not on Shopee seller page. Please navigate to seller.shopee.co.th first.'
            };
        }

        // 2. Find file input
        console.log('[Shopee] Looking for file input...');
        let fileInput = findElement(ShopeeSelectors.fileInput);

        if (!fileInput) {
            // Try clicking upload button first
            console.log('[Shopee] File input not found, trying upload button...');
            const uploadBtn = findElement(ShopeeSelectors.uploadButton);
            if (uploadBtn) {
                uploadBtn.click();
                await sleep(1500);
                fileInput = await waitForElement(ShopeeSelectors.fileInput, 5000);
            }
        }

        if (!fileInput) {
            return {
                success: false,
                error: 'File input not found. Please make sure you are on the video upload page.'
            };
        }

        console.log('[Shopee] File input found');

        // 3. Convert base64 to files
        console.log('[Shopee] Converting files...');
        const files = await convertBase64ToFiles(filesData);

        // 4. Set files to input
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;

        // 5. Trigger change event
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));

        console.log('[Shopee] Files set, waiting for upload...');

        // 6. Wait for upload to complete
        await waitForUploadComplete();

        console.log('[Shopee] Upload completed');

        return {
            success: true,
            message: 'Video uploaded successfully to Shopee'
        };

    } catch (error) {
        console.error('[Shopee] Upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Fill caption function
async function fillShopeeCaption(caption) {
    console.log('[Shopee] Filling caption...');

    try {
        const captionField = await waitForElement(ShopeeSelectors.captionField, 5000);

        if (!captionField) {
            return {
                success: false,
                error: 'Caption field not found'
            };
        }

        // Focus and fill
        captionField.focus();
        await sleep(200);

        captionField.value = caption;
        captionField.dispatchEvent(new Event('input', { bubbles: true }));
        captionField.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(500);

        console.log('[Shopee] Caption filled');

        return {
            success: true,
            message: 'Caption filled successfully'
        };

    } catch (error) {
        console.error('[Shopee] Caption error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Link product function
async function linkShopeeProduct(productId) {
    console.log('[Shopee] Linking product:', productId);

    try {
        // 1. Click "Add Product" button
        const addProductBtn = await waitForElement(ShopeeSelectors.addProductButton, 5000);

        if (!addProductBtn) {
            return {
                success: false,
                error: 'Add product button not found. Product linking may not be available.'
            };
        }

        addProductBtn.click();
        await sleep(1500);

        // 2. Find and fill product search
        const searchInput = await waitForElement(ShopeeSelectors.productSearchInput, 5000);

        if (!searchInput) {
            return {
                success: false,
                error: 'Product search input not found'
            };
        }

        searchInput.value = productId;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(2000); // Wait for search results

        // 3. Select first product
        const firstProduct = await waitForElement(ShopeeSelectors.firstProductCard, 5000);

        if (!firstProduct) {
            return {
                success: false,
                error: 'Product not found in search results'
            };
        }

        firstProduct.click();
        await sleep(800);

        // 4. Confirm selection
        const confirmBtn = findElement(ShopeeSelectors.confirmButton);
        if (confirmBtn) {
            confirmBtn.click();
            await sleep(500);
        }

        console.log('[Shopee] Product linked');

        return {
            success: true,
            message: 'Product linked successfully'
        };

    } catch (error) {
        console.error('[Shopee] Product linking error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Publish video function
async function publishShopeeVideo() {
    console.log('[Shopee] Publishing video...');

    try {
        const publishBtn = await waitForElement(ShopeeSelectors.publishButton, 5000);

        if (!publishBtn) {
            return {
                success: false,
                error: 'Publish button not found'
            };
        }

        publishBtn.click();
        await sleep(2000);

        console.log('[Shopee] Video published');

        return {
            success: true,
            message: 'Video published successfully'
        };

    } catch (error) {
        console.error('[Shopee] Publish error:', error);
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
            const progressBar = findElement(ShopeeSelectors.uploadProgress);

            // If no progress bar found, assume upload complete
            if (!progressBar) {
                clearInterval(checkInterval);
                resolve();
                return;
            }

            // Check if progress is complete
            const value = progressBar.value || progressBar.getAttribute('value');
            if (value && parseFloat(value) >= 100) {
                clearInterval(checkInterval);
                resolve();
            }

            // Check if progress bar is hidden
            if (progressBar.style.display === 'none' ||
                window.getComputedStyle(progressBar).display === 'none') {
                clearInterval(checkInterval);
                resolve();
            }
        }, 500);

        // Timeout after 2 minutes
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 120000);
    });
}

// Initialize content script
(() => {
    console.log('[Shopee] Content script loaded');

    // Listen for messages from extension
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Shopee] Message received:', message.action);

        const action = message.action;

        if (action === 'uploadToShopee') {
            uploadToShopee(message.files)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true; // Keep channel open for async response
        }

        if (action === 'fillShopeeCaption') {
            fillShopeeCaption(message.caption)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'linkShopeeProduct') {
            linkShopeeProduct(message.productId)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'publishShopeeVideo') {
            publishShopeeVideo()
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
