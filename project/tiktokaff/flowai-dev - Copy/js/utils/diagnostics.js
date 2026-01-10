/**
 * Diagnostic script to help debug button click issues
 * Add this to console in the extension popup
 */

console.log('=== FlowAI Debug Diagnostics ===');

// Check if window.flowAIUnlocked exists
console.log('1. FlowAI Instance:', window.flowAIUnlocked ? 'FOUND' : 'MISSING');
if (window.flowAIUnlocked) {
    console.log('   Current Tab:', window.flowAIUnlocked.currentTab);
}

// Check License
console.log('2. License Module:', typeof License !== 'undefined' ? 'FOUND' : 'MISSING');
if (typeof License !== 'undefined') {
    console.log('   License Key:', License.licenseKey);
    console.log('   Machine ID:', License.machineId);
}

// Check all required button elements
const buttons = [
    'refreshDataBtn',
    'logoutBtn',
    'settingsBtn',
    'openWarehouseHeaderBtn',
    'openPromptWarehouseBtn',
    'openTestingPanelBtn',
    'variableGuideBtn'
];

console.log('3. Button Elements:');
buttons.forEach(id => {
    const btn = document.getElementById(id);
    console.log(`   #${id}:`, btn ? 'FOUND' : 'MISSING');
    if (btn) {
        console.log(`     Visible: ${btn.offsetParent !== null}`);
        console.log(`     Listeners: ${btn._hasListeners ? 'YES' : 'UNKNOWN'}`);
    }
});

// Check container
const appContainer = document.getElementById('appContainer');
const overlay = document.getElementById('licenseOverlay');
console.log('4. Containers:');
console.log(`   appContainer: ${appContainer ? 'FOUND' : 'MISSING'}`);
if (appContainer) {
    console.log(`     Display: ${getComputedStyle(appContainer).display}`);
    console.log(`     Hidden: ${appContainer.hidden}`);
}
console.log(`   licenseOverlay: ${overlay ? 'FOUND' : 'MISSING'}`);
if (overlay) {
    console.log(`     Display: ${getComputedStyle(overlay).display}`);
}

// Check TestingPanel
console.log('5. Testing Panel:', window.testingPanel ? 'FOUND' : 'MISSING');
console.log('   TestingPanel class:', typeof TestingPanel !== 'undefined' ? 'FOUND' : 'MISSING');

// Test button click
console.log('6. Button Click Test:');
const testBtn = document.getElementById('settingsBtn');
if (testBtn) {
    console.log('   Attempting to click settingsBtn...');
    testBtn.click();
    console.log('   Click event dispatched');
}

// Check for JS errors
console.log('7. Error Check: Look above for any errors');

console.log('=== End Diagnostics ===');

// Helper: Manual click test with full detail
function testClick(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) {
        console.error(`Button #${buttonId} not found`);
        return;
    }

    console.log(`Testing click on #${buttonId}:`);

    // Add temporary listener to see if event fires
    const testListener = () => {
        console.log(`  ✓ Click event received`);
    };

    btn.addEventListener('click', testListener);
    btn.click();

    // Remove test listener
    setTimeout(() => {
        btn.removeEventListener('click', testListener);
    }, 100);
}

// Usage: testClick('settingsBtn')
