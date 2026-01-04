/**
 * TikTok Uploader Module
 * Handles TikTok tab functionality
 */
const TikTokUploader = {
  files: [],
  currentCaption: '',
  scheduleHistory: [],
  isAutomationRunning: false,
  shouldStopAutomation: false,
  currentMode: 'product',

  // Warehouse video selection
  warehouseProducts: [],
  warehouseVideos: [],
  selectedWarehouseProduct: null,
  warehouseVideoCount: 1,

  // Burst mode
  burstAllPendingVideos: [],
  burstVideoCount: 1,
  burstUploadMode: 'sequential',
  burstSelectionMode: 'auto', // 'auto' or 'manual'
  burstManualProducts: [], // Manually selected products
  burstTempSelectedIds: new Set(), // Temporary selection in modal

  /**
   * Initialize TikTok Uploader
   */
  init() {
    this.bindElements();
    this.bindEvents();
    this.loadSettings();
    this.setDefaultScheduleTime();
    this.loadWarehouseProducts();
  },

  /**
   * Bind DOM elements
   */
  bindElements() {
    // Mode radios
    this.modeRadios = document.querySelectorAll('input[name="tiktokPostMode"]');

    // Mode sections
    this.manualSection = document.getElementById('tiktokManualSection');
    this.warehouseSection = document.getElementById('tiktokWarehouseSection');
    this.contentSection = document.getElementById('tiktokContentSection');
    this.uploadSection = document.getElementById('tiktokUploadSection');
    this.uploadSectionTitle = document.getElementById('tiktokUploadSectionTitle');

    // Manual product inputs
    this.productNameInput = document.getElementById('tiktokProductName');
    this.productIdInput = document.getElementById('tiktokProductId');
    this.cartNameInput = document.getElementById('tiktokCartName');
    this.cartNameCount = document.getElementById('tiktokCartNameCount');

    // Content mode input
    this.contentTitleInput = document.getElementById('tiktokContentTitle');

    // Upload
    this.uploadArea = document.getElementById('tiktokUploadArea');
    this.fileInput = document.getElementById('tiktokFileInput');
    this.clearFilesBtn = document.getElementById('tiktokClearFilesBtn');

    // Caption
    this.captionEditor = document.getElementById('tiktokCaptionEditor');

    // Schedule
    this.scheduleTimeInput = document.getElementById('tiktokScheduleTime');
    this.postIntervalSelect = document.getElementById('tiktokPostInterval');

    // Automation
    this.automationBtn = document.getElementById('tiktokAutomationBtn');
    this.stopBtn = document.getElementById('tiktokStopBtn');
    this.scanBtn = document.getElementById('tiktokScanBtn');
    this.automationStatus = document.getElementById('tiktokAutomationStatus');

    // Warehouse video selection
    this.warehouseProductSelect = document.getElementById('tiktokWarehouseProductSelect');
    this.warehouseVideoCountInput = document.getElementById('tiktokWarehouseVideoCount');
    this.pendingVideoCountLabel = document.getElementById('tiktokPendingVideoCount');
    this.videoSummary = document.getElementById('tiktokWarehouseVideoSummary');
    this.videoUploadCount = document.getElementById('tiktokVideoUploadCount');
    this.warehouseCartNameInput = document.getElementById('tiktokWarehouseCartName');
    this.warehouseCartNameCount = document.getElementById('tiktokWarehouseCartNameCount');

    // Burst mode elements
    this.burstSection = document.getElementById('tiktokBurstSection');
    this.burstVideoCountInput = document.getElementById('tiktokBurstVideoCount');
    this.burstMaxCountLabel = document.getElementById('tiktokBurstMaxCount');
    this.burstPendingCountLabel = document.getElementById('tiktokBurstPendingCount');
    this.burstProductCountLabel = document.getElementById('tiktokBurstProductCount');
    this.burstModeRadios = document.querySelectorAll('input[name="tiktokBurstUploadMode"]');
    this.burstModeHint = document.getElementById('tiktokBurstModeHint');
    this.burstCartNameInput = document.getElementById('tiktokBurstCartName');
    this.burstCartNameCount = document.getElementById('tiktokBurstCartNameCount');

    // Burst manual selection elements
    this.burstSelectionModeRadios = document.querySelectorAll('input[name="tiktokBurstSelectionMode"]');
    this.burstAutoContent = document.getElementById('tiktokBurstAutoContent');
    this.burstManualContent = document.getElementById('tiktokBurstManualContent');
    this.burstSelectedList = document.getElementById('tiktokBurstSelectedList');
    this.burstAddProductBtn = document.getElementById('tiktokBurstAddProductBtn');
    this.burstManualProductCount = document.getElementById('tiktokBurstManualProductCount');
    this.burstManualVideoCount = document.getElementById('tiktokBurstManualVideoCount');

    // Burst modal elements
    this.burstModal = document.getElementById('tiktokBurstProductModal');
    this.burstModalClose = document.getElementById('tiktokBurstModalClose');
    this.burstModalCancel = document.getElementById('tiktokBurstModalCancel');
    this.burstModalConfirm = document.getElementById('tiktokBurstModalConfirm');
    this.burstProductSearch = document.getElementById('tiktokBurstProductSearch');
    this.burstProductGrid = document.getElementById('tiktokBurstProductGrid');
    this.burstSelectAllBtn = document.getElementById('tiktokBurstSelectAll');
    this.burstDeselectAllBtn = document.getElementById('tiktokBurstDeselectAll');
    this.burstModalCount = document.getElementById('tiktokBurstModalCount');
  },

  /**
   * Bind events
   */
  bindEvents() {
    // Mode switching
    this.modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => this.switchMode(e.target.value));
    });

    // Upload area
    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

    // Drag and drop
    this.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadArea.classList.add('dragover');
    });

    this.uploadArea.addEventListener('dragleave', () => {
      this.uploadArea.classList.remove('dragover');
    });

    this.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    // Clear files
    this.clearFilesBtn.addEventListener('click', () => this.clearAllFiles());

    // Cart name input
    this.cartNameInput.addEventListener('input', () => {
      let value = this.cartNameInput.value.replace(/[^a-zA-Z0-9ก-๙\s]/g, '');
      if (value.length > 29) {
        value = value.substring(0, 29);
      }
      this.cartNameInput.value = value;
      this.cartNameCount.textContent = `${value.length}/29`;
      localStorage.setItem('tiktok_cart_name', value);
    });

    // Save settings on input
    this.productNameInput.addEventListener('input', () => {
      localStorage.setItem('tiktok_product_name', this.productNameInput.value);
    });

    this.productIdInput.addEventListener('input', () => {
      localStorage.setItem('tiktok_product_id', this.productIdInput.value);
    });

    this.scheduleTimeInput.addEventListener('change', () => {
      localStorage.setItem('tiktok_schedule_time', this.scheduleTimeInput.value);
    });

    this.postIntervalSelect.addEventListener('change', () => {
      localStorage.setItem('tiktok_post_interval', this.postIntervalSelect.value);
    });

    // Automation buttons
    this.automationBtn.addEventListener('click', () => this.runAutomation());
    this.stopBtn.addEventListener('click', () => this.stopAutomation());
    this.scanBtn.addEventListener('click', () => this.scanProducts());

    // Warehouse video selection
    if (this.warehouseProductSelect) {
      this.warehouseProductSelect.addEventListener('change', (e) => {
        this.handleWarehouseProductSelect(e.target.value);
      });
    }
    if (this.warehouseVideoCountInput) {
      this.warehouseVideoCountInput.addEventListener('input', () => {
        this.updateVideoCountSummary();
      });
    }

    // Content title input
    if (this.contentTitleInput) {
      this.contentTitleInput.addEventListener('input', () => {
        localStorage.setItem('tiktok_content_title', this.contentTitleInput.value);
      });
    }

    // Warehouse cart name input
    if (this.warehouseCartNameInput) {
      this.warehouseCartNameInput.addEventListener('input', () => {
        let value = this.warehouseCartNameInput.value.replace(/[^a-zA-Z0-9ก-๙\s]/g, '');
        if (value.length > 29) {
          value = value.substring(0, 29);
        }
        this.warehouseCartNameInput.value = value;
        if (this.warehouseCartNameCount) {
          this.warehouseCartNameCount.textContent = `${value.length}/29`;
        }
        localStorage.setItem('tiktok_warehouse_cart_name', value);
      });
    }

    // Burst mode events
    if (this.burstVideoCountInput) {
      this.burstVideoCountInput.addEventListener('input', () => {
        const max = parseInt(this.burstVideoCountInput.max) || 1;
        let value = parseInt(this.burstVideoCountInput.value) || 1;
        if (value > max) {
          value = max;
          this.burstVideoCountInput.value = max;
        }
        this.burstVideoCount = value;
        localStorage.setItem('tiktok_burst_video_count', value);
      });
    }

    this.burstModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.burstUploadMode = e.target.value;
        this.updateBurstModeHint();
        localStorage.setItem('tiktok_burst_upload_mode', this.burstUploadMode);
      });
    });

    // Burst cart name input
    if (this.burstCartNameInput) {
      this.burstCartNameInput.addEventListener('input', () => {
        let value = this.burstCartNameInput.value.replace(/[^a-zA-Z0-9ก-๙\s]/g, '');
        if (value.length > 29) value = value.substring(0, 29);
        this.burstCartNameInput.value = value;
        if (this.burstCartNameCount) {
          this.burstCartNameCount.textContent = `${value.length}/29`;
        }
        localStorage.setItem('tiktok_burst_cart_name', value);
      });
    }

    // Burst selection mode toggle
    this.burstSelectionModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.setBurstSelectionMode(e.target.value);
      });
    });

    // Burst add product button
    if (this.burstAddProductBtn) {
      this.burstAddProductBtn.addEventListener('click', () => {
        this.openBurstProductModal();
      });
    }

    // Burst modal events
    if (this.burstModalClose) {
      this.burstModalClose.addEventListener('click', () => this.closeBurstProductModal());
    }
    if (this.burstModalCancel) {
      this.burstModalCancel.addEventListener('click', () => this.closeBurstProductModal());
    }
    if (this.burstModalConfirm) {
      this.burstModalConfirm.addEventListener('click', () => this.confirmBurstProductSelection());
    }
    if (this.burstModal) {
      this.burstModal.addEventListener('click', (e) => {
        if (e.target === this.burstModal) {
          this.closeBurstProductModal();
        }
      });
    }
    if (this.burstProductSearch) {
      this.burstProductSearch.addEventListener('input', () => {
        this.filterBurstProducts(this.burstProductSearch.value);
      });
    }
    if (this.burstSelectAllBtn) {
      this.burstSelectAllBtn.addEventListener('click', () => this.selectAllBurstProducts());
    }
    if (this.burstDeselectAllBtn) {
      this.burstDeselectAllBtn.addEventListener('click', () => this.deselectAllBurstProducts());
    }
  },

  /**
   * Switch mode (manual/warehouse/burst/content)
   */
  switchMode(mode) {
    this.currentMode = mode;
    localStorage.setItem('tiktok_mode', mode);

    // Hide all sections first
    if (this.manualSection) this.manualSection.hidden = true;
    if (this.warehouseSection) this.warehouseSection.hidden = true;
    if (this.contentSection) this.contentSection.hidden = true;
    if (this.burstSection) this.burstSection.hidden = true;

    // Show relevant section based on mode
    if (mode === 'manual') {
      if (this.manualSection) this.manualSection.hidden = false;
      if (this.uploadSection) this.uploadSection.hidden = false;
      if (this.uploadSectionTitle) this.uploadSectionTitle.textContent = 'เลือกไฟล์วิดีโอ';
    } else if (mode === 'warehouse') {
      if (this.warehouseSection) this.warehouseSection.hidden = false;
      if (this.uploadSection) this.uploadSection.hidden = true;
    } else if (mode === 'burst') {
      if (this.burstSection) this.burstSection.hidden = false;
      if (this.uploadSection) this.uploadSection.hidden = true;
      this.loadBurstModeData();
    } else if (mode === 'content') {
      if (this.contentSection) this.contentSection.hidden = false;
      if (this.uploadSection) this.uploadSection.hidden = false;
      if (this.uploadSectionTitle) this.uploadSectionTitle.textContent = 'เลือกไฟล์วิดีโอ';
    }
  },

  /**
   * Update video count summary display
   */
  updateVideoCountSummary() {
    const count = parseInt(this.warehouseVideoCountInput?.value) || 1;
    this.warehouseVideoCount = count;

    if (this.videoUploadCount) {
      this.videoUploadCount.textContent = count;
    }
  },

  /**
   * Set default schedule time
   */
  setDefaultScheduleTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    now.setSeconds(0);
    const formatted = now.toISOString().slice(0, 16);
    this.scheduleTimeInput.value = formatted;
  },

  /**
   * Load settings
   */
  loadSettings() {
    const savedProductName = localStorage.getItem('tiktok_product_name');
    if (savedProductName && this.productNameInput) this.productNameInput.value = savedProductName;

    const savedProductId = localStorage.getItem('tiktok_product_id');
    if (savedProductId && this.productIdInput) this.productIdInput.value = savedProductId;

    const savedCartName = localStorage.getItem('tiktok_cart_name');
    if (savedCartName && this.cartNameInput) {
      this.cartNameInput.value = savedCartName;
      if (this.cartNameCount) this.cartNameCount.textContent = `${savedCartName.length}/29`;
    }

    const savedContentTitle = localStorage.getItem('tiktok_content_title');
    if (savedContentTitle && this.contentTitleInput) this.contentTitleInput.value = savedContentTitle;

    const savedWarehouseCartName = localStorage.getItem('tiktok_warehouse_cart_name');
    if (savedWarehouseCartName && this.warehouseCartNameInput) {
      this.warehouseCartNameInput.value = savedWarehouseCartName;
      if (this.warehouseCartNameCount) this.warehouseCartNameCount.textContent = `${savedWarehouseCartName.length}/29`;
    }

    const savedScheduleTime = localStorage.getItem('tiktok_schedule_time');
    if (savedScheduleTime) this.scheduleTimeInput.value = savedScheduleTime;

    const savedPostInterval = localStorage.getItem('tiktok_post_interval');
    if (savedPostInterval) this.postIntervalSelect.value = savedPostInterval;

    // Load burst mode settings
    const savedBurstVideoCount = localStorage.getItem('tiktok_burst_video_count');
    if (savedBurstVideoCount && this.burstVideoCountInput) {
      this.burstVideoCount = parseInt(savedBurstVideoCount);
      this.burstVideoCountInput.value = savedBurstVideoCount;
    }

    const savedBurstUploadMode = localStorage.getItem('tiktok_burst_upload_mode');
    if (savedBurstUploadMode) {
      this.burstUploadMode = savedBurstUploadMode;
      const burstRadio = document.querySelector(`input[name="tiktokBurstUploadMode"][value="${savedBurstUploadMode}"]`);
      if (burstRadio) burstRadio.checked = true;
    }

    const savedBurstCartName = localStorage.getItem('tiktok_burst_cart_name');
    if (savedBurstCartName && this.burstCartNameInput) {
      this.burstCartNameInput.value = savedBurstCartName;
      if (this.burstCartNameCount) {
        this.burstCartNameCount.textContent = `${savedBurstCartName.length}/29`;
      }
    }

    // Load burst selection mode
    const savedBurstSelectionMode = localStorage.getItem('tiktok_burst_selection_mode');
    if (savedBurstSelectionMode) {
      this.burstSelectionMode = savedBurstSelectionMode;
      const selectionRadio = document.querySelector(`input[name="tiktokBurstSelectionMode"][value="${savedBurstSelectionMode}"]`);
      if (selectionRadio) selectionRadio.checked = true;
      this.setBurstSelectionMode(savedBurstSelectionMode);
    }

    // Load mode (default: manual)
    const savedMode = localStorage.getItem('tiktok_mode') || 'manual';
    this.switchMode(savedMode);
    const radio = document.querySelector(`input[name="tiktokPostMode"][value="${savedMode}"]`);
    if (radio) radio.checked = true;
  },

  /**
   * Handle files
   */
  handleFiles(filesList) {
    const newFiles = Array.from(filesList);

    newFiles.forEach(file => {
      if (!this.files.find(f => f.name === file.name)) {
        this.files.push(file);
      }
    });

    this.updateFileDisplay();
  },

  /**
   * Update file display
   */
  updateFileDisplay() {
    const span = this.uploadArea.querySelector('span');
    if (this.files.length > 0) {
      span.textContent = `${this.files.length} ไฟล์`;
      this.uploadArea.classList.add('has-files');
      this.clearFilesBtn.style.display = 'flex';
    } else {
      span.textContent = 'เลือกไฟล์';
      this.uploadArea.classList.remove('has-files');
      this.clearFilesBtn.style.display = 'none';
    }
  },

  /**
   * Clear all files
   */
  clearAllFiles() {
    this.files = [];
    this.updateFileDisplay();
    showToast('ล้างไฟล์ทั้งหมดแล้ว', 'warning');
  },

  /**
   * File to DataURL
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Get Gemini API Key
   */
  async getGeminiApiKey() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    return result.geminiApiKey || '';
  },

  /**
   * Get OpenAI API Key
   */
  async getOpenAIApiKey() {
    const result = await chrome.storage.local.get(['openaiApiKey']);
    return result.openaiApiKey || '';
  },

  /**
   * Get Selected Model (gemini or openai)
   */
  async getSelectedModel() {
    const result = await chrome.storage.local.get(['selectedModel']);
    return result.selectedModel || 'gemini';
  },

  /**
   * Send message to content script
   */
  sendMessage(tabId, message) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('sendMessage error:', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.warn('sendMessage exception:', e);
        resolve({ success: false, error: e.message });
      }
    });
  },

  /**
   * Sleep with stop check
   */
  sleep(ms) {
    return new Promise(resolve => {
      const checkInterval = 100;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += checkInterval;
        if (this.shouldStopAutomation || elapsed >= ms) {
          clearInterval(timer);
          resolve();
        }
      }, checkInterval);
    });
  },

  /**
   * Random sleep
   */
  randomSleep(minSec, maxSec) {
    const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
    return this.sleep(ms);
  },

  /**
   * Update automation status
   */
  updateAutomationStatus(current, total, step) {
    const stepLabels = {
      'upload': 'กำลังอัพโหลดไฟล์...',
      'caption': 'กำลังสร้างแคปชั่น...',
      'fill': 'กำลังกรอกแคปชั่น...',
      'cart': 'กำลังปักตะกร้า...',
      'schedule': 'กำลังตั้งเวลาโพส...',
      'csv': 'กำลังบันทึก CSV...',
      'done': 'เสร็จสิ้น'
    };

    const label = stepLabels[step] || step;
    this.automationStatus.innerHTML = `
      <div class="current-step">${label}</div>
      <div class="progress-info">คลิปที่ ${current}/${total}</div>
    `;
    this.automationStatus.classList.add('active');
  },

  /**
   * Call Gemini API for caption
   */
  async callGeminiAPI(productName, apiKey) {
    let prompt;

    if (this.currentMode === 'content') {
      prompt = `สร้างแคปชั่น TikTok สำหรับคลิปสั้นในหัวข้อ "${productName}"

กฎเข้มงวด:
1. ข้อความดึงดูด น่าสนใจ กระชับ ไม่เกิน 100 ตัวอักษร
2. เขียนในเชิงให้ความรู้ เล่าเรื่อง หรือสร้างแรงบันดาลใจ
3. แฮชแท็ก: ต้องมีแค่ 3 อันเท่านั้น
4. อิโมจิ: 2-3 ตัว

รูปแบบผลลัพธ์:
[ข้อความแคปชั่น] #แฮชแท็ก1 #แฮชแท็ก2 #แฮชแท็ก3

ตอบแค่แคปชั่นบรรทัดเดียว ไม่ต้องอธิบาย`;
    } else {
      prompt = `สร้างแคปชั่น TikTok สำหรับสินค้า "${productName}"

กฎเข้มงวด:
1. ข้อความดึงดูด กระชับ ไม่เกิน 100 ตัวอักษร
2. ห้ามใช้คำต้องห้าม: การันตี, รับประกัน, 100%, รักษา, หาย, ดีที่สุด, อันดับ 1
3. แฮชแท็ก: ต้องมีแค่ 3 อันเท่านั้น
4. อิโมจิ: 2-3 ตัว

รูปแบบผลลัพธ์:
[ข้อความแคปชั่น] #แฮชแท็ก1 #แฮชแท็ก2 #แฮชแท็ก3

ตอบแค่แคปชั่นบรรทัดเดียว ไม่ต้องอธิบาย`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 150 }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API Error');
    }

    const data = await response.json();
    let caption = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!caption) throw new Error('ไม่ได้รับข้อความจาก API');

    // Clean up
    caption = caption.trim()
      .replace(/\\\n/g, ' ')
      .replace(/\\$/gm, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit hashtags
    const hashtags = caption.match(/#[^\s#]+/g) || [];
    if (hashtags.length > 3) {
      const removeHashtags = hashtags.slice(3);
      for (const tag of removeHashtags) {
        caption = caption.replace(tag, '');
      }
      caption = caption.replace(/\s+/g, ' ').trim();
    }

    return caption;
  },

  /**
   * Call OpenAI API for caption
   */
  async callOpenAIAPI(productName, apiKey) {
    let prompt;

    if (this.currentMode === 'content') {
      prompt = `สร้างแคปชั่น TikTok สำหรับคลิปสั้นในหัวข้อ "${productName}"

กฎเข้มงวด:
1. ข้อความดึงดูด น่าสนใจ กระชับ ไม่เกิน 100 ตัวอักษร
2. เขียนในเชิงให้ความรู้ เล่าเรื่อง หรือสร้างแรงบันดาลใจ
3. แฮชแท็ก: ต้องมีแค่ 3 อันเท่านั้น
4. อิโมจิ: 2-3 ตัว

รูปแบบผลลัพธ์:
[ข้อความแคปชั่น] #แฮชแท็ก1 #แฮชแท็ก2 #แฮชแท็ก3

ตอบแค่แคปชั่นบรรทัดเดียว ไม่ต้องอธิบาย`;
    } else {
      prompt = `สร้างแคปชั่น TikTok สำหรับสินค้า "${productName}"

กฎเข้มงวด:
1. ข้อความดึงดูด กระชับ ไม่เกิน 100 ตัวอักษร
2. ห้ามใช้คำต้องห้าม: การันตี, รับประกัน, 100%, รักษา, หาย, ดีที่สุด, อันดับ 1
3. แฮชแท็ก: ต้องมีแค่ 3 อันเท่านั้น
4. อิโมจิ: 2-3 ตัว

รูปแบบผลลัพธ์:
[ข้อความแคปชั่น] #แฮชแท็ก1 #แฮชแท็ก2 #แฮชแท็ก3

ตอบแค่แคปชั่นบรรทัดเดียว ไม่ต้องอธิบาย`;
    }

    // Using OpenAI Responses API format (for gpt-5-nano)
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        input: prompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API Error');
    }

    const data = await response.json();

    // Extract text from OpenAI Responses API format
    let caption = data.output_text;
    if (!caption) {
      const textOutput = data.output?.find(item => item.type === 'message');
      const content = textOutput?.content?.find(c => c.type === 'output_text');
      caption = content?.text;
    }

    if (!caption) throw new Error('ไม่ได้รับข้อความจาก OpenAI API');

    // Clean up
    caption = caption.trim()
      .replace(/\\\n/g, ' ')
      .replace(/\\$/gm, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit hashtags
    const hashtags = caption.match(/#[^\s#]+/g) || [];
    if (hashtags.length > 3) {
      const removeHashtags = hashtags.slice(3);
      for (const tag of removeHashtags) {
        caption = caption.replace(tag, '');
      }
      caption = caption.replace(/\s+/g, ' ').trim();
    }

    return caption;
  },

  /**
   * Run automation
   */
  async runAutomation() {
    const scheduleTime = this.scheduleTimeInput.value;
    const selectedModel = await this.getSelectedModel();
    const apiKey = selectedModel === 'openai'
      ? await this.getOpenAIApiKey()
      : await this.getGeminiApiKey();

    let productName = '';
    let productId = '';
    let cartName = '';
    let useWarehouseVideo = false;

    let useBurstMode = false;
    let burstVideosToUpload = [];

    // Get data based on mode
    if (this.currentMode === 'manual') {
      productName = this.productNameInput?.value.trim() || '';
      productId = this.productIdInput?.value.trim() || '';
      cartName = this.cartNameInput?.value.trim() || '';

      if (!productName) {
        showToast('กรุณากรอกชื่อสินค้า', 'error');
        return;
      }
      if (!productId) {
        showToast('กรุณากรอก Product ID', 'error');
        return;
      }
      if (!cartName) {
        showToast('กรุณากรอกชื่อตะกร้า', 'error');
        return;
      }
      if (this.files.length === 0) {
        showToast('กรุณาเลือกไฟล์วิดีโอ', 'error');
        return;
      }
    } else if (this.currentMode === 'warehouse') {
      if (!this.selectedWarehouseProduct) {
        showToast('กรุณาเลือกสินค้าจากคลัง', 'error');
        return;
      }
      if (this.warehouseVideos.length === 0) {
        showToast('ไม่มีวิดีโอที่รออัพโหลด', 'error');
        return;
      }
      useWarehouseVideo = true;
      // Get product info from warehouse
      productName = this.selectedWarehouseProduct.name || '';
      productId = this.selectedWarehouseProduct.productId || '';
      // Use warehouse cart name input, fallback to product name
      cartName = this.warehouseCartNameInput?.value.trim() || productName.substring(0, 29);
    } else if (this.currentMode === 'burst') {
      // Burst mode - validate
      if (this.burstAllPendingVideos.length === 0) {
        showToast('ไม่มีวิดีโอในคลังที่รออัพโหลด', 'error');
        return;
      }
      if (this.burstVideoCount < 1) {
        showToast('กรุณาระบุจำนวนวิดีโอที่จะอัพ', 'error');
        return;
      }
      useBurstMode = true;
      // Get videos for burst mode (with product info)
      burstVideosToUpload = await this.getBurstVideos(this.burstVideoCount);
      if (burstVideosToUpload.length === 0) {
        showToast('ไม่พบวิดีโอที่จะอัพโหลด', 'error');
        return;
      }
    } else if (this.currentMode === 'content') {
      productName = this.contentTitleInput?.value.trim() || '';
      if (!productName) {
        showToast('กรุณากรอกหัวข้อคลิป', 'error');
        return;
      }
      if (this.files.length === 0) {
        showToast('กรุณาเลือกไฟล์วิดีโอ', 'error');
        return;
      }
    }

    if (!scheduleTime) {
      showToast('กรุณาเลือกเวลาเริ่มโพส', 'error');
      return;
    }
    if (!apiKey) {
      const keyName = selectedModel === 'openai' ? 'OpenAI' : 'Gemini';
      showToast(`กรุณาตั้งค่า ${keyName} API Key`, 'error');
      return;
    }

    const isContentMode = this.currentMode === 'content';

    // Check schedule time
    const startDate = new Date(scheduleTime);
    const now = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    if (startDate <= now) {
      showToast('เวลาเริ่มต้องมากกว่าปัจจุบัน', 'error');
      return;
    }
    if (startDate > maxDate) {
      showToast('TikTok อนุญาตตั้งเวลาได้ไม่เกิน 30 วัน', 'error');
      return;
    }

    // Get tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('tiktok.com')) {
      showToast('กรุณาเปิดหน้า TikTok ก่อน', 'error');
      return;
    }

    // Prepare files list
    let filesToUpload = [];
    let warehouseVideoIds = [];
    let warehouseVideoMetas = [];

    if (useBurstMode) {
      // Burst mode: get video files from burst selection
      for (const video of burstVideosToUpload) {
        const videoFile = await this.getWarehouseVideoFile(video.id);
        if (videoFile) {
          filesToUpload.push(videoFile);
          warehouseVideoIds.push(video.id);
          warehouseVideoMetas.push(video);
        }
      }

      if (filesToUpload.length === 0) {
        showToast('ไม่พบไฟล์วิดีโอในคลัง', 'error');
        return;
      }
    } else if (useWarehouseVideo) {
      // Get videos to upload based on count
      const videosToUpload = this.getRandomPendingVideos(this.warehouseVideoCount);

      if (videosToUpload.length === 0) {
        showToast('ไม่พบวิดีโอที่จะอัพโหลด', 'error');
        return;
      }

      // Get all video files
      for (const video of videosToUpload) {
        const videoFile = await this.getWarehouseVideoFile(video.id);
        if (videoFile) {
          filesToUpload.push(videoFile);
          warehouseVideoIds.push(video.id);
          warehouseVideoMetas.push(video);
        }
      }

      if (filesToUpload.length === 0) {
        showToast('ไม่พบไฟล์วิดีโอในคลัง', 'error');
        return;
      }
    } else {
      filesToUpload = this.files;
    }

    const clipCount = filesToUpload.length;
    this.scheduleHistory = [];
    this.isAutomationRunning = true;
    this.shouldStopAutomation = false;

    this.automationBtn.style.display = 'none';
    this.stopBtn.style.display = 'flex';

    await this.sendMessage(tab.id, { action: 'resetScheduleIndex' });

    for (let i = 0; i < clipCount; i++) {
      if (this.shouldStopAutomation) break;

      this.updateAutomationStatus(i + 1, clipCount, 'start');

      // For burst mode, get product info from the video's associated product
      let currentProductName = productName;
      let currentProductId = productId;
      let currentCartName = cartName;

      if (useBurstMode && burstVideosToUpload[i]?.product) {
        const product = burstVideosToUpload[i].product;
        currentProductName = product.name || '';
        currentProductId = product.productId || '';
        // Priority: product.cartName > burstCartNameInput > productName
        if (product.cartName && product.cartName.trim()) {
          currentCartName = product.cartName.trim().substring(0, 29);
        } else if (this.burstCartNameInput?.value.trim()) {
          currentCartName = this.burstCartNameInput.value.trim().substring(0, 29);
        } else {
          currentCartName = (product.name || '').substring(0, 29);
        }
      }

      try {
        // Upload
        if (this.shouldStopAutomation) break;
        this.updateAutomationStatus(i + 1, clipCount, 'upload');

        const currentFile = filesToUpload[i];
        const fileData = {
          name: currentFile.name,
          type: currentFile.type,
          size: currentFile.size,
          dataUrl: await this.fileToDataUrl(currentFile)
        };

        await this.sendMessage(tab.id, {
          action: 'uploadToTikTok',
          files: [fileData],
          productName: currentProductName
        });
        await this.randomSleep(2, 4);

        // Caption
        if (this.shouldStopAutomation) break;
        this.updateAutomationStatus(i + 1, clipCount, 'caption');
        const caption = selectedModel === 'openai'
          ? await this.callOpenAIAPI(currentProductName, apiKey)
          : await this.callGeminiAPI(currentProductName, apiKey);
        this.captionEditor.value = caption;
        await this.randomSleep(2, 4);

        // Fill caption
        if (this.shouldStopAutomation) break;
        this.updateAutomationStatus(i + 1, clipCount, 'fill');
        await this.sendMessage(tab.id, { action: 'fillCaption', caption: caption });
        await this.randomSleep(2, 4);

        // Pin cart (product mode only, not for content mode)
        if (!isContentMode) {
          if (this.shouldStopAutomation) break;
          this.updateAutomationStatus(i + 1, clipCount, 'cart');
          await this.sendMessage(tab.id, { action: 'pinCart', productId: currentProductId, cartName: currentCartName });
          await this.randomSleep(2, 4);
        }

        // Schedule
        if (this.shouldStopAutomation) break;
        this.updateAutomationStatus(i + 1, clipCount, 'schedule');
        const scheduleResult = await this.sendMessage(tab.id, {
          action: 'schedulePost',
          scheduleTime: scheduleTime,
          postInterval: parseInt(this.postIntervalSelect.value)
        });

        if (scheduleResult && scheduleResult.success) {
          this.scheduleHistory.push({
            productName: currentProductName,
            productId: currentProductId,
            caption,
            cartName: currentCartName,
            scheduleTime: scheduleResult.scheduleTime || scheduleTime,
            videoFileName: currentFile?.name || '-'
          });

          // Update warehouse video status if using warehouse video or burst mode
          if ((useWarehouseVideo || useBurstMode) && warehouseVideoIds[i]) {
            await ProductWarehouse.updateVideoStatus(warehouseVideoIds[i], 'uploaded');
          }
        }

        await this.randomSleep(5, 8);

      } catch (error) {
        console.error('Automation error:', error);
      }
    }

    // Done
    if (this.shouldStopAutomation) {
      this.automationStatus.innerHTML = '';
      this.automationStatus.classList.remove('active');
      showToast('ยกเลิก Automation', 'warning');
    } else {
      this.updateAutomationStatus(clipCount, clipCount, 'csv');
      this.exportScheduleCSV();
      this.updateAutomationStatus(clipCount, clipCount, 'done');
      showToast(`Automation เสร็จสิ้น ${clipCount} คลิป`, 'success');
    }

    this.isAutomationRunning = false;
    this.shouldStopAutomation = false;
    this.automationBtn.style.display = 'flex';
    this.stopBtn.style.display = 'none';

    // Refresh warehouse data if used warehouse video or burst mode
    if (useWarehouseVideo || useBurstMode) {
      await this.refreshWarehouseData();
    }
  },

  /**
   * Stop automation
   */
  stopAutomation() {
    if (this.isAutomationRunning) {
      this.shouldStopAutomation = true;
      showToast('กำลังหยุด...', 'warning');
    }
  },

  /**
   * Export schedule CSV
   */
  exportScheduleCSV() {
    if (this.scheduleHistory.length === 0) return;

    const headers = ['ชื่อสินค้า', 'Product ID', 'แคปชั่น', 'ชื่อตะกร้า', 'วันเวลาตั้งเวลา', 'ชื่อไฟล์วิดีโอ'];
    const rows = this.scheduleHistory.map(item => [
      `"${(item.productName || '').replace(/"/g, '""')}"`,
      `"${(item.productId || '').replace(/"/g, '""')}"`,
      `"${(item.caption || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(item.cartName || '').replace(/"/g, '""')}"`,
      `"${(item.scheduleTime || '').replace(/"/g, '""')}"`,
      `"${(item.videoFileName || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `tiktok_schedule_${dateStr}.csv`;

    // Download
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Scan products
   */
  async scanProducts() {
    this.scanBtn.disabled = true;
    this.scanBtn.innerHTML = `
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      กำลังสแกน...
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.url && tab.url.includes('tiktok.com')) {
        chrome.tabs.sendMessage(tab.id, { action: 'scanProducts' }, response => {
          if (chrome.runtime.lastError) {
            showToast('เชื่อมต่อไม่ได้ ลอง refresh หน้า', 'error');
          } else if (response) {
            if (response.success) {
              showToast(`พบสินค้า ${response.count} รายการ`, 'success');

              if (response.csv) {
                const BOM = '\uFEFF';
                const blob = new Blob([BOM + response.csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', 'tiktok_products.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }
            } else {
              showToast(response.error || 'เกิดข้อผิดพลาด', 'error');
            }
          }
          this.resetScanButton();
        });
      } else {
        showToast('กรุณาเปิดหน้า TikTok ก่อน', 'error');
        this.resetScanButton();
      }
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการสแกน', 'error');
      this.resetScanButton();
    }
  },

  /**
   * Reset scan button
   */
  resetScanButton() {
    this.scanBtn.disabled = false;
    this.scanBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      สแกนสินค้า
    `;
  },

  /**
   * Load warehouse products to dropdown
   */
  async loadWarehouseProducts() {
    if (!this.warehouseProductSelect) return;

    try {
      // Get products that have videos
      const allProducts = await ProductWarehouse.getAll();
      const allVideos = await ProductWarehouse.getVideos();

      // Filter products that have at least one video
      const productIdsWithVideos = new Set(allVideos.map(v => v.productId));
      this.warehouseProducts = allProducts.filter(p => productIdsWithVideos.has(p.id));

      // Render dropdown
      this.warehouseProductSelect.innerHTML = '<option value="">-- เลือกสินค้า --</option>';

      this.warehouseProducts.forEach(product => {
        const videoCount = allVideos.filter(v => v.productId === product.id).length;
        const pendingCount = allVideos.filter(v => v.productId === product.id && v.status === 'pending').length;
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} (${pendingCount}/${videoCount} วิดีโอ)`;
        this.warehouseProductSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading warehouse products:', error);
    }
  },

  /**
   * Handle warehouse product selection
   */
  async handleWarehouseProductSelect(productId) {
    // Reset
    this.selectedWarehouseProduct = null;
    this.warehouseVideos = [];
    this.warehouseVideoCount = 1;

    if (!productId) {
      if (this.warehouseVideoCountInput) {
        this.warehouseVideoCountInput.disabled = true;
        this.warehouseVideoCountInput.max = 1;
        this.warehouseVideoCountInput.value = 1;
      }
      if (this.pendingVideoCountLabel) {
        this.pendingVideoCountLabel.textContent = '(รอ: 0)';
      }
      if (this.videoSummary) {
        this.videoSummary.hidden = true;
      }
      return;
    }

    try {
      // Find product
      const product = this.warehouseProducts.find(p => p.id === productId);
      if (!product) return;

      this.selectedWarehouseProduct = product;

      // Get videos for product (only pending ones for upload)
      const allVideos = await ProductWarehouse.getVideosByProduct(productId);
      // Filter pending and sort by createdAt (oldest first = upload order)
      this.warehouseVideos = allVideos
        .filter(v => v.status === 'pending')
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      const pendingCount = this.warehouseVideos.length;

      // Update pending label
      if (this.pendingVideoCountLabel) {
        this.pendingVideoCountLabel.textContent = `(รอ: ${pendingCount})`;
      }

      // Update input
      if (this.warehouseVideoCountInput) {
        if (pendingCount === 0) {
          this.warehouseVideoCountInput.disabled = true;
          this.warehouseVideoCountInput.max = 1;
          this.warehouseVideoCountInput.value = 1;
          if (this.videoSummary) this.videoSummary.hidden = true;
        } else {
          this.warehouseVideoCountInput.disabled = false;
          this.warehouseVideoCountInput.max = pendingCount;
          this.warehouseVideoCountInput.value = Math.min(pendingCount, 1);
          this.warehouseVideoCount = parseInt(this.warehouseVideoCountInput.value);
          if (this.videoSummary) this.videoSummary.hidden = false;
          if (this.videoUploadCount) this.videoUploadCount.textContent = this.warehouseVideoCount;
        }
      }

    } catch (error) {
      console.error('Error handling warehouse product selection:', error);
    }
  },

  /**
   * Get random pending videos from selected product
   */
  getRandomPendingVideos(count) {
    if (this.warehouseVideos.length === 0) return [];

    // Take first N videos (already sorted by createdAt)
    return this.warehouseVideos.slice(0, Math.min(count, this.warehouseVideos.length));
  },

  /**
   * Format duration
   */
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  /**
   * Get video file from warehouse
   */
  async getWarehouseVideoFile(videoId) {
    try {
      const file = await VideoStorage.get(videoId);
      return file;
    } catch (error) {
      console.error('Error getting video file:', error);
      return null;
    }
  },

  /**
   * Refresh warehouse data (called from parent)
   */
  async refreshWarehouseData() {
    await this.loadWarehouseProducts();
    // Reset video count input
    if (this.warehouseVideoCountInput) {
      this.warehouseVideoCountInput.disabled = true;
      this.warehouseVideoCountInput.max = 1;
      this.warehouseVideoCountInput.value = 1;
    }
    if (this.pendingVideoCountLabel) {
      this.pendingVideoCountLabel.textContent = '(รอ: 0)';
    }
    if (this.videoSummary) {
      this.videoSummary.hidden = true;
    }
    this.selectedWarehouseProduct = null;
    this.warehouseVideos = [];
    this.warehouseVideoCount = 1;

    // Refresh burst mode if active
    if (this.currentMode === 'burst') {
      await this.loadBurstModeData();
    }
  },

  /**
   * Load burst mode data - get all pending videos from warehouse
   */
  async loadBurstModeData() {
    try {
      // Get all pending videos
      const allVideos = await ProductWarehouse.getVideos();
      this.burstAllPendingVideos = allVideos.filter(v => v.status === 'pending');

      const pendingCount = this.burstAllPendingVideos.length;

      // Get unique product count that have pending videos
      const productIds = new Set(this.burstAllPendingVideos.map(v => v.productId));
      const productCount = productIds.size;

      // Update UI
      if (this.burstMaxCountLabel) {
        this.burstMaxCountLabel.textContent = `(สูงสุด: ${pendingCount})`;
      }
      if (this.burstPendingCountLabel) {
        this.burstPendingCountLabel.textContent = pendingCount;
      }
      if (this.burstProductCountLabel) {
        this.burstProductCountLabel.textContent = productCount;
      }

      // Update input max value
      if (this.burstVideoCountInput) {
        this.burstVideoCountInput.max = Math.max(pendingCount, 1);
        if (this.burstVideoCount > pendingCount) {
          this.burstVideoCount = Math.max(pendingCount, 1);
          this.burstVideoCountInput.value = this.burstVideoCount;
        }
      }

      // Update mode hint
      this.updateBurstModeHint();

      // Load manual products after we have video data
      await this.loadBurstManualProducts();

    } catch (error) {
      console.error('Error loading burst mode data:', error);
    }
  },

  /**
   * Update burst mode hint text based on selected mode
   */
  updateBurstModeHint() {
    if (!this.burstModeHint) return;

    if (this.burstUploadMode === 'sequential') {
      this.burstModeHint.textContent = 'อัพวิดีโอทุกตัวของสินค้าแรกก่อน แล้วค่อยไปสินค้าถัดไป';
    } else {
      this.burstModeHint.textContent = 'สุ่มเลือกวิดีโอจากทุกสินค้าแบบสุ่ม';
    }
  },

  /**
   * Set burst selection mode (auto or manual)
   */
  setBurstSelectionMode(mode) {
    this.burstSelectionMode = mode;
    localStorage.setItem('tiktok_burst_selection_mode', mode);

    if (this.burstAutoContent) {
      this.burstAutoContent.hidden = mode !== 'auto';
    }
    if (this.burstManualContent) {
      this.burstManualContent.hidden = mode !== 'manual';
    }
  },

  /**
   * Open burst product selection modal
   */
  async openBurstProductModal() {
    if (!this.burstModal) return;

    // Initialize temp selection with current manual products
    this.burstTempSelectedIds = new Set(this.burstManualProducts.map(p => p.id));

    // Render products (only those with pending videos)
    await this.renderBurstProductGrid();

    // Clear search
    if (this.burstProductSearch) {
      this.burstProductSearch.value = '';
    }

    // Update count
    this.updateBurstModalCount();

    // Show modal
    this.burstModal.hidden = false;
  },

  /**
   * Close burst product selection modal
   */
  closeBurstProductModal() {
    if (this.burstModal) {
      this.burstModal.hidden = true;
    }
    this.burstTempSelectedIds.clear();
  },

  /**
   * Render product grid in burst modal (only products with pending videos)
   */
  async renderBurstProductGrid(filter = '') {
    if (!this.burstProductGrid) return;

    // Get products that have pending videos
    const productsWithVideos = [];
    const productVideoCount = {};

    this.burstAllPendingVideos.forEach(video => {
      if (!productVideoCount[video.productId]) {
        productVideoCount[video.productId] = 0;
      }
      productVideoCount[video.productId]++;
    });

    const allProducts = await ProductWarehouse.getAll();
    allProducts.forEach(product => {
      if (productVideoCount[product.id]) {
        productsWithVideos.push({
          ...product,
          videoCount: productVideoCount[product.id]
        });
      }
    });

    // Filter by search
    let products = productsWithVideos;
    if (filter) {
      const searchLower = filter.toLowerCase();
      products = productsWithVideos.filter(p =>
        p.name.toLowerCase().includes(searchLower)
      );
    }

    if (products.length === 0) {
      this.burstProductGrid.innerHTML = '<div class="burst-empty-state">ไม่พบสินค้าที่มีวิดีโอรอคิว</div>';
      return;
    }

    this.burstProductGrid.innerHTML = products.map(product => `
      <div class="burst-product-card ${this.burstTempSelectedIds.has(product.id) ? 'selected' : ''}"
           data-id="${product.id}">
        <div class="burst-product-card-checkbox"></div>
        <img src="${product.productImage}" alt="${product.name}" class="burst-product-card-img">
        <div class="burst-product-card-name">${product.name}</div>
        <div class="burst-product-card-badge">${product.videoCount} วิดีโอ</div>
      </div>
    `).join('');

    // Bind click events
    this.burstProductGrid.querySelectorAll('.burst-product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.toggleBurstProductSelection(id, card);
      });
    });
  },

  /**
   * Toggle product selection in burst modal
   */
  toggleBurstProductSelection(id, cardElement) {
    if (this.burstTempSelectedIds.has(id)) {
      this.burstTempSelectedIds.delete(id);
      cardElement.classList.remove('selected');
    } else {
      this.burstTempSelectedIds.add(id);
      cardElement.classList.add('selected');
    }
    this.updateBurstModalCount();
  },

  /**
   * Update burst modal count display
   */
  updateBurstModalCount() {
    if (this.burstModalCount) {
      this.burstModalCount.textContent = `เลือกแล้ว ${this.burstTempSelectedIds.size} ชิ้น`;
    }
  },

  /**
   * Filter products in burst modal
   */
  filterBurstProducts(query) {
    this.renderBurstProductGrid(query);
  },

  /**
   * Select all products in burst modal
   */
  async selectAllBurstProducts() {
    const productVideoCount = {};
    this.burstAllPendingVideos.forEach(video => {
      productVideoCount[video.productId] = true;
    });

    const allProducts = await ProductWarehouse.getAll();
    allProducts.forEach(p => {
      if (productVideoCount[p.id]) {
        this.burstTempSelectedIds.add(p.id);
      }
    });

    this.burstProductGrid.querySelectorAll('.burst-product-card').forEach(card => {
      card.classList.add('selected');
    });

    this.updateBurstModalCount();
  },

  /**
   * Deselect all products in burst modal
   */
  deselectAllBurstProducts() {
    this.burstTempSelectedIds.clear();

    this.burstProductGrid.querySelectorAll('.burst-product-card').forEach(card => {
      card.classList.remove('selected');
    });

    this.updateBurstModalCount();
  },

  /**
   * Confirm product selection from burst modal
   */
  async confirmBurstProductSelection() {
    const allProducts = await ProductWarehouse.getAll();

    // Get selected products with video count
    const productVideoCount = {};
    this.burstAllPendingVideos.forEach(video => {
      if (!productVideoCount[video.productId]) {
        productVideoCount[video.productId] = 0;
      }
      productVideoCount[video.productId]++;
    });

    this.burstManualProducts = allProducts
      .filter(p => this.burstTempSelectedIds.has(p.id))
      .map(p => ({
        ...p,
        videoCount: productVideoCount[p.id] || 0
      }));

    // Close modal
    this.closeBurstProductModal();

    // Update UI
    this.renderBurstSelectedList();
    this.updateBurstManualSummary();
    this.saveBurstManualProducts();
  },

  /**
   * Render selected products list for burst manual mode
   */
  renderBurstSelectedList() {
    if (!this.burstSelectedList) return;

    if (this.burstManualProducts.length === 0) {
      this.burstSelectedList.innerHTML = '<div class="burst-empty-state">ยังไม่ได้เลือกสินค้า</div>';
      return;
    }

    this.burstSelectedList.innerHTML = this.burstManualProducts.map((product, index) => `
      <div class="burst-selected-item" data-index="${index}">
        <img src="${product.productImage}" alt="${product.name}" class="burst-selected-item-img">
        <span class="burst-selected-item-name">${product.name}</span>
        <span class="burst-selected-item-badge">${product.videoCount || 0}</span>
        <button type="button" class="burst-selected-item-remove" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    // Bind remove buttons
    this.burstSelectedList.querySelectorAll('.burst-selected-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.removeBurstManualProduct(index);
      });
    });
  },

  /**
   * Remove a product from burst manual selection
   */
  removeBurstManualProduct(index) {
    this.burstManualProducts.splice(index, 1);
    this.renderBurstSelectedList();
    this.updateBurstManualSummary();
    this.saveBurstManualProducts();
  },

  /**
   * Update burst manual mode summary
   */
  updateBurstManualSummary() {
    const productCount = this.burstManualProducts.length;
    const videoCount = this.burstManualProducts.reduce((sum, p) => sum + (p.videoCount || 0), 0);

    if (this.burstManualProductCount) {
      this.burstManualProductCount.textContent = productCount;
    }
    if (this.burstManualVideoCount) {
      this.burstManualVideoCount.textContent = videoCount;
    }
  },

  /**
   * Save burst manual products to localStorage
   */
  saveBurstManualProducts() {
    const ids = this.burstManualProducts.map(p => p.id);
    localStorage.setItem('tiktok_burst_manual_products', JSON.stringify(ids));
  },

  /**
   * Load burst manual products from localStorage
   */
  async loadBurstManualProducts() {
    const saved = localStorage.getItem('tiktok_burst_manual_products');
    if (!saved) return;

    try {
      const ids = JSON.parse(saved);
      const allProducts = await ProductWarehouse.getAll();

      // Get video counts
      const productVideoCount = {};
      this.burstAllPendingVideos.forEach(video => {
        if (!productVideoCount[video.productId]) {
          productVideoCount[video.productId] = 0;
        }
        productVideoCount[video.productId]++;
      });

      this.burstManualProducts = allProducts
        .filter(p => ids.includes(p.id) && productVideoCount[p.id])
        .map(p => ({
          ...p,
          videoCount: productVideoCount[p.id] || 0
        }));

      this.renderBurstSelectedList();
      this.updateBurstManualSummary();
    } catch (e) {
      console.error('Error loading burst manual products:', e);
    }
  },

  /**
   * Get videos for burst mode based on upload mode
   * @param {number} count - Number of videos to get (only for auto mode)
   * @returns {Array} Array of video objects with product info
   */
  async getBurstVideos(count) {
    // Get all products for product info
    const allProducts = await ProductWarehouse.getAll();
    const productMap = {};
    allProducts.forEach(p => { productMap[p.id] = p; });

    let videosToProcess = [];

    // Manual mode: get videos only from selected products
    if (this.burstSelectionMode === 'manual') {
      if (this.burstManualProducts.length === 0) return [];

      const selectedIds = new Set(this.burstManualProducts.map(p => p.id));
      videosToProcess = this.burstAllPendingVideos.filter(v => selectedIds.has(v.productId));
    } else {
      // Auto mode: use all pending videos
      if (this.burstAllPendingVideos.length === 0) return [];
      videosToProcess = this.burstAllPendingVideos;
    }

    let selectedVideos = [];

    // For manual mode, use all videos from selected products (no count limit)
    // For auto mode, use count limit
    const effectiveCount = this.burstSelectionMode === 'manual' ? videosToProcess.length : count;

    if (this.burstSelectionMode === 'manual' || this.burstUploadMode === 'sequential') {
      // Sequential: Sort by product, then by createdAt
      // Group videos by product
      const videosByProduct = {};
      videosToProcess.forEach(video => {
        if (!videosByProduct[video.productId]) {
          videosByProduct[video.productId] = [];
        }
        videosByProduct[video.productId].push(video);
      });

      // Sort videos in each product by createdAt
      Object.keys(videosByProduct).forEach(productId => {
        videosByProduct[productId].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      });

      // Get product IDs sorted by first video's createdAt
      const productIds = Object.keys(videosByProduct).sort((a, b) => {
        const aFirst = videosByProduct[a][0]?.createdAt || 0;
        const bFirst = videosByProduct[b][0]?.createdAt || 0;
        return aFirst - bFirst;
      });

      // Pick videos sequentially by product
      let remaining = effectiveCount;
      for (const productId of productIds) {
        if (remaining <= 0) break;
        const productVideos = videosByProduct[productId];
        const toTake = Math.min(remaining, productVideos.length);
        for (let i = 0; i < toTake; i++) {
          const video = productVideos[i];
          selectedVideos.push({
            ...video,
            product: productMap[video.productId] || null
          });
        }
        remaining -= toTake;
      }

    } else {
      // Random: Shuffle and pick
      const shuffled = [...videosToProcess].sort(() => Math.random() - 0.5);
      selectedVideos = shuffled.slice(0, effectiveCount).map(video => ({
        ...video,
        product: productMap[video.productId] || null
      }));
    }

    return selectedVideos;
  }
};
