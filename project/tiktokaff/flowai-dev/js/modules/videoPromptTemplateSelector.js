/**
 * Video Prompt Template Selector Module
 * UI for selecting and managing video prompt templates (Dropdown version)
 * Now loads from IndexedDB (PromptStorage) with fallback to built-in templates
 */

const VideoPromptTemplateSelector = {
  STORAGE_KEY: 'flowVideoPromptTemplates',
  selectedTemplateId: 'video-ugc',
  customTemplates: {},
  warehouseTemplates: [], // Templates from IndexedDB

  /**
   * Initialize the template selector
   */
  async init() {
    await this.loadFromStorage();
    await this.loadFromWarehouse();
    this.render();
    this.bindEvents();
  },

  /**
   * Reload templates from warehouse (call after editing in prompt warehouse)
   */
  async reload() {
    await this.loadFromWarehouse();
    this.render();
  },

  /**
   * Load templates from Chrome Storage
   */
  async loadFromStorage() {
    try {
      const result = await Storage.get(this.STORAGE_KEY);
      const data = result[this.STORAGE_KEY];
      if (data) {
        // Migrate old video-default to video-ugc
        let savedId = data.selectedTemplateId || 'video-ugc';
        if (savedId === 'video-default') {
          savedId = 'video-ugc';
        }
        this.selectedTemplateId = savedId;
        this.customTemplates = data.custom || {};
      }
    } catch (error) {
      console.error('Error loading video templates:', error);
    }
  },

  /**
   * Load templates from IndexedDB (PromptStorage)
   * Excludes AI Story templates (they are for AI Story tab only)
   */
  async loadFromWarehouse() {
    try {
      if (typeof PromptStorage !== 'undefined') {
        await PromptStorage.init();
        this.warehouseTemplates = await PromptStorage.getByTypeExcludeAIStory('video');
      }
    } catch (error) {
      console.error('Error loading from warehouse:', error);
      this.warehouseTemplates = [];
    }
  },

  /**
   * Save to Chrome Storage
   */
  async saveToStorage() {
    try {
      await Storage.set({
        [this.STORAGE_KEY]: {
          selectedTemplateId: this.selectedTemplateId,
          custom: this.customTemplates
        }
      });
    } catch (error) {
      console.error('Error saving video templates:', error);
    }
  },

  /**
   * Get all templates (warehouse + built-in + custom)
   * Priority: warehouse > built-in > custom
   */
  getAllTemplates() {
    // Convert warehouse array to object by id
    const warehouseObj = {};
    this.warehouseTemplates.forEach(t => {
      warehouseObj[t.id] = t;
    });

    return {
      ...VIDEO_BUILT_IN_TEMPLATES,
      ...warehouseObj,
      ...this.customTemplates
    };
  },

  /**
   * Get template by ID from warehouse or built-in
   */
  getTemplateById(templateId) {
    // First check warehouse
    const warehouseTemplate = this.warehouseTemplates.find(t => t.id === templateId);
    if (warehouseTemplate) return warehouseTemplate;

    // Then check built-in
    if (VIDEO_BUILT_IN_TEMPLATES[templateId]) return VIDEO_BUILT_IN_TEMPLATES[templateId];

    // Finally check custom
    if (this.customTemplates[templateId]) return this.customTemplates[templateId];

    return null;
  },

  /**
   * Get currently selected template
   * If template has isRandom=true, randomly pick from randomFrom array
   */
  getSelected() {
    const all = this.getAllTemplates();
    let template = this.getTemplateById(this.selectedTemplateId) || VIDEO_BUILT_IN_TEMPLATES['video-ugc'];

    // Handle random template
    if (template.isRandom && template.randomFrom && template.randomFrom.length > 0) {
      const randomId = template.randomFrom[Math.floor(Math.random() * template.randomFrom.length)];
      const randomTemplate = this.getTemplateById(randomId) || all[randomId];
      if (randomTemplate) {
        return randomTemplate;
      }
    }

    return template;
  },

  /**
   * Select a template
   */
  async select(templateId) {
    this.selectedTemplateId = templateId;
    await this.saveToStorage();
  },

  /**
   * Build user message from template
   */
  buildUserMessage(productName, genderText, genderTextEn) {
    const template = this.getSelected();
    let message = template.userMessageTemplate;

    message = message.replace(/\{\{productName\}\}/g, productName || 'ไม่ระบุชื่อ');
    message = message.replace(/\{\{genderText\}\}/g, genderText);
    message = message.replace(/\{\{genderTextEn\}\}/g, genderTextEn);

    return message;
  },

  /**
   * Render dropdown options - simplified version
   * Priority: warehouse templates > built-in templates
   */
  render() {
    const select = document.getElementById('videoStyleSelect');
    if (!select) return;

    let html = '';
    const hasWarehouseTemplates = this.warehouseTemplates.length > 0;

    if (hasWarehouseTemplates) {
      // Show warehouse templates (simple list, no grouping)
      this.warehouseTemplates.forEach(template => {
        const selected = this.selectedTemplateId === template.id ? 'selected' : '';
        const icon = template.isRandom ? '🎲 ' : '';
        html += `<option value="${template.id}" ${selected}>${icon}${template.name}</option>`;
      });
    } else {
      // Fallback to built-in templates (simple list)
      const templateOrder = [
        'video-ugc', 'video-ugc-random',
        'video-ugc-using', 'video-ugc-feeling', 'video-ugc-compare', 'video-ugc-closeup', 'video-ugc-recommend',
        'video-professional', 'video-product-only', 'video-lifestyle', 'video-social-viral'
      ];

      templateOrder.forEach(id => {
        const template = VIDEO_BUILT_IN_TEMPLATES[id];
        if (template) {
          const selected = this.selectedTemplateId === template.id ? 'selected' : '';
          const icon = template.isRandom ? '🎲 ' : '';
          html += `<option value="${template.id}" ${selected}>${icon}${template.name}</option>`;
        }
      });
    }

    // Legacy custom templates (if any)
    const customList = Object.values(this.customTemplates);
    if (customList.length > 0) {
      html += '<optgroup label="Custom">';
      customList.forEach(template => {
        const selected = this.selectedTemplateId === template.id ? 'selected' : '';
        html += `<option value="${template.id}" ${selected}>${template.name}</option>`;
      });
      html += '</optgroup>';
    }

    select.innerHTML = html;
  },

  /**
   * Bind events
   */
  bindEvents() {
    // Dropdown change
    const select = document.getElementById('videoStyleSelect');
    if (select) {
      select.addEventListener('change', async (e) => {
        await this.select(e.target.value);
        this.updateEditButtonVisibility();
      });
    }

    // Manage button (open modal)
    const manageBtn = document.getElementById('manageVideoTemplatesBtn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.openModal());
    }

    // Edit button (edit current custom template)
    const editBtn = document.getElementById('editVideoTemplateBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const template = this.customTemplates[this.selectedTemplateId];
        if (template) {
          this.openModal(template);
        }
      });
    }

    // Initial visibility
    this.updateEditButtonVisibility();

    // Modal events
    this.bindModalEvents();
  },

  /**
   * Update edit button visibility based on selected template
   */
  updateEditButtonVisibility() {
    const editBtn = document.getElementById('editVideoTemplateBtn');
    if (!editBtn) return;

    // Show edit button only if a custom template is selected
    const isCustom = this.selectedTemplateId.startsWith('video-custom-');
    editBtn.style.display = isCustom ? 'flex' : 'none';
  },

  /**
   * Bind modal events
   */
  bindModalEvents() {
    const modal = document.getElementById('videoTemplateModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('#closeVideoTemplateModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    const cancelBtn = modal.querySelector('#cancelVideoTemplateBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeModal());
    }

    const saveBtn = modal.querySelector('#saveVideoTemplateBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveTemplate());
    }

    const loadDefaultBtn = document.getElementById('loadDefaultVideoTemplateBtn');
    if (loadDefaultBtn) {
      loadDefaultBtn.addEventListener('click', () => this.loadDefaultTemplate());
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
  },

  /**
   * Open modal
   */
  openModal(editTemplate = null) {
    const modal = document.getElementById('videoTemplateModal');
    if (!modal) return;

    const nameInput = document.getElementById('videoTemplateName');
    const promptInput = document.getElementById('videoTemplatePrompt');
    const title = modal.querySelector('.modal-header h3');

    if (editTemplate) {
      if (title) title.textContent = 'แก้ไข Video Template';
      nameInput.value = editTemplate.name;
      promptInput.value = editTemplate.systemPrompt;
      modal.dataset.editId = editTemplate.id;
    } else {
      if (title) title.textContent = 'สร้าง Video Template';
      nameInput.value = '';
      promptInput.value = '';
      delete modal.dataset.editId;
    }

    modal.style.display = 'flex';
  },

  /**
   * Close modal
   */
  closeModal() {
    const modal = document.getElementById('videoTemplateModal');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  /**
   * Save template
   */
  async saveTemplate() {
    const modal = document.getElementById('videoTemplateModal');
    const nameInput = document.getElementById('videoTemplateName');
    const promptInput = document.getElementById('videoTemplatePrompt');

    const name = nameInput.value.trim();
    const systemPrompt = promptInput.value.trim();

    if (!name || !systemPrompt) {
      alert('กรุณากรอกชื่อและ System Prompt');
      return;
    }

    const editId = modal.dataset.editId;
    const id = editId || 'video-custom-' + Date.now();

    const template = {
      id,
      name,
      description: 'Custom video template',
      isBuiltIn: false,
      isDefault: false,
      systemPrompt,
      userMessageTemplate: `สร้าง prompt สำหรับ image-to-video: "{{productName}}"

ต้องการ:
- คนรีวิวเป็น {{genderText}} ({{genderTextEn}})`
    };

    this.customTemplates[id] = template;
    await this.saveToStorage();
    this.render();
    this.closeModal();

    await this.select(id);
  },

  /**
   * Load default template into form as example
   */
  loadDefaultTemplate() {
    const defaultTemplate = VIDEO_BUILT_IN_TEMPLATES['video-ugc'];
    if (!defaultTemplate) return;

    const nameInput = document.getElementById('videoTemplateName');
    const promptInput = document.getElementById('videoTemplatePrompt');

    nameInput.value = defaultTemplate.name + ' (Copy)';
    promptInput.value = defaultTemplate.systemPrompt;

    showToast('โหลดตัวอย่างเรียบร้อย', 'success');
  },

  /**
   * Delete template
   */
  async deleteTemplate(templateId) {
    if (!confirm('ต้องการลบ Template นี้หรือไม่?')) {
      return;
    }

    delete this.customTemplates[templateId];

    if (this.selectedTemplateId === templateId) {
      this.selectedTemplateId = 'video-ugc';
    }

    await this.saveToStorage();
    this.render();
  }
};
