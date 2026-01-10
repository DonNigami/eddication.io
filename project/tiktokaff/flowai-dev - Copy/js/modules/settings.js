/**
 * Settings Module
 * Handles API key configuration and model selection
 */
const Settings = {
  modal: null,
  geminiInput: null,
  openaiInput: null,
  facebookAccessTokenInput: null,
  youtubeApiKeyInput: null,
  shopeePartnerIdInput: null,
  shopeePartnerKeyInput: null,
  downloadDelaySelect: null,
  showDebugCheckbox: null,
  skipDownloadCheckbox: null,
  videoDurationSelect: null,
  imageGenerationDelaySelect: null,
  videoGenerationDelaySelect: null,
  selectedModel: 'gemini',
  downloadDelay: 0,
  videoDuration: 10,
  imageGenerationDelay: 60,
  videoGenerationDelay: 90,
  showDebugButtons: false,
  skipDownload: false,
  facebookAccessToken: '',
  youtubeApiKey: '',
  shopeePartnerId: '',
  shopeePartnerKey: '',

  /**
   * Initialize settings module
   */
  init() {
    this.modal = document.getElementById('settingsModal');
    this.geminiInput = document.getElementById('geminiApiKey');
    this.openaiInput = document.getElementById('openaiApiKey');
    this.facebookAccessTokenInput = document.getElementById('facebookAccessToken');
    this.youtubeApiKeyInput = document.getElementById('youtubeApiKey');
    this.shopeePartnerIdInput = document.getElementById('shopeePartnerId');
    this.shopeePartnerKeyInput = document.getElementById('shopeePartnerKey');
    this.downloadDelaySelect = document.getElementById('downloadDelay');
    this.videoDurationSelect = document.getElementById('videoDuration');
    this.imageGenerationDelaySelect = document.getElementById('imageGenerationDelay');
    this.videoGenerationDelaySelect = document.getElementById('videoGenerationDelay');
    this.showDebugCheckbox = document.getElementById('showDebugButtons');
    this.skipDownloadCheckbox = document.getElementById('skipDownload');

    this.setupEventListeners();
    this.loadSettings();
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const settingsBtn = document.getElementById('settingsBtn');
    const closeBtn = document.getElementById('closeSettingsBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const toggleGemini = document.getElementById('toggleGemini');
    const toggleOpenai = document.getElementById('toggleOpenai');
    const exportBtn = document.getElementById('exportDataBtn');
    const importBtn = document.getElementById('importDataBtn');

    settingsBtn.addEventListener('click', () => this.openModal());
    closeBtn.addEventListener('click', () => this.closeModal());
    saveBtn.addEventListener('click', () => this.saveSettings());

    toggleGemini.addEventListener('click', () => this.setModel('gemini'));
    toggleOpenai.addEventListener('click', () => this.setModel('openai'));

    // Backup/Restore buttons
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
    if (importBtn) importBtn.addEventListener('click', () => this.triggerImport());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  },

  /**
   * Set selected model
   */
  setModel(model) {
    this.selectedModel = model;
    const toggleGemini = document.getElementById('toggleGemini');
    const toggleOpenai = document.getElementById('toggleOpenai');

    toggleGemini.classList.toggle('active', model === 'gemini');
    toggleOpenai.classList.toggle('active', model === 'openai');
  },

  /**
   * Open settings modal
   */
  openModal() {
    this.loadSettings();
    this.modal.style.display = 'flex';
  },

  /**
   * Close settings modal
   */
  closeModal() {
    this.modal.style.display = 'none';
  },

  /**
   * Load settings from storage
   */
  loadSettings() {
    chrome.storage.local.get([
      'geminiApiKey', 'openaiApiKey', 'selectedModel',
      'facebookAccessToken', 'youtubeApiKey', 'shopeePartnerId', 'shopeePartnerKey',
      'downloadDelay', 'videoDuration', 'imageGenerationDelay', 'videoGenerationDelay',
      'showDebugButtons', 'skipDownload'
    ], (result) => {
      this.geminiInput.value = result.geminiApiKey || '';
      this.openaiInput.value = result.openaiApiKey || '';

      // Load platform credentials
      if (this.facebookAccessTokenInput) {
        this.facebookAccessToken = result.facebookAccessToken || '';
        this.facebookAccessTokenInput.value = this.facebookAccessToken;
      }
      if (this.youtubeApiKeyInput) {
        this.youtubeApiKey = result.youtubeApiKey || '';
        this.youtubeApiKeyInput.value = this.youtubeApiKey;
      }
      if (this.shopeePartnerIdInput) {
        this.shopeePartnerId = result.shopeePartnerId || '';
        this.shopeePartnerIdInput.value = this.shopeePartnerId;
      }
      if (this.shopeePartnerKeyInput) {
        this.shopeePartnerKey = result.shopeePartnerKey || '';
        this.shopeePartnerKeyInput.value = this.shopeePartnerKey;
      }

      this.setModel(result.selectedModel || 'gemini');

      // Load skip download setting
      this.skipDownload = result.skipDownload || false;
      if (this.skipDownloadCheckbox) {
        this.skipDownloadCheckbox.checked = this.skipDownload;
      }

      // Load download delay (default 0)
      this.downloadDelay = result.downloadDelay !== undefined ? result.downloadDelay : 0;
      if (this.downloadDelaySelect) {
        this.downloadDelaySelect.value = this.downloadDelay;
      }

      // Load video duration (default 10 seconds)
      this.videoDuration = result.videoDuration || 10;
      if (this.videoDurationSelect) {
        this.videoDurationSelect.value = this.videoDuration;
      }

      // Load image generation delay (default 60 seconds)
      this.imageGenerationDelay = result.imageGenerationDelay || 60;
      if (this.imageGenerationDelaySelect) {
        this.imageGenerationDelaySelect.value = this.imageGenerationDelay;
      }

      // Load video generation delay (default 90 seconds)
      this.videoGenerationDelay = result.videoGenerationDelay || 90;
      if (this.videoGenerationDelaySelect) {
        this.videoGenerationDelaySelect.value = this.videoGenerationDelay;
      }

      // Load debug buttons setting
      this.showDebugButtons = result.showDebugButtons || false;
      if (this.showDebugCheckbox) {
        this.showDebugCheckbox.checked = this.showDebugButtons;
      }
      this.updateDebugButtonsVisibility();
    });
  },

  /**
   * Save settings to storage
   */
  saveSettings() {
    const geminiApiKey = this.geminiInput.value.trim();
    const openaiApiKey = this.openaiInput.value.trim();
    const facebookAccessToken = this.facebookAccessTokenInput?.value.trim() || '';
    const youtubeApiKey = this.youtubeApiKeyInput?.value.trim() || '';
    const shopeePartnerId = this.shopeePartnerIdInput?.value.trim() || '';
    const shopeePartnerKey = this.shopeePartnerKeyInput?.value.trim() || '';
    const selectedModel = this.selectedModel;
    const showDebugButtons = this.showDebugCheckbox?.checked || false;
    const skipDownload = this.skipDownloadCheckbox?.checked || false;
    const downloadDelay = parseInt(this.downloadDelaySelect?.value || '0', 10);
    const videoDuration = parseInt(this.videoDurationSelect?.value || '10', 10);
    const imageGenerationDelay = parseInt(this.imageGenerationDelaySelect?.value || '60', 10);
    const videoGenerationDelay = parseInt(this.videoGenerationDelaySelect?.value || '90', 10);

    this.downloadDelay = downloadDelay;
    this.videoDuration = videoDuration;
    this.imageGenerationDelay = imageGenerationDelay;
    this.videoGenerationDelay = videoGenerationDelay;
    this.showDebugButtons = showDebugButtons;
    this.skipDownload = skipDownload;
    this.facebookAccessToken = facebookAccessToken;
    this.youtubeApiKey = youtubeApiKey;
    this.shopeePartnerId = shopeePartnerId;
    this.shopeePartnerKey = shopeePartnerKey;

    chrome.storage.local.set({
      geminiApiKey, openaiApiKey, selectedModel,
      facebookAccessToken, youtubeApiKey, shopeePartnerId, shopeePartnerKey,
      downloadDelay, videoDuration, imageGenerationDelay, videoGenerationDelay,
      showDebugButtons, skipDownload
    }, () => {
      this.updateDebugButtonsVisibility();
      Helpers.showToast('บันทึกแล้ว', 'success');
      this.closeModal();
    });
  },

  /**
   * Get download delay in seconds
   */
  getDownloadDelay() {
    return this.downloadDelay;
  },

  /**
   * Get video duration in seconds
   */
  getVideoDuration() {
    return this.videoDuration;
  },

  /**
   * Get image generation delay in seconds
   */
  getImageGenerationDelay() {
    return this.imageGenerationDelay;
  },

  /**
   * Get video generation delay in seconds
   */
  getVideoGenerationDelay() {
    return this.videoGenerationDelay;
  },

  /**   * Get Facebook Access Token
   */
  getFacebookAccessToken() {
    return this.facebookAccessToken;
  },

  /**
   * Get YouTube API Key
   */
  getYoutubeApiKey() {
    return this.youtubeApiKey;
  },

  /**
   * Get Shopee Partner ID
   */
  getShopeePartnerId() {
    return this.shopeePartnerId;
  },

  /**
   * Get Shopee Partner Key
   */
  getShopeePartnerKey() {
    return this.shopeePartnerKey;
  },

  /**   * Check if download should be skipped
   */
  isSkipDownload() {
    return this.skipDownload;
  },

  /**
   * Update debug buttons visibility based on setting
   */
  updateDebugButtonsVisibility() {
    const wrapper = document.getElementById('debugButtonsWrapper');
    if (wrapper) {
      wrapper.style.display = this.showDebugButtons ? 'block' : 'none';
    }
  },

  /**
   * Get selected model
   */
  getSelectedModel() {
    return this.selectedModel;
  },

  // ==================== Backup/Restore ====================

  /**
   * Export all data to JSON file (including IndexedDB data)
   */
  async exportData() {
    try {
      // 1. Get Chrome Storage data
      const allData = await chrome.storage.local.get(null);

      // 2. Get IndexedDB data (Prompt Warehouse)
      let promptWarehouseData = null;
      if (typeof PromptStorage !== 'undefined') {
        try {
          promptWarehouseData = await PromptStorage.exportAll();
        } catch (e) {
          console.warn('Could not export prompt warehouse:', e);
        }
      }

      const exportData = {
        version: '2.1',
        exportDate: new Date().toISOString(),
        data: allData,
        promptWarehouse: promptWarehouseData
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `flow-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      Helpers.showToast('Export สำเร็จ (รวมคลัง Prompt)', 'success');
    } catch (error) {
      console.error('Export error:', error);
      Helpers.showToast('Export ไม่สำเร็จ', 'error');
    }
  },

  /**
   * Import data from JSON file (including IndexedDB data)
   */
  async importData(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.data) {
        throw new Error('Invalid backup file');
      }

      // 1. Import Chrome Storage data
      await chrome.storage.local.set(importData.data);

      // 2. Import IndexedDB data (Prompt Warehouse) if exists
      let promptCount = 0;
      if (importData.promptWarehouse && typeof PromptStorage !== 'undefined') {
        try {
          promptCount = await PromptStorage.importAll(importData.promptWarehouse, false);
        } catch (e) {
          console.warn('Could not import prompt warehouse:', e);
        }
      }

      const message = promptCount > 0
        ? `Import สำเร็จ (รวม ${promptCount} prompts) กรุณา reload`
        : 'Import สำเร็จ กรุณา reload';

      Helpers.showToast(message, 'success');

      // Reload after 1.5 second
      setTimeout(() => location.reload(), 1500);
    } catch (error) {
      console.error('Import error:', error);
      Helpers.showToast('Import ไม่สำเร็จ: ไฟล์ไม่ถูกต้อง', 'error');
    }
  },

  /**
   * Trigger file input for import
   */
  triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importData(file);
      }
    };
    input.click();
  }
};
