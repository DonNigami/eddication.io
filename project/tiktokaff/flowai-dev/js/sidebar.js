/**
 * Flow AI Unlocked - Main Sidebar Script
 * Handles tab switching, license, and initialization
 */

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
    // V12: Auto-update video templates to include "single prompt only" constraint
    await this.autoFixVideoTemplates();

    this.setupTabs();
    this.setupHeaderButtons();
    this.setupSettingsModal();
    this.loadWarehouseStats();

    // Initialize AI Generator modules (existing flow-unlocked-db modules)
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
    this.initStoryTab();

    console.log('Flow AI Unlocked initialized');
  }

  /**
   * Auto-fix video templates (V12) - add "single prompt only" constraint
   * This runs before modules init to ensure templates are up-to-date
   */
  async autoFixVideoTemplates() {
    try {
      // Use V12b to force re-run even if V12 was already set
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
      console.error('Error auto-fixing video templates:', error);
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

    // Setup prompt generation buttons
    const imagePromptBtn = document.getElementById('storyGenerateImagePromptBtn');
    if (imagePromptBtn) {
      imagePromptBtn.addEventListener('click', () => this.generateStoryPrompts('image'));
    }

    const videoPromptBtn = document.getElementById('storyGenerateVideoPromptBtn');
    if (videoPromptBtn) {
      videoPromptBtn.addEventListener('click', () => this.generateStoryPrompts('video'));
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
${characterName !== 'ตัวละครหลัก' ? `หมายเหตุ: อาจมี silhouette หรือท่าทางของคน (${genderText}) เป็นองค์ประกอบบางฉาก แต่ไม่ต้องเน้นหน้า` : 'หมายเหตุ: ไม่จำเป็นต้องมีคนในฉาก เน้นบรรยากาศ'}

สร้าง ${videoCount} ฉากภาพที่สื่อความรู้สึกตามเนื้อเพลง เน้นบรรยากาศ/สถานที่/แสงสี (ห้ามมีบทพูด)`;

      } else {
        // Regular story style - create story with scenes
        systemPrompt = `คุณเป็นนักเขียนบทคลิปสั้น เชี่ยวชาญการสร้างเนื้อหาสำหรับ TikTok/Reels

หน้าที่: สร้างรายละเอียดฉากสำหรับคลิปสั้น โดยแบ่งเป็นฉากตามจำนวนที่กำหนด

สไตล์: ${styleName}
${styleDescription}

กฎการเขียน:
1. เขียนเป็นภาษาไทย
2. แต่ละฉากมีความยาว 5-8 วินาที
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

        const promptData = {
          sceneNumber: i + 1,
          sceneName: scene.name,
          prompt: result.trim()
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
        const actionsHtml = `
          <div class="story-prompts-actions">
            <button class="btn btn-secondary" onclick="window.flowAIUnlocked.copyAllScenePrompts()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              คัดลอกทั้งหมด
            </button>
          </div>
        `;
        listEl.insertAdjacentHTML('afterend', actionsHtml);
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

    const html = `
      <div class="story-prompt-item" data-index="${index}">
        <div class="story-prompt-header">
          <span class="scene-label">Prompt ${promptData.sceneNumber}</span>
          <button class="btn-copy-scene" onclick="window.flowAIUnlocked.copyScenePrompt(${index})" title="คัดลอก">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        <textarea class="scene-prompt-text" readonly>${promptData.prompt}</textarea>
      </div>
    `;
    listEl.insertAdjacentHTML('beforeend', html);

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
            <button class="btn-copy-scene" onclick="window.flowAIUnlocked.copyScenePrompt(${index})" title="คัดลอก">
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
        <button class="btn btn-secondary" onclick="window.flowAIUnlocked.copyAllScenePrompts()">
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
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 1/12: อัพภาพตัวละคร...');
          await this.uploadCharacterImage(character);
          if (!this.isStoryAutomationRunning) break;
          await this.delay(20000);
        } else {
          this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 1/12: ข้ามอัพภาพ (ไม่มีตัวละคร)...');
          await this.delay(500);
        }

        // Step 2: Get Image Prompt (use pre-generated if available, otherwise generate new)
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
        this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 7/12: สร้าง Prompt วิดีโอ...');
        const videoPrompt = await this.generateScenePrompt('video', scene, character, genderText, genderTextEn);
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
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  /**
   * Switch to a tab
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
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
  setupHeaderButtons() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await this.refreshData();
        refreshBtn.classList.remove('spinning');
        showToast('รีเฟรชข้อมูลเรียบร้อย', 'success');
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('ต้องการออกจากระบบหรือไม่?')) {
          this.handleLogout();
        }
      });
    }

    // Open warehouse button
    const openWarehouseBtn = document.getElementById('openWarehouseBtn');
    if (openWarehouseBtn) {
      openWarehouseBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/warehouse.html') });
      });
    }

    // Open warehouse header button (shortcut)
    const openWarehouseHeaderBtn = document.getElementById('openWarehouseHeaderBtn');
    if (openWarehouseHeaderBtn) {
      openWarehouseHeaderBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/warehouse.html') });
      });
    }

    // Sync from TikTok button
    const syncTiktokBtn = document.getElementById('syncTiktokBtn');
    if (syncTiktokBtn) {
      syncTiktokBtn.addEventListener('click', () => this.syncFromTiktok());
    }

    // Open Prompt Warehouse button
    const openPromptWarehouseBtn = document.getElementById('openPromptWarehouseBtn');
    if (openPromptWarehouseBtn) {
      openPromptWarehouseBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/prompt-warehouse.html') });
      });
    }

    // Variable Guide button
    const variableGuideBtn = document.getElementById('variableGuideBtn');
    if (variableGuideBtn) {
      variableGuideBtn.addEventListener('click', () => {
        const modal = document.getElementById('variableGuideModal');
        if (modal) modal.style.display = 'flex';
      });
    }

    // Variable Guide Modal close buttons
    const closeVariableGuideModal = document.getElementById('closeVariableGuideModal');
    const closeVariableGuideBtn = document.getElementById('closeVariableGuideBtn');

    if (closeVariableGuideModal) {
      closeVariableGuideModal.addEventListener('click', () => {
        document.getElementById('variableGuideModal').style.display = 'none';
      });
    }

    if (closeVariableGuideBtn) {
      closeVariableGuideBtn.addEventListener('click', () => {
        document.getElementById('variableGuideModal').style.display = 'none';
      });
    }

    // Close modal on overlay click
    const variableGuideModal = document.getElementById('variableGuideModal');
    if (variableGuideModal) {
      variableGuideModal.addEventListener('click', (e) => {
        if (e.target === variableGuideModal) {
          variableGuideModal.style.display = 'none';
        }
      });
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
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettingsBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');

    // Open modal
    settingsBtn.addEventListener('click', () => {
      this.loadSettingsToModal();
      settingsModal.style.display = 'flex';
    });

    // Close modal
    const closeModal = () => {
      settingsModal.style.display = 'none';
    };

    closeBtn.addEventListener('click', closeModal);

    // Close on overlay click
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModal();
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
      this.saveSettings();
      closeModal();
    });

    // Model toggle buttons
    const toggleGemini = document.getElementById('toggleGemini');
    const toggleOpenai = document.getElementById('toggleOpenai');

    toggleGemini.addEventListener('click', () => {
      toggleGemini.classList.add('active');
      toggleOpenai.classList.remove('active');
    });

    toggleOpenai.addEventListener('click', () => {
      toggleOpenai.classList.add('active');
      toggleGemini.classList.remove('active');
    });
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.flowAIUnlocked = new FlowAIUnlocked();

  // Initialize Testing Panel
  if (window.TestingPanel) {
    window.testingPanel = new TestingPanel();
    window.testingPanel.init().then(() => {
      console.log('[FlowAI] Testing Panel initialized');

      // Add button event listener
      const testingPanelBtn = document.getElementById('openTestingPanelBtn');
      if (testingPanelBtn) {
        testingPanelBtn.addEventListener('click', () => {
          window.testingPanel.toggle();
        });
      }
    }).catch(error => {
      console.error('[FlowAI] Failed to initialize Testing Panel:', error);
    });
  }
});
