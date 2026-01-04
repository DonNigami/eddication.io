/**
 * Controls Module
 * Handles button actions and main controls
 * WASM-protected selectors version
 */

// Global selectors cache (loaded from WASM)
let _wasmSelectors = null;

/**
 * Load selectors from WASM module
 */
async function loadWasmSelectors() {
  if (_wasmSelectors) return _wasmSelectors;
  if (typeof window !== 'undefined' && window.__flowxWasmDisabled) {
    _wasmSelectors = getFallbackSelectors();
    return _wasmSelectors;
  }

  try {
    if (typeof WasmLoader !== 'undefined') {
      _wasmSelectors = await WasmLoader.getAllSelectors();
      console.log('[Controls] WASM selectors loaded');
    } else {
      console.log('[Controls] WasmLoader not available, using fallback');
      _wasmSelectors = getFallbackSelectors();
    }
  } catch (error) {
    console.log('[Controls] CSP detected - using fallback selectors. Extension working normally.');
    // Avoid retrying WASM load in this session when CSP blocks wasm-eval
    _wasmSelectors = getFallbackSelectors();
    // Prevent future attempts in this session
    try { window.__flowxWasmDisabled = true; } catch (_) { }
  }

  return _wasmSelectors;
}

/**
 * Fallback selectors (if WASM fails to load)
 */
function getFallbackSelectors() {
  return {
    addButton: 'div.sc-76e54377-0 button > i',
    addButtonFull: '#__next div.sc-76e54377-0 button > i',
    combobox: 'button[role="combobox"]',
    videoModeText: 'Frames to Video',
    imageModeText: 'Create Image',
    selectImage: 'div.sc-6349d8ef-6 button.sc-6349d8ef-1',
    selectImageFull: '#__next div.sc-c884da2c-5 div:nth-child(2) div.sc-6349d8ef-6 button',
    dialog: '[id^="radix-"]',
    fileInput: '[id^="radix-"] input[type="file"]',
    virtuosoGrid: '[id^="radix-"] .virtuoso-grid-list',
    gridFirstButton: '[id^="radix-"] .virtuoso-grid-list > div:first-child > button',
    createButton: 'div.sc-408537d4-1 button',
    downloadIcon: 'i.material-icons, i.google-symbols',
    downloadIconText: 'download',
    switchImage: 'div.sc-2bfc07e-0 button:nth-child(2)',
    confirmButton: '[id^="radix-"] button.sc-19de2353-7',
    menuItem: '[role="menuitem"], [role="option"], li, div, span',
    promptTextarea: 'textarea[placeholder]',
  };
}

const Controls = {
  isGenerating: false,

  /**
   * Check if tab URL can be scripted
   */
  canScriptTab(tab) {
    if (!tab || !tab.url) return false;
    const url = tab.url;
    if (url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
      url.startsWith('moz-extension://')) {
      return false;
    }
    return true;
  },

  /**
   * Initialize controls
   */
  async init() {
    // Pre-load WASM selectors
    await loadWasmSelectors();
    this.setupEventListeners();
  },

  /**
   * Setup event listeners for control buttons
   */
  setupEventListeners() {
    document.getElementById('automationBtn').addEventListener('click', () => {
      this.handleAutomation();
    });

    document.getElementById('stopAutomationBtn').addEventListener('click', () => {
      this.stopAutomation();
    });

    document.getElementById('loopCountSelect').addEventListener('change', (e) => {
      const customInput = document.getElementById('customLoopCount');
      if (e.target.value === 'custom') {
        customInput.hidden = false;
        customInput.focus();
      } else {
        customInput.hidden = true;
      }
    });

    // Prompt generation buttons (always visible)
    const generateImagePromptBtn = document.getElementById('generateImagePromptBtn');
    if (generateImagePromptBtn) {
      generateImagePromptBtn.addEventListener('click', () => {
        this.handleGeneratePrompt();
      });
    }

    const generateVideoPromptBtn = document.getElementById('generateVideoPromptBtn');
    if (generateVideoPromptBtn) {
      generateVideoPromptBtn.addEventListener('click', () => {
        this.handleGenerateVideoPrompt();
      });
    }

    this.setupTestButtons();
  },

  /**
   * Setup test buttons based on CONFIG.showTestButtons
   */
  setupTestButtons() {
    const showButtons = typeof APP_CONFIG !== 'undefined' && APP_CONFIG.showTestButtons === true;

    const testVideoModeBtn = document.getElementById('testVideoModeBtn');
    const testImageModeBtn = document.getElementById('testImageModeBtn');
    const testSelectImageBtn = document.getElementById('testSelectImageBtn');
    const testDownloadBtn = document.getElementById('testDownloadBtn');
    const testSwitchImageBtn = document.getElementById('testSwitchImageBtn');

    if (testVideoModeBtn) {
      testVideoModeBtn.parentElement.style.display = showButtons ? '' : 'none';
      testVideoModeBtn.addEventListener('click', () => this.handleVideoMode());
    }
    if (testImageModeBtn) {
      testImageModeBtn.addEventListener('click', () => this.handleImageMode());
    }
    if (testSelectImageBtn) {
      testSelectImageBtn.addEventListener('click', () => this.handleSelectImage());
    }
    if (testDownloadBtn) {
      testDownloadBtn.parentElement.style.display = showButtons ? '' : 'none';
      testDownloadBtn.addEventListener('click', () => this.handleDownload());
    }
    if (testSwitchImageBtn) {
      testSwitchImageBtn.addEventListener('click', () => this.handleSwitchImageMode());
    }
  },

  // Automation state
  isAutomationRunning: false,
  currentLoop: 0,
  totalLoops: 1,

  /**
   * Get loop count from select or custom input
   */
  getLoopCount() {
    const select = document.getElementById('loopCountSelect');
    if (select.value === 'custom') {
      const customInput = document.getElementById('customLoopCount');
      return parseInt(customInput.value) || 1;
    }
    return parseInt(select.value) || 1;
  },

  /**
   * Handle Generate Prompt button - calls AI API
   */
  async handleGeneratePrompt() {
    if (this.isGenerating) return;

    const productImage = await ImageUpload.getProductImage();
    if (!productImage) {
      Helpers.showToast('กรุณาอัพโหลดภาพสินค้าก่อน', 'error');
      return;
    }

    const settings = await this.getSettings();
    if (!settings.apiKey) {
      Helpers.showToast('กรุณาตั้งค่า API Key ก่อน', 'error');
      Settings.openModal();
      return;
    }

    const productName = await ImageUpload.getProductName();
    const hasPersonImage = await ImageUpload.hasPersonImage();
    const reviewerGender = await ImageUpload.getReviewerGender();
    const ugcSettings = { gender: reviewerGender, ageRange: UGCSection.getSettings().ageRange };
    const coverDetails = await CoverDetails.getDetails();

    // Get video length from select element (default to 8 if not found)
    const videoLengthSelect = document.getElementById('videoLengthSelect');
    const videoLength = videoLengthSelect ? parseInt(videoLengthSelect.value) : 8;

    this.isGenerating = true;
    const btn = document.getElementById('generatePromptBtn');
    if (btn) btn.disabled = true;
    Helpers.showToast('กำลังสร้าง prompt...', 'info');

    try {
      let rawResponse;
      if (settings.model === 'gemini') {
        rawResponse = await GeminiApi.generatePrompt(
          settings.apiKey, productImage, productName, hasPersonImage, ugcSettings, videoLength
        );
      } else {
        rawResponse = await OpenaiApi.generatePrompt(
          settings.apiKey, productImage, productName, hasPersonImage, ugcSettings, videoLength
        );
      }

      const parsed = ResponseParser.parse(rawResponse, false);
      let finalPrompt = parsed.prompt;

      const headingParts = [];
      if (coverDetails.mainHeading) headingParts.push(`หัวข้อหลัก: "${coverDetails.mainHeading}"`);
      if (coverDetails.subHeading) headingParts.push(`หัวข้อย่อย: "${coverDetails.subHeading}"`);
      if (coverDetails.price) headingParts.push(`ราคา: "${coverDetails.price}"`);

      if (headingParts.length > 0) {
        finalPrompt += `\n\nAdd bold Thai text overlay in TikTok/Reels thumbnail style:
- Large, eye-catching Thai text with vibrant, attention-grabbing colors
- White or black stroke/outline around text for contrast
- Text should be prominent and easy to read
- Style: viral social media cover thumbnail

${headingParts.join('\n')}`;
      }

      // เพิ่มคำสั่งห้ามแก้ไขสินค้า (เฉพาะ built-in templates)
      const currentTemplate = SystemPrompt.currentTemplate;
      const shouldPreserveProduct = !currentTemplate || currentTemplate.isBuiltIn;
      if (shouldPreserveProduct) {
        finalPrompt += `\n\nIMPORTANT: Do NOT modify, change, or alter the product in any way. The product must retain all its original details, design, colors, labels, and packaging exactly as shown in the reference image.`;
      }

      PromptGenerator.setPrompt(finalPrompt);
      Helpers.showToast('สร้าง prompt สำเร็จ', 'success');

    } catch (error) {
      console.error('Error generating prompt:', error);
      Helpers.showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    } finally {
      this.isGenerating = false;
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Get API settings
   */
  getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'selectedModel'], (result) => {
        const model = result.selectedModel || 'gemini';
        const apiKey = model === 'gemini' ? result.geminiApiKey : result.openaiApiKey;
        resolve({ model, apiKey });
      });
    });
  },

  /**
   * Handle Generate Video Prompt button
   */
  async handleGenerateVideoPrompt() {
    if (this.isGenerating) return;

    const productName = await ImageUpload.getProductName();
    if (!productName) {
      Helpers.showToast('กรุณากรอกชื่อสินค้าก่อน', 'error');
      return;
    }

    const reviewerGender = await ImageUpload.getReviewerGender();
    const genderText = reviewerGender === 'female' ? 'ผู้หญิงไทย' : 'ผู้ชายไทย';
    const genderTextEn = reviewerGender === 'female' ? 'Thai woman' : 'Thai man';

    const settings = await this.getSettings();
    if (!settings.apiKey) {
      Helpers.showToast('กรุณาตั้งค่า API Key ก่อน', 'error');
      Settings.openModal();
      return;
    }

    this.isGenerating = true;
    const btn = document.getElementById('generateVideoPromptBtn');
    if (btn) btn.disabled = true;
    Helpers.showToast('กำลังสร้าง prompt วิดีโอ...', 'info');

    try {
      // Get video template from VideoPromptTemplateSelector
      const videoTemplate = VideoPromptTemplateSelector.getSelected();
      const systemPrompt = videoTemplate.systemPrompt;
      const userMessage = VideoPromptTemplateSelector.buildUserMessage(productName, genderText, genderTextEn);

      let rawResponse;
      if (settings.model === 'gemini') {
        rawResponse = await GeminiApi.generateVideoPrompt(settings.apiKey, systemPrompt, userMessage);
      } else {
        rawResponse = await OpenaiApi.generateVideoPrompt(settings.apiKey, systemPrompt, userMessage);
      }

      PromptGenerator.setPrompt(rawResponse);
      Helpers.showToast('สร้าง prompt วิดีโอสำเร็จ', 'success');

    } catch (error) {
      console.error('Error generating video prompt:', error);
      Helpers.showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    } finally {
      this.isGenerating = false;
      if (btn) btn.disabled = false;
    }
  },

  /**
   * Handle Fill Prompt button
   */
  async handleFillPrompt() {
    const prompt = PromptGenerator.getPrompt();
    if (!prompt) {
      Helpers.showToast('กรุณาสร้าง prompt ก่อน', 'error');
      return;
    }

    await this.fillPromptOnPage(prompt);
  },

  /**
   * Fill prompt on page (reusable for story automation)
   */
  async fillPromptOnPage(prompt) {
    if (!prompt) {
      Helpers.showToast('ไม่มี prompt', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        await Helpers.copyToClipboard(prompt);
        Helpers.showToast('คัดลอก prompt แล้ว', 'success');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (promptText) => {
          const textarea = document.getElementById('PINHOLE_TEXT_AREA_ELEMENT_ID');
          if (textarea) {
            textarea.value = promptText;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        },
        args: [prompt]
      });

      if (results && results[0] && results[0].result) {
        Helpers.showToast('กรอก prompt แล้ว', 'success');
      } else {
        await Helpers.copyToClipboard(prompt);
        Helpers.showToast('ไม่พบช่องกรอก คัดลอก prompt แล้ว', 'info');
      }
    } catch (error) {
      console.error('Fill prompt error:', error);
      await Helpers.copyToClipboard(prompt);
      Helpers.showToast('คัดลอก prompt แล้ว', 'success');
    }
  },

  /**
   * Handle Upload Product button - อัพโหลดภาพสินค้าไปยังหน้าเว็บ (WASM selectors)
   */
  async handleUploadProduct() {
    const productImage = await ImageUpload.getProductImage();
    if (!productImage) {
      Helpers.showToast('กรุณาเลือกภาพสินค้าก่อน', 'error');
      return;
    }

    await this.uploadImageToWeb(productImage);

    // After uploading product, check if there's a person image to upload
    const personImage = await ImageUpload.getPersonImage();
    if (personImage) {
      Helpers.showToast('รอ 20 วินาที แล้วจะอัพโหลดภาพคน...', 'info');
      await new Promise(resolve => setTimeout(resolve, 20000));
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await this.uploadPersonToWeb(tab, personImage);
    }
  },

  /**
   * Upload image to web page (reusable for product/character)
   */
  async uploadImageToWeb(imageBase64) {
    if (!imageBase64) {
      throw new Error('ไม่มีรูปภาพ');
    }

    const selectors = await loadWasmSelectors();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!this.canScriptTab(tab)) {
      throw new Error('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน');
    }

    // Step 1: Click add button
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel) => {
        let btn = document.querySelector(sel);
        if (!btn) {
          const buttons = document.querySelectorAll('div.sc-76e54377-0 button');
          for (const button of buttons) {
            const icon = button.querySelector('i');
            if (icon && icon.textContent.trim() === 'add') {
              btn = icon;
              break;
            }
          }
        }
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      },
      args: [selectors.addButton]
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Upload file directly
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (base64Image, fileInputSel) => {
        const byteString = atob(base64Image.split(',')[1]);
        const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeType });
        const file = new File([blob], 'uploaded-image.png', { type: mimeType });

        const fileInput = document.querySelector(fileInputSel) ||
          document.querySelector('[role="dialog"] input[type="file"]') ||
          document.querySelector('input[type="file"]');

        if (fileInput) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          return 'input';
        }
        return false;
      },
      args: [imageBase64, selectors.fileInput]
    });

    if (results && results[0] && results[0].result) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Click confirm
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (confirmSel) => {
          const confirmBtn = document.querySelector(confirmSel);
          if (confirmBtn) {
            confirmBtn.click();
            return true;
          }
          const buttons = document.querySelectorAll('[id^="radix-"] button, [role="dialog"] button');
          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('use') || text.includes('apply') || text.includes('confirm') || text.includes('select')) {
              btn.click();
              return true;
            }
          }
          return false;
        },
        args: [selectors.confirmButton]
      });

      Helpers.showToast('อัพโหลดภาพแล้ว', 'success');
    } else {
      throw new Error('ไม่พบช่องอัพโหลด');
    }
  },

  /**
   * Upload Image to Web with Media Asset Button Click
   * Inserts the media asset button click between dialog open and file upload
   */
  async uploadImageToWebWithMediaAsset(imageBase64) {
    if (!imageBase64) {
      throw new Error('ไม่มีรูปภาพ');
    }

    const selectors = await loadWasmSelectors();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!this.canScriptTab(tab)) {
      throw new Error('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน');
    }

    // Step 1: Click add button (0-800ms)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel) => {
        let btn = document.querySelector(sel);
        if (!btn) {
          const buttons = document.querySelectorAll('div.sc-76e54377-0 button');
          for (const button of buttons) {
            const icon = button.querySelector('i');
            if (icon && icon.textContent.trim() === 'add') {
              btn = icon;
              break;
            }
          }
        }
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      },
      args: [selectors.addButton]
    });

    // Step 2: Wait for dialog to open (800-1800ms)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // ✅ NEW: Click Media Asset Button (1800-3000ms)
    const mediaAssetResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Strategy 1: Direct class selector
        const mediaAssetBtn = document.querySelector('button.sc-fbea20b2-9.cdgKGS');

        if (mediaAssetBtn) {
          console.log('[Upload] Clicking media asset button');
          mediaAssetBtn.click();
          return true;
        }

        // Strategy 2: Search by aria-label
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          if (ariaLabel.toLowerCase().includes('media') || ariaLabel.toLowerCase().includes('asset')) {
            console.log('[Upload] Found media asset button by aria-label');
            btn.click();
            return true;
          }
        }

        // Strategy 3: Search by text content
        for (const btn of buttons) {
          const span = btn.querySelector('span');
          if (span && span.textContent.toLowerCase().includes('previously uploaded')) {
            console.log('[Upload] Found media asset button by text');
            btn.click();
            return true;
          }
        }

        console.warn('[Upload] Media asset button not found');
        return false;
      }
    });

    const mediaAssetClicked = mediaAssetResults?.[0]?.result || false;

    // Step 3: Wait for media selection UI (3000-5000ms)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // If media asset button was NOT clicked, proceed with file upload
    if (!mediaAssetClicked) {
      // Step 4: Upload file directly (5000-5500ms)
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (base64Image, fileInputSel) => {
          const byteString = atob(base64Image.split(',')[1]);
          const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeType });
          const file = new File([blob], 'uploaded-image.png', { type: mimeType });

          const fileInput = document.querySelector(fileInputSel) ||
            document.querySelector('[role="dialog"] input[type="file"]') ||
            document.querySelector('input[type="file"]');

          if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            return 'input';
          }
          return false;
        },
        args: [imageBase64, selectors.fileInput]
      });

      if (results && results[0] && results[0].result) {
        // Step 5: Wait for preview (5500-6500ms)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 6: Click confirm (6500-6700ms)
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (confirmSel) => {
            const confirmBtn = document.querySelector(confirmSel);
            if (confirmBtn) {
              confirmBtn.click();
              return true;
            }
            const buttons = document.querySelectorAll('[id^="radix-"] button, [role="dialog"] button');
            for (const btn of buttons) {
              const text = btn.textContent.toLowerCase();
              if (text.includes('use') || text.includes('apply') || text.includes('confirm') || text.includes('select')) {
                btn.click();
                return true;
              }
            }
            return false;
          },
          args: [selectors.confirmButton]
        });

        Helpers.showToast('อัพโหลดภาพแล้ว', 'success');
      } else {
        throw new Error('ไม่พบช่องอัพโหลด');
      }
    } else {
      // Media asset was selected - wait for user to select and confirm
      console.log('[Upload] Media asset button clicked, waiting for user selection');

      // Wait for user selection to complete (up to 10 seconds)
      let confirmed = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if upload dialog is still open
        const isDialogStillOpen = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return !!document.querySelector('[role="dialog"]');
          }
        });

        if (!isDialogStillOpen?.[0]?.result) {
          confirmed = true;
          break;
        }
      }

      if (confirmed) {
        Helpers.showToast('เลือกไฟล์จากคลังแล้ว', 'success');
      } else {
        Helpers.showToast('กำลังรอการเลือกไฟล์จากคลังของคุณ', 'info');
      }
    }
  },

  /**
   * Upload person image to web (WASM selectors)
   */
  async uploadPersonToWeb(tab, personImage) {
    const selectors = await loadWasmSelectors();

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          let btn = document.querySelector(sel);
          if (!btn) {
            const buttons = document.querySelectorAll('div.sc-76e54377-0 button');
            for (const button of buttons) {
              const icon = button.querySelector('i');
              if (icon && icon.textContent.trim() === 'add') {
                btn = icon;
                break;
              }
            }
          }
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        },
        args: [selectors.addButton]
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (base64Image, fileInputSel) => {
          const byteString = atob(base64Image.split(',')[1]);
          const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeType });
          const file = new File([blob], 'person-image.png', { type: mimeType });

          const fileInput = document.querySelector(fileInputSel) ||
            document.querySelector('[role="dialog"] input[type="file"]') ||
            document.querySelector('input[type="file"]');

          if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        },
        args: [personImage, selectors.fileInput]
      });

      if (results && results[0] && results[0].result) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click Crop and Save button 3 times for character image
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await this.clickCropAndSave(tab, 3);

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (confirmSel) => {
            const confirmBtn = document.querySelector(confirmSel);
            if (confirmBtn) {
              confirmBtn.click();
              return true;
            }
            const buttons = document.querySelectorAll('[id^="radix-"] button');
            for (const btn of buttons) {
              const text = btn.textContent.toLowerCase();
              if (text.includes('use') || text.includes('apply') || text.includes('confirm') || text.includes('select')) {
                btn.click();
                return true;
              }
            }
            return false;
          },
          args: [selectors.confirmButton]
        });

        Helpers.showToast('อัพโหลดภาพคนแล้ว', 'success');
      }
    } catch (error) {
      console.error('Upload person error:', error);
      Helpers.showToast('อัพโหลดภาพคนไม่สำเร็จ', 'error');
    }
  },

  /**
   * Handle Upload Character button
   */
  handleUploadCharacter() {
    document.getElementById('personImageInput').click();
  },

  /**
   * Handle Create button (WASM selectors)
   */
  async handleCreate() {
    const selectors = await loadWasmSelectors();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        Helpers.showToast('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน', 'error');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        },
        args: [selectors.createButton]
      });

      if (results && results[0] && results[0].result) {
        Helpers.showToast('กดสร้างแล้ว', 'success');
      } else {
        Helpers.showToast('ไม่พบปุ่มสร้าง', 'error');
      }
    } catch (error) {
      console.error('Create button error:', error);
      Helpers.showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  /**
   * Handle Download button (WASM selectors)
   */
  async handleDownload() {
    const selectors = await loadWasmSelectors();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        Helpers.showToast('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน', 'error');
        return;
      }

      // Step 1: Click download button
      const step1 = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (iconSel, iconText) => {
          const icons = document.querySelectorAll(iconSel);
          for (const icon of icons) {
            if (icon.textContent.trim() === iconText) {
              const btn = icon.closest('button');
              if (btn) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        },
        args: [selectors.downloadIcon, selectors.downloadIconText]
      });

      if (!step1 || !step1[0] || !step1[0].result) {
        Helpers.showToast('ไม่พบปุ่มดาวน์โหลด', 'error');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 600));

      // Step 2: Select 720p
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (menuItemSel) => {
          const menus = document.querySelectorAll('[role="menu"], [data-radix-menu-content], [data-state="open"]');
          for (const menu of menus) {
            const items = menu.querySelectorAll(menuItemSel);
            for (const item of items) {
              if (item.textContent.includes('720p') || item.textContent.includes('Original size')) {
                item.click();
                return 'menu';
              }
            }
          }

          const popups = document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"], [role="listbox"]');
          for (const popup of popups) {
            const items = popup.querySelectorAll('*');
            for (const item of items) {
              if (item.textContent.trim().includes('720p')) {
                item.click();
                return 'popup';
              }
            }
          }

          const allDivs = document.querySelectorAll('div');
          for (const div of allDivs) {
            const style = window.getComputedStyle(div);
            const zIndex = parseInt(style.zIndex) || 0;
            if (zIndex > 10 && div.textContent.includes('720p')) {
              const clickable = div.querySelector('[role="menuitem"]') || div;
              if (clickable.textContent.includes('720p')) {
                clickable.click();
                return 'overlay';
              }
            }
          }

          return false;
        },
        args: [selectors.menuItem]
      });

      if (results && results[0] && results[0].result) {
        Helpers.showToast('กำลังดาวน์โหลด 720p', 'success');
      } else {
        Helpers.showToast('ไม่พบตัวเลือก 720p', 'error');
      }
    } catch (error) {
      console.error('Download error:', error);
      Helpers.showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  /**
   * Handle Video Mode button (WASM selectors)
   */
  async handleVideoMode() {
    const selectors = await loadWasmSelectors();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        Helpers.showToast('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน', 'error');
        return;
      }

      // Step 1: Open dropdown with focus + Enter
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (comboboxSel) => {
          const btn = document.querySelector(comboboxSel);
          if (btn) {
            btn.focus();
            btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            return true;
          }
          return false;
        },
        args: [selectors.combobox]
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Select Frames to Video
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (menuItemSel, videoText) => {
          const items = document.querySelectorAll(menuItemSel);
          for (const item of items) {
            if (item.textContent === videoText || item.textContent.trim() === videoText) {
              item.click();
              return true;
            }
          }
          return false;
        },
        args: [selectors.menuItem, selectors.videoModeText]
      });

      if (results && results[0] && results[0].result) {
        // Step 3: Set video duration (after switching to video mode)
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.setVideoDuration();

        Helpers.showToast('เปลี่ยนเป็น Frames to Video แล้ว', 'success');
      } else {
        Helpers.showToast('ไม่พบตัวเลือก Frames to Video', 'error');
      }
    } catch (error) {
      console.error('Video mode error:', error);
      Helpers.showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  /**
   * Set video duration based on settings
   */
  async setVideoDuration() {
    const selectors = await loadWasmSelectors();
    const duration = Settings.getVideoDuration() || 10;

    // If selectors for duration are missing (e.g., fallback mode), skip to avoid unserializable args
    if (!selectors.Gen5DurationBtn || !selectors.Gen5DurationMenuItem) {
      console.log('[Controls] Duration selectors unavailable in fallback mode; skipping setVideoDuration');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        return;
      }

      // Click on Gen5Duration dropdown and select duration
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (durationBtnSel, durationMenuSel, targetDuration) => {
          // Open duration dropdown
          const durationBtn = document.querySelector(durationBtnSel);
          if (!durationBtn) return { success: false, error: 'Duration button not found' };

          durationBtn.click();

          // Wait a bit for menu to appear
          setTimeout(() => {
            const menuItems = document.querySelectorAll(durationMenuSel);

            // Find the item with matching duration (e.g., "5s", "10s", "15s")
            for (const item of menuItems) {
              const text = item.textContent.trim();
              // Match "5s", "10s", "15s" etc.
              if (text === `${targetDuration}s`) {
                item.click();
                return { success: true };
              }
            }

            return { success: false, error: 'Duration option not found' };
          }, 300);

          return { success: true, pending: true };
        },
        args: [selectors.Gen5DurationBtn, selectors.Gen5DurationMenuItem, duration]
      });

      if (results && results[0] && results[0].result) {
        console.log(`[Controls] Set video duration to ${duration}s`);
      }
    } catch (error) {
      console.error('Set video duration error:', error);
    }
  },

  /**
   * Handle Image Mode button (WASM selectors)
   */
  async handleImageMode() {
    const selectors = await loadWasmSelectors();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        Helpers.showToast('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน', 'error');
        return;
      }

      // Step 1: Open dropdown with focus + Enter
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (comboboxSel) => {
          const btn = document.querySelector(comboboxSel);
          if (btn) {
            btn.focus();
            btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            return true;
          }
          return false;
        },
        args: [selectors.combobox]
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Select Create Image
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (menuItemSel, imageText) => {
          const items = document.querySelectorAll(menuItemSel);
          for (const item of items) {
            if (item.textContent === imageText || item.textContent.trim() === imageText) {
              item.click();
              return true;
            }
          }
          return false;
        },
        args: [selectors.menuItem, selectors.imageModeText]
      });

      if (results && results[0] && results[0].result) {
        Helpers.showToast('เปลี่ยนเป็น Create Image แล้ว', 'success');
      } else {
        Helpers.showToast('ไม่พบตัวเลือก Create Image', 'error');
      }
    } catch (error) {
      console.error('Image mode error:', error);
      Helpers.showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  /**
   * Handle Select Image button (WASM selectors)
   */
  async handleSelectImage() {
    const selectors = await loadWasmSelectors();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        Helpers.showToast('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน', 'error');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          let btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        },
        args: [selectors.selectImage]
      });

      if (results && results[0] && results[0].result) {
        Helpers.showToast('กดเลือกภาพแล้ว', 'success');
        await this.clickCropAndSave(tab, 3);
      } else {
        Helpers.showToast('ไม่พบปุ่มเลือกภาพ', 'error');
      }
    } catch (error) {
      console.error('Select image error:', error);
      Helpers.showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  /**
   * Click Crop and Save button multiple times after image selection
   */
  async clickCropAndSave(tab, times = 5) {
    if (!tab || !this.canScriptTab(tab)) {
      console.log('[clickCropAndSave] Cannot script tab');
      return false;
    }

    let successCount = 0;

    for (let i = 0; i < times; i++) {
      // Wait longer to ensure dialog renders
      await new Promise(resolve => setTimeout(resolve, 1500 + (i * 200)));

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          console.log('[clickCropAndSave] Attempt to find and click Crop and Save button');

          // Strategy 1: Try to find button by class selectors from HTML
          let button = null;

          // Direct class match (from inspector: sc-c177465c-1 gdArnN sc-19de2353-7 jcyPCc)
          button = document.querySelector('button.sc-c177465c-1.sc-19de2353-7');
          if (button && button.textContent.includes('Crop and Save')) {
            console.log('[clickCropAndSave] Found via class selector (Strategy 1a)');
            try {
              button.focus();
              button.click();

              // Extra event triggers
              setTimeout(() => {
                button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              }, 50);
              setTimeout(() => {
                button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              }, 100);
              setTimeout(() => {
                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              }, 150);

              return true;
            } catch (e) {
              console.error('[clickCropAndSave] Strategy 1a failed:', e);
            }
          }

          // Strategy 2: Find by searching all buttons for crop icon + text
          const buttons = document.querySelectorAll('button');
          console.log(`[clickCropAndSave] Found ${buttons.length} buttons, searching...`);

          for (const btn of buttons) {
            const iconElement = btn.querySelector('i.material-icons');
            const hasIcon = iconElement && iconElement.textContent.trim() === 'crop';
            const hasText = btn.textContent.includes('Crop and Save');

            if (hasIcon && hasText) {
              // Check visibility
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0) {
                console.log('[clickCropAndSave] Found button with crop icon, clicking (Strategy 2)');
                try {
                  // Use focus to ensure it's active
                  btn.focus();

                  // Click with delay between events
                  btn.click();

                  // Trigger pointer events as well
                  setTimeout(() => {
                    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                  }, 50);
                  setTimeout(() => {
                    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
                  }, 100);

                  return true;
                } catch (e) {
                  console.error('[clickCropAndSave] Strategy 2 failed:', e);
                }
              }
            }
          }

          // Strategy 3: Find button by text only
          console.log('[clickCropAndSave] Trying text-only search (Strategy 3)');
          for (const btn of buttons) {
            const text = btn.textContent.trim();
            if (text === 'Crop and Save' || (text.includes('Crop and Save') && text.length < 100)) {
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.bottom > 0) {
                console.log('[clickCropAndSave] Found by text, clicking (Strategy 3)');
                try {
                  btn.focus();
                  btn.click();

                  setTimeout(() => {
                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                  }, 50);
                  setTimeout(() => {
                    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                  }, 100);

                  return true;
                } catch (e) {
                  console.error('[clickCropAndSave] Strategy 3 failed:', e);
                }
              }
            }
          }

          console.log('[clickCropAndSave] No button found after trying all strategies');
          return false;
        }
      });

      if (results && results[0] && results[0].result) {
        console.log(`[clickCropAndSave] Successfully clicked on attempt ${i + 1}`);
        successCount++;
      } else {
        console.log(`[clickCropAndSave] Click attempt ${i + 1} failed`);
      }
    }

    if (successCount > 0) {
      Helpers.showToast(`กด Crop and Save สำเร็จ ${successCount} ครั้ง`, 'success');
      return true;
    }

    console.log('[clickCropAndSave] Failed to click button after all attempts');
    return false;
  },

  /**
   * Handle Switch Image Mode button (WASM selectors)
   */
  async handleSwitchImageMode() {
    const selectors = await loadWasmSelectors();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!this.canScriptTab(tab)) {
        Helpers.showToast('กรุณาเปิดหน้าเว็บที่ต้องการใช้งานก่อน', 'error');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        },
        args: [selectors.switchImage]
      });

      if (results && results[0] && results[0].result) {
        Helpers.showToast('สลับโหมดภาพแล้ว', 'success');
      } else {
        Helpers.showToast('ไม่พบปุ่มสลับโหมด', 'error');
      }
    } catch (error) {
      console.error('Switch image mode error:', error);
      Helpers.showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  /**
   * Update automation status display (sidebar + web overlay)
   */
  updateAutomationStatus(text) {
    const statusEl = document.getElementById('automationStatus');
    const statusText = document.getElementById('automationStatusText');
    statusText.textContent = text;
    statusEl.hidden = false;

    // Also update web overlay
    this.updateWebOverlayStatus(text);
  },

  /**
   * Hide automation status
   */
  hideAutomationStatus() {
    document.getElementById('automationStatus').hidden = true;
  },

  /**
   * Show overlay on web page
   */
  async showWebOverlay() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const logoUrl = chrome.runtime.getURL('icons/icon128.png');

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (logoSrc) => {
          const existing = document.getElementById('flowx-automation-overlay');
          if (existing) existing.remove();

          const overlay = document.createElement('div');
          overlay.id = 'flowx-automation-overlay';
          overlay.innerHTML = `
            <div style="
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.4);
              z-index: 999999;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              pointer-events: none;
            ">
              <div style="
                background: rgba(0, 0, 0, 0.8);
                padding: 24px 32px;
                border-radius: 16px;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 280px;
              ">
                <img src="${logoSrc}" alt="Eddication Flow AI" style="
                  width: 64px;
                  height: 64px;
                  border-radius: 50%;
                  object-fit: cover;
                  margin-bottom: 12px;
                  animation: flowx-pulse 2s ease-in-out infinite;
                ">
                <div id="flowx-overlay-title" style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">ระบบกำลังทำงาน</div>
                <div id="flowx-overlay-status" style="font-size: 14px; opacity: 0.9; text-align: center; line-height: 1.4;">โปรดรอสักครู่...</div>
                <div id="flowx-overlay-progress" style="font-size: 12px; opacity: 0.7; margin-top: 8px;"></div>
              </div>
            </div>
            <style>
              @keyframes flowx-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(0.95); }
              }
            </style>
          `;
          document.body.appendChild(overlay);
        },
        args: [logoUrl]
      });
    } catch (error) {
      console.error('Show overlay error:', error);
    }
  },

  /**
   * Update overlay status text on web page
   */
  async updateWebOverlayStatus(status, progress = '') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (statusText, progressText) => {
          const statusEl = document.getElementById('flowx-overlay-status');
          const progressEl = document.getElementById('flowx-overlay-progress');
          if (statusEl) statusEl.textContent = statusText;
          if (progressEl) progressEl.textContent = progressText;
        },
        args: [status, progress]
      });
    } catch (error) {
      // Ignore errors silently
    }
  },

  /**
   * Hide overlay on web page
   */
  async hideWebOverlay() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const overlay = document.getElementById('flowx-automation-overlay');
          if (overlay) overlay.remove();
        }
      });
    } catch (error) {
      console.error('Hide overlay error:', error);
    }
  },

  /**
   * Stop automation
   */
  stopAutomation() {
    this.isAutomationRunning = false;
    this.hideAutomationStatus();
    this.hideWebOverlay();
    document.getElementById('automationBtn').disabled = false;
    document.getElementById('stopAutomationBtn').disabled = true;
    Helpers.showToast('หยุด Automation แล้ว', 'info');
  },

  /**
   * Handle Automation - รันทุกขั้นตอนอัตโนมัติ
   */
  async handleAutomation() {
    if (this.isAutomationRunning) return;

    const isBurstMode = typeof BurstMode !== 'undefined' && BurstMode.isEnabled;

    if (isBurstMode) {
      await this.handleBurstAutomation();
      return;
    }

    const productImage = await ImageUpload.getProductImage();
    if (!productImage) {
      Helpers.showToast('กรุณาเลือกภาพสินค้าก่อน', 'error');
      return;
    }

    const productName = await ImageUpload.getProductName();
    if (!productName) {
      Helpers.showToast('กรุณากรอกชื่อสินค้าก่อน', 'error');
      return;
    }

    const settings = await this.getSettings();
    if (!settings.apiKey) {
      Helpers.showToast('กรุณาตั้งค่า API Key ก่อน', 'error');
      Settings.openModal();
      return;
    }

    this.totalLoops = await ImageUpload.getLoopCount();
    this.currentLoop = 0;

    this.isAutomationRunning = true;
    document.getElementById('automationBtn').disabled = true;
    document.getElementById('stopAutomationBtn').disabled = false;

    await this.showWebOverlay();

    try {
      for (let i = 0; i < this.totalLoops; i++) {
        if (!this.isAutomationRunning) break;

        this.currentLoop = i + 1;
        const loopPrefix = `[${this.currentLoop}/${this.totalLoops}] `;

        // Step 1-12
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 1/12: อัพภาพสินค้า...');
        await this.handleUploadProduct();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 20000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 2/12: สร้าง Prompt ภาพ...');
        await this.handleGeneratePrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 3/12: กรอก Prompt...');
        await this.handleFillPrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 4/12: สร้างภาพ...');
        await this.handleCreate();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 60000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 5/12: สลับโหมดวิดีโอ...');
        await this.handleVideoMode();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 6/12: เลือกภาพ...');
        await this.handleSelectImage();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 7/12: สร้าง Prompt วิดีโอ...');
        await this.handleGenerateVideoPrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 8/12: กรอก Prompt วิดีโอ...');
        await this.handleFillPrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 9/12: สร้างวิดีโอ...');
        await this.handleCreate();
        if (!this.isAutomationRunning) break;

        // Use download delay from settings (default 90 seconds, convert to ms)
        const downloadDelay = (Settings.getDownloadDelay() || 90) * 1000;
        this.updateAutomationStatus(loopPrefix + `รอวิดีโอโหลด ${Settings.getDownloadDelay()} วินาที...`);
        await new Promise(resolve => setTimeout(resolve, downloadDelay));

        // Step 10: Download (skip if skipDownload is enabled)
        if (!this.isAutomationRunning) break;
        if (Settings.isSkipDownload()) {
          this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 10/12: ข้ามดาวน์โหลด...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 10/12: ดาวน์โหลด...');
          await this.handleDownload();
          if (!this.isAutomationRunning) break;
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 11/12: สลับภาพ...');
        await this.handleSwitchImageMode();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(loopPrefix + 'ขั้นตอน 12/12: สลับกลับโหมดภาพ...');
        await this.handleImageMode();
        if (!this.isAutomationRunning) break;

        if (i < this.totalLoops - 1) {
          this.updateAutomationStatus(loopPrefix + 'เสร็จสิ้นรอบนี้! รอ 5 วินาที...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (this.isAutomationRunning) {
        this.hideAutomationStatus();
        Helpers.showToast(`Automation เสร็จสิ้น! (${this.totalLoops} รอบ)`, 'success');
      }

    } catch (error) {
      console.error('Automation error:', error);
      Helpers.showToast(`Automation error: ${error.message}`, 'error');
    } finally {
      this.isAutomationRunning = false;
      this.currentLoop = 0;
      document.getElementById('automationBtn').disabled = false;
      document.getElementById('stopAutomationBtn').disabled = true;
      this.hideAutomationStatus();
      this.hideWebOverlay();
    }
  },

  /**
   * Handle Burst Mode Automation
   */
  async handleBurstAutomation() {
    if (this.isAutomationRunning) return;

    const settings = await this.getSettings();
    if (!settings.apiKey) {
      Helpers.showToast('กรุณาตั้งค่า API Key ก่อน', 'error');
      Settings.openModal();
      return;
    }

    const started = await BurstMode.start();
    if (!started) return;

    this.isAutomationRunning = true;
    document.getElementById('automationBtn').disabled = true;
    document.getElementById('stopAutomationBtn').disabled = false;

    await this.showWebOverlay();

    const totalIterations = BurstMode.getTotalIterations();

    try {
      while (this.isAutomationRunning) {
        const product = BurstMode.getNextProduct();
        if (!product) break;

        const productNum = BurstMode.currentProductIndex + 1;
        const totalProducts = BurstMode.selectedProducts.length;
        const roundNum = BurstMode.currentRound + 1;
        const totalRounds = BurstMode.roundCount;

        const burstPrefix = `[${productNum}/${totalProducts}] [${roundNum}/${totalRounds}] `;

        await ImageUpload.loadFromProduct(product);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Run all 12 steps
        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 1/12: อัพภาพสินค้า...');
        await this.handleUploadProduct();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 20000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 2/12: สร้าง Prompt ภาพ...');
        await this.handleGeneratePrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 3/12: กรอก Prompt...');
        await this.handleFillPrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 4/12: สร้างภาพ...');
        await this.handleCreate();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 60000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 5/12: สลับโหมดวิดีโอ...');
        await this.handleVideoMode();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 6/12: เลือกภาพ...');
        await this.handleSelectImage();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 7/12: สร้าง Prompt วิดีโอ...');
        await this.handleGenerateVideoPrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 8/12: กรอก Prompt วิดีโอ...');
        await this.handleFillPrompt();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 9/12: สร้างวิดีโอ...');
        await this.handleCreate();
        if (!this.isAutomationRunning) break;

        // Use download delay from settings (default 90 seconds, convert to ms)
        const burstDownloadDelay = (Settings.getDownloadDelay() || 90) * 1000;
        this.updateAutomationStatus(burstPrefix + `รอวิดีโอโหลด ${Settings.getDownloadDelay()} วินาที...`);
        await new Promise(resolve => setTimeout(resolve, burstDownloadDelay));

        // Step 10: Download (skip if skipDownload is enabled)
        if (!this.isAutomationRunning) break;
        if (Settings.isSkipDownload()) {
          this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 10/12: ข้ามดาวน์โหลด...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 10/12: ดาวน์โหลด...');
          await this.handleDownload();
          if (!this.isAutomationRunning) break;
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 11/12: สลับภาพ...');
        await this.handleSwitchImageMode();
        if (!this.isAutomationRunning) break;
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.isAutomationRunning) break;
        this.updateAutomationStatus(burstPrefix + 'ขั้นตอน 12/12: สลับกลับโหมดภาพ...');
        await this.handleImageMode();
        if (!this.isAutomationRunning) break;

        const hasMore = BurstMode.nextIteration();
        if (!hasMore) break;

        this.updateAutomationStatus(burstPrefix + 'เสร็จสิ้น! รอ 5 วินาที...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      if (this.isAutomationRunning) {
        this.hideAutomationStatus();
        Helpers.showToast(`โหมดกระหน่ำเสร็จสิ้น! (${totalIterations} ครั้ง)`, 'success');
      }

    } catch (error) {
      console.error('Burst automation error:', error);
      Helpers.showToast(`Burst automation error: ${error.message}`, 'error');
    } finally {
      this.isAutomationRunning = false;
      BurstMode.stop();
      document.getElementById('automationBtn').disabled = false;
      document.getElementById('stopAutomationBtn').disabled = true;
      this.hideAutomationStatus();
      this.hideWebOverlay();
    }
  }
};
