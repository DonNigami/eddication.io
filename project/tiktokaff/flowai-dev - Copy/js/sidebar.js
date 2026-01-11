/**
 * Flow AI Unlocked - Main Sidebar Script
 * Handles tab switching, license, and initialization
 */

// Global safeguards
if (typeof window.workflowState === 'undefined') {
  window.workflowState = {};
}

// Global error handler to prevent crashes from external scripts
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('workflowState')) {
    console.warn('[FlowAI] Suppressed external workflowState error:', event.error.message);
    event.preventDefault();
    return true;
  }
});

class FlowAIUnlocked {
  constructor() {
    this.currentTab = 'ai-generator';
    this.init();
  }

  async init() {
    await this.checkLicense();
  }

  /**
   * Check license before starting app
   */
  async checkLicense() {
    // Initialize license module (disabled - auto-activate as free version)
    await License.init();

    // License system disabled - show app immediately
    this.showApp();
  }

  /**
   * Display machine ID on license screen
   */
  displayMachineId() {
    const machineIdEl = document.getElementById('machineIdDisplay');
    if (machineIdEl && License.machineId) {
      machineIdEl.textContent = License.machineId;
    }
  }

  /**
   * Setup license form event listeners
   */
  setupLicenseForm() {
    const input = document.getElementById('licenseKeyInput');
    const submitBtn = document.getElementById('licenseSubmitBtn');

    // Submit on button click
    submitBtn.addEventListener('click', () => this.handleLicenseSubmit());

    // Submit on Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLicenseSubmit();
      }
    });

    // Auto-format license key input (add dashes)
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (value.length > 16) value = value.substring(0, 16);

      // Add dashes every 4 characters
      const parts = value.match(/.{1,4}/g) || [];
      e.target.value = parts.join('-');
    });
  }

  /**
   * Handle license form submission
   */
  async handleLicenseSubmit() {
    const input = document.getElementById('licenseKeyInput');
    const submitBtn = document.getElementById('licenseSubmitBtn');
    const licenseKey = input.value.trim();

    if (!licenseKey) {
      this.showLicenseMessage('กรุณากรอก License Key', 'error');
      input.classList.add('error');
      return;
    }

    // Disable form
    input.disabled = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    this.showLicenseMessage('กำลังตรวจสอบ...', 'info');

    try {
      const result = await License.validateAndActivate(licenseKey);

      if (result.success) {
        input.classList.remove('error');
        input.classList.add('success');
        this.showLicenseMessage(result.message, 'success');

        // Wait a moment then show app
        setTimeout(() => {
          this.showApp();
        }, 1000);
      } else {
        input.classList.add('error');
        input.classList.remove('success');
        this.showLicenseMessage(result.message, 'error');

        // Open aiunlock.co for invalid license
        if (result.code === 'LICENSE_NOT_FOUND' || result.code === 'LICENSE_INACTIVE' ||
          result.code === 'LICENSE_EXPIRED' || result.code === 'MAX_ACTIVATIONS_REACHED' ||
          result.code === 'PROGRAM_MISMATCH') {
          setTimeout(() => {
            window.open('https://aiunlock.co', '_blank');
          }, 1500);
        }

        // Re-enable form
        input.disabled = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
      }
    } catch (error) {
      console.error('License submit error:', error);
      this.showLicenseMessage('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');

      // Re-enable form
      input.disabled = false;
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  }

  /**
   * Show license message
   */
  showLicenseMessage(message, type = 'info') {
    const msgEl = document.getElementById('licenseMessage');
    msgEl.textContent = message;
    msgEl.className = `license-message ${type}`;
  }

  /**
   * Show license overlay
   */
  showLicenseOverlay() {
    document.getElementById('licenseOverlay').hidden = false;
    document.getElementById('appContainer').hidden = true;
  }

  /**
   * Show main app (hide license overlay)
   */
  showApp() {
    const overlay = document.getElementById('licenseOverlay');
    const appContainer = document.getElementById('appContainer');

    if (overlay) {
      overlay.style.display = 'none';
      overlay.hidden = true;
    }
    if (appContainer) {
      appContainer.style.display = 'flex';
      appContainer.hidden = false;
    }

    console.log('[FlowAI] App initialized - Free version activated');

    // Initialize the app
    this.initApp();

    // License system disabled - no heartbeat needed
    // License.startHeartbeat();
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    License.stopHeartbeat();
    await License.clearLicense();
    this.showLicenseOverlay();

    // Clear the input
    const input = document.getElementById('licenseKeyInput');
    input.value = '';
    input.classList.remove('error', 'success');
    input.disabled = false;
    document.getElementById('licenseSubmitBtn').disabled = false;
    document.getElementById('licenseSubmitBtn').classList.remove('loading');
    document.getElementById('licenseMessage').textContent = '';
  }

  /**
   * Initialize app after license check
   */
  async initApp() {
    console.log('[FlowAI] initApp() starting...');

    try {
      console.log('[FlowAI] Setting up tabs...');
      this.setupTabs();

      console.log('[FlowAI] Setting up header buttons...');
      this.setupHeaderButtons();

      console.log('[FlowAI] Setting up settings modal...');
      this.setupSettingsModal();

      console.log('[FlowAI] Loading warehouse stats...');
      this.loadWarehouseStats();

      // Initialize AI Generator modules (existing flow-unlocked-db modules)
      console.log('[FlowAI] Initializing modules...');
      if (typeof ImageUpload !== 'undefined') ImageUpload.init();
      if (typeof Settings !== 'undefined') Settings.init();
      if (typeof UGCSection !== 'undefined') UGCSection.init();
      if (typeof CoverDetails !== 'undefined') CoverDetails.init();
      if (typeof PromptGenerator !== 'undefined') PromptGenerator.init();
      if (typeof PromptTemplateSelector !== 'undefined') PromptTemplateSelector.init();
      if (typeof VideoPromptTemplateSelector !== 'undefined') VideoPromptTemplateSelector.init();
      if (typeof Controls !== 'undefined') Controls.init();
      if (typeof FormState !== 'undefined') FormState.init();
      if (typeof BurstMode !== 'undefined') BurstMode.init();

      // Initialize TikTok Uploader
      if (typeof TikTokUploader !== 'undefined') TikTokUploader.init();

      // Initialize AI Story tab
      await this.initStoryTab();

      console.log('[FlowAI] Flow AI v4.0 (Eddication) initialized successfully');

      // V12: Update video templates to include "single prompt only" constraint
      const fixKey = 'videoSinglePromptV12b';
      const { [fixKey]: alreadyFixed } = await chrome.storage.local.get(fixKey);

      if (!alreadyFixed && typeof PromptStorage !== 'undefined') {
        console.log('Sidebar: Updating video templates (V12b) - single prompt only...');
        await PromptStorage.init();
        const result = await PromptStorage.forceUpdateVideoTemplates();
        await chrome.storage.local.set({ [fixKey]: true });
        console.log('Video templates updated:', result.updated, 'templates');
      }
    } catch (error) {
      console.error('[FlowAI] Error during initApp:', error);
      // Continue despite errors - critical system still works
      console.log('[FlowAI] Continuing despite initialization error...');
    }
  }

  /**
   * Initialize AI Story tab
   */
  async initStoryTab() {
    // Load characters into dropdown
    await this.loadStoryCharacters();

    // Load prompt style dropdowns
    await this.loadStoryPromptStyles();

    // Setup character select change handler
    const characterSelect = document.getElementById('storyCharacterSelect');
    if (characterSelect) {
      characterSelect.addEventListener('change', (e) => this.handleStoryCharacterSelect(e.target.value));
    }

    // Setup loop count custom input
    const loopSelect = document.getElementById('storyLoopCountSelect');
    const customInput = document.getElementById('storyCustomLoopCount');
    if (loopSelect && customInput) {
      loopSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customInput.hidden = false;
          customInput.focus();
        } else {
          customInput.hidden = true;
        }
      });
    }

    // Setup generate story details button
    const generateBtn = document.getElementById('generateStoryDetailsBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateStoryDetails());
    }

    // Setup generate topics button
    const generateTopicsBtn = document.getElementById('generateTopicsBtn');
    if (generateTopicsBtn) {
      generateTopicsBtn.addEventListener('click', () => this.generateTopics());
    }

    // Setup prompt generation buttons
    const imagePromptBtn = document.getElementById('storyGenerateImagePromptBtn');
    if (imagePromptBtn) {
      imagePromptBtn.addEventListener('click', () => this.generateStoryPrompts('image'));
    }

    const videoPromptBtn = document.getElementById('storyGenerateVideoPromptBtn');
    if (videoPromptBtn) {
      videoPromptBtn.addEventListener('click', () => this.generateStoryPrompts('video'));
    }

    const storyLoadTemplateBtn = document.getElementById('storyLoadTemplateBtn');
    if (storyLoadTemplateBtn) {
      storyLoadTemplateBtn.addEventListener('click', () => this.loadStoryTemplatePrompts());
    }

    // Setup copy prompt button
    const copyBtn = document.getElementById('storyCopyPromptBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyStoryPrompt());
    }

    // Setup story automation buttons
    const storyAutomationBtn = document.getElementById('storyAutomationBtn');
    if (storyAutomationBtn) {
      storyAutomationBtn.addEventListener('click', () => this.handleStoryAutomation());
    }

    const storyStopBtn = document.getElementById('storyStopAutomationBtn');
    if (storyStopBtn) {
      storyStopBtn.addEventListener('click', () => this.stopStoryAutomation());
    }

    // Setup style change warning
    const styleSelect = document.getElementById('storyImageStyleSelect');
    if (styleSelect) {
      styleSelect.addEventListener('change', () => this.handleStoryStyleChange());
    }

    // Track generated style
    this.storyGeneratedWithStyle = null;
  }

  /**
   * Load characters from warehouse into AI Story dropdown
   */
  async loadStoryCharacters() {
    const select = document.getElementById('storyCharacterSelect');
    if (!select) return;

    const characters = await ProductWarehouse.getCharacters();

    // Clear and rebuild options
    select.innerHTML = '<option value="">-- เลือกตัวละคร --</option>';

    const genderMap = { female: 'หญิง', male: 'ชาย' };

    characters.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = `${c.name} (${genderMap[c.gender] || 'หญิง'})`;
      select.appendChild(option);
    });
  }

  /**
   * Load prompt style dropdowns for AI Story tab
   */
  async loadStoryPromptStyles() {
    // Load image templates
    const imageSelect = document.getElementById('storyImageStyleSelect');
    if (imageSelect) {
      await this.renderStoryTemplateDropdown(imageSelect, 'image');
    }

    // Load video templates
    const videoSelect = document.getElementById('storyVideoStyleSelect');
    if (videoSelect) {
      await this.renderStoryTemplateDropdown(videoSelect, 'video');
    }
  }

  /**
   * Render template dropdown for AI Story (only AI Story category)
   */
  async renderStoryTemplateDropdown(selectElement, type) {
    let templates = [];

    // Get AI Story templates from PromptStorage (IndexedDB)
    if (typeof PromptStorage !== 'undefined') {
      try {
        await PromptStorage.init();
        // Import AI Story defaults if not exists
        await PromptStorage.importAIStoryDefaults();
        // Get only AI Story category templates
        templates = await PromptStorage.getAIStoryTemplates(type);
      } catch (error) {
        console.error(`Error loading AI Story ${type} templates:`, error);
      }
    }

    let html = '';

    // Default MV templates as selected
    const defaultTemplateId = type === 'image' ? 'story-music' : 'story-video-music';

    if (templates.length > 0) {
      // Use AI Story templates from warehouse
      templates.forEach((template) => {
        const selected = template.id === defaultTemplateId ? 'selected' : '';
        const icon = template.isRandom ? '🎲 ' : '';
        html += `<option value="${template.id}" ${selected}>${icon}${template.name}</option>`;
      });
    } else {
      // Fallback to hardcoded AI Story templates
      const storyTemplates = type === 'image' ? [
        { id: 'story-music', name: 'MV เพลง' },
        { id: 'story-funny-clip', name: 'คลิปสั้นตลก' },
        { id: 'story-drama', name: 'ดราม่าซีรีส์' },
        { id: 'story-romantic', name: 'โรแมนติก' },
        { id: 'story-horror', name: 'สยองขวัญ' },
        { id: 'story-action', name: 'แอ็คชั่น' }
      ] : [
        { id: 'story-video-music', name: 'วิดีโอ MV เพลง' },
        { id: 'story-video-funny', name: 'วิดีโอตลก' },
        { id: 'story-video-drama', name: 'วิดีโอดราม่า' },
        { id: 'story-video-romantic', name: 'วิดีโอโรแมนติก' },
        { id: 'story-video-horror', name: 'วิดีโอสยองขวัญ' },
        { id: 'story-video-action', name: 'วิดีโอแอ็คชั่น' }
      ];

      storyTemplates.forEach((template) => {
        const selected = template.id === defaultTemplateId ? 'selected' : '';
        html += `<option value="${template.id}" ${selected}>${template.name}</option>`;
      });
    }

    selectElement.innerHTML = html;
  }

  /**
   * Handle AI Story character selection
   */
  async handleStoryCharacterSelect(characterId) {
    const preview = document.getElementById('storyCharacterImagePreview');
    const placeholder = document.getElementById('storyCharacterPlaceholder');
    const nameInput = document.getElementById('storyCharacterName');

    if (!characterId) {
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (nameInput) nameInput.value = '';
      return;
    }

    const character = await ProductWarehouse.getCharacterById(characterId);
    if (character) {
      // Show image preview
      if (preview && character.image) {
        preview.src = character.image;
        preview.hidden = false;
      }
      if (placeholder) placeholder.hidden = true;

      // Set character name
      if (nameInput) nameInput.value = character.name || '';

      // Update gender radio based on character
      if (character.gender) {
        const genderRadio = document.querySelector(`input[name="storyGender"][value="${character.gender}"]`);
        if (genderRadio) genderRadio.checked = true;
      }
    }
  }

  /**
   * Generate topics using AI
   */
  async generateTopics() {
    const topicInput = document.getElementById('storyTopic');
    const countInput = document.getElementById('topicGenerateCount');
    const generateBtn = document.getElementById('generateTopicsBtn');
    const characterNameInput = document.getElementById('storyCharacterName');
    const genderRadio = document.querySelector('input[name="storyGender"]:checked');

    const count = parseInt(countInput?.value || 3);
    const goals = document.getElementById('topicGoals')?.value?.trim() || '';

    if (count < 1 || count > 10) {
      alert('กรุณาใส่จำนวนหัวข้อระหว่าง 1-10');
      return;
    }

    const characterName = characterNameInput?.value || 'ตัวละครหลัก';
    const gender = genderRadio?.value || 'female';
    const genderText = gender === 'male' ? 'ผู้ชาย' : 'ผู้หญิง';

    // Disable button
    const originalText = generateBtn.innerHTML;
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';

    try {
      // Get API settings
      const settings = await chrome.storage.local.get(['selectedAI', 'geminiApiKey', 'openaiApiKey']);
      let selectedAI = settings.selectedAI || 'gemini';
      let geminiApiKey = settings.geminiApiKey;
      let openaiApiKey = settings.openaiApiKey;

      // Check if API keys are configured
      const hasGemini = geminiApiKey && geminiApiKey.trim();
      const hasOpenAI = openaiApiKey && openaiApiKey.trim();

      // If no API keys, show API selection dialog
      if (!hasGemini && !hasOpenAI) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;

        const choice = await this.showAPISelectionDialog();
        if (!choice) return;

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';

        selectedAI = choice.api;
        if (choice.api === 'gemini') {
          geminiApiKey = choice.apiKey;
          await chrome.storage.local.set({ selectedAI: 'gemini', geminiApiKey });
        } else {
          openaiApiKey = choice.apiKey;
          await chrome.storage.local.set({ selectedAI: 'openai', openaiApiKey });
        }
      } else if (!hasGemini && selectedAI === 'gemini') {
        // Gemini selected but no key
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;
        const apiKey = await this.showAPIKeyInputDialog('Gemini');
        if (!apiKey) return;
        geminiApiKey = apiKey;
        await chrome.storage.local.set({ geminiApiKey });

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';
      } else if (!hasOpenAI && selectedAI === 'openai') {
        // OpenAI selected but no key
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;
        const apiKey = await this.showAPIKeyInputDialog('OpenAI');
        if (!apiKey) return;
        openaiApiKey = apiKey;
        await chrome.storage.local.set({ openaiApiKey });

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';
      }

      // Create prompt for generating topics
      const goalsSection = goals ? `\n\nเป้าหมาย/ประเด็นที่ต้องการ:\n${goals}` : '';
      const prompt = `สร้างหัวข้อเรื่องสำหรับคลิปสั้น TikTok จำนวน ${count} หัวข้อ
      
ตัวละคร: ${characterName} (${genderText})${goalsSection}

กรุณาสร้างหัวข้อที่:
1. น่าสนใจและดึงดูดผู้ชม
2. เหมาะสำหรับคลิปสั้น 8-16 วินาที
3. มีความหลากหลาย ไม่ซ้ำกัน
4. เหมาะสมกับเนื้อหาบันเทิงและการเล่าเรื่อง

ตอบกลับเป็นรายการหัวข้อเท่านั้น เรียงลำดับหมายเลข 1-${count}`;

      // Call AI API
      let response;
      let retryWithOpenAI = false;

      try {
        if (selectedAI === 'openai') {
          // Check if OpenAIApi is available
          if (typeof OpenAIApi === 'undefined') {
            throw new Error('OpenAI API module not loaded. Please reload the page.');
          }
          response = await OpenAIApi.generateText(prompt, openaiApiKey);
        } else {
          response = await GeminiApi.generateText(prompt, geminiApiKey);
        }
      } catch (apiError) {
        const errorMsg = apiError.message || '';
        const isQuotaError = errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');

        // Check if it's a Gemini quota error
        if (selectedAI === 'gemini' && isQuotaError) {
          console.warn('Gemini quota exceeded, attempting to switch to OpenAI...');
          generateBtn.disabled = false;
          generateBtn.innerHTML = originalText;

          // If OpenAI key not available, ask user to provide it
          if (!hasOpenAI) {
            console.log('No OpenAI key available, asking user to provide one...');
            const apiKey = await this.showAPIKeyInputDialog('OpenAI');
            if (!apiKey) {
              throw new Error('Gemini quota exceeded. OpenAI API Key is required to continue.');
            }
            openaiApiKey = apiKey;
            await chrome.storage.local.set({ openaiApiKey });
            hasOpenAI = true;
          }

          // Show dialog to switch to OpenAI
          const switchResult = await this.showAPIQuotaErrorDialog('Gemini');
          if (switchResult) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="spinner"></span> กำลังสร้าง...';

            selectedAI = 'openai';
            await chrome.storage.local.set({ selectedAI: 'openai' });
            retryWithOpenAI = true;
          } else {
            throw new Error('Gemini quota exceeded. User cancelled switching to OpenAI.');
          }
        } else {
          throw apiError;
        }
      }

      // Retry with OpenAI if needed
      if (retryWithOpenAI) {
        try {
          // Check if OpenAIApi is available
          if (typeof OpenAIApi === 'undefined') {
            throw new Error('OpenAI API module not loaded. Please reload the page.');
          }
          response = await OpenAIApi.generateText(prompt, openaiApiKey);
        } catch (retryError) {
          console.error('OpenAI also failed:', retryError);
          throw new Error(`OpenAI Error: ${retryError.message}`);
        }
      }

      if (response) {
        // Parse response to extract topics
        const lines = response.split('\n').filter(line => line.trim());
        const topics = [];

        for (const line of lines) {
          // Extract topic from numbered list (e.g., "1. Topic here" or "1) Topic here")
          const match = line.match(/^\d+[\.\)]\s*(.+)$/);
          if (match) {
            topics.push(match[1].trim());
          }
        }

        if (topics.length > 0) {
          // Show topics in input (first topic)
          topicInput.value = topics[0];

          // If more than 1 topic, show selection dialog to choose multiple
          if (topics.length > 1) {
            const selectedTopics = await this.showTopicSelectionDialog(topics);
            if (selectedTopics && selectedTopics.length > 0) {
              // If user selected multiple topics, create details for each
              if (selectedTopics.length > 1) {
                topicInput.value = selectedTopics.join(' | ');
                await this.generateDetailsForMultipleTopics(selectedTopics);
              } else {
                // Single selection
                topicInput.value = selectedTopics[0];
                showToast('เลือกหัวข้อเรียบร้อย!', 'success');
              }
            }
          } else {
            showToast('สร้างหัวข้อสำเร็จ!', 'success');
          }
        } else {
          topicInput.value = response.substring(0, 200); // Fallback
          showToast('สร้างหัวข้อสำเร็จ!', 'success');
        }
      } else {
        throw new Error('ไม่สามารถสร้างหัวข้อได้');
      }
    } catch (error) {
      console.error('Error generating topics:', error);
      showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
  }

  /**
   * Generate details for multiple topics
   */
  async generateDetailsForMultipleTopics(selectedTopics) {
    const detailsTextarea = document.getElementById('storyDetails');
    const generateBtn = document.getElementById('generateTopicsBtn');

    // Ask user if they want to auto-generate details for all topics
    const autoGenerate = confirm(`ต้องการสร้างรายละเอียดอัตโนมัติสำหรับ ${selectedTopics.length} หัวข้อหรือไม่?\n\nคลิก "ตกลง" เพื่อสร้างอัตโนมัติ\nคลิก "ยกเลิก" เพื่อสร้างแต่ละรายการด้วยตนเอง`);

    if (!autoGenerate) {
      showToast(`เลือกหัวข้อ ${selectedTopics.length} หัวข้อแล้ว - สามารถสร้างรายละเอียดแต่ละรายการแยกกัน`, 'info');
      return;
    }

    // Auto-generate details for each topic
    const allDetails = [];

    for (let i = 0; i < selectedTopics.length; i++) {
      const topic = selectedTopics[i];
      try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = `<span class="spinner"></span> สร้างรายละเอียด (${i + 1}/${selectedTopics.length})...`;

        const details = await this.generateDetailForTopic(topic);
        allDetails.push(`หัวข้อ ${i + 1}: ${topic}\n${details}\n`);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error generating details for topic "${topic}":`, error);
        allDetails.push(`หัวข้อ ${i + 1}: ${topic}\n[ไม่สามารถสร้างรายละเอียดได้]\n`);
      }
    }

    detailsTextarea.value = allDetails.join('\n---\n\n');
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>Gen หัวข้อ';
    showToast('สร้างรายละเอียดเรียบร้อย!', 'success');
  }

  /**
   * Generate detail for a single topic
   */
  async generateDetailForTopic(topic) {
    const settings = await chrome.storage.local.get(['selectedAI', 'geminiApiKey', 'openaiApiKey']);
    let selectedAI = settings.selectedAI || 'gemini';
    let geminiApiKey = settings.geminiApiKey;
    let openaiApiKey = settings.openaiApiKey;

    const characterName = document.getElementById('storyCharacterName')?.value || 'ตัวละครหลัก';
    const genderRadio = document.querySelector('input[name="storyGender"]:checked');
    const gender = genderRadio?.value || 'female';
    const genderText = gender === 'male' ? 'ผู้ชาย' : 'ผู้หญิง';

    const prompt = `สร้างรายละเอียดสำหรับคลิป TikTok เรื่องสั้นเกี่ยวกับหัวข้อต่อไปนี้:

หัวข้อ: ${topic}
ตัวละคร: ${characterName} (${genderText})

กรุณาสร้างรายละเอียด:
1. ความยาวประมาณ 50-100 คำ
2. เหมาะสำหรับคลิปสั้น 8-16 วินาที
3. น่าสนใจและสร้างความอยากเห็นในผู้ชม
4. อธิบายเนื้อหาหลักของเรื่อง

ตอบกลับโดยให้รายละเอียดเท่านั้น ไม่ต้องมีหัวข้อหรือหมายเลข`;

    try {
      if (selectedAI === 'openai' && openaiApiKey) {
        return await OpenAIApi.generateText(prompt, openaiApiKey);
      } else if (geminiApiKey) {
        return await GeminiApi.generateText(prompt, geminiApiKey);
      } else {
        throw new Error('ไม่มี API Key ที่ตั้งค่าไว้');
      }
    } catch (error) {
      throw new Error(`ไม่สามารถสร้างรายละเอียดได้: ${error.message}`);
    }
  }

  /**
   * Show API selection dialog
   */
  async showAPISelectionDialog() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        padding: 20px;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 450px;
        width: 100%;
      `;

      const title = document.createElement('h3');
      title.textContent = 'เลือก AI API';
      title.style.cssText = 'margin: 0 0 16px 0; color: #333;';

      const subtitle = document.createElement('p');
      subtitle.textContent = 'กรุณาเลือก AI API และกรอก API Key';
      subtitle.style.cssText = 'margin: 0 0 16px 0; color: #666; font-size: 14px;';

      // Gemini option
      const geminiBtn = document.createElement('button');
      geminiBtn.textContent = '🔷 Google Gemini';
      geminiBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        margin-bottom: 8px;
        border: 2px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      `;
      geminiBtn.onmouseover = () => {
        geminiBtn.style.borderColor = '#4285F4';
        geminiBtn.style.background = '#F0F7FF';
      };
      geminiBtn.onmouseout = () => {
        geminiBtn.style.borderColor = '#ddd';
        geminiBtn.style.background = 'white';
      };
      geminiBtn.onclick = async () => {
        document.body.removeChild(modal);
        const apiKey = await this.showAPIKeyInputDialog('Google Gemini');
        if (apiKey) {
          resolve({ api: 'gemini', apiKey });
        } else {
          resolve(null);
        }
      };

      // OpenAI option
      const openaiBtn = document.createElement('button');
      openaiBtn.textContent = '🔴 OpenAI (GPT-4o-mini)';
      openaiBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      `;
      openaiBtn.onmouseover = () => {
        openaiBtn.style.borderColor = '#10A37F';
        openaiBtn.style.background = '#F0FBF8';
      };
      openaiBtn.onmouseout = () => {
        openaiBtn.style.borderColor = '#ddd';
        openaiBtn.style.background = 'white';
      };
      openaiBtn.onclick = async () => {
        document.body.removeChild(modal);
        const apiKey = await this.showAPIKeyInputDialog('OpenAI');
        if (apiKey) {
          resolve({ api: 'openai', apiKey });
        } else {
          resolve(null);
        }
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'ยกเลิก';
      cancelBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        margin-top: 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
      `;
      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      content.appendChild(title);
      content.appendChild(subtitle);
      content.appendChild(geminiBtn);
      content.appendChild(openaiBtn);
      content.appendChild(cancelBtn);
      modal.appendChild(content);
      document.body.appendChild(modal);
    });
  }

  /**
   * Show API key input dialog
   */
  async showAPIKeyInputDialog(apiName) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
        padding: 20px;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 450px;
        width: 100%;
      `;

      const title = document.createElement('h3');
      title.textContent = `ใส่ ${apiName} API Key`;
      title.style.cssText = 'margin: 0 0 8px 0; color: #333;';

      const help = document.createElement('p');
      help.style.cssText = 'margin: 0 0 16px 0; font-size: 12px; color: #999;';
      if (apiName.includes('Gemini')) {
        help.innerHTML = `ได้จาก <a href="https://ai.google.dev/api" target="_blank" style="color: #4285F4;">Google AI Studio</a>`;
      } else {
        help.innerHTML = `ได้จาก <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #10A37F;">OpenAI Dashboard</a>`;
      }

      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'sk-... หรือ AIzaSy...';
      input.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        margin-bottom: 16px;
        box-sizing: border-box;
      `;

      const showBtn = document.createElement('button');
      showBtn.textContent = '👁️ แสดง';
      showBtn.style.cssText = `
        padding: 4px 8px;
        margin-bottom: 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 12px;
      `;
      showBtn.onclick = () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        showBtn.textContent = input.type === 'password' ? '👁️ แสดง' : '🚫 ซ่อน';
      };

      const buttonRow = document.createElement('div');
      buttonRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
      buttonRow.appendChild(input);
      buttonRow.appendChild(showBtn);

      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '✓ บันทึก API Key';
      confirmBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        background: #4285F4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin-bottom: 8px;
      `;
      confirmBtn.onclick = () => {
        const key = input.value.trim();
        if (!key) {
          alert('กรุณากรอก API Key');
          return;
        }
        document.body.removeChild(modal);
        resolve(key);
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'ยกเลิก';
      cancelBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
      `;
      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      content.appendChild(title);
      content.appendChild(help);
      content.appendChild(buttonRow);
      content.appendChild(confirmBtn);
      content.appendChild(cancelBtn);
      modal.appendChild(content);
      document.body.appendChild(modal);

      // Focus input
      setTimeout(() => input.focus(), 100);
    });
  }

  /**
   * Show API quota error dialog (when Gemini quota exceeded)
   */
  async showAPIQuotaErrorDialog(failedAPI) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10003;
        padding: 20px;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 450px;
        width: 100%;
      `;

      const icon = document.createElement('div');
      icon.textContent = '⚠️';
      icon.style.cssText = 'font-size: 48px; text-align: center; margin-bottom: 16px;';

      const title = document.createElement('h3');
      title.textContent = `${failedAPI} Quota ถูกใช้หมด`;
      title.style.cssText = 'margin: 0 0 12px 0; color: #333; text-align: center;';

      const message = document.createElement('p');
      message.textContent = `${failedAPI} API quota ของคุณถูกใช้หมดแล้ว ระบบจะเปลี่ยนไปใช้ OpenAI แทนอัตโนมัติ`;
      message.style.cssText = 'margin: 0 0 16px 0; color: #666; font-size: 14px; text-align: center;';

      const switchBtn = document.createElement('button');
      switchBtn.textContent = '✓ ใช้ OpenAI แทน';
      switchBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        background: #10A37F;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin-bottom: 8px;
        font-weight: 500;
      `;
      switchBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'ยกเลิก';
      cancelBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
      `;
      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };

      const helpText = document.createElement('p');
      helpText.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #999;';
      helpText.innerHTML = `💡 วิธีแก้ไข: <a href="https://ai.google.dev/pricing" target="_blank" style="color: #4285F4;">อัพเกรด Gemini plan</a> หรือใช้ OpenAI ต่อไป`;

      content.appendChild(icon);
      content.appendChild(title);
      content.appendChild(message);
      content.appendChild(switchBtn);
      content.appendChild(cancelBtn);
      content.appendChild(helpText);
      modal.appendChild(content);
      document.body.appendChild(modal);
    });
  }

  /**
   * Show topic selection dialog
   */
  async showTopicSelectionDialog(topics) {
    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
      `;

      const title = document.createElement('h3');
      title.textContent = `เลือกหัวข้อที่ต้องการ (${topics.length} หัวข้อ)`;
      title.style.cssText = 'margin: 0 0 16px 0; color: #333;';

      const list = document.createElement('div');
      list.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;';

      const selectedTopics = new Set();
      const topicCheckboxes = {};

      topics.forEach((topic, index) => {
        const checkboxContainer = document.createElement('label');
        checkboxContainer.style.cssText = `
          display: flex;
          align-items: center;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
        `;
        checkboxContainer.onmouseover = () => {
          checkboxContainer.style.background = '#f5f5f5';
          checkboxContainer.style.borderColor = '#999';
        };
        checkboxContainer.onmouseout = () => {
          if (!topicCheckboxes[index].checked) {
            checkboxContainer.style.background = 'white';
            checkboxContainer.style.borderColor = '#ddd';
          }
        };

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = topic;
        checkbox.style.cssText = 'margin-right: 12px; cursor: pointer;';
        topicCheckboxes[index] = checkbox;

        const label = document.createElement('span');
        label.textContent = `${index + 1}. ${topic}`;
        label.style.cssText = 'flex: 1;';

        checkbox.onchange = () => {
          if (checkbox.checked) {
            selectedTopics.add(topic);
            checkboxContainer.style.background = '#e8f5e9';
            checkboxContainer.style.borderColor = '#4caf50';
          } else {
            selectedTopics.delete(topic);
            checkboxContainer.style.background = 'white';
            checkboxContainer.style.borderColor = '#ddd';
          }
        };

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        list.appendChild(checkboxContainer);
      });

      const buttonRow = document.createElement('div');
      buttonRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';

      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'สร้างรายละเอียด';
      confirmBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        border: 1px solid #4caf50;
        border-radius: 4px;
        background: #4caf50;
        color: white;
        cursor: pointer;
        font-weight: bold;
      `;
      confirmBtn.onclick = () => {
        if (selectedTopics.size === 0) {
          alert('กรุณาเลือกหัวข้ออย่างน้อย 1 หัวข้อ');
          return;
        }
        document.body.removeChild(modal);
        resolve(Array.from(selectedTopics));
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'ปิด';
      cancelBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
      `;
      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      buttonRow.appendChild(confirmBtn);
      buttonRow.appendChild(cancelBtn);

      content.appendChild(title);
      content.appendChild(list);
      content.appendChild(buttonRow);
      modal.appendChild(content);
      document.body.appendChild(modal);
    });
  }

  /**
   * Generate story details using AI
   */
  async generateStoryDetails() {
    const topicInput = document.getElementById('storyTopic');
    const detailsTextarea = document.getElementById('storyDetails');
    const generateBtn = document.getElementById('generateStoryDetailsBtn');
    const loopSelect = document.getElementById('storyLoopCountSelect');
    const customInput = document.getElementById('storyCustomLoopCount');
    const characterNameInput = document.getElementById('storyCharacterName');
    const genderRadio = document.querySelector('input[name="storyGender"]:checked');
    const styleSelect = document.getElementById('storyImageStyleSelect');
    const modeRadio = document.querySelector('input[name="storyMode"]:checked');
    const clipLengthSelect = document.getElementById('storyVideoLengthSelect');

    const clipLength = parseInt(clipLengthSelect?.value, 10) || 8;
    const sceneDurationText = clipLength >= 16 ? '2-5 วินาที' : '1-3 วินาที';

    // Get topic
    const topic = topicInput?.value?.trim();
    if (!topic) {
      alert('กรุณาใส่หัวข้อเรื่องก่อน');
      topicInput?.focus();
      return;
    }

    // Get story mode (content = หลายฉาก, repeat = 1 ฉาก ทำซ้ำ)
    const storyMode = modeRadio?.value || 'content';

    // Get video count - ถ้าโหมดทำซ้ำ สร้างแค่ 1 ฉาก
    let videoCount = storyMode === 'repeat'
      ? 1
      : (loopSelect?.value === 'custom'
        ? parseInt(customInput?.value) || 1
        : parseInt(loopSelect?.value) || 1);

    // Get character info
    const characterName = characterNameInput?.value || 'ตัวละครหลัก';
    const gender = genderRadio?.value || 'female';
    const genderText = gender === 'male' ? 'ผู้ชาย' : 'ผู้หญิง';

    // Get selected style info
    const selectedStyleId = styleSelect?.value;
    let styleName = 'คลิปสั้นตลก';
    let styleDescription = 'เน้นอารมณ์ขัน ตลก น่ารัก มี punchline หรือ twist ในฉากสุดท้าย';

    if (selectedStyleId) {
      try {
        const template = await PromptStorage.get(selectedStyleId);
        if (template) {
          styleName = template.name || styleName;
          // Use template description or extract from userMessageTemplate
          styleDescription = template.description || styleDescription;
        }
      } catch (err) {
        console.warn('Could not load style template:', err);
      }
    }

    // Show loading state
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.classList.add('loading');
      generateBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        กำลังสร้าง...
      `;
    }

    try {
      // Check if style is ambient/lofi/music (no story, just scene descriptions)
      const isAmbientStyle = selectedStyleId?.includes('lofi') || selectedStyleId?.includes('music');

      // Build prompt for AI with style context
      let systemPrompt, userMessage;

      if (isAmbientStyle) {
        // Lofi/Music style - create ambient scene descriptions from lyrics
        systemPrompt = `คุณเป็นผู้กำกับ MV เพลง เชี่ยวชาญในการแปลงเนื้อเพลงเป็นฉากภาพสำหรับมิวสิควิดีโอ

หน้าที่: วิเคราะห์เนื้อเพลง/อารมณ์ที่ให้มา แล้วออกแบบฉากภาพที่สื่อความหมายของเพลง

สไตล์: ${styleName}
${styleDescription}

ความยาวคลิป: ~${clipLength} วินาที (แบ่งเป็น ${videoCount} ฉาก)

กฎสำคัญ:
1. วิเคราะห์อารมณ์/ความหมายของเนื้อเพลง → แปลงเป็นฉากภาพที่สื่อความรู้สึกนั้น
2. เน้นบรรยาย "สถานที่ บรรยากาศ แสง สี องค์ประกอบ" ไม่ใช่เนื้อเรื่อง
3. ห้ามมีบทพูด/dialogue - เพราะจะใส่เพลงทับ
4. ถ้ามีคนในฉาก ให้บอกแค่ "silhouette" หรือ "ท่าทางกว้างๆ" (ไม่เน้นหน้า)
5. แต่ละฉากควรสื่ออารมณ์ที่แตกต่างกันตามเนื้อเพลง
6. เขียนเป็นภาษาไทย

ตัวอย่างการแปลงเนื้อเพลง:
- "ฉันเหงาเมื่อไม่มีเธอ" → ห้องว่างเปล่า แสงจากหน้าต่าง เตียงที่ไม่มีคน หมอนยับ
- "ความรักทำให้โลกสดใส" → ทุ่งดอกไม้สีสด แสงแดดอบอุ่น ท้องฟ้าสีคราม
- "ฝนตกในใจ" → ถนนเปียกฝน แสงไฟเมืองสะท้อนน้ำ บรรยากาศเศร้า
- "เธออยู่ไหน" → ชายหาดเวลาพระอาทิตย์ตก silhouette คนนั่งอยู่ไกลๆ

รูปแบบ output:
ฉากที่ 1: [ชื่อฉาก/บรรยากาศ]
[คำอธิบายฉากภาพ: สถานที่ แสง สี บรรยากาศ ที่สื่อความรู้สึกตามเนื้อเพลงส่วนนั้น]

ฉากที่ 2: [ชื่อฉาก/บรรยากาศ]
[คำอธิบายฉากภาพ...]`;

        userMessage = `วิเคราะห์เนื้อเพลง/อารมณ์นี้ แล้วออกแบบฉาก MV:

เนื้อเพลง/อารมณ์: ${topic}
จำนวนฉาก: ${videoCount} ฉาก
ความยาวคลิปที่ต้องการ: ~${clipLength} วินาที (แบ่งเป็น ${videoCount} ฉาก)
${characterName !== 'ตัวละครหลัก' ? `หมายเหตุ: อาจมี silhouette หรือท่าทางของคน (${genderText}) เป็นองค์ประกอบบางฉาก แต่ไม่ต้องเน้นหน้า` : 'หมายเหตุ: ไม่จำเป็นต้องมีคนในฉาก เน้นบรรยากาศ'}

สร้าง ${videoCount} ฉากภาพที่สื่อความรู้สึกตามเนื้อเพลง เน้นบรรยากาศ/สถานที่/แสงสี (ห้ามมีบทพูด)`;

      } else {
        // Regular story style - create story with scenes
        systemPrompt = `คุณเป็นนักเขียนบทคลิปสั้น เชี่ยวชาญการสร้างเนื้อหาสำหรับ TikTok/Reels

หน้าที่: สร้างรายละเอียดฉากสำหรับคลิปสั้น โดยแบ่งเป็นฉากตามจำนวนที่กำหนด

สไตล์: ${styleName}
${styleDescription}
ความยาวคลิปทั้งหมด: ~${clipLength} วินาที (แบ่งเป็น ${videoCount} ฉาก)

กฎการเขียน:
1. เขียนเป็นภาษาไทย
2. แต่ละฉากมีความยาว ${sceneDurationText}
3. ฉากต้องต่อเนื่องกันเป็นเรื่องราว
4. ปรับแต่งอารมณ์และเนื้อหาให้เข้ากับสไตล์ที่กำหนด
5. มี climax หรือจุดพีคในฉากสุดท้าย
6. อธิบายท่าทาง สีหน้า และอารมณ์ของตัวละคร
7. ถ้ามีบทพูดให้ใส่ในเครื่องหมายคำพูด ""

รูปแบบ output:
ฉากที่ 1: [ชื่อฉาก]
[รายละเอียดฉาก รวมถึงท่าทาง สีหน้า อารมณ์ และบทพูด (ถ้ามี)]

ฉากที่ 2: [ชื่อฉาก]
[รายละเอียดฉาก...]

... (ตามจำนวนฉากที่กำหนด)`;

        userMessage = `สร้างรายละเอียดคลิปสั้นสไตล์ "${styleName}":

หัวข้อ: ${topic}
ตัวละคร: ${characterName} (${genderText})
จำนวนฉาก: ${videoCount} ฉาก

สร้างเนื้อเรื่องที่แบ่งเป็น ${videoCount} ฉาก ให้ต่อเนื่องกันและเหมาะกับสไตล์ ${styleName}`;
      }

      // Call AI API
      const result = await this.callAIForStoryDetails(systemPrompt, userMessage);

      // Set result to textarea
      if (detailsTextarea && result) {
        detailsTextarea.value = result;

        // Save which style was used
        this.storyGeneratedWithStyle = {
          id: selectedStyleId,
          name: styleName
        };

        // Show style warning
        this.showStoryStyleWarning(styleName);
      }

    } catch (error) {
      console.error('Error generating story details:', error);
      alert('เกิดข้อผิดพลาดในการสร้างรายละเอียด: ' + error.message);
    } finally {
      // Reset button state
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.classList.remove('loading');
        generateBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          สร้างรายละเอียด
        `;
      }
    }
  }

  /**
   * Show style warning message
   */
  showStoryStyleWarning(styleName) {
    const warningEl = document.getElementById('storyStyleWarning');
    const styleNameEl = document.getElementById('storyStyleUsedName');

    if (warningEl && styleNameEl) {
      styleNameEl.textContent = styleName;
      warningEl.hidden = false;
    }
  }

  /**
   * Handle story style change - warn if story already generated
   */
  handleStoryStyleChange() {
    const detailsTextarea = document.getElementById('storyDetails');
    const hasContent = detailsTextarea?.value?.trim();
    const styleSelect = document.getElementById('storyImageStyleSelect');

    // Only warn if story was generated and has content
    if (this.storyGeneratedWithStyle && hasContent) {
      // Store new value before showing modal
      this.pendingStyleValue = styleSelect?.value;

      // Show modal warning
      this.showStyleChangeModal();
    }
  }

  /**
   * Show style change warning modal
   */
  showStyleChangeModal() {
    const modal = document.getElementById('storyStyleChangeModal');
    const oldStyleEl = document.getElementById('styleChangeOldStyle');
    const confirmBtn = document.getElementById('styleChangeConfirm');
    const cancelBtn = document.getElementById('styleChangeCancel');
    const closeBtn = document.getElementById('styleChangeModalClose');

    if (!modal) return;

    // Set old style name
    if (oldStyleEl) {
      oldStyleEl.textContent = this.storyGeneratedWithStyle?.name || 'ไม่ทราบ';
    }

    // Show modal
    modal.hidden = false;

    // Setup event listeners (remove old ones first)
    const handleConfirm = () => {
      modal.hidden = true;
      this.cleanupStyleChangeModal();
    };

    const handleCancel = () => {
      // Revert to original style
      const styleSelect = document.getElementById('storyImageStyleSelect');
      if (styleSelect && this.storyGeneratedWithStyle?.id) {
        styleSelect.value = this.storyGeneratedWithStyle.id;
      }
      modal.hidden = true;
      this.cleanupStyleChangeModal();
    };

    // Store handlers for cleanup
    this.styleChangeHandlers = { handleConfirm, handleCancel };

    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    closeBtn?.addEventListener('click', handleCancel);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) handleCancel();
    });
  }

  /**
   * Cleanup style change modal event listeners
   */
  cleanupStyleChangeModal() {
    const confirmBtn = document.getElementById('styleChangeConfirm');
    const cancelBtn = document.getElementById('styleChangeCancel');
    const closeBtn = document.getElementById('styleChangeModalClose');

    if (this.styleChangeHandlers) {
      confirmBtn?.removeEventListener('click', this.styleChangeHandlers.handleConfirm);
      cancelBtn?.removeEventListener('click', this.styleChangeHandlers.handleCancel);
      closeBtn?.removeEventListener('click', this.styleChangeHandlers.handleCancel);
      this.styleChangeHandlers = null;
    }
    this.pendingStyleValue = null;
  }

  /**
   * Call AI API to generate story details
   */
  async callAIForStoryDetails(systemPrompt, userMessage) {
    // Get settings
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['selectedModel', 'geminiApiKey', 'openaiApiKey'], resolve);
    });

    const model = settings.selectedModel || 'gemini';

    if (model === 'gemini') {
      const apiKey = settings.geminiApiKey;
      if (!apiKey) {
        throw new Error('กรุณาตั้งค่า Gemini API Key ก่อน');
      }
      return await this.callGeminiForStory(apiKey, systemPrompt, userMessage);
    } else {
      const apiKey = settings.openaiApiKey;
      if (!apiKey) {
        throw new Error('กรุณาตั้งค่า OpenAI API Key ก่อน');
      }
      return await this.callOpenAIForStory(apiKey, systemPrompt, userMessage);
    }
  }

  /**
   * Call Gemini API for story generation
   */
  async callGeminiForStory(apiKey, systemPrompt, userMessage) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userMessage}` }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Call OpenAI API for story generation
   */
  async callOpenAIForStory(apiKey, systemPrompt, userMessage) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Generate prompts for each scene in story details
   */
  async generateStoryPrompts(type) {
    const detailsTextarea = document.getElementById('storyDetails');
    const characterSelect = document.getElementById('storyCharacterSelect');
    const characterNameInput = document.getElementById('storyCharacterName');
    const genderRadio = document.querySelector('input[name="storyGender"]:checked');
    const outputSection = document.getElementById('storyPromptOutputSection');
    const loopSelect = document.getElementById('storyLoopCountSelect');
    const customInput = document.getElementById('storyCustomLoopCount');

    // Get story details
    let storyDetails = detailsTextarea?.value?.trim();
    if (!storyDetails) {
      alert('กรุณาใส่รายละเอียดเรื่องก่อน หรือกดปุ่ม "สร้างรายละเอียด"');
      detailsTextarea?.focus();
      return;
    }

    // Get requested count from dropdown
    const requestedCount = loopSelect?.value === 'custom'
      ? parseInt(customInput?.value) || 1
      : parseInt(loopSelect?.value) || 1;

    // Check if character is selected
    const hasCharacter = characterSelect?.value && characterNameInput?.value?.trim();

    // Get character info (only if character is selected)
    const characterName = hasCharacter ? characterNameInput.value.trim() : '';
    const gender = hasCharacter ? (genderRadio?.value || 'female') : '';
    const genderText = hasCharacter ? (gender === 'male' ? 'ผู้ชาย' : 'ผู้หญิง') : '';
    const genderTextEn = hasCharacter ? (gender === 'male' ? 'Thai man' : 'Thai woman') : '';

    // Get button for loading state
    const btn = type === 'image'
      ? document.getElementById('storyGenerateImagePromptBtn')
      : document.getElementById('storyGenerateVideoPromptBtn');

    // ===== ตรวจจับเนื้อเพลงดิบ (Raw Lyrics Detection) =====
    // ถ้าเป็นเนื้อเพลงดิบ → ส่งให้ AI วิเคราะห์ และสร้างฉากก่อน
    if (this.isRawSongLyrics(storyDetails)) {
      console.log('Raw lyrics detected! Generating scene descriptions from AI...');

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          วิเคราะห์เนื้อเพลง...
        `;
      }

      try {
        // ให้ AI วิเคราะห์เนื้อเพลงทั้งหมด และสร้างฉากตามจำนวนที่กำหนด
        // ส่ง characterName และ genderText ไปด้วยเพื่อให้ AI ใช้เพศที่ถูกต้อง
        const sceneDescriptions = await this.generateScenesFromLyrics(
          storyDetails,
          requestedCount,
          characterName,
          genderText
        );

        // อัพเดทกล่อง textarea ด้วยฉากที่สร้างใหม่
        if (detailsTextarea && sceneDescriptions) {
          detailsTextarea.value = sceneDescriptions;
          storyDetails = sceneDescriptions; // อัพเดทตัวแปรด้วย
          console.log('Scene descriptions generated and updated in textarea');
        }
      } catch (error) {
        console.error('Error generating scenes from lyrics:', error);
        alert('เกิดข้อผิดพลาดในการวิเคราะห์เนื้อเพลง: ' + error.message);
        if (btn) {
          btn.disabled = false;
          const icon = type === 'image'
            ? '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>'
            : '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>';
          btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${icon}
            </svg>
            Prompt ${type === 'image' ? 'ภาพ' : 'วิดีโอ'}
          `;
        }
        return;
      }
    }

    // Parse scenes from story details (ตอนนี้ควรเป็น format "ฉากที่ X:" แล้ว)
    let scenes = this.parseStoryScenes(storyDetails);

    // If no scenes found OR only 1 scene fallback, use requested count
    // Create multiple scenes from the same content
    if (scenes.length <= 1 && requestedCount > 1) {
      console.log(`No scene markers found. Using requested count: ${requestedCount}`);
      const baseDescription = storyDetails;
      scenes = [];
      for (let i = 0; i < requestedCount; i++) {
        scenes.push({
          number: i + 1,
          name: `ฉากที่ ${i + 1}`,
          description: baseDescription
        });
      }
    }
    // If scenes found but user requested different count
    else if (scenes.length > 1 && requestedCount !== scenes.length) {
      console.log(`Found ${scenes.length} scenes, user requested ${requestedCount}`);

      if (requestedCount < scenes.length) {
        // User wants fewer - take first N scenes
        scenes = scenes.slice(0, requestedCount);
        console.log(`Trimmed to ${scenes.length} scenes`);
      } else {
        // User wants more - cycle through scenes
        const originalScenes = [...scenes];
        scenes = [];
        for (let i = 0; i < requestedCount; i++) {
          const sourceScene = originalScenes[i % originalScenes.length];
          scenes.push({
            number: i + 1,
            name: sourceScene.name + (i >= originalScenes.length ? ` (รอบ ${Math.floor(i / originalScenes.length) + 1})` : ''),
            description: sourceScene.description
          });
        }
        console.log(`Cycled to ${scenes.length} scenes`);
      }
    }

    if (scenes.length === 0) {
      alert('ไม่พบฉากในรายละเอียดเรื่อง กรุณาสร้างรายละเอียดใหม่');
      return;
    }

    // Get selected template
    const templateSelect = type === 'image'
      ? document.getElementById('storyImageStyleSelect')
      : document.getElementById('storyVideoStyleSelect');
    const templateId = templateSelect?.value;

    // Get template from storage
    let template = null;
    if (typeof PromptStorage !== 'undefined') {
      try {
        await PromptStorage.init();
        template = await PromptStorage.get(templateId);
      } catch (e) {
        console.error('Error loading template:', e);
      }
    }

    // Fallback to AI Story templates
    if (!template && typeof PromptStorage !== 'undefined') {
      template = PromptStorage.AI_STORY_TEMPLATES?.[templateId];
    }

    if (!template) {
      alert('ไม่พบ Template ที่เลือก');
      return;
    }

    // Show loading state (btn was already declared above)
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        กำลังสร้าง...
      `;
    }

    try {
      // Initialize output section immediately
      if (outputSection) {
        outputSection.hidden = false;
        const typeLabel = type === 'image' ? 'ภาพ' : 'วิดีโอ';
        outputSection.innerHTML = `
          <h2 class="section-title">Prompt ${typeLabel} (0/${scenes.length} ฉาก)</h2>
          <div class="story-prompts-list" id="storyPromptsListLive"></div>
        `;
      }

      // Generate prompts for each scene - display each one immediately
      // Batch size: 10 prompts per batch with 3s delay between batches
      const BATCH_SIZE = 10;
      const BATCH_DELAY_MS = 3000;

      const prompts = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];

        // Batch delay: pause after every BATCH_SIZE prompts
        if (i > 0 && i % BATCH_SIZE === 0) {
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(scenes.length / BATCH_SIZE);
          if (btn) {
            btn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              พัก ${BATCH_DELAY_MS / 1000}s (batch ${batchNum}/${totalBatches})
            `;
          }
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }

        // Update button to show progress
        if (btn) {
          btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            ${i + 1}/${scenes.length}...
          `;
        }

        // Build user message with scene
        let userMessage = (template.userMessageTemplate || '')
          .replace(/\{\{characterName\}\}/g, characterName)
          .replace(/\{\{sceneDescription\}\}/g, scene.description);

        if (hasCharacter) {
          userMessage = userMessage
            .replace(/\{\{genderText\}\}/g, genderText + 'ไทย, ')
            .replace(/\{\{genderTextEn\}\}/g, genderTextEn);
        } else {
          userMessage = userMessage
            .replace(/\{\{genderText\}\}/g, '')
            .replace(/\{\{genderTextEn\}\}/g, '');
        }

        // Call AI
        const result = await this.callAIForStoryDetails(
          template.systemPrompt || '',
          userMessage
        );

        // Convert prompt to English and add 9:16 aspect ratio specification
        let finalPrompt = result.trim();

        // Add English translation request if the result is in Thai
        if (this.containsThai(finalPrompt)) {
          const englishPrompt = await this.translatePromptToEnglish(finalPrompt);
          // Format: Add 9:16 aspect ratio spec and English prompt
          finalPrompt = `Aspect Ratio: 9:16 (Vertical Portrait)\n\n${englishPrompt}`;
        } else {
          // Already in English, just add aspect ratio
          finalPrompt = `Aspect Ratio: 9:16 (Vertical Portrait)\n\n${finalPrompt}`;
        }

        const promptData = {
          sceneNumber: i + 1,
          sceneName: scene.name,
          prompt: finalPrompt
        };
        prompts.push(promptData);

        // Display this prompt immediately
        this.appendStoryPrompt(promptData, i);

        // Update title count
        const titleEl = outputSection?.querySelector('.section-title');
        if (titleEl) {
          const typeLabel = type === 'image' ? 'ภาพ' : 'วิดีโอ';
          titleEl.textContent = `Prompt ${typeLabel} (${i + 1}/${scenes.length} ฉาก)`;
        }
      }

      // Store prompts for copy all function
      this.generatedPrompts = prompts;

      // Add copy all button at the end
      const listEl = document.getElementById('storyPromptsListLive');
      if (listEl) {
        const actions = document.createElement('div');
        actions.className = 'story-prompts-actions';
        actions.innerHTML = `
            <button class="btn btn-secondary btn-copy-all-scenes-live">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              คัดลอกทั้งหมด
            </button>`;
        listEl.insertAdjacentElement('afterend', actions);

        const copyAllLiveBtn = actions.querySelector('.btn-copy-all-scenes-live');
        if (copyAllLiveBtn) {
          copyAllLiveBtn.addEventListener('click', () => this.copyAllScenePrompts());
        }
      }

    } catch (error) {
      console.error('Error generating prompts:', error);
      alert('เกิดข้อผิดพลาดในการสร้าง Prompt: ' + error.message);
    } finally {
      // Reset button state
      if (btn) {
        btn.disabled = false;
        const icon = type === 'image'
          ? '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>'
          : '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>';
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${icon}
          </svg>
          Prompt ${type === 'image' ? 'ภาพ' : 'วิดีโอ'}
        `;
      }
    }
  }

  /**
   * Load prompts from Extend Scene template for AI Story
   */
  async loadStoryTemplatePrompts(autoApply = false) {
    const select = document.getElementById('storyTemplateSelect');
    if (!select || !select.value) {
      if (!autoApply) showToast('เลือกเทมเพลตก่อน', 'warning');
      return null;
    }

    try {
      const url = chrome.runtime.getURL(`examples/extend-prompts/${select.value}`);
      const res = await fetch(url);
      const text = await res.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      if (lines.length === 0) {
        if (!autoApply) showToast('ไม่พบ prompt ในเทมเพลต', 'warning');
        return null;
      }

      const prompts = lines.map((p, idx) => ({ sceneNumber: idx + 1, prompt: p }));

      // Store template prompts for use in automation
      this.storyTemplatePrompts = prompts;

      if (!autoApply) {
        this.displayStoryPrompts(prompts, 'video');
        showToast(`โหลด ${prompts.length} prompt จากเทมเพลตแล้ว`, 'success');
      }

      return prompts;
    } catch (error) {
      console.error('Load story template error:', error);
      showToast('โหลดเทมเพลตไม่สำเร็จ', 'error');
    }
  }

  /**
   * Detect if text is raw song lyrics (not already parsed into scenes)
   * เนื้อเพลงดิบ = มี [Verse], [Chorus], etc. แต่ยังไม่ถูกแปลงเป็นฉาก
   */
  isRawSongLyrics(text) {
    // ตรวจสอบว่ามี section markers ของเพลงหรือไม่
    const lyricsPattern = /\[([^\]]+)\]/g;
    const lyricsMatches = [...text.matchAll(lyricsPattern)];

    if (lyricsMatches.length === 0) return false;

    // keywords ที่บ่งบอกว่าเป็นเนื้อเพลง
    const songSectionKeywords = ['verse', 'chorus', 'bridge', 'pre-chorus', 'outro', 'intro', 'hook', 'ท่อน'];
    const isSongLyrics = lyricsMatches.some(m =>
      songSectionKeywords.some(kw => m[1].toLowerCase().includes(kw))
    );

    // ตรวจสอบว่าไม่ใช่ "ฉากที่ X" format (ถ้าเป็น = แปลงแล้ว)
    const hasSceneMarkers = /ฉากที่\s*\d+|Scene\s*\d+/i.test(text);

    return isSongLyrics && !hasSceneMarkers;
  }

  /**
   * Generate scene descriptions from raw lyrics using AI
   * ให้ AI วิเคราะห์เนื้อเพลงทั้งหมด แล้วสร้างฉากตามจำนวนที่กำหนด
   * @param {string} lyrics - เนื้อเพลง
   * @param {number} sceneCount - จำนวนฉากที่ต้องการ
   * @param {string} characterName - ชื่อตัวละคร (optional)
   * @param {string} genderText - เพศตัวละคร เช่น "ผู้ชาย" หรือ "ผู้หญิง" (optional)
   */
  async generateScenesFromLyrics(lyrics, sceneCount, characterName = '', genderText = '') {
    // สร้างข้อความเกี่ยวกับตัวละคร (ถ้ามี)
    const characterInfo = characterName
      ? `\n6. ตัวละครหลัก: ${characterName} (${genderText}ไทย) - ใช้ตัวละครนี้ในทุกฉากที่มีคน`
      : '';

    const characterInstruction = characterName
      ? `\nหมายเหตุสำคัญ: ตัวละครหลักคือ "${characterName}" (${genderText}ไทย) - ต้องใช้ ${genderText} ในทุกฉากที่มีคน ห้ามใช้เพศอื่น`
      : '';

    const systemPrompt = `คุณเป็นผู้กำกับ MV เพลง เชี่ยวชาญการแปลงเนื้อเพลงเป็นฉากภาพ

หน้าที่: วิเคราะห์เนื้อเพลงทั้งหมด แล้วออกแบบฉากภาพ ${sceneCount} ฉาก ที่สื่อความหมายและอารมณ์ของเพลง

กฎสำคัญ:
1. วิเคราะห์ความหมาย อารมณ์ และเรื่องราวที่ซ่อนอยู่ในเนื้อเพลง
2. สร้างฉากแต่ละฉากให้มีความหลากหลาย - ไม่ซ้ำกัน
3. ฉากควรเรียงตามลำดับอารมณ์/เรื่องราวของเพลง
4. เขียนคำอธิบายฉากแต่ละฉากให้ละเอียด (สถานที่ แสง สี บรรยากาศ ท่าทาง)
5. แต่ละฉากต้องแตกต่างกัน - ห้ามสร้างฉากที่คล้ายกัน${characterInfo}

รูปแบบ output (ห้ามเปลี่ยน format นี้):
ฉากที่ 1: [ชื่อฉากสั้นๆ]
[คำอธิบายฉากละเอียด 2-3 ประโยค]

ฉากที่ 2: [ชื่อฉากสั้นๆ]
[คำอธิบายฉากละเอียด 2-3 ประโยค]

... (ต่อจนครบ ${sceneCount} ฉาก)`;

    const userMessage = `วิเคราะห์เนื้อเพลงนี้ แล้วสร้าง ${sceneCount} ฉากภาพสำหรับ MV:

${lyrics}

สร้างฉากภาพ ${sceneCount} ฉาก ที่แตกต่างกัน แต่ละฉากสื่ออารมณ์/ความหมายที่ต่างกันตามเนื้อเพลง
(เขียนตามรูปแบบ "ฉากที่ X: ..." ให้ครบ ${sceneCount} ฉาก)${characterInstruction}`;

    console.log(`Generating ${sceneCount} scenes from lyrics using AI...`);
    if (characterName) {
      console.log(`Character: ${characterName} (${genderText})`);
    }

    const result = await this.callAIForStoryDetails(systemPrompt, userMessage);
    return result;
  }

  /**
   * Parse scenes from story details text
   * รองรับหลาย formats:
   * 1. Standard: "ฉากที่ 1:" หรือ "Scene 1:"
   * 2. MV Style brackets: "**ฉาก: [Verse 1]**"
   * 3. MV Style dash: "**ฉาก: Verse 1 - คำอธิบาย**"
   * 4. MV Style colon: "**ฉาก: Verse 1: คำอธิบาย**"
   *
   * หมายเหตุ: ไม่รองรับ raw song lyrics โดยตรงแล้ว
   * ถ้าเป็น raw lyrics ต้องผ่าน generateScenesFromLyrics() ก่อน
   */
  parseStoryScenes(text) {
    const scenes = [];

    // Pattern 1: MV format with brackets - **ฉาก: [Verse 1]**
    const mvBracketPattern = /\*\*ฉาก:\s*\[([^\]]+)\]\*\*/g;
    const mvBracketMatches = [...text.matchAll(mvBracketPattern)];

    if (mvBracketMatches.length > 0) {
      console.log('MV bracket format detected, found', mvBracketMatches.length, 'scenes');
      return this.extractMVScenes(text, mvBracketMatches);
    }

    // Pattern 2: MV format with dash/colon - **ฉาก: Verse 1 - คำอธิบาย** or **ฉาก: Chorus**
    const mvDashPattern = /\*\*ฉาก:\s*([^*]+)\*\*/g;
    const mvDashMatches = [...text.matchAll(mvDashPattern)];

    if (mvDashMatches.length > 0) {
      console.log('MV dash/colon format detected, found', mvDashMatches.length, 'scenes');

      for (let i = 0; i < mvDashMatches.length; i++) {
        const match = mvDashMatches[i];
        let sceneHeader = match[1].trim();

        // Extract scene name (before dash or full text if no dash)
        let sceneName = sceneHeader;
        if (sceneHeader.includes(' - ')) {
          sceneName = sceneHeader.split(' - ')[0].trim();
        } else if (sceneHeader.includes(': ')) {
          sceneName = sceneHeader.split(': ')[0].trim();
        }

        const startIndex = match.index + match[0].length;
        const endIndex = (i + 1 < mvDashMatches.length) ? mvDashMatches[i + 1].index : text.length;

        // Get content between markers
        let content = text.substring(startIndex, endIndex).trim();
        content = content.replace(/^\n+/, '').replace(/\n+$/, '').trim();

        if (content) {
          scenes.push({
            number: i + 1,
            name: sceneName,
            description: content
          });
        }
      }

      if (scenes.length > 0) {
        console.log('Parsed MV scenes:', scenes.length, scenes);
        return scenes;
      }
    }

    // Pattern 3: Standard format - "ฉากที่ 1:" หรือ "Scene 1:"
    const parts = text.split(/(?=ฉากที่\s*\d+|Scene\s*\d+)/gi);

    for (const part of parts) {
      if (!part.trim()) continue;

      const headerMatch = part.match(/^(?:ฉากที่|Scene)\s*(\d+)\s*[:\-]?\s*([^\n]*)/i);

      if (headerMatch) {
        const sceneNumber = parseInt(headerMatch[1]);
        const sceneName = headerMatch[2]?.trim() || `ฉากที่ ${sceneNumber}`;
        const content = part.substring(headerMatch[0].length).trim();

        if (content) {
          scenes.push({
            number: sceneNumber,
            name: sceneName,
            description: content
          });
        }
      }
    }

    // Fallback: treat entire text as one scene
    if (scenes.length === 0 && text.trim()) {
      scenes.push({
        number: 1,
        name: 'ฉากที่ 1',
        description: text.trim()
      });
    }

    console.log('Parsed scenes:', scenes.length, scenes);
    return scenes;
  }

  /**
   * Extract scenes from MV bracket format
   */
  extractMVScenes(text, matches) {
    const scenes = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const sceneName = match[1].trim();
      const startIndex = match.index + match[0].length;
      const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : text.length;

      let content = text.substring(startIndex, endIndex).trim();
      content = content.replace(/^\n+/, '').replace(/\n+$/, '').trim();

      if (content) {
        scenes.push({
          number: i + 1,
          name: sceneName,
          description: content
        });
      }
    }

    console.log('Parsed MV bracket scenes:', scenes.length, scenes);
    return scenes;
  }

  /**
   * Append a single prompt to the live list (for progressive display)
   */
  appendStoryPrompt(promptData, index) {
    const listEl = document.getElementById('storyPromptsListLive');
    if (!listEl) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'story-prompt-item';
    wrapper.dataset.index = String(index);
    wrapper.innerHTML = `
      <div class="story-prompt-header">
        <span class="scene-label">Prompt ${promptData.sceneNumber}</span>
        <button class="btn-copy-scene" data-index="${index}" title="คัดลอก">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <textarea class="scene-prompt-text" readonly>${promptData.prompt}</textarea>
    `;

    const copyBtn = wrapper.querySelector('.btn-copy-scene');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyScenePrompt(index));
    }

    listEl.appendChild(wrapper);

    // Auto-scroll to newest prompt
    const newItem = listEl.lastElementChild;
    if (newItem) {
      newItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Display generated prompts with individual copy buttons
   */
  displayStoryPrompts(prompts, type) {
    const outputSection = document.getElementById('storyPromptOutputSection');
    if (!outputSection) return;

    // Build HTML for prompts
    const typeLabel = type === 'image' ? 'ภาพ' : 'วิดีโอ';
    let html = `<h2 class="section-title">Prompt ${typeLabel} (${prompts.length} ฉาก)</h2>`;
    html += '<div class="story-prompts-list">';

    prompts.forEach((p, index) => {
      html += `
        <div class="story-prompt-item" data-index="${index}">
          <div class="story-prompt-header">
            <span class="scene-label">Prompt ${p.sceneNumber}</span>
            <button class="btn-copy-scene" data-index="${index}" title="คัดลอก">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <textarea class="scene-prompt-text" readonly>${p.prompt}</textarea>
        </div>
      `;
    });

    html += '</div>';
    html += `
      <div class="story-prompts-actions">
        <button class="btn btn-secondary btn-copy-all-scenes">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          คัดลอกทั้งหมด
        </button>
      </div>
    `;

    outputSection.innerHTML = html;
    outputSection.hidden = false;

    // Store prompts for copy functions
    this.generatedPrompts = prompts;

    // Attach non-inline handlers to satisfy CSP
    const sceneButtons = outputSection.querySelectorAll('.btn-copy-scene');
    sceneButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        this.copyScenePrompt(idx);
      });
    });

    const copyAllBtn = outputSection.querySelector('.btn-copy-all-scenes');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => this.copyAllScenePrompts());
    }
  }

  /**
   * Copy a single scene prompt
   */
  copyScenePrompt(index) {
    if (!this.generatedPrompts || !this.generatedPrompts[index]) return;

    const prompt = this.generatedPrompts[index].prompt;
    navigator.clipboard.writeText(prompt).then(() => {
      showToast(`คัดลอก Prompt ฉากที่ ${index + 1} แล้ว`, 'success');
    }).catch(err => {
      console.error('Copy failed:', err);
      showToast('ไม่สามารถคัดลอกได้', 'error');
    });
  }

  /**
   * Copy all scene prompts
   */
  copyAllScenePrompts() {
    if (!this.generatedPrompts || this.generatedPrompts.length === 0) return;

    const allText = this.generatedPrompts.map((p, i) =>
      `=== Prompt ${p.sceneNumber} ===\n${p.prompt}`
    ).join('\n\n');

    navigator.clipboard.writeText(allText).then(() => {
      showToast(`คัดลอก ${this.generatedPrompts.length} Prompt แล้ว`, 'success');
    }).catch(err => {
      console.error('Copy failed:', err);
      showToast('ไม่สามารถคัดลอกได้', 'error');
    });
  }

  /**
   * Copy story prompt (legacy single prompt)
   */
  copyStoryPrompt() {
    const textarea = document.getElementById('storyPromptOutput');
    if (textarea && textarea.value) {
      navigator.clipboard.writeText(textarea.value).then(() => {
        showToast('คัดลอก Prompt แล้ว', 'success');
      });
    }
  }

  /**
   * Handle AI Story Automation with Scene Rotation or Repeat Mode
   * - Content mode: rotate through scenes
   * - Repeat mode: use same prompt for all iterations
   */
  async handleStoryAutomation() {
    if (this.isStoryAutomationRunning) return;

    // Get character selection (optional)
    const characterSelect = document.getElementById('storyCharacterSelect');
    const characterId = characterSelect?.value;

    // Validate story details (scenes)
    const detailsTextarea = document.getElementById('storyDetails');
    const storyDetails = detailsTextarea?.value?.trim();
    if (!storyDetails) {
      showToast('กรุณาสร้างรายละเอียดเรื่องก่อน', 'error');
      return;
    }

    // Parse scenes
    const scenes = this.parseStoryScenes(storyDetails);
    if (scenes.length === 0) {
      showToast('ไม่พบฉากในรายละเอียด กรุณาสร้างใหม่', 'error');
      return;
    }

    // Check if Controls module exists
    if (typeof Controls === 'undefined') {
      showToast('ไม่พบ Controls module', 'error');
      return;
    }

    // Get settings
    const settings = await Controls.getSettings();
    if (!settings.apiKey) {
      showToast('กรุณาตั้งค่า API Key ก่อน', 'error');
      Settings.openModal();
      return;
    }

    // Get character info (optional - can be null)
    let character = null;
    if (characterId) {
      character = await ProductWarehouse.getCharacterById(characterId);
    }

    // Get templates
    const imageTemplateId = document.getElementById('storyImageStyleSelect')?.value;
    const videoTemplateId = document.getElementById('storyVideoStyleSelect')?.value;

    let imageTemplate = null;
    let videoTemplate = null;

    if (typeof PromptStorage !== 'undefined') {
      await PromptStorage.init();
      imageTemplate = await PromptStorage.get(imageTemplateId) || PromptStorage.AI_STORY_TEMPLATES?.[imageTemplateId];
      videoTemplate = await PromptStorage.get(videoTemplateId) || PromptStorage.AI_STORY_TEMPLATES?.[videoTemplateId];
    }

    if (!imageTemplate || !videoTemplate) {
      showToast('กรุณาเลือก Template สำหรับ ภาพ และ วิดีโอ', 'error');
      return;
    }

    // Get loop count
    const loopSelect = document.getElementById('storyLoopCountSelect');
    const customLoop = document.getElementById('storyCustomLoopCount');
    let totalLoops = parseInt(loopSelect?.value === 'custom' ? customLoop?.value : loopSelect?.value) || 1;

    // Get story mode
    const modeRadio = document.querySelector('input[name="storyMode"]:checked');
    const storyMode = modeRadio?.value || 'content';
    const isRepeatMode = storyMode === 'repeat';

    // Check if we have pre-generated prompts (from "Prompt ภาพ" button)
    const hasPreGeneratedPrompts = this.generatedPrompts && this.generatedPrompts.length > 0;
    if (hasPreGeneratedPrompts) {
      console.log(`Using ${this.generatedPrompts.length} pre-generated prompts`);
    }

    // Load template prompts if available (for auto-populating video/story prompts)
    let templatePrompts = null;
    const select = document.getElementById('storyTemplateSelect');
    if (select && select.value) {
      const loaded = await this.loadStoryTemplatePrompts(true);
      if (loaded && loaded.length > 0) {
        templatePrompts = loaded;
        console.log(`Using ${templatePrompts.length} template prompts for video/story`);
      }
    }

    // Start automation
    this.isStoryAutomationRunning = true;
    this.storyCurrentScene = 0;
    this.storyScenes = scenes;
    this.storyCharacter = character;
    this.storyImageTemplate = imageTemplate;
    this.storyVideoTemplate = videoTemplate;

    document.getElementById('storyAutomationBtn').disabled = true;
    document.getElementById('storyStopAutomationBtn').disabled = false;

    await Controls.showWebOverlay();

    // Get gender from character or from form selection
    const genderRadio = document.querySelector('input[name="storyGender"]:checked');
    const gender = character?.gender || genderRadio?.value || 'female';
    const genderText = gender === 'male' ? 'ผู้ชาย' : 'ผู้หญิง';
    const genderTextEn = gender === 'male' ? 'Thai man' : 'Thai woman';

    // Check if we have character with image
    const hasCharacterImage = character?.image;

    try {
      for (let i = 0; i < totalLoops; i++) {
        if (!this.isStoryAutomationRunning) break;

        // Get current scene (repeat mode always uses first scene, content mode rotates)
        const sceneIndex = isRepeatMode ? 0 : (i % scenes.length);
        const scene = scenes[sceneIndex];

        const loopPrefix = isRepeatMode
          ? `[${i + 1}/${totalLoops}] `
          : `[${i + 1}/${totalLoops}] [ฉาก ${scene.number}] `;

        // Step 1: Upload character image (skip if no character)
        if (hasCharacterImage) {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 1/13: อัพภาพตัวละคร...');
          await this.uploadCharacterImageWithMediaAsset(character);
          if (!this.isStoryAutomationRunning) break;
          await this.delay(20000);
        } else {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 1/13: ข้ามอัพภาพ (ไม่มีตัวละคร)...');
          await this.delay(500);
        }

        // Step 3: Get Image Prompt (use pre-generated if available, otherwise generate new)
        if (!this.isStoryAutomationRunning) break;
        let imagePrompt;
        if (hasPreGeneratedPrompts && this.generatedPrompts[sceneIndex]) {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 2/12: ใช้ Prompt ภาพที่สร้างไว้...');
          imagePrompt = this.generatedPrompts[sceneIndex].prompt;
        } else {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 2/12: สร้าง Prompt ภาพ...');
          imagePrompt = await this.generateScenePrompt('image', scene, character, genderText, genderTextEn);
        }
        if (!this.isStoryAutomationRunning) break;
        await this.delay(1000);

        // Step 3: Fill Image Prompt
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 3/12: กรอก Prompt ภาพ...');
        await Controls.fillPromptOnPage(imagePrompt);
        if (!this.isStoryAutomationRunning) break;
        await this.delay(1000);

        // Step 4: Create Image
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 4/12: สร้างภาพ...');
        await Controls.handleCreate();
        if (!this.isStoryAutomationRunning) break;

        // Wait for image generation (configurable delay)
        const imageDelay = (Settings.getImageGenerationDelay() || 60) * 1000;
        this.updateStoryAutomationStatus(loopPrefix + `รอภาพ ${Settings.getImageGenerationDelay()} วินาที...`);
        await this.delay(imageDelay);

        // Step 5: Switch to Video Mode
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 5/12: สลับโหมดวิดีโอ...');
        await Controls.handleVideoMode();
        if (!this.isStoryAutomationRunning) break;
        await this.delay(2000);

        // Step 6: Select Image
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 6/12: เลือกภาพ...');
        await Controls.handleSelectImage();
        if (!this.isStoryAutomationRunning) break;
        await this.delay(2000);

        // Step 7: Generate Video Prompt (always generate new prompt each iteration)
        if (!this.isStoryAutomationRunning) break;
        let videoPrompt;
        if (templatePrompts && templatePrompts.length > 0) {
          // Use template prompts cyclically
          const promptIndex = i % templatePrompts.length;
          videoPrompt = templatePrompts[promptIndex].prompt;
          this.updateStoryAutomationStatus(loopPrefix + `ขั้นตอน 7/12: ใช้ Prompt Template ${promptIndex + 1}/${templatePrompts.length}...`);
        } else {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 7/12: สร้าง Prompt วิดีโอ...');
          videoPrompt = await this.generateScenePrompt('video', scene, character, genderText, genderTextEn);
        }
        if (!this.isStoryAutomationRunning) break;
        await this.delay(1000);

        // Step 8: Fill Video Prompt
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 8/12: กรอก Prompt วิดีโอ...');
        await Controls.fillPromptOnPage(videoPrompt);
        if (!this.isStoryAutomationRunning) break;
        await this.delay(1000);

        // Step 9: Create Video
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 9/12: สร้างวิดีโอ...');
        await Controls.handleCreate();
        if (!this.isStoryAutomationRunning) break;

        // Wait for video to render (configurable delay)
        const videoDelay = (Settings.getVideoGenerationDelay() || 90) * 1000;
        this.updateStoryAutomationStatus(loopPrefix + `รอวิดีโอ ${Settings.getVideoGenerationDelay()} วินาที...`);
        await this.delay(videoDelay);

        // Additional download delay (configurable)
        const downloadDelay = (Settings.getDownloadDelay() || 0) * 1000;
        if (downloadDelay > 0) {
          this.updateStoryAutomationStatus(loopPrefix + `รอเพิ่มเติม ${Settings.getDownloadDelay()} วินาที...`);
          await this.delay(downloadDelay);
        }

        // Step 10: Download (skip if skipDownload is enabled)
        if (!this.isStoryAutomationRunning) break;
        if (Settings.isSkipDownload()) {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 10/12: ข้ามดาวน์โหลด...');
          await this.delay(1000);
        } else {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 10/12: ดาวน์โหลด...');
          await Controls.handleDownload();
          if (!this.isStoryAutomationRunning) break;
          await this.delay(5000);
        }

        // Step 11: Switch Image (refresh)
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 11/12: สลับภาพ...');
        await Controls.handleSwitchImageMode();
        if (!this.isStoryAutomationRunning) break;
        await this.delay(2000);

        // Step 12: Switch back to Image Mode
        if (!this.isStoryAutomationRunning) break;
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 12/12: สลับกลับโหมดภาพ...');
        await Controls.handleImageMode();
        if (!this.isStoryAutomationRunning) break;

        // Wait between iterations
        if (i < totalLoops - 1) {
          this.updateStoryAutomationStatus(loopPrefix + 'เสร็จสิ้นรอบนี้! รอ 5 วินาที...');
          await this.delay(5000);
        }
      }

      if (this.isStoryAutomationRunning) {
        this.hideStoryAutomationStatus();
        const modeText = isRepeatMode ? 'ทำซ้ำ' : 'เนื้อหา';
        showToast(`AI Story เสร็จสิ้น! (${totalLoops} รอบ, โหมด ${modeText})`, 'success');
      }

    } catch (error) {
      console.error('Story automation error:', error);
      showToast(`AI Story error: ${error.message}`, 'error');
    } finally {
      this.isStoryAutomationRunning = false;
      this.storyCurrentScene = 0;
      document.getElementById('storyAutomationBtn').disabled = false;
      document.getElementById('storyStopAutomationBtn').disabled = true;
      this.hideStoryAutomationStatus();
      Controls.hideWebOverlay();
    }
  }

  /**
   * Generate prompt for a specific scene
   */
  async generateScenePrompt(type, scene, character, genderText, genderTextEn) {
    const template = type === 'image' ? this.storyImageTemplate : this.storyVideoTemplate;

    // Check if we have a character
    const hasCharacter = character && character.name;
    const characterName = hasCharacter ? character.name : '';

    // Build user message
    let userMessage = (template.userMessageTemplate || '')
      .replace(/\{\{characterName\}\}/g, characterName)
      .replace(/\{\{sceneDescription\}\}/g, scene.description);

    // Only add gender info if character is selected
    if (hasCharacter && genderText) {
      userMessage = userMessage
        .replace(/\{\{genderText\}\}/g, genderText + 'ไทย, ')
        .replace(/\{\{genderTextEn\}\}/g, genderTextEn);
    } else {
      // Remove gender placeholders if no character
      userMessage = userMessage
        .replace(/\{\{genderText\}\}/g, '')
        .replace(/\{\{genderTextEn\}\}/g, '');
    }

    const result = await this.callAIForStoryDetails(
      template.systemPrompt || '',
      userMessage
    );

    return result.trim();
  }

  /**
   * Upload character image to the web page
   */
  async uploadCharacterImage(character) {
    if (!character.image) {
      throw new Error('ตัวละครไม่มีรูปภาพ');
    }

    // Use Controls.uploadImageToWeb for consistent behavior
    await Controls.uploadImageToWeb(character.image);
  }

  /**
   * Upload Character Image with Media Asset Button Click
   * Sequence:
   * 1. Click Add button
   * 2. Wait for dialog
   * 3. Click Media Asset Button
   * 4. Wait 2 seconds
   * 5. Upload file
   * 6. Click Confirm
   */
  async uploadCharacterImageWithMediaAsset(character) {
    if (!character.image) {
      throw new Error('ตัวละครไม่มีรูปภาพ');
    }

    await Controls.uploadImageToWebWithMediaAsset(character.image);
  }

  /**
   * Click Media Asset Button - Select previously uploaded/selected media
   */
  async clickMediaAssetButton() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('ไม่พบแท็บที่ใช้งาน');
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Try to find and click the media asset button
          // Target: <button class="sc-fbea20b2-9 cdgKGS">
          const mediaAssetBtn = document.querySelector('button.sc-fbea20b2-9.cdgKGS');

          if (mediaAssetBtn) {
            console.log('[Story] Clicking media asset button');
            mediaAssetBtn.click();
            return true;
          }

          // Fallback: look for button with aria-label containing "media" or "asset"
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const ariaLabel = btn.getAttribute('aria-label') || '';
            if (ariaLabel.toLowerCase().includes('media') || ariaLabel.toLowerCase().includes('asset')) {
              console.log('[Story] Found media asset button by aria-label, clicking...');
              btn.click();
              return true;
            }
          }

          // Fallback: look by span text content
          for (const btn of buttons) {
            const span = btn.querySelector('span');
            if (span && span.textContent.toLowerCase().includes('previously uploaded')) {
              console.log('[Story] Found media asset button by text, clicking...');
              btn.click();
              return true;
            }
          }

          console.warn('[Story] Media asset button not found');
          return false;
        }
      });
    } catch (error) {
      console.error('[Story] Error clicking media asset button:', error);
      throw error;
    }
  }

  /**
   * Stop Story Automation
   */
  stopStoryAutomation() {
    this.isStoryAutomationRunning = false;
    this.hideStoryAutomationStatus();
    document.getElementById('storyAutomationBtn').disabled = false;
    document.getElementById('storyStopAutomationBtn').disabled = true;
    Controls.hideWebOverlay();
    showToast('หยุด AI Story Automation แล้ว', 'info');
  }

  /**
   * Update story automation status display
   */
  updateStoryAutomationStatus(text) {
    const statusDiv = document.getElementById('storyAutomationStatus');
    const statusText = document.getElementById('storyAutomationStatusText');
    if (statusDiv) statusDiv.hidden = false;
    if (statusText) statusText.textContent = text;
  }

  /**
   * Hide story automation status
   */
  hideStoryAutomationStatus() {
    const statusDiv = document.getElementById('storyAutomationStatus');
    if (statusDiv) statusDiv.hidden = true;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup tab switching
   */
  setupTabs() {
    console.log('[FlowAI] Starting setupTabs...');

    try {
      const tabBtns = document.querySelectorAll('.tab-btn');

      if (tabBtns.length === 0) {
        console.warn('[FlowAI] No tab buttons found');
        return;
      }

      tabBtns.forEach((btn, index) => {
        btn.onclick = () => {
          const tabName = btn.dataset.tab;
          console.log(`[FlowAI] Tab button ${index} clicked: ${tabName}`);
          this.switchTab(tabName);
        };
      });

      console.log(`[FlowAI] ✓ Tabs setup complete (${tabBtns.length} buttons)`);
    } catch (error) {
      console.error('[FlowAI] Fatal error in setupTabs:', error);
      console.error('[FlowAI] Stack:', error.stack);
    }
  }

  /**
   * Switch to a tab
   */
  switchTab(tabName) {
    this.currentTab = tabName;
    console.log(`[FlowAI] Switching to tab: ${tabName}`);

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        console.log(`[FlowAI] Tab button active: ${btn.textContent.trim()}`);
      }
    });

    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      const isActive = content.id === `tab-${tabName}`;
      content.classList.toggle('active', isActive);
      if (isActive) {
        console.log(`[FlowAI] Tab content active: ${content.id}`);
      }
    });

    // Load warehouse stats when switching to warehouse tab
    if (tabName === 'warehouse') {
      this.loadWarehouseStats();
      this.loadRecentProducts();
    }
  }

  /**
   * Setup header buttons
   */
  /**
   * Setup header buttons
   */
  setupHeaderButtons() {
    console.log('[FlowAI] Starting setupHeaderButtons...');

    try {
      // Refresh button
      const refreshBtn = document.getElementById('refreshDataBtn');
      if (refreshBtn) {
        refreshBtn.onclick = async () => {
          console.log('[FlowAI] Refresh clicked');
          refreshBtn.classList.add('spinning');
          try {
            await this.refreshData();
            showToast('รีเฟรชข้อมูลเรียบร้อย', 'success');
          } catch (err) {
            console.error('[FlowAI] Refresh error:', err);
            showToast('ไม่สามารถรีเฟรชได้: ' + err.message, 'error');
          } finally {
            refreshBtn.classList.remove('spinning');
          }
        };
        console.log('[FlowAI] ✓ Refresh button setup');
      } else {
        console.warn('[FlowAI] ✗ refreshDataBtn not found');
      }

      // Logout button
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          console.log('[FlowAI] Logout clicked');
          if (confirm('ต้องการออกจากระบบหรือไม่?')) {
            this.handleLogout();
          }
        };
        console.log('[FlowAI] ✓ Logout button setup');
      } else {
        console.warn('[FlowAI] ✗ logoutBtn not found');
      }

      // Open warehouse button
      const openWarehouseBtn = document.getElementById('openWarehouseBtn');
      if (openWarehouseBtn) {
        openWarehouseBtn.onclick = () => {
          console.log('[FlowAI] Open Warehouse (sidebar) clicked');
          chrome.tabs.create({ url: chrome.runtime.getURL('html/warehouse.html') });
        };
        console.log('[FlowAI] ✓ Open Warehouse (sidebar) button setup');
      }

      // Open warehouse header button (shortcut)
      const openWarehouseHeaderBtn = document.getElementById('openWarehouseHeaderBtn');
      if (openWarehouseHeaderBtn) {
        openWarehouseHeaderBtn.onclick = () => {
          console.log('[FlowAI] Open Warehouse (header) clicked');
          chrome.tabs.create({ url: chrome.runtime.getURL('html/warehouse.html') });
        };
        console.log('[FlowAI] ✓ Open Warehouse (header) button setup');
      } else {
        console.warn('[FlowAI] ✗ openWarehouseHeaderBtn not found');
      }

      // Sync from TikTok button
      const syncTiktokBtn = document.getElementById('syncTiktokBtn');
      if (syncTiktokBtn) {
        syncTiktokBtn.onclick = () => {
          console.log('[FlowAI] Sync from TikTok clicked');
          this.syncFromTiktok();
        };
        console.log('[FlowAI] ✓ Sync TikTok button setup');
      }

      // Open Prompt Warehouse button
      const openPromptWarehouseBtn = document.getElementById('openPromptWarehouseBtn');
      if (openPromptWarehouseBtn) {
        openPromptWarehouseBtn.onclick = () => {
          console.log('[FlowAI] Open Prompt Warehouse clicked');
          chrome.tabs.create({ url: chrome.runtime.getURL('html/prompt-warehouse.html') });
        };
        console.log('[FlowAI] ✓ Open Prompt Warehouse button setup');
      } else {
        console.warn('[FlowAI] ✗ openPromptWarehouseBtn not found');
      }

      // Testing Panel button
      const openTestingPanelBtn = document.getElementById('openTestingPanelBtn');
      if (openTestingPanelBtn) {
        openTestingPanelBtn.onclick = () => {
          console.log('[FlowAI] Testing Panel clicked');
          if (window.testingPanel) {
            window.testingPanel.toggle();
          } else {
            console.warn('[FlowAI] Testing panel not initialized');
          }
        };
        console.log('[FlowAI] ✓ Testing Panel button setup');
      } else {
        console.warn('[FlowAI] ✗ openTestingPanelBtn not found');
      }

      // Variable Guide button
      const variableGuideBtn = document.getElementById('variableGuideBtn');
      if (variableGuideBtn) {
        variableGuideBtn.onclick = () => {
          console.log('[FlowAI] Variable Guide clicked');
          const modal = document.getElementById('variableGuideModal');
          if (modal) {
            modal.style.display = 'flex';
          }
        };
        console.log('[FlowAI] ✓ Variable Guide button setup');
      }

      // Variable Guide Modal close buttons
      const closeVariableGuideModal = document.getElementById('closeVariableGuideModal');
      if (closeVariableGuideModal) {
        closeVariableGuideModal.onclick = () => {
          const modal = document.getElementById('variableGuideModal');
          if (modal) modal.style.display = 'none';
        };
        console.log('[FlowAI] ✓ Close Variable Guide (X) button setup');
      }

      const closeVariableGuideBtn = document.getElementById('closeVariableGuideBtn');
      if (closeVariableGuideBtn) {
        closeVariableGuideBtn.onclick = () => {
          const modal = document.getElementById('variableGuideModal');
          if (modal) modal.style.display = 'none';
        };
        console.log('[FlowAI] ✓ Close Variable Guide button setup');
      }

      // Close modal on overlay click
      const variableGuideModal = document.getElementById('variableGuideModal');
      if (variableGuideModal) {
        variableGuideModal.onclick = (e) => {
          if (e.target === variableGuideModal) {
            variableGuideModal.style.display = 'none';
          }
        };
        console.log('[FlowAI] ✓ Variable Guide modal overlay click setup');
      }

      console.log('[FlowAI] ✓✓✓ All header buttons setup complete ✓✓✓');
    } catch (error) {
      console.error('[FlowAI] Fatal error in setupHeaderButtons:', error);
      console.error('[FlowAI] Stack:', error.stack);
    }
  }

  /**
   * Sync products from TikTok Shop
   */
  async syncFromTiktok() {
    const syncBtn = document.getElementById('syncTiktokBtn');

    try {
      // Disable button and show loading
      syncBtn.disabled = true;
      syncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        กำลังดึงข้อมูล...
      `;

      showToast('กำลังดึงข้อมูลจาก Showcase (ทุกหน้า)...', 'info');

      // Find TikTok tab
      const tabs = await chrome.tabs.query({ url: '*://*.tiktok.com/*' });

      if (tabs.length === 0) {
        showToast('ไม่พบหน้า TikTok Shop กรุณาเปิดหน้า TikTok Shop ก่อน', 'error');
        this.resetSyncButton();
        return;
      }

      const tiktokTab = tabs[0];

      // Send message to content script
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tiktokTab.id, { action: 'getProductsForWarehouse' }, (resp) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || 'Unknown error';
            console.error('sendMessage error:', errMsg);
            // Most common cause: content script not loaded
            resolve({ success: false, error: 'กรุณา refresh หน้า TikTok แล้วลองใหม่' });
          } else {
            resolve(resp);
          }
        });
      });

      console.log('Sync response:', response);

      if (!response || !response.success) {
        showToast(response?.error || 'ไม่สามารถดึงข้อมูลได้ ลอง refresh หน้า TikTok', 'error');
        this.resetSyncButton();
        return;
      }

      const products = response.products || [];

      if (products.length === 0) {
        showToast('ไม่พบสินค้าในตาราง กรุณาเปิดหน้าเลือกสินค้า', 'error');
        this.resetSyncButton();
        return;
      }

      // Get existing products to check for duplicates
      const existingProducts = await ProductWarehouse.getAll();
      const existingProductIds = new Set(existingProducts.map(p => p.productId).filter(id => id));

      // Filter out duplicates
      const newProducts = products.filter(p => !existingProductIds.has(p.productId));

      if (newProducts.length === 0) {
        showToast(`สินค้าทั้งหมด ${products.length} รายการมีในคลังแล้ว`, 'info');
        this.resetSyncButton();
        return;
      }

      // Convert image URLs to base64
      showToast(`กำลังดาวน์โหลดภาพ ${newProducts.length} รายการ...`, 'info');
      const productsWithBase64 = await this.convertImagesToBase64(newProducts);

      // Save new products
      await ProductWarehouse.saveMultiple(productsWithBase64);

      // Reload stats
      await this.loadWarehouseStats();
      await this.loadRecentProducts();

      showToast(`เพิ่ม ${newProducts.length} สินค้าใหม่ (ข้าม ${products.length - newProducts.length} รายการที่ซ้ำ)`, 'success');

    } catch (error) {
      console.error('TikTok sync error:', error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
      this.resetSyncButton();
    }
  }

  /**
   * Convert image URLs to base64
   * @param {Array} products - Array of products with image URLs
   * @returns {Array} - Products with base64 images
   */
  async convertImagesToBase64(products) {
    const results = [];

    for (const product of products) {
      try {
        if (product.productImage && product.productImage.startsWith('http')) {
          // Fetch image and convert to base64
          const response = await fetch(product.productImage);
          const blob = await response.blob();
          const base64 = await this.blobToBase64(blob);
          results.push({ ...product, productImage: base64 });
        } else {
          // Already base64 or empty
          results.push(product);
        }
      } catch (error) {
        console.error('Error converting image:', error);
        // Keep the product but without image
        results.push({ ...product, productImage: '' });
      }
    }

    return results;
  }

  /**
   * Convert blob to base64
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Reset sync button to default state
   */
  resetSyncButton() {
    const syncBtn = document.getElementById('syncTiktokBtn');
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 21h5v-5"/>
        </svg>
        ดึงข้อมูลจาก Showcase
      `;
    }
  }

  /**
   * Refresh data from storage (products, characters)
   */
  async refreshData() {
    // Reload warehouse dropdowns in AI Generator
    if (typeof ImageUpload !== 'undefined') {
      await ImageUpload.loadWarehouseProducts();
      await ImageUpload.loadWarehouseCharacters();
    }

    // Reload AI Story characters and prompt styles
    await this.loadStoryCharacters();
    await this.loadStoryPromptStyles();

    // Reload warehouse videos in TikTok tab
    if (typeof TikTokUploader !== 'undefined') {
      await TikTokUploader.refreshWarehouseData();
    }

    // Reload prompt templates from warehouse
    if (typeof PromptTemplateSelector !== 'undefined') {
      await PromptTemplateSelector.reload();
    }
    if (typeof VideoPromptTemplateSelector !== 'undefined') {
      await VideoPromptTemplateSelector.reload();
    }

    // Reload warehouse stats
    await this.loadWarehouseStats();
    await this.loadRecentProducts();
  }

  /**
   * Setup settings modal
   */
  setupSettingsModal() {
    console.log('[FlowAI] Starting setupSettingsModal...');

    try {
      const settingsBtn = document.getElementById('settingsBtn');
      const settingsModal = document.getElementById('settingsModal');
      const closeBtn = document.getElementById('closeSettingsBtn');
      const saveBtn = document.getElementById('saveSettingsBtn');

      if (!settingsBtn || !settingsModal || !closeBtn || !saveBtn) {
        console.warn('[FlowAI] Some settings modal elements not found:');
        console.warn('  settingsBtn:', !!settingsBtn);
        console.warn('  settingsModal:', !!settingsModal);
        console.warn('  closeBtn:', !!closeBtn);
        console.warn('  saveBtn:', !!saveBtn);
        return;
      }

      // Close modal function
      const closeModal = () => {
        console.log('[FlowAI] Closing settings modal');
        settingsModal.style.display = 'none';
      };

      // Open modal
      settingsBtn.onclick = () => {
        console.log('[FlowAI] Settings button clicked');
        this.loadSettingsToModal();
        settingsModal.style.display = 'flex';
      };

      // Close button
      closeBtn.onclick = closeModal;

      // Close on overlay click
      settingsModal.onclick = (e) => {
        if (e.target === settingsModal) closeModal();
      };

      // Save settings
      saveBtn.onclick = () => {
        console.log('[FlowAI] Save settings clicked');
        this.saveSettings();
        closeModal();
      };

      // Model toggle buttons
      const toggleGemini = document.getElementById('toggleGemini');
      const toggleOpenai = document.getElementById('toggleOpenai');

      if (toggleGemini && toggleOpenai) {
        toggleGemini.onclick = () => {
          console.log('[FlowAI] Toggle Gemini');
          toggleGemini.classList.add('active');
          toggleOpenai.classList.remove('active');
        };

        toggleOpenai.onclick = () => {
          console.log('[FlowAI] Toggle OpenAI');
          toggleOpenai.classList.add('active');
          toggleGemini.classList.remove('active');
        };

        console.log('[FlowAI] ✓ Model toggle buttons setup');
      } else {
        console.warn('[FlowAI] Model toggle buttons not found');
      }

      console.log('[FlowAI] ✓ Settings modal setup complete');
    } catch (error) {
      console.error('[FlowAI] Fatal error in setupSettingsModal:', error);
      console.error('[FlowAI] Stack:', error.stack);
    }
  }

  /**
   * Load settings to modal
   */
  async loadSettingsToModal() {
    const result = await chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'selectedModel']);

    document.getElementById('geminiApiKey').value = result.geminiApiKey || '';
    document.getElementById('openaiApiKey').value = result.openaiApiKey || '';

    const model = result.selectedModel || 'gemini';
    document.getElementById('toggleGemini').classList.toggle('active', model === 'gemini');
    document.getElementById('toggleOpenai').classList.toggle('active', model === 'openai');
  }

  /**
   * Save settings
   */
  async saveSettings() {
    const geminiKey = document.getElementById('geminiApiKey').value.trim();
    const openaiKey = document.getElementById('openaiApiKey').value.trim();
    const model = document.getElementById('toggleGemini').classList.contains('active') ? 'gemini' : 'openai';

    await chrome.storage.local.set({
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      selectedModel: model
    });

    showToast('บันทึกการตั้งค่าเรียบร้อย', 'success');
  }

  /**
   * Load warehouse stats
   */
  async loadWarehouseStats() {
    if (typeof ProductWarehouse === 'undefined') return;

    const stats = await ProductWarehouse.getStats();
    const categories = await ProductWarehouse.getCategories();
    const videos = await ProductWarehouse.getVideos();
    const characters = await ProductWarehouse.getCharacters();

    // Basic stats
    document.getElementById('totalProductsCount').textContent = stats.total;
    document.getElementById('totalCategoriesCount').textContent = categories.length;
    document.getElementById('totalCharactersCount').textContent = characters.length;

    // Video stats
    let pendingCount = 0;
    let uploadedCount = 0;

    videos.forEach(v => {
      if (v.status === 'pending') {
        pendingCount++;
      } else if (v.status === 'uploaded') {
        uploadedCount++;
      }
    });

    document.getElementById('sidebarTotalVideos').textContent = videos.length;
    document.getElementById('sidebarPendingVideos').textContent = pendingCount;
    document.getElementById('sidebarUploadedVideos').textContent = uploadedCount;
  }

  /**
   * Load recent products
   */
  async loadRecentProducts() {
    if (typeof ProductWarehouse === 'undefined') return;

    const products = await ProductWarehouse.getAll();
    const grid = document.getElementById('recentProductsGrid');

    if (products.length === 0) {
      grid.innerHTML = '<p class="empty-message">ยังไม่มีสินค้าในคลัง</p>';
      return;
    }

    // Sort by createdAt desc and take first 6
    const recent = products
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6);

    grid.innerHTML = recent.map(p => `
      <div class="product-grid-item" data-id="${p.id}">
        <img src="${p.productImage}" alt="${p.name}">
        <div class="product-name-overlay">${p.name}</div>
      </div>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.product-grid-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        await ProductWarehouse.selectProduct(id);
        showToast('เลือกสินค้าแล้ว', 'success');
        this.switchTab('ai-generator');
      });
    });
  }

  /**
   * Detect if text contains Thai characters
   */
  containsThai(text) {
    // Thai Unicode range: \u0E00-\u0E7F
    const thaiPattern = /[\u0E00-\u0E7F]/;
    return thaiPattern.test(text);
  }

  /**
   * Translate prompt from Thai to English using AI
   */
  async translatePromptToEnglish(thaiPrompt) {
    try {
      // Get settings for API
      const settings = await new Promise(resolve => {
        chrome.storage.local.get(['selectedModel', 'geminiApiKey', 'openaiApiKey'], resolve);
      });

      const model = settings.selectedModel || 'gemini';
      const apiKey = model === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey;

      if (!apiKey) {
        console.warn('[TranslatePrompt] No API key available, returning original Thai prompt');
        return thaiPrompt;
      }

      const translateSystemPrompt = `You are a professional image generation prompt translator. 
Translate the given Thai image generation prompt to English while:
1. Preserving all visual details and descriptive elements
2. Maintaining the exact style, mood, and composition requirements
3. Keeping technical parameters (aspect ratio, lighting, camera angles, etc.)
4. Making it compatible with image generation AI (DALL-E, Midjourney, Stable Diffusion, etc.)

Return ONLY the English prompt, no explanations or preamble.`;

      const userMsg = `Translate this Thai image prompt to English for use in image generation AI:\n\n${thaiPrompt}`;

      if (model === 'gemini') {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: { text: translateSystemPrompt } },
            contents: { parts: { text: userMsg } }
          })
        });

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || thaiPrompt;
      } else {
        // OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: translateSystemPrompt },
              { role: 'user', content: userMsg }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        });

        if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || thaiPrompt;
      }
    } catch (error) {
      console.error('[TranslatePrompt] Error:', error);
      // Return original if translation fails
      return thaiPrompt;
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[FlowAI] DOM Content Loaded - Initializing app...');

  window.flowAIUnlocked = new FlowAIUnlocked();

  // Initialize Testing Panel
  if (window.TestingPanel) {
    console.log('[FlowAI] Initializing Testing Panel...');
    window.testingPanel = new TestingPanel();
    window.testingPanel.init().then(() => {
      console.log('[FlowAI] ✓ Testing Panel initialized successfully');
    }).catch(error => {
      console.error('[FlowAI] ✗ Failed to initialize Testing Panel:', error);
    });
  } else {
    console.warn('[FlowAI] TestingPanel class not found');
  }
});

