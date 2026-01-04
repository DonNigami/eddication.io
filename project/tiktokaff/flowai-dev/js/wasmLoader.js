/**
 * WASM Loader - โหลดและจัดการ WASM modules
 * ป้องกันการ reverse engineer ของ license และ selectors
 */

let wasmModule = null;
let licenseValidator = null;
let selectorManager = null;
let automationManager = null;
let wasmDisabled = false;

/**
 * โหลด WASM module
 */
async function loadWasmModule() {
  if (wasmModule) return wasmModule;
  if (wasmDisabled || (typeof window !== 'undefined' && window.__flowxWasmDisabled)) {
    wasmDisabled = true;
    return null;
  }

  try {
    // Import WASM module
    const wasm = await import(chrome.runtime.getURL('wasm/flow_core.js'));

    // ใช้ single object parameter format ใหม่ (ไม่ใช้ deprecated positional parameters)
    await wasm.default({
      module_or_path: chrome.runtime.getURL('wasm/flow_core_bg.wasm')
    });

    wasmModule = wasm;

    // Initialize managers
    licenseValidator = new wasm.LicenseValidator();
    selectorManager = new wasm.SelectorManager();
    automationManager = new wasm.AutomationManager();

    console.log('[WASM] Module loaded successfully');
    return wasmModule;
  } catch (error) {
    console.log('[WASM] CSP detected - using fallback mode (CSS selectors). Extension working normally.');
    wasmDisabled = true;
    try { window.__flowxWasmDisabled = true; } catch (_) { }
    return null;
  }
}

/**
 * ตรวจสอบ License
 */
async function validateLicenseWasm(licenseKey, machineId) {
  if (wasmDisabled) return null;
  await loadWasmModule();
  return licenseValidator.validate(licenseKey, machineId);
}

/**
 * สร้าง Machine Hash
 */
async function generateMachineHashWasm(input) {
  if (wasmDisabled) return null;
  await loadWasmModule();
  return licenseValidator.generate_machine_hash(input);
}

/**
 * Encrypt data
 */
async function encryptWasm(data) {
  if (wasmDisabled) return null;
  await loadWasmModule();
  return licenseValidator.encrypt(data);
}

/**
 * Decrypt data
 */
async function decryptWasm(data) {
  if (wasmDisabled) return null;
  await loadWasmModule();
  return licenseValidator.decrypt(data);
}

// ==================== Selector Functions ====================

/**
 * Get selector by name
 */
async function getSelectorWasm(name) {
  if (wasmDisabled) return null;
  await loadWasmModule();

  const selectorMap = {
    'addButton': () => selectorManager.get_add_button_selector(),
    'addButtonFull': () => selectorManager.get_add_button_selector_full(),
    'combobox': () => selectorManager.get_combobox_selector(),
    'videoModeText': () => selectorManager.get_video_mode_text(),
    'imageModeText': () => selectorManager.get_image_mode_text(),
    'selectImage': () => selectorManager.get_select_image_selector(),
    'selectImageFull': () => selectorManager.get_select_image_selector_full(),
    'dialog': () => selectorManager.get_dialog_selector(),
    'fileInput': () => selectorManager.get_file_input_selector(),
    'virtuosoGrid': () => selectorManager.get_virtuoso_grid_selector(),
    'gridFirstButton': () => selectorManager.get_grid_first_button_selector(),
    'createButton': () => selectorManager.get_create_button_selector(),
    'downloadIcon': () => selectorManager.get_download_icon_selector(),
    'downloadIconText': () => selectorManager.get_download_icon_text(),
    'switchImage': () => selectorManager.get_switch_image_selector(),
    'confirmButton': () => selectorManager.get_confirm_button_selector(),
    'menuItem': () => selectorManager.get_menu_item_selector(),
    'promptTextarea': () => selectorManager.get_prompt_textarea_selector(),
  };

  const getter = selectorMap[name];
  if (getter) {
    return getter();
  }

  console.warn(`[WASM] Unknown selector: ${name}`);
  return null;
}

/**
 * Get all selectors as object
 */
async function getAllSelectorsWasm() {
  if (wasmDisabled) return {};
  await loadWasmModule();

  return {
    addButton: selectorManager.get_add_button_selector(),
    addButtonFull: selectorManager.get_add_button_selector_full(),
    combobox: selectorManager.get_combobox_selector(),
    videoModeText: selectorManager.get_video_mode_text(),
    imageModeText: selectorManager.get_image_mode_text(),
    selectImage: selectorManager.get_select_image_selector(),
    selectImageFull: selectorManager.get_select_image_selector_full(),
    dialog: selectorManager.get_dialog_selector(),
    fileInput: selectorManager.get_file_input_selector(),
    virtuosoGrid: selectorManager.get_virtuoso_grid_selector(),
    gridFirstButton: selectorManager.get_grid_first_button_selector(),
    createButton: selectorManager.get_create_button_selector(),
    downloadIcon: selectorManager.get_download_icon_selector(),
    downloadIconText: selectorManager.get_download_icon_text(),
    switchImage: selectorManager.get_switch_image_selector(),
    confirmButton: selectorManager.get_confirm_button_selector(),
    menuItem: selectorManager.get_menu_item_selector(),
    promptTextarea: selectorManager.get_prompt_textarea_selector(),
  };
}

/**
 * Get confirm button texts
 */
async function getConfirmTextsWasm() {
  if (wasmDisabled) return [];
  await loadWasmModule();
  return selectorManager.get_confirm_texts();
}

// ==================== Automation Functions ====================

/**
 * Get automation step info
 */
async function getAutomationStepWasm(index) {
  if (wasmDisabled) return null;
  await loadWasmModule();
  if (!automationManager) return null;
  return automationManager.get_step(index);
}

/**
 * Get total automation steps
 */
async function getTotalStepsWasm() {
  if (wasmDisabled) return 0;
  await loadWasmModule();
  if (!automationManager) return 0;
  return automationManager.total_steps();
}

/**
 * Get step delay
 */
async function getStepDelayWasm(index) {
  if (wasmDisabled) return 0;
  await loadWasmModule();
  if (!automationManager) return 0;
  return automationManager.get_step_delay(index);
}

/**
 * Get step action type
 */
async function getStepActionWasm(index) {
  if (wasmDisabled) return null;
  await loadWasmModule();
  if (!automationManager) return null;
  return automationManager.get_step_action(index);
}

/**
 * Get step description
 */
async function getStepDescriptionWasm(index) {
  if (wasmDisabled) return '';
  await loadWasmModule();
  if (!automationManager) return '';
  return automationManager.get_step_description(index);
}

/**
 * Get status text
 */
async function getStatusTextWasm(loopNum, totalLoops) {
  if (wasmDisabled) return '';
  await loadWasmModule();
  if (!automationManager) return '';
  return automationManager.get_status_text(loopNum, totalLoops);
}

/**
 * Start automation
 */
async function startAutomationWasm() {
  if (wasmDisabled) return;
  await loadWasmModule();
  if (automationManager) automationManager.start();
}

/**
 * Stop automation
 */
async function stopAutomationWasm() {
  if (wasmDisabled) return;
  await loadWasmModule();
  if (automationManager) automationManager.stop();
}

/**
 * Check if automation is running
 */
async function isAutomationRunningWasm() {
  if (wasmDisabled) return false;
  await loadWasmModule();
  if (!automationManager) return false;
  return automationManager.is_running();
}

/**
 * Move to next step
 */
async function nextStepWasm() {
  if (wasmDisabled) return false;
  await loadWasmModule();
  if (!automationManager) return false;
  return automationManager.next_step();
}

/**
 * Get current step index
 */
async function getCurrentStepIndexWasm() {
  if (wasmDisabled) return 0;
  await loadWasmModule();
  if (!automationManager) return 0;
  return automationManager.current_step_index();
}

// Export functions
window.WasmLoader = {
  load: loadWasmModule,

  // License
  validateLicense: validateLicenseWasm,
  generateMachineHash: generateMachineHashWasm,
  encrypt: encryptWasm,
  decrypt: decryptWasm,

  // Selectors
  getSelector: getSelectorWasm,
  getAllSelectors: getAllSelectorsWasm,
  getConfirmTexts: getConfirmTextsWasm,

  // Automation
  getStep: getAutomationStepWasm,
  getTotalSteps: getTotalStepsWasm,
  getStepDelay: getStepDelayWasm,
  getStepAction: getStepActionWasm,
  getStepDescription: getStepDescriptionWasm,
  getStatusText: getStatusTextWasm,
  startAutomation: startAutomationWasm,
  stopAutomation: stopAutomationWasm,
  isRunning: isAutomationRunningWasm,
  nextStep: nextStepWasm,
  getCurrentStepIndex: getCurrentStepIndexWasm,
};
