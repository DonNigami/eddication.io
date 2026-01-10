/**
 * YouTube Shorts Upload - Content Script
 * 
 * Handles video upload to YouTube Studio for Shorts
 */

const YouTubeSelectors = {
    fileInput: ['input#upload-input', 'input#content-upload-input', 'input[type="file"][accept*="video"]'],
    selectFilesButton: ['#select-files-button', 'ytcp-button#select-files-button'],
    uploadProgress: ['#progress-label', 'ytcp-video-upload-progress'],
    titleInput: ['#textbox', 'div#textbox[contenteditable="true"]'],
    descriptionInput: ['#description-container #textbox', 'ytcp-social-suggestions-textbox#description-textarea #textbox'],
    shortsToggle: ['#shorts-toggle', 'ytcp-checkbox-lit[label*="Shorts"]'],
    nextButton: ['#next-button', 'ytcp-button#next-button'],
    publicRadio: ['#public-radio-button', 'tp-yt-paper-radio-button[name="PUBLIC"]'],
    scheduleRadio: ['tp-yt-paper-radio-button[name="SCHEDULE"]'],
    scheduleDateInput: ['#datepicker-input'],
    scheduleTimeInput: ['#timepicker-input'],
    publishButton: ['#done-button', 'ytcp-button#done-button'],
    closeButton: ['#close-button']
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findElement(selectors) {
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element) return element;
        } catch (error) { }
    }
    return null;
}

async function waitForElement(selectors, timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = findElement(selectors);
        if (element) return element;
        await sleep(500);
    }
    throw new Error(`Element not found: ${selectors.join(', ')}`);
}

async function uploadToYouTube(filesData) {
    console.log('[YouTube] Starting upload...');

    try {
        if (!window.location.href.includes('studio.youtube.com')) {
            return { success: false, error: 'Not on YouTube Studio. Please navigate to studio.youtube.com first.' };
        }

        console.log('[YouTube] Looking for file input...');
        let fileInput = findElement(YouTubeSelectors.fileInput);

        if (!fileInput) {
            console.log('[YouTube] Trying select files button...');
            const selectBtn = findElement(YouTubeSelectors.selectFilesButton);
            if (selectBtn) {
                selectBtn.click();
                await sleep(1500);
                fileInput = await waitForElement(YouTubeSelectors.fileInput, 5000);
            }
        }

        if (!fileInput) {
            return { success: false, error: 'File input not found. Please navigate to upload page.' };
        }

        console.log('[YouTube] Converting files...');
        const files = await convertBase64ToFiles(filesData);

        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('[YouTube] Files set, waiting for processing...');
        await waitForUploadComplete();

        console.log('[YouTube] Upload completed');
        return { success: true, message: 'Video uploaded to YouTube' };

    } catch (error) {
        console.error('[YouTube] Upload error:', error);
        return { success: false, error: error.message };
    }
}

async function fillYouTubeTitle(title) {
    console.log('[YouTube] Filling title...');

    try {
        const titleInput = await waitForElement(YouTubeSelectors.titleInput, 10000);

        titleInput.focus();
        await sleep(200);

        // Clear and set content
        titleInput.textContent = '';
        titleInput.textContent = title;

        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(500);
        console.log('[YouTube] Title filled');
        return { success: true };

    } catch (error) {
        console.error('[YouTube] Title error:', error);
        return { success: false, error: error.message };
    }
}

async function fillYouTubeDescription(description) {
    console.log('[YouTube] Filling description...');

    try {
        const descInput = await waitForElement(YouTubeSelectors.descriptionInput, 5000);

        descInput.focus();
        await sleep(200);

        descInput.textContent = '';
        descInput.textContent = description;

        descInput.dispatchEvent(new Event('input', { bubbles: true }));
        descInput.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(500);
        console.log('[YouTube] Description filled');
        return { success: true };

    } catch (error) {
        console.error('[YouTube] Description error:', error);
        return { success: false, error: error.message };
    }
}

async function markAsShort() {
    console.log('[YouTube] Marking as Short...');

    try {
        const shortsToggle = findElement(YouTubeSelectors.shortsToggle);

        if (shortsToggle) {
            // Check if already checked
            const isChecked = shortsToggle.hasAttribute('checked') ||
                shortsToggle.getAttribute('aria-checked') === 'true';

            if (!isChecked) {
                shortsToggle.click();
                await sleep(500);
                console.log('[YouTube] Marked as Short');
            } else {
                console.log('[YouTube] Already marked as Short');
            }
        } else {
            console.log('[YouTube] Shorts toggle not found (may be auto-detected)');
        }

        return { success: true };

    } catch (error) {
        console.error('[YouTube] Mark as Short error:', error);
        return { success: false, error: error.message };
    }
}

async function setYouTubeVisibility(visibility = 'Public') {
    console.log('[YouTube] Setting visibility:', visibility);

    try {
        // Click Next to go to Visibility tab
        const nextBtn = await waitForElement(YouTubeSelectors.nextButton, 5000);
        nextBtn.click();
        await sleep(2000);

        // Click Next again if needed (skip other tabs)
        const nextBtn2 = findElement(YouTubeSelectors.nextButton);
        if (nextBtn2) {
            nextBtn2.click();
            await sleep(2000);
        }

        // Select visibility
        let radio;
        if (visibility.toLowerCase() === 'public') {
            radio = findElement(YouTubeSelectors.publicRadio);
        } else if (visibility.toLowerCase() === 'private') {
            radio = findElement(YouTubeSelectors.privateRadio);
        } else if (visibility.toLowerCase() === 'unlisted') {
            radio = findElement(YouTubeSelectors.unlistedRadio);
        }

        if (radio) {
            radio.click();
            await sleep(500);
            console.log('[YouTube] Visibility set');
        }

        return { success: true };

    } catch (error) {
        console.error('[YouTube] Visibility error:', error);
        return { success: false, error: error.message };
    }
}

async function scheduleYouTubePost(scheduleTime) {
    console.log('[YouTube] Scheduling post...');

    try {
        const scheduleRadio = await waitForElement(YouTubeSelectors.scheduleRadio, 5000);
        scheduleRadio.click();
        await sleep(1000);

        // Date/time picker implementation would go here
        console.log('[YouTube] Schedule picker opened (manual input required)');

        return { success: true, message: 'Schedule picker opened' };

    } catch (error) {
        console.error('[YouTube] Schedule error:', error);
        return { success: false, error: error.message };
    }
}

async function publishYouTubeVideo() {
    console.log('[YouTube] Publishing video...');

    try {
        const publishBtn = await waitForElement(YouTubeSelectors.publishButton, 5000);
        publishBtn.click();
        await sleep(3000);

        console.log('[YouTube] Video published');
        return { success: true };

    } catch (error) {
        console.error('[YouTube] Publish error:', error);
        return { success: false, error: error.message };
    }
}

async function convertBase64ToFiles(filesData) {
    return Promise.all(filesData.map(async (fileData) => {
        const response = await fetch(fileData.dataUrl);
        const blob = await response.blob();
        return new File([blob], fileData.name, { type: fileData.type });
    }));
}

async function waitForUploadComplete() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const progressLabel = findElement(YouTubeSelectors.uploadProgress);

            if (!progressLabel) {
                clearInterval(checkInterval);
                resolve();
                return;
            }

            const text = progressLabel.textContent || '';
            if (text.includes('Upload complete') || text.includes('Processing')) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 300000); // 5 minutes timeout
    });
}

// Initialize
(() => {
    console.log('[YouTube] Content script loaded');

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[YouTube] Message received:', message.action);

        const action = message.action;

        if (action === 'uploadToYouTube') {
            uploadToYouTube(message.files)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'fillYouTubeTitle') {
            fillYouTubeTitle(message.title)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'fillYouTubeDescription') {
            fillYouTubeDescription(message.description)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'markAsShort') {
            markAsShort()
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'setYouTubeVisibility') {
            setYouTubeVisibility(message.visibility)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'scheduleYouTubePost') {
            scheduleYouTubePost(message.scheduleTime)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'publishYouTubeVideo') {
            publishYouTubeVideo()
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
