/**
 * Prompt Template Selector Module
 * UI for selecting and managing prompt templates (Dropdown version)
 * Now loads from IndexedDB (PromptStorage) with fallback to built-in templates
 */

const PromptTemplateSelector = {
  STORAGE_KEY: 'flowPromptTemplates',
  selectedTemplateId: 'ugc-review',
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
    this.updateSystemPrompt();
  },

  /**
   * Reload templates from warehouse (call after editing in prompt warehouse)
   */
  async reload() {
    await this.loadFromWarehouse();
    this.render();
    this.updateSystemPrompt();
  },

  /**
   * Load templates and selection from Chrome Storage
   */
  async loadFromStorage() {
    try {
      const result = await Storage.get(this.STORAGE_KEY);
      const data = result[this.STORAGE_KEY];
      if (data) {
        this.selectedTemplateId = data.selectedTemplateId || 'ugc-review';
        this.customTemplates = data.custom || {};
      }
    } catch (error) {
      console.error('Error loading templates:', error);
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
        this.warehouseTemplates = await PromptStorage.getByTypeExcludeAIStory('image');
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
      console.error('Error saving templates:', error);
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
      ...BUILT_IN_TEMPLATES,
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
    if (BUILT_IN_TEMPLATES[templateId]) return BUILT_IN_TEMPLATES[templateId];

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
    let template = this.getTemplateById(this.selectedTemplateId) || BUILT_IN_TEMPLATES['ugc-review'];

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
    this.updateSystemPrompt();
  },

  /**
   * Update SystemPrompt module with selected template
   */
  updateSystemPrompt() {
    const template = this.getSelected();
    if (typeof SystemPrompt !== 'undefined' && SystemPrompt.setTemplate) {
      SystemPrompt.setTemplate(template);
    }
  },

  /**
   * Render dropdown options - simplified version
   * Priority: warehouse templates > built-in templates
   */
  render() {
    const select = document.getElementById('imageStyleSelect');
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
        'ugc-review', 'ugc-random',
        'ugc-using', 'ugc-feeling', 'ugc-compare', 'ugc-closeup', 'ugc-recommend',
        'professional-ad', 'product-only', 'lifestyle', 'social-viral'
      ];

      templateOrder.forEach(id => {
        const template = BUILT_IN_TEMPLATES[id];
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
    const select = document.getElementById('imageStyleSelect');
    if (select) {
      select.addEventListener('change', async (e) => {
        await this.select(e.target.value);
        this.updateEditButtonVisibility();
      });
    }

    // Manage button (open modal)
    const manageBtn = document.getElementById('manageTemplatesBtn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.openCustomTemplateModal());
    }

    // Edit button (edit current custom template)
    const editBtn = document.getElementById('editImageTemplateBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const template = this.customTemplates[this.selectedTemplateId];
        if (template) {
          this.openCustomTemplateModal(template);
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
    const editBtn = document.getElementById('editImageTemplateBtn');
    if (!editBtn) return;

    // Show edit button only if a custom template is selected
    const isCustom = this.selectedTemplateId.startsWith('custom-');
    editBtn.style.display = isCustom ? 'flex' : 'none';
  },

  /**
   * Bind modal events
   */
  bindModalEvents() {
    const modal = document.getElementById('templateManagerModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('#closeTemplateModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    const cancelBtn = modal.querySelector('#cancelTemplateBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeModal());
    }

    const saveBtn = modal.querySelector('#saveTemplateBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveCustomTemplate());
    }

    const loadDefaultBtn = document.getElementById('loadDefaultTemplateBtn');
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
   * Open custom template modal
   */
  openCustomTemplateModal(editTemplate = null) {
    const modal = document.getElementById('templateManagerModal');
    if (!modal) return;

    const form = modal.querySelector('.template-form');
    if (form) form.reset();

    const nameInput = document.getElementById('customTemplateName');
    const descInput = document.getElementById('customTemplateDesc');
    const promptInput = document.getElementById('customTemplatePrompt');
    const title = modal.querySelector('.modal-header h3');

    if (editTemplate) {
      if (title) title.textContent = 'แก้ไข Template ภาพ';
      nameInput.value = editTemplate.name;
      descInput.value = editTemplate.description;
      promptInput.value = editTemplate.systemPrompt;
      modal.dataset.editId = editTemplate.id;
    } else {
      if (title) title.textContent = 'สร้าง Template ภาพ';
      nameInput.value = '';
      descInput.value = '';
      promptInput.value = '';
      delete modal.dataset.editId;
    }

    modal.style.display = 'flex';
  },

  /**
   * Close modal
   */
  closeModal() {
    const modal = document.getElementById('templateManagerModal');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  /**
   * Save custom template
   */
  async saveCustomTemplate() {
    const modal = document.getElementById('templateManagerModal');
    const nameInput = document.getElementById('customTemplateName');
    const descInput = document.getElementById('customTemplateDesc');
    const promptInput = document.getElementById('customTemplatePrompt');

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const systemPrompt = promptInput.value.trim();

    if (!name || !systemPrompt) {
      alert('กรุณากรอกชื่อและ System Prompt');
      return;
    }

    const editId = modal.dataset.editId;
    const id = editId || 'custom-' + Date.now();

    const template = {
      id,
      name,
      description: description || 'Custom template',
      icon: 'package',
      isBuiltIn: false,
      isDefault: false,
      systemPrompt,
      userMessageTemplate: `สินค้า: {{productName}}
{{personDescription}}
สร้าง prompt สำหรับภาพสินค้านี้`,
      settings: {
        ethnicityRequired: null,
        defaultGender: 'female',
        allowPersonImage: true,
        temperature: 0.7
      }
    };

    this.customTemplates[id] = template;
    await this.saveToStorage();
    this.render();
    this.closeModal();

    // Select the new template
    await this.select(id);
  },

  /**
   * Load default template into form as example
   */
  loadDefaultTemplate() {
    const defaultTemplate = BUILT_IN_TEMPLATES['ugc-review'];
    if (!defaultTemplate) return;

    const nameInput = document.getElementById('customTemplateName');
    const descInput = document.getElementById('customTemplateDesc');
    const promptInput = document.getElementById('customTemplatePrompt');

    nameInput.value = defaultTemplate.name + ' (Copy)';
    descInput.value = defaultTemplate.description;
    promptInput.value = defaultTemplate.systemPrompt;

    showToast('โหลดตัวอย่างเรียบร้อย', 'success');
  },

  /**
   * Delete custom template
   */
  async deleteCustomTemplate(templateId) {
    if (!confirm('ต้องการลบ Template นี้หรือไม่?')) {
      return;
    }

    delete this.customTemplates[templateId];

    if (this.selectedTemplateId === templateId) {
      this.selectedTemplateId = 'ugc-review';
    }

    await this.saveToStorage();
    this.render();
    this.updateSystemPrompt();
  }
};
