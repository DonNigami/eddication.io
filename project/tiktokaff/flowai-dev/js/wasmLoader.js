/**
 * WASM Loader - โหลดและจัดการ WASM modules
 * ป้องกันการ reverse engineer ของ license และ selectors
 */

let wasmModule = null;
let licenseValidator = null;
let selectorManager = null;
let automationManager = null;

/**
 * โหลด WASM module
 */
async function loadWasmModule() {
  if (wasmModule) return wasmModule;

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
    console.error('[WASM] Failed to load module:', error);
    throw error;
  }
}

/**
 * ตรวจสอบ License
 */
async function validateLicenseWasm(licenseKey, machineId) {
  await loadWasmModule();
  return licenseValidator.validate(licenseKey, machineId);
}

/**
 * สร้าง Machine Hash
 */
async function generateMachineHashWasm(input) {
  await loadWasmModule();
  return licenseValidator.generate_machine_hash(input);
}

/**
 * Encrypt data
 */
async function encryptWasm(data) {
  await loadWasmModule();
  return licenseValidator.encrypt(data);
}

/**
 * Decrypt data
 */
async function decryptWasm(data) {
  await loadWasmModule();
  return licenseValidator.decrypt(data);
}

// ==================== Selector Functions ====================

/**
 * Get selector by name
 */
async function getSelectorWasm(name) {
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
  await loadWasmModule();
  return selectorManager.get_confirm_texts();
}

// ==================== Automation Functions ====================

/**
 * Get automation step info
 */
async function getAutomationStepWasm(index) {
  await loadWasmModule();
  return automationManager.get_step(index);
}

/**
 * Get total automation steps
 */
async function getTotalStepsWasm() {
  await loadWasmModule();
  return automationManager.total_steps();
}

/**
 * Get step delay
 */
async function getStepDelayWasm(index) {
  await loadWasmModule();
  return automationManager.get_step_delay(index);
}

/**
 * Get step action type
 */
async function getStepActionWasm(index) {
  await loadWasmModule();
  return automationManager.get_step_action(index);
}

/**
 * Get step description
 */
async function getStepDescriptionWasm(index) {
  await loadWasmModule();
  return automationManager.get_step_description(index);
}

/**
 * Get status text
 */
async function getStatusTextWasm(loopNum, totalLoops) {
  await loadWasmModule();
  return automationManager.get_status_text(loopNum, totalLoops);
}

/**
 * Start automation
 */
async function startAutomationWasm() {
  await loadWasmModule();
  automationManager.start();
}

/**
 * Stop automation
 */
async function stopAutomationWasm() {
  await loadWasmModule();
  automationManager.stop();
}

/**
 * Check if automation is running
 */
async function isAutomationRunningWasm() {
  await loadWasmModule();
  return automationManager.is_running();
}

/**
 * Move to next step
 */
async function nextStepWasm() {
  await loadWasmModule();
  return automationManager.next_step();
}

/**
 * Get current step index
 */
async function getCurrentStepIndexWasm() {
  await loadWasmModule();
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
