# Quick Reference Guide - Driver App Modules

## 🎯 At a Glance

| Module | Purpose | Usage |
|--------|---------|-------|
| `config.js` | Environment config | `window.CONFIG.LIFF_ID`, `window.CONFIG.WEB_APP_URL` |
| `logger.js` | Structured logging | `window.Logger.info/warn/error(label, data)` |
| `constants.js` | Config & messages | `window.CONSTANTS.MESSAGES.SUCCESS_*`, `window.CONSTANTS.VALIDATION.*` |
| `validators.js` | Input validation | `window.Validators.validate*(value)` returns `{valid, error?, value?}` |
| `api.js` | HTTP layer + retry | `window.API.search()`, `window.API.updateStop()`, etc. |

---

## 📖 Module API Reference

### logger.js
```javascript
// Log levels: DEBUG (0) < INFO (1) < WARN (2) < ERROR (3)
window.Logger.debug(label, data)    // Only in dev mode
window.Logger.info(label, data)     // Always
window.Logger.warn(label, data)     // Always
window.Logger.error(label, data)    // Always

// Grouping (dev only)
window.Logger.group('Section name')
window.Logger.info('Sub-item 1', data)
window.Logger.info('Sub-item 2', data)
window.Logger.groupEnd()

// Examples
window.Logger.info('✅ Search completed', {stops: 5, drivers: 2})
window.Logger.error('❌ Network timeout', {url, timeout: 20000})
```

### constants.js
```javascript
// API Configuration
CONSTANTS.API.TIMEOUT_MS              // 20000
CONSTANTS.API.MAX_RETRIES             // 2
CONSTANTS.API.RETRY_DELAY_MS          // 800
CONSTANTS.API.WEB_APP_URL             // GAS URL

// Validation Ranges
CONSTANTS.VALIDATION.ODOMETER_MIN     // 0
CONSTANTS.VALIDATION.ODOMETER_MAX     // 3000000
CONSTANTS.VALIDATION.ALCOHOL_MIN      // 0.0
CONSTANTS.VALIDATION.ALCOHOL_MAX      // 2.0
CONSTANTS.VALIDATION.IMAGE_MAX_SIZE_MB // 5
CONSTANTS.VALIDATION.REFERENCE_MIN_LENGTH // 3
CONSTANTS.VALIDATION.REFERENCE_MAX_LENGTH // 50

// All Messages (Thai)
CONSTANTS.MESSAGES.SUCCESS_CHECKIN
CONSTANTS.MESSAGES.ERROR_GPS
CONSTANTS.MESSAGES.LOADING_GET_COORDINATES
// ... 40+ more messages

// Stop Status
CONSTANTS.STOP_STATUS.CHECKIN
CONSTANTS.STOP_STATUS.CHECKOUT
CONSTANTS.STOP_STATUS.FUELING
CONSTANTS.STOP_STATUS.UNLOAD_DONE

// Storage Keys
CONSTANTS.STORAGE_KEYS.LAST_SEARCH
CONSTANTS.STORAGE_KEYS.USER_PREFS
```

### validators.js
```javascript
// All return {valid: boolean, error?: string, value?: any}

// Validate reference (3-50 chars)
window.Validators.validateReference('WH1234')
// → {valid: true, value: 'WH1234'}

// Validate odometer (0-3M)
window.Validators.validateOdometer('123456')
// → {valid: true, value: 123456}

// Validate alcohol (0.00-2.00)
window.Validators.validateAlcohol('0.50')
// → {valid: true, value: 0.50}

// Validate image (mime type, ≤5MB)
window.Validators.validateImage(fileObject)
// → {valid: false, error: 'ขนาดรูปต้องไม่เกิน 5 MB'}

// Validate coordinates (±90 lat, ±180 lng)
window.Validators.validateCoordinates(13.7563, 100.5018)
// → {valid: true, value: {lat: 13.7563, lng: 100.5018}}

// Validate response shape
window.Validators.validateResponseShape(response, ['reference', 'stops'])
// → {valid: true, error?: undefined}
```

### api.js (All Methods)
```javascript
// All API methods return {success: boolean, data?: any, message?: string}
// All methods have built-in retry logic, timeout, and logging

// 1. Search for job
await window.API.search(keyword, userId)
// → {success, data: {reference, stops, alcohol, drivers, ...}}

// 2. Update stop status (check-in/out, fuel, unload)
await window.API.updateStop({
  rowIndex, status, type, userId, lat, lng, odo?
})
// → {success, data: {stop}}

// 3. Upload alcohol check with photo
await window.API.uploadAlcohol({
  reference, driverName, userId, alcoholValue, lat, lng, imageBase64
})
// → {success, data: {checkedDrivers: [...]}}

// 4. Upload customer review & signature
await window.API.uploadReview({
  reference, rowIndex, userId, score, lat, lng, signatureBase64
})
// → {success, data: {stop}}

// 5. Fill missing data before end-trip
await window.API.fillMissingSteps({
  reference, userId, lat, lng, missingData
})
// → {success, data: {...}}

// 6. End trip with odometer & location
await window.API.endTrip({
  reference, userId, endOdo, endPointName, lat, lng
})
// → {success, data: {...}}

// 7. Close job (mark vehicle ready)
await window.API.closeJob({reference, userId})
// → {success, data: {stop}}
```

---

## 🧪 Usage Examples

### Example 1: Search with Error Handling
```javascript
async function search() {
  const keyword = document.getElementById('keyword').value.trim();
  
  if (!keyword) {
    showInfo(CONSTANTS.MESSAGES.INFO_SEARCH_EMPTY);
    return;
  }
  
  showLoading(CONSTANTS.MESSAGES.LOADING_SEARCH);
  
  try {
    const result = await window.API.search(keyword, currentUserId);
    closeLoading();
    
    if (!result.success) {
      showError(result.message); // Already localized by API
      return;
    }
    
    // Use result.data
    renderSummary(result.data);
    
  } catch (err) {
    window.Logger.error('❌ Search error', err);
    closeLoading();
    showError(CONSTANTS.MESSAGES.ERROR_NETWORK);
  }
}
```

### Example 2: Form with Validation
```javascript
const { value: formValues } = await Swal.fire({
  title: CONSTANTS.MESSAGES.ALCOHOL_TITLE,
  html: `<input id="alcoholVal" type="number" min="0" step="0.01">`,
  preConfirm: () => {
    const val = document.getElementById('alcoholVal').value;
    
    // Use centralized validator
    const validation = window.Validators.validateAlcohol(val);
    if (!validation.valid) {
      Swal.showValidationMessage(validation.error);
      return false;
    }
    
    // validation.value is already coerced to proper float
    return {alcoholValue: validation.value};
  }
});
```

### Example 3: GPS with Fallback
```javascript
try {
  pos = await getCurrentPositionAsync();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  
} catch (err) {
  window.Logger.warn('GPS unavailable', err);
  
  // Ask user to enter manually
  const {value} = await Swal.fire({
    html: `
      <input id="lat" placeholder="Latitude" type="number" step="0.0001">
      <input id="lng" placeholder="Longitude" type="number" step="0.0001">
    `,
    preConfirm: () => {
      const coordValidation = window.Validators.validateCoordinates(
        parseFloat(document.getElementById('lat').value),
        parseFloat(document.getElementById('lng').value)
      );
      if (!coordValidation.valid) {
        Swal.showValidationMessage(coordValidation.error);
        return false;
      }
      return coordValidation.value;
    }
  });
  
  lat = value.lat;
  lng = value.lng;
}

// Now proceed with API call
const result = await window.API.updateStop({...lat, lng, ...});
```

### Example 4: Logging Pattern
```javascript
function checkMissingSteps() {
  window.Logger.group('Checking missing steps');
  
  const missing = [];
  if (!alcoholCheckDone) {
    window.Logger.info('Missing', {step: 'alcohol check'});
    missing.push('alcohol');
  }
  if (!allStopsVisited) {
    window.Logger.warn('Missing', {step: 'all stops'});
    missing.push('stops');
  }
  
  window.Logger.groupEnd();
  return missing;
}
// Output: All grouped under "Checking missing steps" in console
```

---

## 🐛 Debugging Tips

### Check Logger Level
```javascript
window.Logger.currentLevel  // 0=dev (all), 1=prod (no debug)
```

### Test Validator
```javascript
// In browser console
window.Validators.validateOdometer('abc')
// {valid: false, error: 'เลขไมล์ต้องเป็นตัวเลข 0 - 3,000,000'}

window.Validators.validateAlcohol('1.5')
// {valid: true, value: 1.5}
```

### Check Constants
```javascript
// In browser console
window.CONSTANTS.VALIDATION.ODOMETER_MAX  // 3000000
window.CONSTANTS.MESSAGES.ERROR_GPS       // 'ไม่สามารถดึงพิกัด...'
Object.keys(window.CONSTANTS.MESSAGES)    // All available messages
```

### Monitor API Calls
```javascript
// window.Logger automatically logs API calls with:
// - Request parameters (masked)
// - Retry attempts
// - Final success/failure
// - Response data (structured)

// Check network tab for actual HTTP requests
```

---

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Module not found (e.g., `window.API is undefined`) | Modules loaded in wrong order | Check `<script>` tags are in correct order (config → logger → constants → validators → api → main) |
| Validation error shows wrong message | Typo in CONSTANTS.MESSAGES key | Use IDE autocomplete: `CONSTANTS.MESSAGES.` then select from list |
| API call never returns | Timeout or network issue | Check Network tab; Logger will show retry attempts; max wait is 20s + (800ms + 1600ms backoff) |
| Getting `{success: false, message: "..."}` | Backend returned error | This is normal; display `message` to user via `showError(result.message)` |
| Coordinates validation fails | Invalid range | Latitude must be ±90, Longitude must be ±180; use `validateCoordinates()` |

---

## 📏 Module Size Reference

| Module | Lines | Uncompressed |
|--------|-------|--------------|
| config.js | 8 | <1 KB |
| logger.js | 60 | ~2 KB |
| constants.js | 100+ | ~4 KB |
| validators.js | 180 | ~5 KB |
| api.js | 350+ | ~12 KB |
| **Total** | **~700** | **~23 KB** |

All modules together = smaller than 1 network request!

---

## 🔄 Retry Strategy

```javascript
// Automatic retry on:
fetch(url) → timeout (20s) ❌ → wait 800ms → retry
           → network error ❌ → wait 800ms → retry
           → 502 Bad Gateway ❌ → wait 800ms → retry
           → 2nd timeout ❌ → wait 1600ms → retry
           → 2nd 502 ❌ → wait 1600ms → retry
           → 3rd attempt fails → STOP, return error
           
// No retry on:
fetch(url) → 404 Not Found ❌ → STOP (don't retry 4xx)
           → JSON parse error ❌ → STOP (data is corrupted)
           → 2 max retries reached ❌ → STOP
```

---

## 🎁 Best Practices

✅ **DO:**
- Use `window.API.*` for all backend calls
- Use `window.CONSTANTS.MESSAGES.*` for all user messages
- Use `window.Validators.*` for input validation
- Use `window.Logger.*` for debugging
- Check `result.success` before using `result.data`

❌ **DON'T:**
- Don't use `fetch()` directly; use `window.API.*`
- Don't hardcode error messages; use CONSTANTS
- Don't validate inline; use `window.Validators.*`
- Don't use `console.log()`; use `window.Logger.*`
- Don't assume backend response is complete; validate shape

---

**Last Updated:** 2025-01-30  
**Status:** ✅ Production Ready
