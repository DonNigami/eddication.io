/**
 * Form State Module
 * Handles saving and restoring form values
 */
const FormState = {
  formFields: ['productName', 'mainHeading', 'subHeading', 'price', 'gender', 'ageRange', 'videoLengthSelect', 'extendSceneToggle'],

  /**
   * Initialize form state
   */
  init() {
    this.loadFormState();
    this.setupAutoSave();
    this.setupResetButton();
  },

  /**
   * Load saved form state
   */
  loadFormState() {
    chrome.storage.local.get(['formState'], (result) => {
      if (result.formState) {
        this.formFields.forEach(field => {
          const element = document.getElementById(field);
          if (element && result.formState[field]) {
            element.value = result.formState[field];
          }
        });
      }
    });
  },

  /**
   * Save form state
   */
  saveFormState() {
    const formState = {};
    this.formFields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        formState[field] = element.value;
      }
    });
    chrome.storage.local.set({ formState });
  },

  /**
   * Setup auto-save on input change
   */
  setupAutoSave() {
    this.formFields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        element.addEventListener('input', () => this.saveFormState());
        element.addEventListener('change', () => this.saveFormState());
      }
    });
  },

  /**
   * Setup reset button
   */
  setupResetButton() {
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetForm());
    }
  },

  /**
   * Reset all form fields
   */
  resetForm() {
    // Reset text fields
    this.formFields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        element.value = '';
      }
    });

    // Reset images
    ImageUpload.removeImage('product',
      document.getElementById('productImagePreview'),
      document.querySelector('#productImageBox .remove-image-btn'),
      document.querySelector('#productImageBox .upload-placeholder'),
      document.getElementById('productImageInput')
    );
    ImageUpload.removeImage('person',
      document.getElementById('personImagePreview'),
      document.querySelector('#personImageBox .remove-image-btn'),
      document.querySelector('#personImageBox .upload-placeholder'),
      document.getElementById('personImageInput')
    );

    // Clear prompt output
    PromptGenerator.clear();

    // Clear saved state
    chrome.storage.local.remove(['formState', 'savedProductImage', 'savedPersonImage']);

    Helpers.showToast('รีเซ็ตแล้ว', 'success');
  }
};
