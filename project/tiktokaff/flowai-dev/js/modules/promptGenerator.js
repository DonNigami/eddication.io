/**
 * Prompt Generator Module
 * Generates prompts based on form data
 */
const PromptGenerator = {
  outputSection: null,
  outputTextarea: null,

  /**
   * Initialize prompt generator
   */
  init() {
    this.outputSection = document.getElementById('promptOutputSection');
    this.outputTextarea = document.getElementById('promptOutput');

    this.setupCopyButton();
  },

  /**
   * Setup copy button
   */
  setupCopyButton() {
    const copyBtn = document.getElementById('copyPromptBtn');
    copyBtn.addEventListener('click', async () => {
      const text = this.outputTextarea.value;
      if (text) {
        const success = await Helpers.copyToClipboard(text);
        if (success) {
          Helpers.showToast('Prompt copied to clipboard', 'success');
        } else {
          Helpers.showToast('Failed to copy prompt', 'error');
        }
      }
    });
  },

  /**
   * Get form data
   * @returns {object}
   */
  getFormData() {
    return {
      productName: document.getElementById('productName').value.trim(),
      mainHeading: document.getElementById('mainHeading').value.trim(),
      subHeading: document.getElementById('subHeading').value.trim(),
      price: document.getElementById('price').value.trim(),
      hasProductImage: ImageUpload.getProductImage() !== null,
      hasPersonImage: ImageUpload.hasPersonImage(),
      ugcSettings: UGCSection.getSettings()
    };
  },

  /**
   * Generate prompt based on form data
   * @returns {string}
   */
  generate() {
    const data = this.getFormData();
    let prompt = '';

    prompt += `Create a professional product advertisement image.\n\n`;

    if (data.productName) {
      prompt += `Product: ${data.productName}\n`;
    }

    if (data.mainHeading) {
      prompt += `Main Heading: ${data.mainHeading}\n`;
    }

    if (data.subHeading) {
      prompt += `Sub Heading: ${data.subHeading}\n`;
    }

    if (data.price) {
      prompt += `Price: ${data.price}\n`;
    }

    prompt += `\n`;

    if (data.hasProductImage) {
      prompt += `[Product image provided - use as reference]\n`;
    }

    if (data.hasPersonImage) {
      prompt += `[Person/Model image provided - use as reference]\n`;
    } else if (UGCSection.isActive()) {
      const { gender, ageRange } = data.ugcSettings;
      if (gender || ageRange) {
        prompt += `UGC Character: `;
        if (gender) prompt += `${gender}`;
        if (gender && ageRange) prompt += `, `;
        if (ageRange) prompt += `age ${ageRange}`;
        prompt += `\n`;
      }
    }

    prompt += `\nStyle: Clean, modern, professional product advertisement with white background, high quality lighting, and clear product focus.`;

    return prompt;
  },

  /**
   * Show generated prompt
   */
  showPrompt() {
    const prompt = this.generate();
    this.outputTextarea.value = prompt;
    this.outputSection.hidden = false;
    this.outputSection.scrollIntoView({ behavior: 'smooth' });
    Helpers.showToast('Prompt generated', 'success');
  },

  /**
   * Get current prompt
   * @returns {string}
   */
  getPrompt() {
    return this.outputTextarea.value;
  },

  /**
   * Set prompt from AI response
   * @param {string} prompt - Generated prompt
   */
  setPrompt(prompt) {
    this.outputTextarea.value = prompt;
    this.outputSection.hidden = false;
    this.outputSection.style.display = 'block';
    this.outputSection.scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * Clear prompt output
   */
  clear() {
    this.outputTextarea.value = '';
    this.outputSection.hidden = true;
  }
};
