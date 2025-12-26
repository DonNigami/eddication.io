# Driver App Architecture & Refactoring Guide

## Overview
This document describes the professional modular architecture implemented for the LINE LIFF Driver App. The refactoring transforms the original monolithic codebase into a maintainable, production-grade system with clear separation of concerns, reusable components, and enterprise-level error handling.

---

## 📁 New Module Structure

### 1. **config.js** - Environment Configuration
```javascript
window.CONFIG = {
  LIFF_ID: '2007705394-y4mV76Gv',
  WEB_APP_URL: 'https://script.google.com/macros/...'
}
```
**Purpose:** Environment-specific constants for easy deployment across dev/staging/production.

**Key Features:**
- Fallback values for safety
- Single point of configuration management
- Easy to switch between environments

---

### 2. **logger.js** - Centralized Logging (60+ lines)
```javascript
window.Logger = {
  debug(label, data),
  info(label, data),
  warn(label, data),
  error(label, data),
  group(label),
  groupEnd()
}
```

**Purpose:** Structured logging with environment-aware filtering.

**Features:**
- 4 log levels: `DEBUG=0, INFO=1, WARN=2, ERROR=3`
- Production mode filters out DEBUG logs automatically
- Color-coded console output for readability
- Console grouping for related operations (dev only)
- Replaces ad-hoc `console.log()` calls throughout codebase

**Usage:**
```javascript
window.Logger.info('✅ Search completed', { stops: 5, drivers: 2 });
window.Logger.error('❌ API error', err);
window.Logger.warn('GPS timeout', { retryCount: 2 });
```

---

### 3. **constants.js** - Centralized Configuration (100+ lines)
```javascript
window.CONSTANTS = {
  API: { TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, ... },
  VALIDATION: { ODOMETER_MIN, ODOMETER_MAX, ALCOHOL_MIN, ALCOHOL_MAX, ... },
  MESSAGES: { SUCCESS_*, ERROR_*, VALIDATE_*, INFO_*, LABEL_*, BUTTON_*, ... },
  ACTIONS: { SEARCH, UPDATE_STOP, UPLOAD_ALCOHOL, ... },
  STOP_STATUS: { CHECKIN, CHECKOUT, FUELING, UNLOAD_DONE },
  STORAGE_KEYS: { LAST_SEARCH, USER_PREFS }
}
```

**Purpose:** Extract all magic strings, numbers, and error messages.

**Key Features:**
- All Thai messages centralized for i18n support
- Validation ranges in one place (easy to adjust)
- API configuration (timeouts, retry counts)
- Enables consistency across app
- Simplifies future translations

**Benefits:**
- ✅ No hardcoded strings scattered in code
- ✅ Easy to maintain and update messages
- ✅ Internationalization ready
- ✅ A/B testing friendly (can swap messages)

---

### 4. **validators.js** - Reusable Input Validators (180+ lines)
```javascript
window.Validators = {
  validateReference(ref),        // 3-50 chars
  validateOdometer(odo),         // 0-3,000,000
  validateAlcohol(alcohol),      // 0.00-2.00
  validateImage(file),           // mime type, ≤5MB
  validateCoordinates(lat, lng), // ±90, ±180
  validateResponseShape(response, requiredFields)
}
```

**Return Format:** `{valid: boolean, error?: string, value?: any}`

**Purpose:** Decoupled input validation logic.

**Features:**
- Reusable across all forms
- Consistent error messages (from CONSTANTS)
- Type coercion where appropriate (e.g., parseFloat)
- GPS coordinate validation
- API response shape validation (guards against incomplete backend responses)

**Usage:**
```javascript
const validation = window.Validators.validateOdometer(inputValue);
if (!validation.valid) {
  Swal.showValidationMessage(validation.error);
  return false;
}
const normalizedValue = validation.value; // Already coerced to number
```

---

### 5. **api.js** - Centralized HTTP Layer (350+ lines)
```javascript
window.API = {
  search(keyword, userId),
  updateStop({rowIndex, status, type, userId, lat, lng, odo}),
  uploadAlcohol({reference, driverName, userId, alcoholValue, lat, lng, imageBase64}),
  uploadReview({reference, rowIndex, userId, score, lat, lng, signatureBase64}),
  fillMissingSteps({reference, userId, lat, lng, missingData}),
  endTrip({reference, userId, endOdo, endPointName, lat, lng}),
  closeJob({reference, userId})
}
```

**Return Format:** `{success: boolean, data?: any, message?: string}`

**Purpose:** Unified HTTP communication layer with retry logic and error recovery.

### Core Features:

#### ✅ **Retry Logic with Exponential Backoff**
```javascript
fetchWithRetry(url, options, retryCount = 0)
// Timeout: 20 seconds
// Max retries: 2
// Backoff: 800ms × 2^retryCount (800ms → 1600ms)
// Retryable errors: Timeout, network errors, 5xx status
// Non-retryable: 4xx (client errors), JSON parse errors
```

#### ✅ **Request Abort Control**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
// Prevents requests from hanging indefinitely
```

#### ✅ **POST-First with GET Fallback**
```javascript
// Attempts POST first (modern)
// Falls back to GET if POST fails (backward compatibility)
```

#### ✅ **Comprehensive Logging**
- Logs request parameters (masked for sensitive data)
- Logs response success/failure
- Logs retry attempts and backoff delays
- Integrated with window.Logger

#### ✅ **Unified Error Handling**
- Consistent error messages from CONSTANTS
- Recovery hints for different error types
- User-friendly error display

**Usage:**
```javascript
try {
  const result = await window.API.search(keyword, userId);
  if (!result.success) {
    showError(result.message); // Already set by API layer
    return;
  }
  const data = result.data;
  // Use data...
} catch (err) {
  window.Logger.error('Fatal error', err);
}
```

---

## 🔄 Refactored Functions

### **search()** ✅
**Before:** Inline fetch with no timeout, no retry, hardcoded error messages
**After:** Uses `window.API.search()`, CONSTANTS.MESSAGES, Logger

### **doAlcoholCheck()** ✅
**Before:** Inline fetch, manual validation scattered in preConfirm, no logging
**After:** Uses `window.API.uploadAlcohol()`, `window.Validators.validateAlcohol()`, `window.Validators.validateImage()`

### **startReview()** ✅
**Before:** Inline fetch, hardcoded strings
**After:** Uses `window.API.uploadReview()`, CONSTANTS.MESSAGES, Logger

### **updateStopStatus()** ✅
**Before:** Mixed GET/POST fallback logic, no retry, hardcoded messages
**After:** Centralized in `window.API.updateStop()`, retry logic, double-submit guard preserved

### **saveEndTripSummary()** ✅
**Before:** Inline fetch with manual geolocation fallback UI
**After:** Uses `window.API.endTrip()`, keeps fallback UI but simplified error handling

### **saveMissingStepsData()** ✅
**Before:** Inline fetch for missing data collection
**After:** Uses `window.API.fillMissingSteps()`, consistent error handling

### **closeJob()** ✅
**Before:** Direct fetch with fetch API (not fetchJSON)
**After:** Uses `window.API.closeJob()`, consistent with other API calls

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTML UI Layer (test.html)                │
│  - Forms, buttons, modals (SweetAlert2)                         │
│  - Event handlers (search, doAlcoholCheck, startReview, etc.)   │
└────────────────────┬────────────────────────────────────────────┘
                     │ Uses
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                        API Functions                             │
│  • search() → API.search()                                       │
│  • doAlcoholCheck() → API.uploadAlcohol()                        │
│  • startReview() → API.uploadReview()                            │
│  • updateStopStatus() → API.updateStop()                         │
│  • saveEndTripSummary() → API.endTrip()                          │
│  • saveMissingStepsData() → API.fillMissingSteps()               │
│  • closeJob() → API.closeJob()                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │ Delegates to
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│         Dependency Injection Layer (window globals)              │
│  • window.Logger (logger.js) - Structured logging                │
│  • window.CONSTANTS (constants.js) - Config & messages           │
│  • window.Validators (validators.js) - Input validation          │
│  • window.API (api.js) - HTTP layer with retry logic             │
└────────────────────┬───────────────────────────────────────────┘
                     │ Delegates to
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│               Core HTTP Layer (api.js internals)                 │
│  • fetchWithRetry() - Exponential backoff (800ms → 1600ms)       │
│  • AbortController - 20s timeout per request                     │
│  • POST-first, GET-fallback pattern                              │
│  • Comprehensive error recovery                                  │
└────────────────────┬───────────────────────────────────────────┘
                     │ Communicates with
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│           Google Apps Script Backend (WEB_APP_URL)               │
│  Returns: {success, data, message}                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Benefits of Modular Architecture

### 1. **Maintainability**
- ✅ Clear separation of concerns (UI ↔ API ↔ HTTP)
- ✅ Centralized error handling (no scattered try-catch)
- ✅ Easy to find/update business logic
- ✅ No magic strings or numbers

### 2. **Testability**
- ✅ Validators can be unit-tested independently
- ✅ API methods can be mocked/tested with fake GAS backend
- ✅ Logger can be tested for correct event tracking
- ✅ No tight coupling to HTML elements

### 3. **Reusability**
- ✅ Validators used by all forms
- ✅ API methods shared across app
- ✅ Logger available globally
- ✅ CONSTANTS referenced everywhere

### 4. **Reliability**
- ✅ Automatic retry with exponential backoff
- ✅ 20-second timeout per request (prevents hanging)
- ✅ AbortController support (cancel on-the-fly)
- ✅ Graceful fallback patterns (POST→GET, GPS fallback)

### 5. **Scalability**
- ✅ Easy to add new API endpoints (just add method to API.js)
- ✅ Easy to add new validators (just add function to validators.js)
- ✅ Easy to add new constants (just add to CONSTANTS object)
- ✅ Ready for micro-frontend architecture

### 6. **Internationalization (i18n)**
- ✅ All messages in CONSTANTS.MESSAGES
- ✅ Easy to create `messages-th.js`, `messages-en.js`, etc.
- ✅ Runtime message switching without code changes

### 7. **Performance**
- ✅ Minimal overhead (modular pattern, no frameworks)
- ✅ Lazy-loaded modules via script tags
- ✅ Can add localStorage caching (already has hooks)
- ✅ Can add service worker for offline support

---

## 📋 Module Load Order

**Critical:** Modules must load in dependency order:

```html
<!-- Layer 1: Raw config -->
<script src="config.js"></script>

<!-- Layer 2: Utilities (no dependencies) -->
<script src="logger.js"></script>

<!-- Layer 3: Constants (uses Logger) -->
<script src="constants.js"></script>

<!-- Layer 4: Validators (uses Constants) -->
<script src="validators.js"></script>

<!-- Layer 5: API layer (uses Constants & Logger) -->
<script src="api.js"></script>

<!-- Layer 6: Main app (uses all modules) -->
<script src="test.html" inline></script>
```

---

## 🔍 Validation & Error Handling Examples

### Alcohol Check Validation
```javascript
// Old way (scattered validation)
if (!val) { Swal.showValidationMessage('...'); return false; }
const num = parseFloat(val);
if (!Number.isFinite(num)) { ... return false; }
if (num < 0 || num > 2.0) { ... return false; }

// New way (centralized)
const validation = window.Validators.validateAlcohol(val);
if (!validation.valid) {
  Swal.showValidationMessage(validation.error);
  return false;
}
// validation.value is already a clean number with proper decimals
```

### API Error Handling
```javascript
// Old way (multiple error message sources)
showError(json.message || 'บันทึกการตรวจแอลกอฮอล์ไม่สำเร็จ');

// New way (consistent messages)
const result = await window.API.uploadAlcohol(...);
showError(result.message); // Already localized & appropriate for context
```

### Logging
```javascript
// Old way (scattered console.log)
console.log('Search result:', d);
console.error('Error occurred', err);

// New way (structured, environment-aware)
window.Logger.info('✅ Search completed', { stops: d.stops.length });
window.Logger.error('❌ Search error', err);
// In production, ERROR still logs but DEBUG is filtered
```

---

## 🚀 Usage Guide

### Adding a New API Endpoint

**Step 1:** Add to CONSTANTS.ACTIONS
```javascript
ACTIONS: {
  ...existing,
  NEW_ACTION: 'newaction'
}
```

**Step 2:** Add to CONSTANTS.MESSAGES
```javascript
MESSAGES: {
  ...existing,
  ERROR_NEW_ACTION: 'ข้อผิดพลาดใน...',
  SUCCESS_NEW_ACTION: 'สำเร็จ'
}
```

**Step 3:** Add method to api.js
```javascript
API.newAction = async function({param1, param2}) {
  window.Logger.info('🔄 Calling newAction', {param1, param2});
  try {
    const result = await fetchWithRetry(CONSTANTS.API.WEB_APP_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: CONSTANTS.ACTIONS.NEW_ACTION,
        param1,
        param2
      })
    });
    // ... handle response
    window.Logger.info('✅ newAction success', result);
    return {success: true, data: result};
  } catch (err) {
    window.Logger.error('❌ newAction error', err);
    return {success: false, message: CONSTANTS.MESSAGES.ERROR_NEW_ACTION};
  }
}
```

**Step 4:** Use in UI
```javascript
async function onNewActionClick() {
  const result = await window.API.newAction({param1: value1, param2: value2});
  if (!result.success) {
    showError(result.message);
    return;
  }
  showSuccess('สำเร็จ', result.message);
}
```

---

## 📚 Advanced Features

### Request Cancellation
```javascript
// In api.js - each request gets a new AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
// User can cancel via cancel button without waiting 20 seconds
```

### Retry Logic Details
```javascript
// Retry on:
// - Timeout (AbortError)
// - Network errors
// - 5xx server errors (500, 502, 503, 504)

// Don't retry on:
// - 4xx client errors (400, 401, 403, 404)
// - JSON parse errors
// - Max retries reached

// Backoff formula: BASE_DELAY × 2^retryCount
// 1st attempt: immediate
// 2nd attempt: wait 800ms
// 3rd attempt: wait 1600ms
```

### Response Shape Validation
```javascript
// Guards against incomplete backend responses
const validation = window.Validators.validateResponseShape(
  backendData,
  ['reference', 'stops', 'alcohol']  // required fields
);
if (!validation.valid) {
  // Handle incomplete response gracefully
}
```

---

## 🎓 Learning Path

1. **Understand the flow:** Read this architecture doc
2. **Explore each module:** Open `config.js`, `logger.js`, `constants.js`, `validators.js`, `api.js`
3. **See usage:** Find refactored functions in `test.html` (search, doAlcoholCheck, etc.)
4. **Add new feature:** Follow "Adding a New API Endpoint" guide above
5. **Debug:**  Use `window.Logger` at dev console or check network tab

---

## 🔮 Future Enhancements

1. **✨ Service Worker** - Offline support, cache HTML/CSS/JS
2. **✨ Input Debouncing** - Debounce search (500ms), abort previous request
3. **✨ Request Queuing** - Queue failed requests, retry when online
4. **✨ Analytics** - Track user flows, error rates
5. **✨ i18n Switch** - Runtime language switching
6. **✨ Micro-frontends** - Load drivers/customers as separate micro-apps
7. **✨ PWA** - Full offline-first mobile app
8. **✨ A/B Testing** - Swap messages/flow for testing

---

## 📞 Support

- **Logging Issues:** Check `window.Logger.currentLevel` in console
- **API Errors:** Check Network tab + `window.Logger` output
- **Validation Issues:** Test with `window.Validators.validate*(value)`
- **Constants Issues:** Search `window.CONSTANTS` in console

---

## 📝 Changelog

### v2.0 - Modular Architecture (Current)
- ✅ Created logger.js with 4 log levels
- ✅ Created constants.js with 100+ config items
- ✅ Created validators.js with 6 validators
- ✅ Created api.js with 7 API methods + retry logic
- ✅ Refactored 7 main functions to use new modules
- ✅ Added JSDoc comments for IDE support
- ✅ Kept backward compatibility with GAS backend

### v1.0 - Original Monolithic
- Basic functionality working
- Inline fetch calls
- Scattered error messages
- No retry logic
- No structured logging

---

**Last Updated:** 2025-01-30  
**Version:** 2.0 (Production)  
**Status:** ✅ Ready for Deployment
