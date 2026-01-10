/**
 * Multi-Platform Uploader Integration
 * 
 * Extends TikTok uploader to support multiple platforms
 */

// Initialize platform selector and upload manager
let platformSelector;
let uploadManager;

async function initMultiPlatform() {
    console.log('[MultiPlatform] Initializing...');

    // Initialize platform selector
    platformSelector = new PlatformSelector();
    platformSelector.init();

    // Initialize upload manager
    uploadManager = new MultiPlatformUploadManager();
    await uploadManager.init();

    // Listen to platform selection changes
    platformSelector.onChange((selectedIds, platformsInfo) => {
        console.log('[MultiPlatform] Selected platforms:', selectedIds);
        updateUIForPlatforms(platformsInfo);
    });

    console.log('[MultiPlatform] Initialization complete');
}

/**
 * Update UI based on selected platforms
 */
function updateUIForPlatforms(platformsInfo) {
    console.log('[MultiPlatform] Updating UI for platforms:', platformsInfo);

    // Update label names based on platforms
    const hasYouTube = platformsInfo.some(p => p.id === 'youtube');
    const productNameLabel = document.getElementById('tiktokProductNameLabel');

    if (hasYouTube && productNameLabel) {
        productNameLabel.textContent = 'หัวข้อ/ชื่อสินค้า';
    } else if (productNameLabel) {
        productNameLabel.textContent = 'ชื่อสินค้า';
    }

    // Show/hide platform-specific fields
    updatePlatformFields(platformsInfo);
}

/**
 * Update platform-specific fields visibility
 */
function updatePlatformFields(platformsInfo) {
    const platformIds = platformsInfo.map(p => p.id);

    // Show product ID only if TikTok is selected
    const productIdGroup = document.getElementById('tiktokProductIdGroup');
    if (productIdGroup) {
        productIdGroup.hidden = !platformIds.includes('tiktok');
    }

    // Show cart name only if TikTok is selected
    const cartNameGroup = document.getElementById('tiktokCartNameGroup');
    if (cartNameGroup) {
        cartNameGroup.hidden = !platformIds.includes('tiktok');
    }
}

/**
 * Upload to multiple platforms
 */
async function uploadToMultiplePlatforms() {
    const selectedPlatforms = platformSelector.getSelected();

    if (selectedPlatforms.length === 0) {
        alert('กรุณาเลือกแพลตฟอร์มอย่างน้อย 1 แพลตฟอร์ม');
        return;
    }

    // Get files
    const files = TikTokUploader.files;
    if (files.length === 0) {
        alert('กรุณาเลือกไฟล์วิดีโอ');
        return;
    }

    // Get caption
    const caption = TikTokUploader.captionEditor.value.trim();
    if (!caption) {
        alert('กรุณากรอก Caption');
        return;
    }

    console.log(`[MultiPlatform] Uploading to ${selectedPlatforms.length} platforms...`);

    // Show progress UI
    showUploadProgress();

    try {
        // Build platform-specific options
        const options = {};

        for (const platformId of selectedPlatforms) {
            options[platformId] = {};

            if (platformId === 'tiktok') {
                const productId = document.getElementById('tiktokProductId')?.value;
                if (productId) {
                    options[platformId].productId = productId;
                }

                const cartName = document.getElementById('tiktokCartName')?.value;
                if (cartName) {
                    options[platformId].cartName = cartName;
                }
            }

            if (platformId === 'facebook') {
                options[platformId].privacy = 'Public'; // Could add UI for this
            }

            if (platformId === 'youtube') {
                options[platformId].visibility = 'Public'; // Could add UI for this
            }
        }

        // Upload to all platforms
        const result = await uploadManager.uploadToMultiplePlatforms({
            file: files[0],
            caption: caption,
            description: caption, // For YouTube
            platforms: selectedPlatforms,
            options: options
        });

        console.log('[MultiPlatform] Upload complete:', result);

        // Show results
        showUploadResults(result);

    } catch (error) {
        console.error('[MultiPlatform] Upload failed:', error);
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
        hideUploadProgress();
    }
}

/**
 * Show upload progress UI
 */
function showUploadProgress() {
    const container = document.createElement('div');
    container.id = 'multiplatform-progress';
    container.className = 'upload-progress-container';

    const selectedPlatforms = platformSelector.getSelectedPlatformsInfo();

    const items = selectedPlatforms.map(platform => `
    <div class="upload-progress-item" id="progress-${platform.id}">
      <span class="upload-platform-icon">${platform.icon}</span>
      <div class="upload-platform-info">
        <div class="upload-platform-name">${platform.name}</div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" style="width: 0%"></div>
        </div>
      </div>
      <span class="upload-status-icon uploading">⏳</span>
    </div>
  `).join('');

    container.innerHTML = `
    <h3 style="margin: 0 0 15px 0;">กำลังอัพโหลด...</h3>
    ${items}
  `;

    const uploadSection = document.getElementById('tiktokUploadSection');
    if (uploadSection) {
        uploadSection.insertAdjacentElement('afterend', container);
    }

    // Register progress callback
    uploadManager.onProgress((platformId, status, progress, error) => {
        updateProgressItem(platformId, status, progress, error);
    });
}

/**
 * Update progress item
 */
function updateProgressItem(platformId, status, progress, error) {
    const item = document.getElementById(`progress-${platformId}`);
    if (!item) return;

    const progressFill = item.querySelector('.upload-progress-fill');
    const statusIcon = item.querySelector('.upload-status-icon');

    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }

    if (statusIcon) {
        if (status === 'complete') {
            statusIcon.textContent = '✅';
            statusIcon.className = 'upload-status-icon success';
        } else if (status === 'error') {
            statusIcon.textContent = '❌';
            statusIcon.className = 'upload-status-icon error';
        }
    }
}

/**
 * Hide upload progress UI
 */
function hideUploadProgress() {
    const progress = document.getElementById('multiplatform-progress');
    if (progress) {
        setTimeout(() => progress.remove(), 3000);
    }
}

/**
 * Show upload results
 */
function showUploadResults(result) {
    const container = document.createElement('div');
    container.className = 'upload-results';

    const successCount = result.successCount || 0;
    const totalCount = result.totalCount || 0;
    const failCount = totalCount - successCount;

    const resultItems = result.results.map(r => {
        const platform = platformSelector.getPlatformInfo(r.platformId);
        if (!platform) return '';

        return `
      <div class="upload-result-item ${r.success ? 'success' : 'error'}">
        <span class="result-platform-icon">${platform.icon}</span>
        <div class="result-platform-details">
          <div class="result-platform-name">${platform.name}</div>
          ${r.success
                ? `<div class="result-message">อัพโหลดสำเร็จ</div>`
                : `<div class="result-error">ล้มเหลว: ${r.error}</div>`
            }
        </div>
      </div>
    `;
    }).join('');

    container.innerHTML = `
    <div class="upload-results-header">
      <h3>ผลการอัพโหลด</h3>
      <div class="upload-results-summary">
        <span class="result-badge success">${successCount} สำเร็จ</span>
        ${failCount > 0 ? `<span class="result-badge error">${failCount} ล้มเหลว</span>` : ''}
      </div>
    </div>
    <div class="upload-results-list">
      ${resultItems}
    </div>
  `;

    const automationStatus = document.getElementById('tiktokAutomationStatus');
    if (automationStatus) {
        automationStatus.insertAdjacentElement('afterend', container);
    }

    // Auto remove after 10 seconds
    setTimeout(() => container.remove(), 10000);
}

/**
 * Modify automation button to use multi-platform upload
 */
function patchTikTokAutomationBtn() {
    const automationBtn = document.getElementById('tiktokAutomationBtn');
    if (!automationBtn) return;

    // Store original handler
    const originalHandler = automationBtn.onclick;

    // Replace with multi-platform handler
    automationBtn.onclick = async function (e) {
        e.preventDefault();

        const selectedPlatforms = platformSelector.getSelected();

        if (selectedPlatforms.length === 1 && selectedPlatforms[0] === 'tiktok') {
            // Use original TikTok-only handler
            if (originalHandler) {
                originalHandler.call(this, e);
            }
        } else {
            // Use multi-platform upload
            await uploadToMultiplePlatforms();
        }
    };

    console.log('[MultiPlatform] Patched automation button');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await initMultiPlatform();
    patchTikTokAutomationBtn();
});
